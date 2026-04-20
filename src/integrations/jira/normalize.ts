import type { IssueEvent, IssueEventField, IssueSnapshot, WorkingState } from '../../domain/types';
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
    initialStatus: string;
    initialPriority: string;
    resolutionDate?: string;
  };
  changelog: JiraHistoryEntry[];
}

const toInitialState = (issue: JiraIssueFixture): WorkingState => ({
  assigneeAccountId: issue.fields.initialAssigneeAccountId,
  teamLabel: issue.fields.initialTeamLabel,
  status: issue.fields.initialStatus,
  priority: issue.fields.initialPriority,
  resolved: false,
});

const toEvent = (historyId: string, created: string, item: JiraHistoryItem): IssueEvent => ({
  kind: 'change',
  field: item.field,
  timestamp: created,
  changelogId: `${historyId}:${item.field}`,
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

const toLiveInitialState = (
  issue: JiraIssueWithDynamicFields,
  teamFieldKey?: string,
): WorkingState => ({
  assigneeAccountId: issue.fields.assignee?.accountId,
  teamLabel: teamFieldKey ? extractFieldLabel(issue.fields[teamFieldKey]) : undefined,
  status: issue.fields.status?.name ?? 'Unknown',
  priority: issue.fields.priority?.name ?? 'Unknown',
  resolved: Boolean(issue.fields.resolutiondate),
});

const mapLiveChangeField = (
  field: string,
  fieldId: string | undefined,
  teamFieldKey?: string,
): IssueEventField | undefined => {
  if (field === 'assignee') {
    return 'assignee';
  }
  if (field === 'status') {
    return 'status';
  }
  if (field === 'priority') {
    return 'priority';
  }
  if (field === 'resolution') {
    return 'resolution';
  }
  if (teamFieldKey && (fieldId === teamFieldKey || field === teamFieldKey)) {
    return 'team';
  }
  return undefined;
};

export const normalizeLiveJiraIssue = ({
  issue,
  changelog,
  teamFieldKey,
}: {
  issue: JiraIssueWithDynamicFields;
  changelog: JiraChangelogEntry[];
  teamFieldKey?: string;
}): IssueSnapshot => ({
  issueKey: issue.key,
  projectKey: issue.fields.project.key,
  summary: issue.fields.summary,
  createdAt: issue.fields.created,
  updatedAt: issue.fields.updated,
  initialState: toLiveInitialState(issue, teamFieldKey),
  events: changelog.flatMap((entry) =>
    entry.items.flatMap((item) => {
      const field = mapLiveChangeField(item.field, item.fieldId, teamFieldKey);
      if (!field) {
        return [];
      }
      return [
        {
          kind: 'change' as const,
          field,
          timestamp: entry.created,
          changelogId: `${entry.id}:${field}`,
          from: field === 'resolution' ? item.fromString ?? item.from ?? undefined : item.from ?? item.fromString ?? undefined,
          to: field === 'resolution' ? item.toString ?? item.to ?? undefined : item.to ?? item.toString ?? undefined,
        },
      ];
    }),
  ),
});

export const extractTeamLabel = (value: unknown): string | undefined => extractFieldLabel(value);
