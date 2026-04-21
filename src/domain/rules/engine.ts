import { buildIssueSummary } from '../summary/aggregate';
import type {
  BusinessCalendar,
  IssueComputationResult,
  IssueEvent,
  IssueSegment,
  IssueSnapshot,
  RuleSet,
  SegmentType,
  TimingMode,
  WorkingState,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { secondsBetween, splitIntervalByBusinessHours } from './businessHours';
import {
  getEffectiveSlaPolicy,
  isActiveStatus,
  isTrackedOwnership,
  resolveTrackedOwnershipSource,
  shouldStartClock,
} from './policy';
import { shouldResumeFromStatusPause } from './stateMachine';

interface IntervalClassification {
  baseType: SegmentType;
  reason: string;
  timingMode: TimingMode;
}

const isPausedStatus = (state: WorkingState, ruleSet: RuleSet): boolean => ruleSet.pausedStatuses.includes(state.status);
const isStoppedStatus = (state: WorkingState, ruleSet: RuleSet): boolean => state.resolved || ruleSet.stoppedStatuses.includes(state.status);

const getTimingMode = (state: WorkingState, ruleSet: RuleSet, calendar: BusinessCalendar): TimingMode => {
  return getEffectiveSlaPolicy(ruleSet, state.priority, calendar.afterHoursMode).timingMode;
};

const describeWaitingReason = (): string => {
  return 'Timing is waiting because the issue left tracked ownership.';
};

const describePausedReason = (state: WorkingState): string => {
  return `Timing paused because status ${state.status} is configured as a paused state.`;
};

const describeResumeGateReason = (pausedStatus: string): string => (
  `Timing remains paused after leaving ${pausedStatus} until a configured resume rule matches.`
);

const classifyInterval = (
  state: WorkingState,
  ruleSet: RuleSet,
  calendar: BusinessCalendar,
  responseStartedAt: string | undefined,
  activeStartedAt: string | undefined,
  statusPauseGate: { pausedStatus: string } | null,
): IntervalClassification => {
  const timingMode = getTimingMode(state, ruleSet, calendar);
  const policy = getEffectiveSlaPolicy(ruleSet, state.priority, calendar.afterHoursMode);
  const responseEnabled = policy.enabledClocks.includes('response');
  const activeEnabled = policy.enabledClocks.includes('active');
  const hasStarted = Boolean(responseStartedAt || activeStartedAt);

  if (!hasStarted) {
    return {
      baseType: 'untracked',
      reason: 'SLA has not started for the current issue state.',
      timingMode,
    };
  }

  if (isStoppedStatus(state, ruleSet)) {
    return {
      baseType: 'stopped',
      reason: `Timing stopped because status ${state.status} is configured as terminal or the issue is resolved.`,
      timingMode,
    };
  }

  if (!isTrackedOwnership(state, ruleSet)) {
    return {
      baseType: 'waiting',
      reason: describeWaitingReason(),
      timingMode,
    };
  }

  if (isPausedStatus(state, ruleSet)) {
    return {
      baseType: 'paused',
      reason: describePausedReason(state),
      timingMode,
    };
  }

  if (statusPauseGate) {
    return {
      baseType: 'paused',
      reason: describeResumeGateReason(statusPauseGate.pausedStatus),
      timingMode,
    };
  }

  if (activeEnabled && activeStartedAt && isActiveStatus(state, ruleSet)) {
    return {
      baseType: 'active',
      reason: `Active handling time is accruing because status ${state.status} is configured as active and ownership is tracked.`,
      timingMode,
    };
  }

  if (responseEnabled && responseStartedAt && !activeStartedAt) {
    return {
      baseType: 'response',
      reason: 'Response SLA is accruing while the issue is assigned to tracked ownership and waiting for first active work.',
      timingMode,
    };
  }

  return {
    baseType: 'paused',
    reason: `Timing is paused because status ${state.status} does not count as active after initial response work began.`,
    timingMode,
  };
};

const applyEvent = (state: WorkingState, event: IssueEvent): WorkingState => {
  switch (event.field) {
    case 'assignee':
      return {
        ...state,
        assigneeAccountId: event.to,
      };
    case 'team':
      return {
        ...state,
        teamLabel: event.to,
      };
    case 'ownership':
      return {
        ...state,
        ownershipLabel: event.to,
      };
    case 'status':
      return {
        ...state,
        status: event.to ?? state.status,
      };
    case 'priority':
      return {
        ...state,
        priority: event.to ?? state.priority,
      };
    case 'resolution':
      return {
        ...state,
        resolved: event.to !== undefined && event.to !== '',
      };
    default:
      return state;
  }
};

const pushSegment = (
  segments: IssueSegment[],
  segment: Omit<IssueSegment, 'segmentId'>,
): void => {
  if (segment.rawSeconds <= 0) {
    return;
  }

  const previous = segments.at(-1);
  if (
    previous
    && previous.segmentType === segment.segmentType
    && previous.assigneeAccountId === segment.assigneeAccountId
    && previous.ownershipLabel === segment.ownershipLabel
    && previous.status === segment.status
    && previous.priority === segment.priority
    && previous.reason === segment.reason
    && previous.endedAt === segment.startedAt
  ) {
    previous.endedAt = segment.endedAt;
    previous.rawSeconds += segment.rawSeconds;
    previous.businessSeconds += segment.businessSeconds;
    previous.sourceEventEnd = segment.sourceEventEnd;
    previous.countsTowardActive = previous.countsTowardActive || segment.countsTowardActive;
    previous.countsTowardResponse = previous.countsTowardResponse || segment.countsTowardResponse;
    return;
  }

  segments.push({
    ...segment,
    segmentId: `${segment.issueKey}-${segments.length + 1}`,
  });
};

const emitSegmentsForInterval = ({
  segments,
  snapshot,
  state,
  ruleSet,
  calendar,
  classification,
  startedAt,
  endedAt,
  sourceEventStart,
  sourceEventEnd,
  computeRunId,
}: {
  segments: IssueSegment[];
  snapshot: IssueSnapshot;
  state: WorkingState;
  ruleSet: RuleSet;
  calendar: BusinessCalendar;
  classification: IntervalClassification;
  startedAt: string;
  endedAt: string;
  sourceEventStart: string;
  sourceEventEnd: string;
  computeRunId: string;
}): void => {
  if (classification.baseType !== 'active' && classification.baseType !== 'response') {
    const rawSeconds = secondsBetween(new Date(startedAt), new Date(endedAt));
    pushSegment(segments, {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      ruleVersion: ruleSet.version,
      computeRunId,
      assigneeAccountId: state.assigneeAccountId,
      teamLabel: state.teamLabel,
      ownershipLabel: state.ownershipLabel,
      status: state.status,
      priority: state.priority,
      segmentType: classification.baseType,
      startedAt,
      endedAt,
      rawSeconds,
      businessSeconds: 0,
      reason: classification.reason,
      sourceEventStart,
      sourceEventEnd,
      countsTowardResponse: false,
      countsTowardActive: false,
    });
    return;
  }

  if (classification.timingMode === '24x7') {
    const rawSeconds = secondsBetween(new Date(startedAt), new Date(endedAt));
    pushSegment(segments, {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      ruleVersion: ruleSet.version,
      computeRunId,
      assigneeAccountId: state.assigneeAccountId,
      teamLabel: state.teamLabel,
      ownershipLabel: state.ownershipLabel,
      status: state.status,
      priority: state.priority,
      segmentType: classification.baseType,
      startedAt,
      endedAt,
      rawSeconds,
      businessSeconds: rawSeconds,
      reason: classification.reason,
      sourceEventStart,
      sourceEventEnd,
      countsTowardResponse: classification.baseType === 'response',
      countsTowardActive: classification.baseType === 'active',
    });
    return;
  }

  for (const chunk of splitIntervalByBusinessHours(startedAt, endedAt, calendar)) {
    pushSegment(segments, {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      ruleVersion: ruleSet.version,
      computeRunId,
      assigneeAccountId: state.assigneeAccountId,
      teamLabel: state.teamLabel,
      ownershipLabel: state.ownershipLabel,
      status: state.status,
      priority: state.priority,
      segmentType: chunk.isBusinessTime ? classification.baseType : 'outside-hours',
      startedAt: chunk.startedAt,
      endedAt: chunk.endedAt,
      rawSeconds: chunk.rawSeconds,
      businessSeconds: chunk.businessSeconds,
      reason: chunk.isBusinessTime ? classification.reason : 'Time falls outside the configured business calendar, so business SLA time does not accrue.',
      sourceEventStart,
      sourceEventEnd,
      countsTowardResponse: chunk.isBusinessTime && classification.baseType === 'response',
      countsTowardActive: chunk.isBusinessTime && classification.baseType === 'active',
    });
  }
};

export const calculateIssueSla = ({
  snapshot,
  ruleSet,
  calendar,
  recomputedAt = snapshot.updatedAt,
}: {
  snapshot: IssueSnapshot;
  ruleSet: RuleSet;
  calendar: BusinessCalendar;
  recomputedAt?: string;
}): IssueComputationResult => {
  const events = [...snapshot.events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const segments: IssueSegment[] = [];
  const computeRunId = uuidv4();
  let state: WorkingState = { ...snapshot.initialState };
  let cursor = snapshot.createdAt;
  let previousEventId = 'issue-created';
  const initialPolicy = getEffectiveSlaPolicy(ruleSet, state.priority, calendar.afterHoursMode);
  let responseStartedAt = initialPolicy.enabledClocks.includes('response')
    && shouldStartClock(state, ruleSet, initialPolicy.responseStartMode)
      ? snapshot.createdAt
      : undefined;
  let activeStartedAt = initialPolicy.enabledClocks.includes('active')
    && shouldStartClock(state, ruleSet, initialPolicy.activeStartMode)
      ? snapshot.createdAt
      : undefined;
  let slaStartedAt = responseStartedAt ?? activeStartedAt;
  let statusPauseGate: { pausedStatus: string } | null = null;

  for (const event of [...events, {
    kind: 'change' as const,
    field: 'status' as const,
    timestamp: snapshot.updatedAt,
    changelogId: 'issue-terminal',
  }]) {
    if (new Date(event.timestamp) > new Date(cursor)) {
      const classification = classifyInterval(
        state,
        ruleSet,
        calendar,
        responseStartedAt,
        activeStartedAt,
        statusPauseGate,
      );
      emitSegmentsForInterval({
        segments,
        snapshot,
        state,
        ruleSet,
        calendar,
        classification,
        startedAt: cursor,
        endedAt: event.timestamp,
        sourceEventStart: previousEventId,
        sourceEventEnd: event.changelogId,
        computeRunId,
      });
    }

    if (event.changelogId !== 'issue-terminal') {
      state = applyEvent(state, event);
      previousEventId = event.changelogId;
      const policy = getEffectiveSlaPolicy(ruleSet, state.priority, calendar.afterHoursMode);
      if (
        !responseStartedAt
        && policy.enabledClocks.includes('response')
        && shouldStartClock(state, ruleSet, policy.responseStartMode)
      ) {
        responseStartedAt = event.timestamp;
        slaStartedAt = slaStartedAt ?? responseStartedAt;
      }
      if (
        !activeStartedAt
        && policy.enabledClocks.includes('active')
        && shouldStartClock(state, ruleSet, policy.activeStartMode)
      ) {
        activeStartedAt = event.timestamp;
        slaStartedAt = slaStartedAt ?? activeStartedAt;
      }
      if (isPausedStatus(state, ruleSet)) {
        statusPauseGate = { pausedStatus: state.status };
      } else if (
        statusPauseGate
        && isTrackedOwnership(state, ruleSet)
        && !isStoppedStatus(state, ruleSet)
        && shouldResumeFromStatusPause({
          previousStatus: statusPauseGate.pausedStatus,
          nextStatus: state.status,
          resumeStatuses: ruleSet.resumeStatuses,
          resumeRules: ruleSet.resumeRules,
        })
      ) {
          statusPauseGate = null;
      }
    }

    cursor = event.timestamp;
  }

  const summary = buildIssueSummary({
    snapshot,
    ruleSet,
    calendar,
    segments,
    slaStartedAt,
    responseStartedAt,
    activeStartedAt,
    recomputedAt,
    computeRunId,
  });

  return {
    segments,
    summary,
    checkpoint: {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      computeRunId,
      lastProcessedChangelogId: events.at(-1)?.changelogId ?? 'issue-created',
      lastIssueUpdatedTimestamp: snapshot.updatedAt,
      lastRecomputedAt: recomputedAt,
      summaryVersion: ruleSet.version,
      needsRebuild: false,
      derivedDataStatus: 'complete',
      integrityIssues: [],
    },
  };
};
