import type {
  FieldMapping,
  IssueEvent,
  IssueEventField,
  IssueSnapshot,
  WorkingState,
} from '../../domain/types';
import type { JiraChangelogEntry } from '../../sla/types';
import type { JiraIssueWithDynamicFields } from '../../api/jira';

export interface JiraHistoryItem {
  field: IssueEventField;
  from?: string;
  to?: string;
}

export interface JiraHistoryEntry {
  id: string;
  created: string;
  items: JiraHistoryItem[];
}

export interface JiraIssueFixture {
  key: string;
  fields: {
    projectKey: string;
    summary: string;
    created: string;
    updated: string;
    initialAssigneeAccountId?: string;
    initialTeamLabel?: string;
    initialOwnershipLabel?: string;
    initialStatus: string;
    initialPriority: string;
    resolutionDate?: string;
  };
  changelog: JiraHistoryEntry[];
}

const toInitialState = (issue: JiraIssueFixture): WorkingState => ({
  assigneeAccountId: issue.fields.initialAssigneeAccountId,
  teamLabel: issue.fields.initialTeamLabel,
  ownershipLabel: issue.fields.initialOwnershipLabel,
  status: issue.fields.initialStatus,
  priority: issue.fields.initialPriority,
  resolved: false,
});

const toEvent = (historyId: string, created: string, item: JiraHistoryItem): IssueEvent => ({
  kind: 'change',
  field: item.field,
  timestamp: created,
  changelogId: `${historyId}:${item.field}`,
  sourceFieldName: item.field,
  from: item.from,
  to: item.to,
});

export const normalizeJiraIssue = (issue: JiraIssueFixture): IssueSnapshot => ({
  issueKey: issue.key,
  projectKey: issue.fields.projectKey,
  summary: issue.fields.summary,
  createdAt: issue.fields.created,
  updatedAt: issue.fields.updated,
  initialState: toInitialState(issue),
  events: issue.changelog.flatMap((entry) => entry.items.map((item) => toEvent(entry.id, entry.created, item))),
});

const extractFieldLabel = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractFieldLabel).find((item): item is string => Boolean(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.value, record.name, record.displayName, record.title, record.label];
    return candidates.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return undefined;
};

const extractAccountId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.accountId, record.id, record.key, record.value];
    return candidates.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return undefined;
};

const getMappedValue = (
  fields: JiraIssueWithDynamicFields['fields'],
  primaryKey: string | undefined,
  fallbackKey: string,
): unknown => {
  if (primaryKey && fields[primaryKey] !== undefined) {
    return fields[primaryKey];
  }
  return fields[fallbackKey];
};

const toLiveInitialState = (
  issue: JiraIssueWithDynamicFields,
  fieldMapping?: FieldMapping,
): WorkingState => ({
  assigneeAccountId:
    extractAccountId(getMappedValue(issue.fields, fieldMapping?.assigneeFieldKey, 'assignee'))
    ?? issue.fields.assignee?.accountId,
  teamLabel: fieldMapping?.teamFieldKey
    ? extractFieldLabel(issue.fields[fieldMapping.teamFieldKey])
    : undefined,
  ownershipLabel: fieldMapping?.ownershipFieldKey
    ? extractFieldLabel(issue.fields[fieldMapping.ownershipFieldKey])
    : fieldMapping?.responsibleOrganizationFieldKey
      ? extractFieldLabel(issue.fields[fieldMapping.responsibleOrganizationFieldKey])
      : undefined,
  status:
    extractFieldLabel(getMappedValue(issue.fields, fieldMapping?.statusFieldKey, 'status'))
    ?? issue.fields.status?.name
    ?? 'Unknown',
  priority:
    extractFieldLabel(getMappedValue(issue.fields, fieldMapping?.priorityFieldKey, 'priority'))
    ?? issue.fields.priority?.name
    ?? 'Unknown',
  resolved: Boolean(
    getMappedValue(issue.fields, fieldMapping?.resolutionFieldKey, 'resolutiondate'),
  ),
});

const mapLiveChangeField = (
  field: string,
  fieldId: string | undefined,
  fieldMapping?: FieldMapping,
): IssueEventField | undefined => {
  if (field === (fieldMapping?.assigneeFieldKey ?? 'assignee') || fieldId === fieldMapping?.assigneeFieldKey || field === 'assignee') {
    return 'assignee';
  }
  if (field === (fieldMapping?.statusFieldKey ?? 'status') || fieldId === fieldMapping?.statusFieldKey || field === 'status') {
    return 'status';
  }
  if (field === (fieldMapping?.priorityFieldKey ?? 'priority') || fieldId === fieldMapping?.priorityFieldKey || field === 'priority') {
    return 'priority';
  }
  if (field === (fieldMapping?.resolutionFieldKey ?? 'resolution') || fieldId === fieldMapping?.resolutionFieldKey || field === 'resolution') {
    return 'resolution';
  }
  if (
    fieldMapping?.teamFieldKey
    && (fieldId === fieldMapping.teamFieldKey || field === fieldMapping.teamFieldKey)
  ) {
    return 'team';
  }
  if (
    fieldMapping?.ownershipFieldKey
    && (fieldId === fieldMapping.ownershipFieldKey || field === fieldMapping.ownershipFieldKey)
  ) {
    return 'ownership';
  }
  if (
    fieldMapping?.responsibleOrganizationFieldKey
    && (fieldId === fieldMapping.responsibleOrganizationFieldKey || field === fieldMapping.responsibleOrganizationFieldKey)
  ) {
    return 'ownership';
  }
  return undefined;
};

export const normalizeLiveJiraIssue = ({
  issue,
  changelog,
  fieldMapping,
}: {
  issue: JiraIssueWithDynamicFields;
  changelog: JiraChangelogEntry[];
  fieldMapping?: FieldMapping;
}): IssueSnapshot => ({
  issueKey: issue.key,
  projectKey: issue.fields.project.key,
  summary: issue.fields.summary,
  createdAt: issue.fields.created,
  updatedAt: issue.fields.updated,
  initialState: toLiveInitialState(issue, fieldMapping),
  events: changelog.flatMap((entry) =>
    entry.items.flatMap((item) => {
      const field = mapLiveChangeField(item.field, item.fieldId, fieldMapping);
      if (!field) {
        return [];
      }
      return [
        {
          kind: 'change' as const,
          field,
          timestamp: entry.created,
          changelogId: `${entry.id}:${field}`,
          sourceFieldId: item.fieldId,
          sourceFieldName: item.field,
          from: field === 'resolution' ? item.fromString ?? item.from ?? undefined : item.from ?? item.fromString ?? undefined,
          to: field === 'resolution' ? item.toString ?? item.to ?? undefined : item.to ?? item.toString ?? undefined,
        },
      ];
    }),
  ),
});

export const extractTeamLabel = (value: unknown): string | undefined => extractFieldLabel(value);
