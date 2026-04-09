import type { IssueEvent, IssueEventField, IssueSnapshot, WorkingState } from '../../domain/types';

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
  resolved: Boolean(issue.fields.resolutionDate),
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
