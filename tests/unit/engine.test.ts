import { describe, expect, it } from 'vitest';
import { splitIntervalByBusinessHours } from '../../src/domain/rules/businessHours';
import { calculateIssueSla } from '../../src/domain/rules/engine';
import { buildAggregateCache } from '../../src/domain/reporting/aggregateCache';
import { normalizeJiraIssue } from '../../src/integrations/jira/normalize';
import { MemoryApplicationStore } from '../../src/storage/appStore';
import { sampleCalendars, sampleIssues, sampleRuleSets } from '../../src/storage/seed';

const ruleSet = sampleRuleSets[0];
const calendar = sampleCalendars[0];

describe('calculateIssueSla', () => {
  it('computes pause and resume segments for a standard tracked issue', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[0]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.responseSeconds).toBe(3600);
    expect(result.summary.activeSeconds).toBe(19800);
    expect(result.summary.pausedSeconds).toBe(7200);
    expect(result.summary.outsideHoursSeconds).toBe(0);
    expect(result.segments.map((segment) => segment.segmentType)).toEqual(['response', 'active', 'paused', 'active']);
  });

  it('splits outside-hours intervals away from business-hour response and active time', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[1]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.responseSeconds).toBe(1800);
    expect(result.summary.activeSeconds).toBe(10800);
    expect(result.summary.outsideHoursSeconds).toBe(52200);
    expect(result.segments.some((segment) => segment.segmentType === 'outside-hours')).toBe(true);
  });

  it('applies 24x7 priority overrides for critical incidents', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[2]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.responseSeconds).toBe(3600);
    expect(result.summary.activeSeconds).toBe(12600);
    expect(result.summary.pausedSeconds).toBe(5400);
    expect(result.summary.outsideHoursSeconds).toBe(0);
    expect(result.summary.breachState).toBe('healthy');
  });

  it('starts SLA on ownership transfer and excludes pre-ownership queue time', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[3]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.slaStartedAt).toBe('2026-04-06T10:00:00.000Z');
    expect(result.summary.responseSeconds).toBe(3600);
    expect(result.summary.activeSeconds).toBe(5400);
    expect(result.summary.pausedSeconds).toBe(5400);
    expect(result.summary.waitingSeconds).toBe(0);
    expect(result.segments.map((segment) => segment.segmentType)).toEqual([
      'untracked',
      'response',
      'active',
      'paused',
      'paused',
      'active',
    ]);
  });

  it('tracks waiting time separately when ownership leaves the tracked team', () => {
    const snapshot = normalizeJiraIssue({
      key: 'ABC-901',
      fields: {
        projectKey: 'ABC',
        summary: 'Ownership leaves and returns',
        created: '2026-04-06T09:00:00.000Z',
        updated: '2026-04-06T13:00:00.000Z',
        initialStatus: 'Assigned',
        initialPriority: 'P2',
        initialOwnershipLabel: 'Capgemini',
      },
      changelog: [
        {
          id: '9011',
          created: '2026-04-06T10:00:00.000Z',
          items: [{ field: 'status', from: 'Assigned', to: 'In Progress' }],
        },
        {
          id: '9012',
          created: '2026-04-06T11:00:00.000Z',
          items: [{ field: 'ownership', from: 'Capgemini', to: 'Customer' }],
        },
        {
          id: '9013',
          created: '2026-04-06T12:00:00.000Z',
          items: [{ field: 'ownership', from: 'Customer', to: 'Capgemini' }],
        },
        {
          id: '9014',
          created: '2026-04-06T13:00:00.000Z',
          items: [
            { field: 'status', from: 'In Progress', to: 'Done' },
            { field: 'resolution', to: 'Completed' },
          ],
        },
      ],
    });

    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.waitingSeconds).toBe(3600);
    expect(result.summary.pausedSeconds).toBe(0);
    expect(result.segments.some((segment) => segment.segmentType === 'waiting')).toBe(true);
  });

  it('supports hybrid response and handling start modes with separate clock starts', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[3]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.responseStartedAt).toBe('2026-04-06T10:00:00.000Z');
    expect(result.summary.activeStartedAt).toBe('2026-04-06T11:00:00.000Z');
    expect(result.summary.responseSeconds).toBe(3600);
    expect(result.summary.activeSeconds).toBe(5400);
    expect(result.summary.effectivePolicy.responseStartMode).toBe('ownership-field');
    expect(result.summary.effectivePolicy.activeStartMode).toBe('status');
  });

  it('preserves team continuity while splitting consultant attribution', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[1]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.currentTeam).toBe('capgemini');
    expect(result.summary.assigneeMetrics.find((metric) => metric.assigneeAccountId === 'alice')?.activeSeconds).toBeGreaterThan(0);
    expect(result.summary.assigneeMetrics.find((metric) => metric.assigneeAccountId === 'bob')?.activeSeconds).toBeGreaterThan(0);
    expect(result.segments.filter((segment) => segment.countsTowardActive).every((segment) => segment.teamLabel === 'capgemini')).toBe(true);
  });

  it('supports resolution-based breach policies and reports the breached clock', () => {
    const snapshot = normalizeJiraIssue(sampleIssues[6]);
    const result = calculateIssueSla({ snapshot, ruleSet, calendar });

    expect(result.summary.effectivePolicy.breachBasis).toBe('resolution');
    expect(result.summary.resolutionSeconds).toBeGreaterThan(0);
    expect(result.summary.breachState).toBe('breached');
    expect(result.summary.breachedClock).toBe('resolution');
  });

  it('builds aggregate cache rows from recomputed summaries', async () => {
    const store = new MemoryApplicationStore();
    const summaries = await store.listIssueSummaries({ projectKey: 'ABC' });
    const aggregates = buildAggregateCache(summaries);

    expect(aggregates.length).toBeGreaterThan(0);
    expect(aggregates.every((aggregate) => aggregate.computeRunId)).toBe(true);
    expect(aggregates.every((aggregate) => aggregate.ruleSetId === 'capgemini-support')).toBe(true);
  });
});

