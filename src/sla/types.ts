// ─── Domain types ───────────────────────────────────────────────────────────

export type SegmentType =
  | 'response'
  | 'active'
  | 'paused'
  | 'waiting'
  | 'outside-hours'
  | 'stopped';

export type SlaState = 'active' | 'paused' | 'stopped' | 'breached' | 'met';

export type StartMode = 'assignment' | 'status';

export type PriorityMode = 'business-hours' | '24x7';

// ─── Storage entity types ────────────────────────────────────────────────────

/**
 * Stores business rules per customer / project.
 */
export interface RuleSet {
  ruleSetId: string;
  name: string;
  projectKeys: string[];
  teamIds: string[];
  trackedAssigneeAccountIds: string[];
  startMode: StartMode;
  activeStatuses: string[];
  pausedStatuses: string[];
  stoppedStatuses: string[];
  resumeRules: ResumeRule[];
  businessCalendarId: string;
  timezone: string;
  priorityOverrides: Record<string, PriorityOverride>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeRule {
  fromStatus: string;
  toStatus: string;
}

export interface PriorityOverride {
  mode: PriorityMode;
  slaTargetMinutes?: number;
}

/**
 * Defines working hours and holidays for a calendar.
 */
export interface BusinessCalendar {
  calendarId: string;
  name: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday */
  workingDays: number[];
  workingHoursStart: string; // e.g. "09:00"
  workingHoursEnd: string;   // e.g. "18:00"
  holidayDates: string[];    // ISO date strings "YYYY-MM-DD"
  afterHoursMode: PriorityMode;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tracks incremental changelog processing per issue.
 */
export interface IssueCheckpoint {
  issueKey: string;
  ruleSetId: string;
  lastProcessedChangelogId: string | null;
  lastProcessedAt: string | null;
  lastIssueUpdated: string | null;
  summaryVersion: number;
  needsRebuild: boolean;
}

/**
 * One computed interval for an issue.
 */
export interface IssueSlaSegment {
  segmentId: string;
  issueKey: string;
  ruleSetId: string;
  ruleSetVersion: number;
  assigneeAccountId: string | null;
  teamLabel: string | null;
  status: string;
  priority: string;
  segmentType: SegmentType;
  startedAt: string;   // ISO timestamp
  endedAt: string;     // ISO timestamp
  rawSeconds: number;
  businessSeconds: number;
  sourceEventStart: string | null;
  sourceEventEnd: string | null;
}

/**
 * Precomputed rollup per issue.
 */
export interface IssueSummary {
  issueKey: string;
  ruleSetId: string;
  projectKey: string;
  currentState: SlaState;
  currentStatus: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  outsideHoursSeconds: number;
  breachState: boolean;
  breachThresholdMinutes: number | null;
  currentAssignee: string | null;
  currentTeam: string | null;
  currentPriority: string;
  slaStartedAt: string | null;
  perAssigneeTotals: Record<string, number>;
  perTeamTotals: Record<string, number>;
  lastRecomputedAt: string;
  summaryVersion: number;
}

/**
 * Optional daily aggregate cache for dashboard queries.
 */
export interface AggregateDaily {
  ruleSetId: string;
  date: string; // "YYYY-MM-DD"
  projectKey: string;
  assigneeAccountId: string | null;
  teamLabel: string | null;
  priority: string;
  ticketCount: number;
  avgResponseSeconds: number;
  avgActiveSeconds: number;
  breachCount: number;
}

export type RebuildScope = 'issue' | 'project-window' | 'scheduled';

export type RebuildJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface RebuildJob {
  jobId: string;
  scope: RebuildScope;
  status: RebuildJobStatus;
  projectKey: string | null;
  issueKey: string | null;
  ruleSetId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  processedIssueCount: number;
  errorCount: number;
  durationMs: number | null;
  message: string | null;
}

// ─── Jira API types ──────────────────────────────────────────────────────────

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    status: { name: string };
    priority: { name: string };
    assignee: { accountId: string; displayName: string } | null;
    created: string;
    updated: string;
    resolutiondate: string | null;
    project: { key: string; name: string };
  };
}

export interface JiraChangelogEntry {
  id: string;
  created: string;
  author: { accountId: string; displayName: string };
  items: JiraChangelogItem[];
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraWorklog {
  id: string;
  author: { accountId: string; displayName: string };
  started: string;
  timeSpentSeconds: number;
  comment?: string;
}

// ─── Internal computation types ──────────────────────────────────────────────

export type EventType =
  | 'issue_created'
  | 'assignee_changed'
  | 'status_changed'
  | 'priority_changed'
  | 'resolution_set'
  | 'resolution_cleared';

export interface NormalizedEvent {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  /** Old value before this change */
  from: string | null;
  /** New value after this change */
  to: string | null;
}

export interface IssueState {
  assigneeAccountId: string | null;
  status: string;
  priority: string;
  resolved: boolean;
}
