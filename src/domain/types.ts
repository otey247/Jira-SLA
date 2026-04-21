export type TimingMode = 'business-hours' | '24x7';
export type StartMode =
  | 'assignment'
  | 'status'
  | 'assignment-or-status'
  | 'ownership-field';
export type SegmentType =
  | 'untracked'
  | 'response'
  | 'active'
  | 'paused'
  | 'waiting'
  | 'outside-hours'
  | 'stopped';
export type BreachState = 'healthy' | 'warning' | 'breached';
export type SurfaceKind = 'projectPage' | 'issuePanel' | 'dashboardGadget';
export type OwnershipSource = 'ownership' | 'team' | 'assignee';

export interface ResumeRule {
  fromStatus?: string;
  toStatus: string;
}

export interface PriorityOverride {
  priority: string;
  timingMode?: TimingMode;
  responseThresholdSeconds?: number;
  activeThresholdSeconds?: number;
}

export interface FieldMapping {
  fieldMappingId: string;
  name: string;
  assigneeFieldKey?: string;
  statusFieldKey?: string;
  priorityFieldKey?: string;
  resolutionFieldKey?: string;
  teamFieldKey?: string;
  ownershipFieldKey?: string;
  responsibleOrganizationFieldKey?: string;
}

export interface RuleSet {
  ruleSetId: string;
  name: string;
  version: number;
  projectKeys: string[];
  fieldMappingId?: string;
  trackedAssignees: string[];
  trackedTeams: string[];
  trackedOwnershipValues: string[];
  ownershipPrecedence: OwnershipSource[];
  startMode: StartMode;
  activeStatuses: string[];
  pausedStatuses: string[];
  stoppedStatuses: string[];
  resumeStatuses: string[];
  resumeRules: ResumeRule[];
  businessCalendarId: string;
  priorityOverrides: PriorityOverride[];
  enabled: boolean;
  defaultTimingMode: TimingMode;
  defaultResponseThresholdSeconds: number;
  defaultActiveThresholdSeconds: number;
}

export interface BusinessCalendar {
  calendarId: string;
  name: string;
  timezone: string;
  workingDays: number[];
  workingHours: {
    start: string;
    end: string;
  };
  holidays: string[];
  afterHoursMode: TimingMode;
}

export interface WorkingState {
  assigneeAccountId?: string;
  teamLabel?: string;
  ownershipLabel?: string;
  status: string;
  priority: string;
  resolved: boolean;
}

export type IssueEventField =
  | 'assignee'
  | 'team'
  | 'ownership'
  | 'status'
  | 'priority'
  | 'resolution';

export interface IssueEvent {
  kind: 'change';
  field: IssueEventField;
  timestamp: string;
  changelogId: string;
  sourceFieldId?: string;
  sourceFieldName?: string;
  from?: string;
  to?: string;
}

export interface IssueSnapshot {
  issueKey: string;
  projectKey: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  initialState: WorkingState;
  events: IssueEvent[];
}

export interface IssueSegment {
  segmentId: string;
  issueKey: string;
  ruleSetId: string;
  ruleVersion: number;
  assigneeAccountId?: string;
  teamLabel?: string;
  ownershipLabel?: string;
  status: string;
  priority: string;
  segmentType: SegmentType;
  startedAt: string;
  endedAt: string;
  rawSeconds: number;
  businessSeconds: number;
  reason: string;
  sourceEventStart: string;
  sourceEventEnd: string;
  countsTowardResponse: boolean;
  countsTowardActive: boolean;
}

export interface AssigneeMetric {
  assigneeAccountId: string;
  responseSeconds: number;
  activeSeconds: number;
  segmentCount: number;
}

export interface IssueSummary {
  issueKey: string;
  projectKey: string;
  summary: string;
  ruleSetId: string;
  ruleVersion: number;
  currentState: SegmentType;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  waitingSeconds: number;
  outsideHoursSeconds: number;
  breachState: BreachState;
  currentAssignee?: string;
  currentTeam?: string;
  currentOwnership?: string;
  currentPriority: string;
  recomputedAt: string;
  slaStartedAt?: string;
  timelineExplanation: string[];
  assigneeMetrics: AssigneeMetric[];
}

export interface IssueCheckpoint {
  issueKey: string;
  ruleSetId: string;
  lastProcessedChangelogId: string;
  lastIssueUpdatedTimestamp: string;
  lastRecomputedAt: string;
  summaryVersion: number;
  needsRebuild: boolean;
}

export interface AggregateDaily {
  date: string;
  projectKey: string;
  assigneeAccountId?: string;
  teamLabel?: string;
  priority: string;
  ticketCount: number;
  avgResponseSeconds: number;
  avgActiveSeconds: number;
  breachCount: number;
}

export interface RebuildJob {
  jobId: string;
  issueKey: string;
  source: 'seed' | 'manual' | 'scheduled' | 'automation';
  status: 'queued' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  message: string;
}

export interface IssueSearchFilters {
  projectKey?: string;
  assigneeAccountId?: string;
  priority?: string;
  breachState?: BreachState;
  status?: string;
  query?: string;
}

export interface OverviewMetrics {
  issueCount: number;
  breachCount: number;
  averageResponseSeconds: number;
  averageActiveSeconds: number;
  totalPausedSeconds: number;
}

export interface DashboardMetric {
  label: string;
  valueSeconds: number;
  count: number;
}

export interface SelectorOption {
  value: string;
  label: string;
  description?: string;
}

export interface AdminMetadata {
  projects: SelectorOption[];
  assignees: SelectorOption[];
  teams: SelectorOption[];
  statuses: string[];
  jiraFields: SelectorOption[];
  warnings: string[];
  teamFieldConfigured: boolean;
  teamFieldKey?: string;
  fieldMappingDiagnostics: Array<{
    fieldMappingId: string;
    valid: boolean;
    messages: string[];
  }>;
}

export interface BootstrapRequest {
  surface: SurfaceKind;
  issueKey?: string;
  refresh?: boolean;
}

export interface BootstrapData {
  surface: SurfaceKind;
  selectedIssueKey?: string;
  summaries: IssueSummary[];
  selectedIssue?: {
    summary: IssueSummary;
    segments: IssueSegment[];
  };
  ruleSets: RuleSet[];
  fieldMappings: FieldMapping[];
  calendars: BusinessCalendar[];
  rebuildJobs: RebuildJob[];
  overview: OverviewMetrics;
  assigneeMetrics: DashboardMetric[];
  teamMetrics: DashboardMetric[];
  breachMetrics: Array<{ priority: string; count: number }>;
  adminMetadata: AdminMetadata;
}

export interface IssueComputationResult {
  segments: IssueSegment[];
  summary: IssueSummary;
  checkpoint: IssueCheckpoint;
}
