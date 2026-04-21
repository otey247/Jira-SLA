import type {
  BreachBasis,
  ClockKind,
  EffectiveSlaPolicy,
  RuleSet,
  StartMode,
  TimingMode,
  WorkingState,
} from '../types';

const isTrackedAssignee = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.assigneeAccountId && ruleSet.trackedAssignees.includes(state.assigneeAccountId))
);

const isTrackedTeam = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.teamLabel && ruleSet.trackedTeams.includes(state.teamLabel))
);

const isTrackedOwnershipField = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(state.ownershipLabel && ruleSet.trackedOwnershipValues.includes(state.ownershipLabel))
);

export const resolveTrackedOwnershipSource = (
  state: WorkingState,
  ruleSet: RuleSet,
): string | undefined => {
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

export const isTrackedOwnership = (state: WorkingState, ruleSet: RuleSet): boolean => (
  Boolean(resolveTrackedOwnershipSource(state, ruleSet))
);

export const isActiveStatus = (state: WorkingState, ruleSet: RuleSet): boolean => (
  ruleSet.activeStatuses.includes(state.status)
);

export const resolveClockStartMode = (
  ruleSet: RuleSet,
  clock: ClockKind,
): StartMode => {
  if (clock === 'response') {
    return ruleSet.responseStartMode ?? ruleSet.startMode;
  }

  return ruleSet.activeStartMode ?? ruleSet.startMode;
};

export const shouldStartClock = (
  state: WorkingState,
  ruleSet: RuleSet,
  mode: StartMode,
): boolean => {
  switch (mode) {
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

const uniqueClocks = (clocks: ClockKind[]): ClockKind[] => (
  [...new Set(clocks)]
);

const resolveEnabledClocks = (
  ruleSet: RuleSet,
  override?: RuleSet['priorityOverrides'][number],
): ClockKind[] => {
  const clocks = uniqueClocks(
    override?.enabledClocks && override.enabledClocks.length > 0
      ? override.enabledClocks
      : ruleSet.enabledClocks,
  );
  return clocks.length > 0 ? clocks : ['response', 'active'];
};

const resolveBreachBasis = (
  ruleSet: RuleSet,
  override?: RuleSet['priorityOverrides'][number],
  enabledClocks: ClockKind[] = ruleSet.enabledClocks,
): BreachBasis => {
  const basis = override?.breachBasis ?? ruleSet.breachBasis;
  if (basis === 'response' && !enabledClocks.includes('response')) {
    return enabledClocks.includes('active') ? 'active' : 'combined';
  }
  if (basis === 'active' && !enabledClocks.includes('active')) {
    return enabledClocks.includes('response') ? 'response' : 'combined';
  }
  return basis;
};

export const getEffectiveSlaPolicy = (
  ruleSet: RuleSet,
  priority: string,
  fallbackTimingMode?: TimingMode,
): EffectiveSlaPolicy => {
  const override = ruleSet.priorityOverrides.find((item) => item.priority === priority);
  const enabledClocks = resolveEnabledClocks(ruleSet, override);

  return {
    timingMode: override?.timingMode ?? ruleSet.defaultTimingMode ?? fallbackTimingMode ?? 'business-hours',
    responseStartMode: resolveClockStartMode(ruleSet, 'response'),
    activeStartMode: resolveClockStartMode(ruleSet, 'active'),
    enabledClocks,
    breachBasis: resolveBreachBasis(ruleSet, override, enabledClocks),
    responseThresholdSeconds: override?.responseThresholdSeconds ?? ruleSet.defaultResponseThresholdSeconds,
    activeThresholdSeconds: override?.activeThresholdSeconds ?? ruleSet.defaultActiveThresholdSeconds,
    combinedThresholdSeconds: override?.combinedThresholdSeconds ?? ruleSet.defaultCombinedThresholdSeconds,
    resolutionThresholdSeconds: override?.resolutionThresholdSeconds ?? ruleSet.defaultResolutionThresholdSeconds,
  };
};
