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
import { secondsBetween, splitIntervalByBusinessHours } from './businessHours';
import { shouldResumeFromStatusPause } from './stateMachine';

interface IntervalClassification {
  baseType: SegmentType;
  reason: string;
  timingMode: TimingMode;
}

const isTrackedAssignee = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.assigneeAccountId && ruleSet.trackedAssignees.includes(state.assigneeAccountId))
);

const isTrackedTeam = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.teamLabel && ruleSet.trackedTeams.includes(state.teamLabel))
);

const isTrackedOwnershipField = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.ownershipLabel && ruleSet.trackedOwnershipValues.includes(state.ownershipLabel))
);

const resolveTrackedOwnershipSource = (state: WorkingState, ruleSet: RuleSet): string | undefined => {
  const precedence = ruleSet.ownershipPrecedence.length > 0
    ? ruleSet.ownershipPrecedence
    : ['ownership', 'team', 'assignee'];

  if (
    ruleSet.trackedAssignees.length === 0
    && ruleSet.trackedTeams.length === 0
    && ruleSet.trackedOwnershipValues.length === 0
  ) {
    return state.ownershipLabel ?? state.teamLabel ?? state.assigneeAccountId;
  }

  for (const source of precedence) {
    if (source === 'ownership' && isTrackedOwnershipField(state, ruleSet)) {
      return state.ownershipLabel;
    }
    if (source === 'team' && isTrackedTeam(state, ruleSet)) {
      return state.teamLabel;
    }
    if (source === 'assignee' && isTrackedAssignee(state, ruleSet)) {
      return state.assigneeAccountId;
    }
  }

  return undefined;
};

const isTrackedOwnership = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(resolveTrackedOwnershipSource(state, ruleSet))
);

const isActiveStatus = (state: WorkingState, ruleSet: RuleSet): boolean => ruleSet.activeStatuses.includes(state.status);
const isPausedStatus = (state: WorkingState, ruleSet: RuleSet): boolean => ruleSet.pausedStatuses.includes(state.status);
const isStoppedStatus = (state: WorkingState, ruleSet: RuleSet): boolean => state.resolved || ruleSet.stoppedStatuses.includes(state.status);

const getTimingMode = (state: WorkingState, ruleSet: RuleSet, calendar: BusinessCalendar): TimingMode => {
  const override = ruleSet.priorityOverrides.find((item) => item.priority === state.priority);
  return override?.timingMode ?? ruleSet.defaultTimingMode ?? calendar.afterHoursMode;
};

const shouldStartSla = (state: WorkingState, ruleSet: RuleSet): boolean => {
  switch (ruleSet.startMode) {
    case 'assignment':
      return isTrackedOwnership(state, ruleSet);
    case 'status':
      return isActiveStatus(state, ruleSet);
    case 'assignment-or-status':
      return isTrackedOwnership(state, ruleSet) || isActiveStatus(state, ruleSet);
    case 'ownership-field':
      return Boolean(resolveTrackedOwnershipSource(state, ruleSet));
    default:
      return false;
  }
};

const describeWaitingReason = (_state: WorkingState, _ruleSet: RuleSet): string => {
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
  hasStarted: boolean,
  hasSeenActive: boolean,
  statusPauseGate: { pausedStatus: string } | null,
): IntervalClassification => {
  const timingMode = getTimingMode(state, ruleSet, calendar);

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
      reason: describeWaitingReason(state, ruleSet),
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

  if (isActiveStatus(state, ruleSet)) {
    return {
      baseType: 'active',
      reason: `Active handling time is accruing because status ${state.status} is configured as active and ownership is tracked.`,
      timingMode,
    };
  }

  if (!hasSeenActive) {
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
}): void => {
  if (classification.baseType !== 'active' && classification.baseType !== 'response') {
    const rawSeconds = secondsBetween(new Date(startedAt), new Date(endedAt));
    pushSegment(segments, {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      ruleVersion: ruleSet.version,
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
  let state: WorkingState = { ...snapshot.initialState };
  let cursor = snapshot.createdAt;
  let previousEventId = 'issue-created';
  let slaStartedAt = shouldStartSla(state, ruleSet) ? snapshot.createdAt : undefined;
  let hasSeenActive = false;
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
        Boolean(slaStartedAt),
        hasSeenActive,
        statusPauseGate,
      );
      if (classification.baseType === 'active') {
        hasSeenActive = true;
      }
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
      });
    }

    if (event.changelogId !== 'issue-terminal') {
      state = applyEvent(state, event);
      previousEventId = event.changelogId;
      if (!slaStartedAt && shouldStartSla(state, ruleSet)) {
        slaStartedAt = event.timestamp;
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
      if (isActiveStatus(state, ruleSet)) {
        hasSeenActive = true;
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
    recomputedAt,
  });

  return {
    segments,
    summary,
    checkpoint: {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      lastProcessedChangelogId: events.at(-1)?.changelogId ?? 'issue-created',
      lastIssueUpdatedTimestamp: snapshot.updatedAt,
      lastRecomputedAt: recomputedAt,
      summaryVersion: ruleSet.version,
      needsRebuild: false,
    },
  };
};
