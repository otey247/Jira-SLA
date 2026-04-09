import { v4 as uuidv4 } from 'uuid';
import {
  BusinessCalendar,
  IssueSlaSegment,
  IssueSummary,
  IssueState,
  NormalizedEvent,
  RuleSet,
  SegmentType,
  SlaState,
} from './types';
import { computeBusinessSeconds } from './calendar';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a chronological list of NormalizedEvents into SLA segments and a
 * precomputed IssueSummary.
 *
 * @param issueKey  Jira issue key, e.g. "ABC-123"
 * @param events    Sorted list produced by normalizeIssueEvents()
 * @param ruleSet   The active rule set for this issue
 * @param calendar  The business calendar referenced by the rule set
 * @param now       Current time (ISO string) used to close the last open segment
 */
export function computeIssueSla(
  issueKey: string,
  events: NormalizedEvent[],
  ruleSet: RuleSet,
  calendar: BusinessCalendar,
  now: string,
): { segments: IssueSlaSegment[]; summary: IssueSummary } {
  if (events.length === 0) {
    return {
      segments: [],
      summary: buildEmptySummary(issueKey, ruleSet.ruleSetId, now),
    };
  }

  // ── Step 1: reconstruct state transitions ──────────────────────────────────
  const boundaries = buildBoundaries(events, ruleSet, now);

  // ── Step 2: emit segments ─────────────────────────────────────────────────
  const segments = emitSegments(issueKey, ruleSet, calendar, boundaries);

  // ── Step 3: roll up summary ───────────────────────────────────────────────
  const summary = rollUpSummary(issueKey, ruleSet, calendar, segments, boundaries, now);

  return { segments, summary };
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface Boundary {
  timestamp: string;
  state: IssueState;
  /** True if SLA clock has started (first ownership event has occurred) */
  slaStarted: boolean;
  /** True if the issue is currently owned by the tracked team/assignees */
  ownedByTeam: boolean;
  /** True if a stop condition has been reached */
  stopped: boolean;
}

/**
 * Walk the event list and produce a list of (timestamp, state) boundaries.
 * Each boundary represents the start of a new interval.
 */
function buildBoundaries(
  events: NormalizedEvent[],
  ruleSet: RuleSet,
  now: string,
): Boundary[] {
  const boundaries: Boundary[] = [];

  let current: IssueState = {
    assigneeAccountId: null,
    status: '',
    priority: 'Medium',
    resolved: false,
  };

  let slaStarted = false;

  for (const event of events) {
    // Apply the event to derive the new state
    const next: IssueState = { ...current };

    switch (event.eventType) {
      case 'issue_created':
        next.assigneeAccountId = event.to;
        // Seed initial status and priority encoded in the `from` field
        if (event.from) {
          try {
            const init = JSON.parse(event.from) as {
              status?: string;
              priority?: string;
            };
            if (init.status !== undefined) next.status = init.status;
            if (init.priority !== undefined) next.priority = init.priority;
          } catch {
            // Ignore malformed JSON; use defaults
          }
        }
        break;
      case 'assignee_changed':
        next.assigneeAccountId = event.to ?? null;
        break;
      case 'status_changed':
        next.status = event.to ?? current.status;
        break;
      case 'priority_changed':
        next.priority = event.to ?? current.priority;
        break;
      case 'resolution_set':
        next.resolved = true;
        break;
      case 'resolution_cleared':
        next.resolved = false;
        break;
    }

    const ownedByTeam = isOwnedByTeam(next, ruleSet);

    // Determine if the SLA clock should start
    if (!slaStarted) {
      if (ruleSet.startMode === 'assignment' && ownedByTeam) {
        slaStarted = true;
      } else if (
        ruleSet.startMode === 'status' &&
        ruleSet.activeStatuses.includes(next.status)
      ) {
        slaStarted = true;
      }
    }

    const stopped =
      next.resolved ||
      (next.status !== '' && ruleSet.stoppedStatuses.includes(next.status));

    boundaries.push({
      timestamp: event.timestamp,
      state: next,
      slaStarted,
      ownedByTeam,
      stopped,
    });

    current = next;
  }

  // Add a synthetic closing boundary at "now" so the last segment has an end
  boundaries.push({
    timestamp: now,
    state: current,
    slaStarted,
    ownedByTeam: isOwnedByTeam(current, ruleSet),
    stopped:
      current.resolved ||
      (current.status !== '' && ruleSet.stoppedStatuses.includes(current.status)),
  });

  return boundaries;
}

/**
 * Convert sequential boundaries into concrete IssueSlaSegment objects.
 * Each consecutive pair of boundaries defines one segment.
 */
function emitSegments(
  issueKey: string,
  ruleSet: RuleSet,
  calendar: BusinessCalendar,
  boundaries: Boundary[],
): IssueSlaSegment[] {
  const segments: IssueSlaSegment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];

    if (!start.slaStarted) continue; // SLA not yet running

    const rawSeconds = Math.max(
      0,
      (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000,
    );

    if (rawSeconds === 0) continue;

    const segmentType = classifySegment(start, ruleSet);

    const priorityOverride = ruleSet.priorityOverrides[start.state.priority];
    const is24x7 = priorityOverride?.mode === '24x7';

    const businessSeconds = is24x7
      ? rawSeconds
      : computeBusinessSeconds(start.timestamp, end.timestamp, calendar);

    segments.push({
      segmentId: uuidv4(),
      issueKey,
      ruleSetId: ruleSet.ruleSetId,
      assigneeAccountId: start.state.assigneeAccountId,
      teamLabel: resolveTeamLabel(start.state.assigneeAccountId, ruleSet),
      status: start.state.status,
      priority: start.state.priority,
      segmentType,
      startedAt: start.timestamp,
      endedAt: end.timestamp,
      rawSeconds,
      businessSeconds,
      sourceEventStart: null,
      sourceEventEnd: null,
    });
  }

  return segments;
}