describe('MemoryApplicationStore', () => {
  it('marks issues for rebuild and recomputes pending checkpoints idempotently', async () => {
    const store = new MemoryApplicationStore();
    const queued = await store.markIssueForRebuild('ABC-123');
    expect(queued.status).toBe('queued');

    const checkpoint = await store.getCheckpoint('ABC-123');
    expect(checkpoint?.needsRebuild).toBe(true);

    const recomputed = await store.recomputePendingIssues();
    expect(recomputed).toHaveLength(1);

    const updated = await store.getCheckpoint('ABC-123');
    expect(updated?.needsRebuild).toBe(false);
  });

  it('filters issue summaries for breached items', async () => {
    const store = new MemoryApplicationStore({
      issues: sampleIssues,
      ruleSets: [{
        ...sampleRuleSets[0],
        defaultActiveThresholdSeconds: 1000,
      }],
      calendars: sampleCalendars,
    });

    const breached = await store.listIssueSummaries({ breachState: 'breached' });
    expect(breached.length).toBeGreaterThan(0);
  });

  it('repairs inconsistent derived data by recomputing linked records', async () => {
    const store = new MemoryApplicationStore();
    const before = await store.getIssueIntegrityReport('ABC-123');

    expect(before?.valid).toBe(true);

    await store.saveRuleSet({
      ...sampleRuleSets[0],
      ruleSetId: sampleRuleSets[0].ruleSetId,
    });

    const stale = await store.getIssueIntegrityReport('ABC-123');
    expect(stale?.valid).toBe(false);
    expect(stale?.messages.some((message) => message.includes('rule-set version'))).toBe(true);

    const repaired = await store.repairIssueDerivedData('ABC-123');
    expect(repaired.repaired).toBe(true);

    const after = await store.getIssueIntegrityReport('ABC-123');
    expect(after?.valid).toBe(true);
  });
});

describe('splitIntervalByBusinessHours', () => {
  it('uses the configured calendar timezone when slicing business time', () => {
    const slices = splitIntervalByBusinessHours(
      '2024-01-08T13:30:00.000Z',
      '2024-01-08T15:30:00.000Z',
      {
        calendarId: 'cal-est',
        name: 'US East',
        timezone: 'America/New_York',
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: '09:00', end: '17:00' },
        holidays: [],
        afterHoursMode: 'business-hours',
      },
    );

    expect(slices).toEqual([
      {
        startedAt: '2024-01-08T13:30:00.000Z',
        endedAt: '2024-01-08T14:00:00.000Z',
        rawSeconds: 1800,
        businessSeconds: 0,
        isBusinessTime: false,
      },
      {
        startedAt: '2024-01-08T14:00:00.000Z',
        endedAt: '2024-01-08T15:30:00.000Z',
        rawSeconds: 5400,
        businessSeconds: 5400,
        isBusinessTime: true,
      },
    ]);
  });
});
