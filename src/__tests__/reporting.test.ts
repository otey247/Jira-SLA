import { kvs } from '@forge/kvs';
import { saveSummary } from '../api/storage';
import { buildExplanation } from '../functions/getIssueSla';
import { rovoGetAssigneeMetrics } from '../functions/rovoActions';
import { searchIssueSummaries } from '../functions/searchIssueSummaries';
import { IssueSlaSegment, IssueSummary } from '../sla/types';

const summaryBase: IssueSummary = {
  issueKey: 'PROJ-1',
  ruleSetId: 'rs-1',
  projectKey: 'PROJ',
  currentState: 'active',
  currentStatus: 'In Progress',
  responseSeconds: 900,
  activeSeconds: 3600,
  pausedSeconds: 0,
  outsideHoursSeconds: 0,
  breachState: false,
  breachThresholdMinutes: 240,
  currentAssignee: 'assignee-alice',
  currentTeam: 'Capgemini',
  currentPriority: 'High',
  slaStartedAt: '2024-01-08T09:00:00.000Z',
  perAssigneeTotals: { 'assignee-alice': 3600 },
  perTeamTotals: { Capgemini: 3600 },
  lastRecomputedAt: '2024-01-08T10:00:00.000Z',
  summaryVersion: 1,
};

describe('reporting helpers', () => {
  beforeEach(() => {
    (kvs as typeof kvs & { _reset: () => void })._reset();
  });

  test('searchIssueSummaries filters and sorts using the extended fields', async () => {
    await saveSummary(summaryBase);
    await saveSummary({
      ...summaryBase,
      issueKey: 'PROJ-2',
      currentAssignee: 'assignee-bob',
      currentTeam: 'Support',
      currentPriority: 'Critical',
      currentStatus: 'Blocked',
      breachState: true,
      activeSeconds: 7200,
      lastRecomputedAt: '2024-01-09T11:00:00.000Z',
    });

    const results = await searchIssueSummaries({
      projectKey: 'PROJ',
      breachedOnly: true,
      teamLabel: 'Support',
      sortBy: 'activeSeconds',
      sortDirection: 'desc',
    });

    expect(results).toHaveLength(1);
    expect(results[0].issueKey).toBe('PROJ-2');
  });

  test('rovoGetAssigneeMetrics rolls up assignee averages from persisted summaries', async () => {
    await saveSummary(summaryBase);
    await saveSummary({
      ...summaryBase,
      issueKey: 'PROJ-2',
      responseSeconds: 1800,
      activeSeconds: 5400,
    });

    const result = await rovoGetAssigneeMetrics({ projectKey: 'PROJ' });

    expect(result.metrics).toEqual([
      {
        assigneeAccountId: 'assignee-alice',
        issueCount: 2,
        avgResponseSeconds: 1350,
        avgActiveSeconds: 4500,
        breachCount: 0,
      },
    ]);
  });

  test('buildExplanation includes start and pause/resume reasoning lines', () => {
    const segments: IssueSlaSegment[] = [
      {
        segmentId: 'seg-1',
        issueKey: 'PROJ-1',
        ruleSetId: 'rs-1',
        ruleSetVersion: 1,
        assigneeAccountId: 'assignee-alice',
        teamLabel: 'Capgemini',
        status: 'Assigned',
        priority: 'High',
        segmentType: 'response',
        startedAt: '2024-01-08T09:00:00.000Z',
        endedAt: '2024-01-08T09:15:00.000Z',
        rawSeconds: 900,
        businessSeconds: 900,
        sourceEventStart: 'event-1',
        sourceEventEnd: 'event-2',
      },
      {
        segmentId: 'seg-2',
        issueKey: 'PROJ-1',
        ruleSetId: 'rs-1',
        ruleSetVersion: 1,
        assigneeAccountId: 'assignee-alice',
        teamLabel: 'Capgemini',
        status: 'Blocked',
        priority: 'High',
        segmentType: 'paused',
        startedAt: '2024-01-08T09:15:00.000Z',
        endedAt: '2024-01-08T10:15:00.000Z',
        rawSeconds: 3600,
        businessSeconds: 3600,
        sourceEventStart: 'event-2',
        sourceEventEnd: 'event-3',
      },
    ];

    const explanation = buildExplanation(summaryBase, segments);

    expect(explanation[0]).toContain('SLA started');
    expect(explanation.some((line) => line.includes('Response clock ran'))).toBe(true);
    expect(explanation.some((line) => line.includes('SLA paused'))).toBe(true);
  });
});
