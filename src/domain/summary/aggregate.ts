import type {
  AssigneeMetric,
  BreachState,
  BusinessCalendar,
  IssueSegment,
  IssueSnapshot,
  IssueSummary,
  RuleSet,
} from '../types';

const WARNING_THRESHOLD = 0.8;

const getThresholds = (ruleSet: RuleSet, priority: string): { response: number; active: number } => {
  const override = ruleSet.priorityOverrides.find((item) => item.priority === priority);
  return {
    response: override?.responseThresholdSeconds ?? ruleSet.defaultResponseThresholdSeconds,
    active: override?.activeThresholdSeconds ?? ruleSet.defaultActiveThresholdSeconds,
  };
};

const getBreachState = (summary: Pick<IssueSummary, 'responseSeconds' | 'activeSeconds' | 'currentPriority'>, ruleSet: RuleSet): BreachState => {
  const thresholds = getThresholds(ruleSet, summary.currentPriority);
  const responseRatio = thresholds.response > 0 ? summary.responseSeconds / thresholds.response : 0;
  const activeRatio = thresholds.active > 0 ? summary.activeSeconds / thresholds.active : 0;
  const ratio = Math.max(responseRatio, activeRatio);

  if (ratio >= 1) {
    return 'breached';
  }
  if (ratio >= WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'healthy';
};

const getAssigneeMetrics = (segments: IssueSegment[]): AssigneeMetric[] => {
  const metrics = new Map<string, AssigneeMetric>();

  for (const segment of segments) {
    if (!segment.assigneeAccountId) {
      continue;
    }

    const current = metrics.get(segment.assigneeAccountId) ?? {
      assigneeAccountId: segment.assigneeAccountId,
      responseSeconds: 0,
      activeSeconds: 0,
      segmentCount: 0,
    };

    current.segmentCount += 1;
    if (segment.countsTowardResponse) {
      current.responseSeconds += segment.businessSeconds;
    }
    if (segment.countsTowardActive) {
      current.activeSeconds += segment.businessSeconds;
    }

    metrics.set(segment.assigneeAccountId, current);
  }

  return [...metrics.values()].sort((left, right) => right.activeSeconds - left.activeSeconds);
};

export const buildIssueSummary = ({
  snapshot,
  ruleSet,
  calendar,
  segments,
  slaStartedAt,
  recomputedAt,
}: {
  snapshot: IssueSnapshot;
  ruleSet: RuleSet;
  calendar: BusinessCalendar;
  segments: IssueSegment[];
  slaStartedAt?: string;
  recomputedAt: string;
}): IssueSummary => {
  const responseSeconds = segments.reduce((total, segment) => total + (segment.countsTowardResponse ? segment.businessSeconds : 0), 0);
  const activeSeconds = segments.reduce((total, segment) => total + (segment.countsTowardActive ? segment.businessSeconds : 0), 0);
  const pausedSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'paused' ? segment.rawSeconds : 0), 0);
  const waitingSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'waiting' ? segment.rawSeconds : 0), 0);
  const outsideHoursSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'outside-hours' ? segment.rawSeconds : 0), 0);
  const assigneeMetrics = getAssigneeMetrics(segments);
  const currentState = segments.at(-1)?.segmentType ?? 'untracked';

  const summary: IssueSummary = {
    issueKey: snapshot.issueKey,
    projectKey: snapshot.projectKey,
    summary: snapshot.summary,
    ruleSetId: ruleSet.ruleSetId,
    ruleVersion: ruleSet.version,
    currentState,
    responseSeconds,
    activeSeconds,
    pausedSeconds,
    waitingSeconds,
    outsideHoursSeconds,
    breachState: 'healthy',
    currentAssignee: snapshot.initialState.assigneeAccountId,
    currentTeam: snapshot.initialState.teamLabel,
    currentOwnership: snapshot.initialState.ownershipLabel,
    currentPriority: snapshot.initialState.priority,
    recomputedAt,
    slaStartedAt,
    timelineExplanation: segments.map((segment) => `${segment.startedAt} → ${segment.endedAt}: ${segment.reason}`),
    assigneeMetrics,
  };

  const currentSegment = segments.at(-1);
  if (currentSegment) {
    summary.currentAssignee = currentSegment.assigneeAccountId;
    summary.currentTeam = currentSegment.teamLabel;
    summary.currentPriority = currentSegment.priority;
  }

  summary.breachState = getBreachState(summary, ruleSet);
  if (summary.outsideHoursSeconds > 0 && calendar.afterHoursMode === 'business-hours' && summary.currentState === 'outside-hours') {
    summary.timelineExplanation.push('Current interval is outside configured business hours, so no additional business time is accruing.');
  }

  return summary;
};
