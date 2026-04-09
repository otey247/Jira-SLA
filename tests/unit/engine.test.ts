import { describe, expect, it } from 'vitest';
import { calculateIssueSla } from '../../src/domain/rules/engine';
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
});
