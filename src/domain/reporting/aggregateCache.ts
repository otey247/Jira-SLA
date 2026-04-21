import type { AggregateDaily, IssueSummary } from '../types';

interface AggregateAccumulator {
  ticketCount: number;
  responseSeconds: number;
  activeSeconds: number;
  breachCount: number;
}

const buildAggregateKey = (
  summary: IssueSummary,
  date: string,
): string => [
  date,
  summary.projectKey,
  summary.ruleSetId,
  summary.currentAssignee ?? 'unassigned',
  summary.currentTeam ?? 'unmapped',
  summary.currentPriority,
].join('::');

export const buildAggregateCache = (summaries: IssueSummary[]): AggregateDaily[] => {
  const aggregates = new Map<string, AggregateDaily & AggregateAccumulator>();

  for (const summary of summaries) {
    const date = summary.recomputedAt.slice(0, 10);
    const key = buildAggregateKey(summary, date);
    const existing = aggregates.get(key) ?? {
      aggregateId: key,
      date,
      projectKey: summary.projectKey,
      ruleSetId: summary.ruleSetId,
      computeRunId: summary.computeRunId,
      generatedAt: summary.recomputedAt,
      assigneeAccountId: summary.currentAssignee,
      teamLabel: summary.currentTeam,
      priority: summary.currentPriority,
      ticketCount: 0,
      avgResponseSeconds: 0,
      avgActiveSeconds: 0,
      breachCount: 0,
      responseSeconds: 0,
      activeSeconds: 0,
    };

    if (summary.recomputedAt > existing.generatedAt) {
      existing.computeRunId = summary.computeRunId;
      existing.generatedAt = summary.recomputedAt;
    }
    existing.ticketCount += 1;
    existing.responseSeconds += summary.responseSeconds;
    existing.activeSeconds += summary.activeSeconds;
    if (summary.breachState === 'breached') {
      existing.breachCount += 1;
    }

    aggregates.set(key, existing);
  }

  return [...aggregates.values()].map((aggregate) => ({
    aggregateId: aggregate.aggregateId,
    date: aggregate.date,
    projectKey: aggregate.projectKey,
    ruleSetId: aggregate.ruleSetId,
    computeRunId: aggregate.computeRunId,
    generatedAt: aggregate.generatedAt,
    assigneeAccountId: aggregate.assigneeAccountId,
    teamLabel: aggregate.teamLabel,
    priority: aggregate.priority,
    ticketCount: aggregate.ticketCount,
    avgResponseSeconds: aggregate.ticketCount > 0
      ? Math.round(aggregate.responseSeconds / aggregate.ticketCount)
      : 0,
    avgActiveSeconds: aggregate.ticketCount > 0
      ? Math.round(aggregate.activeSeconds / aggregate.ticketCount)
      : 0,
    breachCount: aggregate.breachCount,
  }));
};
