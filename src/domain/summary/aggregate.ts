import type {
  AssigneeMetric,
  BusinessCalendar,
  IssueSegment,
  IssueSnapshot,
  IssueSummary,
  RuleSet,
} from '../types';
import { getEffectiveSlaPolicy } from '../rules/policy';

const WARNING_THRESHOLD = 0.8;

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
  responseStartedAt,
  activeStartedAt,
  recomputedAt,
  computeRunId,
  derivedDataStatus = 'complete',
}: {
  snapshot: IssueSnapshot;
  ruleSet: RuleSet;
  calendar: BusinessCalendar;
  segments: IssueSegment[];
  slaStartedAt?: string;
  responseStartedAt?: string;
  activeStartedAt?: string;
  recomputedAt: string;
  computeRunId: string;
  derivedDataStatus?: IssueSummary['derivedDataStatus'];
}): IssueSummary => {
  const responseSeconds = segments.reduce((total, segment) => total + (segment.countsTowardResponse ? segment.businessSeconds : 0), 0);
  const activeSeconds = segments.reduce((total, segment) => total + (segment.countsTowardActive ? segment.businessSeconds : 0), 0);
  const pausedSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'paused' ? segment.rawSeconds : 0), 0);
  const waitingSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'waiting' ? segment.rawSeconds : 0), 0);
  const outsideHoursSeconds = segments.reduce((total, segment) => total + (segment.segmentType === 'outside-hours' ? segment.rawSeconds : 0), 0);
  const combinedSeconds = responseSeconds + activeSeconds;
  const assigneeMetrics = getAssigneeMetrics(segments);
  const currentState = segments.at(-1)?.segmentType ?? 'untracked';
  const lastMeasuredAt = segments.at(-1)?.endedAt ?? recomputedAt;
  const resolutionAnchor = activeStartedAt ?? responseStartedAt ?? slaStartedAt;
  const resolutionSeconds = resolutionAnchor
    ? Math.max(0, Math.round((new Date(lastMeasuredAt).getTime() - new Date(resolutionAnchor).getTime()) / 1000))
    : 0;

  const summary: IssueSummary = {
    issueKey: snapshot.issueKey,
    projectKey: snapshot.projectKey,
    summary: snapshot.summary,
    ruleSetId: ruleSet.ruleSetId,
    ruleVersion: ruleSet.version,
    computeRunId,
    derivedDataStatus,
    currentState,
    responseSeconds,
    activeSeconds,
    pausedSeconds,
    waitingSeconds,
    outsideHoursSeconds,
    combinedSeconds,
    resolutionSeconds,
    breachState: 'healthy',
    breachedClock: undefined,
    effectivePolicy: getEffectiveSlaPolicy(ruleSet, snapshot.initialState.priority, calendar.afterHoursMode),
    currentAssignee: snapshot.initialState.assigneeAccountId,
    currentTeam: snapshot.initialState.teamLabel,
    currentOwnership: snapshot.initialState.ownershipLabel,
    currentPriority: snapshot.initialState.priority,
    recomputedAt,
    slaStartedAt,
    responseStartedAt,
    activeStartedAt,
    timelineExplanation: segments.map((segment) => `${segment.startedAt} → ${segment.endedAt}: ${segment.reason}`),
    assigneeMetrics,
  };

  const currentSegment = segments.at(-1);
  if (currentSegment) {
    summary.currentAssignee = currentSegment.assigneeAccountId;
    summary.currentTeam = currentSegment.teamLabel;
    summary.currentOwnership = currentSegment.ownershipLabel;
    summary.currentPriority = currentSegment.priority;
    summary.effectivePolicy = getEffectiveSlaPolicy(ruleSet, currentSegment.priority, calendar.afterHoursMode);
  }

  const {
    breachBasis,
    responseThresholdSeconds,
    activeThresholdSeconds,
    combinedThresholdSeconds,
    resolutionThresholdSeconds,
  } = summary.effectivePolicy;

  const ratio = (() => {
    switch (breachBasis) {
      case 'response':
        return responseThresholdSeconds > 0 ? summary.responseSeconds / responseThresholdSeconds : 0;
      case 'active':
        return activeThresholdSeconds > 0 ? summary.activeSeconds / activeThresholdSeconds : 0;
      case 'combined':
        return combinedThresholdSeconds && combinedThresholdSeconds > 0
          ? summary.combinedSeconds / combinedThresholdSeconds
          : 0;
      case 'resolution':
        return resolutionThresholdSeconds && resolutionThresholdSeconds > 0
          ? summary.resolutionSeconds / resolutionThresholdSeconds
          : 0;
      default:
        return 0;
    }
  })();

  if (ratio >= 1) {
    summary.breachState = 'breached';
    summary.breachedClock = breachBasis;
  } else if (ratio >= WARNING_THRESHOLD) {
    summary.breachState = 'warning';
  }

  if (summary.outsideHoursSeconds > 0 && calendar.afterHoursMode === 'business-hours' && summary.currentState === 'outside-hours') {
    summary.timelineExplanation.push('Current interval is outside configured business hours, so no additional business time is accruing.');
  }

  return summary;
};