/**
 * Aggregate segments into an IssueSummary.
 */
function rollUpSummary(
  issueKey: string,
  ruleSet: RuleSet,
  calendar: BusinessCalendar,
  segments: IssueSlaSegment[],
  boundaries: Boundary[],
  now: string,
): IssueSummary {
  const lastBoundary = boundaries[boundaries.length - 1];

  let responseSeconds = 0;
  let activeSeconds = 0;
  let pausedSeconds = 0;
  let outsideHoursSeconds = 0;

  const perAssigneeTotals: Record<string, number> = {};
  const perTeamTotals: Record<string, number> = {};

  // Track whether we have already counted the first response
  let responseRecorded = false;

  for (const seg of segments) {
    const seconds = seg.businessSeconds;

    if (seg.segmentType === 'response' && !responseRecorded) {
      responseSeconds += seconds;
      if (seg.segmentType !== 'response') responseRecorded = true;
    }
    if (seg.segmentType === 'active') {
      activeSeconds += seconds;
    }
    if (seg.segmentType === 'paused' || seg.segmentType === 'waiting') {
      pausedSeconds += seconds;
    }
    if (seg.segmentType === 'outside-hours') {
      outsideHoursSeconds += seconds;
    }

    // Per-assignee accumulation (active segments only)
    if (seg.segmentType === 'active' && seg.assigneeAccountId) {
      perAssigneeTotals[seg.assigneeAccountId] =
        (perAssigneeTotals[seg.assigneeAccountId] ?? 0) + seconds;
    }
    if (seg.segmentType === 'active' && seg.teamLabel) {
      perTeamTotals[seg.teamLabel] = (perTeamTotals[seg.teamLabel] ?? 0) + seconds;
    }
  }

  const currentPriority = lastBoundary.state.priority;
  const priorityOverride = ruleSet.priorityOverrides[currentPriority];
  const breachThresholdMinutes = priorityOverride?.slaTargetMinutes ?? null;

  const breachState =
    breachThresholdMinutes !== null &&
    activeSeconds / 60 > breachThresholdMinutes;

  let currentState: SlaState;
  if (lastBoundary.stopped) {
    currentState = breachState ? 'breached' : 'met';
  } else if (!lastBoundary.slaStarted) {
    currentState = 'paused'; // waiting to start
  } else {
    const latestSegType = classifySegment(lastBoundary, ruleSet);
    if (latestSegType === 'paused' || latestSegType === 'waiting') {
      currentState = 'paused';
    } else if (breachState) {
      currentState = 'breached';
    } else {
      currentState = 'active';
    }
  }

  return {
    issueKey,
    ruleSetId: ruleSet.ruleSetId,
    currentState,
    responseSeconds,
    activeSeconds,
    pausedSeconds,
    outsideHoursSeconds,
    breachState,
    breachThresholdMinutes,
    currentAssignee: lastBoundary.state.assigneeAccountId,
    currentPriority,
    perAssigneeTotals,
    perTeamTotals,
    lastRecomputedAt: now,
    summaryVersion: 1,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOwnedByTeam(state: IssueState, ruleSet: RuleSet): boolean {
  if (!state.assigneeAccountId) return false;
  return (
    ruleSet.trackedAssigneeAccountIds.includes(state.assigneeAccountId) ||
    ruleSet.teamIds.length === 0 // if no team filter, any assignee counts
  );
}

function resolveTeamLabel(
  assigneeAccountId: string | null,
  ruleSet: RuleSet,
): string | null {
  if (!assigneeAccountId) return null;
  if (ruleSet.trackedAssigneeAccountIds.includes(assigneeAccountId)) {
    return ruleSet.name;
  }
  return null;
}

function classifySegment(boundary: Boundary, ruleSet: RuleSet): SegmentType {
  if (boundary.stopped) return 'stopped';

  const { status } = boundary.state;

  if (ruleSet.stoppedStatuses.includes(status)) return 'stopped';
  if (ruleSet.pausedStatuses.includes(status)) return 'paused';

  if (!boundary.ownedByTeam) return 'waiting';

  if (ruleSet.activeStatuses.includes(status) || status === '') return 'active';

  return 'active'; // default
}

function buildEmptySummary(
  issueKey: string,
  ruleSetId: string,
  now: string,
): IssueSummary {
  return {
    issueKey,
    ruleSetId,
    currentState: 'paused',
    responseSeconds: 0,
    activeSeconds: 0,
    pausedSeconds: 0,
    outsideHoursSeconds: 0,
    breachState: false,
    breachThresholdMinutes: null,
    currentAssignee: null,
    currentPriority: 'Medium',
    perAssigneeTotals: {},
    perTeamTotals: {},
    lastRecomputedAt: now,
    summaryVersion: 1,
  };
}
