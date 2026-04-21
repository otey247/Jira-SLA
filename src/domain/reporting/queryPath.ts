import type {
  AggregateDaily,
  DashboardMetric,
  IssueSummary,
  OverviewMetrics,
  ReportingDataSourceStatus,
} from '../types';

const average = (values: number[]): number => (
  values.length > 0
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : 0
);

const weightedAverage = (
  rows: AggregateDaily[],
  field: 'avgResponseSeconds' | 'avgActiveSeconds',
): number => {
  const totalCount = rows.reduce((count, row) => count + row.ticketCount, 0);
  if (totalCount === 0) {
    return 0;
  }

  return Math.round(
    rows.reduce((total, row) => total + (row[field] * row.ticketCount), 0) / totalCount,
  );
};

const buildMetricList = (
  values: Map<string, { total: number; count: number }>,
): DashboardMetric[] => (
  [...values.entries()]
    .map(([label, value]) => ({
      label,
      valueSeconds: average([value.total / Math.max(value.count, 1)]),
      count: value.count,
    }))
    .sort((left, right) => right.valueSeconds - left.valueSeconds)
);

export const buildReportingSnapshot = ({
  summaries,
  aggregates,
}: {
  summaries: IssueSummary[];
  aggregates: AggregateDaily[];
}): {
  overview: OverviewMetrics;
  assigneeMetrics: DashboardMetric[];
  teamMetrics: DashboardMetric[];
  breachMetrics: Array<{ priority: string; count: number }>;
  reportingDataSources: ReportingDataSourceStatus[];
} => {
  const useAggregates = aggregates.length > 0;

  if (useAggregates) {
    const assigneeTotals = new Map<string, { total: number; count: number }>();
    const teamTotals = new Map<string, { total: number; count: number }>();
    const breachTotals = new Map<string, number>();

    for (const aggregate of aggregates) {
      const assignee = aggregate.assigneeAccountId ?? 'unassigned';
      const team = aggregate.teamLabel ?? 'unmapped';
      const assigneeValue = assigneeTotals.get(assignee) ?? { total: 0, count: 0 };
      assigneeValue.total += aggregate.avgActiveSeconds * aggregate.ticketCount;
      assigneeValue.count += aggregate.ticketCount;
      assigneeTotals.set(assignee, assigneeValue);

      const teamValue = teamTotals.get(team) ?? { total: 0, count: 0 };
      teamValue.total += aggregate.avgActiveSeconds * aggregate.ticketCount;
      teamValue.count += aggregate.ticketCount;
      teamTotals.set(team, teamValue);

      if (aggregate.breachCount > 0) {
        breachTotals.set(
          aggregate.priority,
          (breachTotals.get(aggregate.priority) ?? 0) + aggregate.breachCount,
        );
      }
    }

    return {
      overview: {
        issueCount: aggregates.reduce((count, aggregate) => count + aggregate.ticketCount, 0),
        breachCount: aggregates.reduce((count, aggregate) => count + aggregate.breachCount, 0),
        averageResponseSeconds: weightedAverage(aggregates, 'avgResponseSeconds'),
        averageActiveSeconds: weightedAverage(aggregates, 'avgActiveSeconds'),
        totalPausedSeconds: summaries.reduce((total, summary) => total + summary.pausedSeconds, 0),
      },
      assigneeMetrics: buildMetricList(assigneeTotals),
      teamMetrics: buildMetricList(teamTotals),
      breachMetrics: [...breachTotals.entries()].map(([priority, count]) => ({ priority, count })),
      reportingDataSources: [
        {
          widget: 'overview',
          source: 'aggregate-cache',
          fallbackUsed: false,
          detail: 'Overview cards are reading persisted aggregate cache rows.',
        },
        {
          widget: 'assigneeMetrics',
          source: 'aggregate-cache',
          fallbackUsed: false,
          detail: 'Assignee metrics are reading persisted aggregate cache rows.',
        },
        {
          widget: 'teamMetrics',
          source: 'aggregate-cache',
          fallbackUsed: false,
          detail: 'Team metrics are reading persisted aggregate cache rows.',
        },
        {
          widget: 'breachMetrics',
          source: 'aggregate-cache',
          fallbackUsed: false,
          detail: 'Breach metrics are reading persisted aggregate cache rows.',
        },
      ],
    };
  }

  const assigneeTotals = new Map<string, { total: number; count: number }>();
  const teamTotals = new Map<string, { total: number; count: number }>();
  const breachTotals = new Map<string, number>();

  for (const summary of summaries) {
    const assignee = summary.currentAssignee ?? 'unassigned';
    const team = summary.currentTeam ?? 'unmapped';
    const assigneeValue = assigneeTotals.get(assignee) ?? { total: 0, count: 0 };
    assigneeValue.total += summary.activeSeconds;
    assigneeValue.count += 1;
    assigneeTotals.set(assignee, assigneeValue);

    const teamValue = teamTotals.get(team) ?? { total: 0, count: 0 };
    teamValue.total += summary.activeSeconds;
    teamValue.count += 1;
    teamTotals.set(team, teamValue);

    if (summary.breachState === 'breached') {
      breachTotals.set(summary.currentPriority, (breachTotals.get(summary.currentPriority) ?? 0) + 1);
    }
  }

  return {
    overview: {
      issueCount: summaries.length,
      breachCount: summaries.filter((summary) => summary.breachState === 'breached').length,
      averageResponseSeconds: average(summaries.map((summary) => summary.responseSeconds)),
      averageActiveSeconds: average(summaries.map((summary) => summary.activeSeconds)),
      totalPausedSeconds: summaries.reduce((total, summary) => total + summary.pausedSeconds, 0),
    },
    assigneeMetrics: buildMetricList(assigneeTotals),
    teamMetrics: buildMetricList(teamTotals),
    breachMetrics: [...breachTotals.entries()].map(([priority, count]) => ({ priority, count })),
    reportingDataSources: [
      {
        widget: 'overview',
        source: 'issue-summaries',
        fallbackUsed: true,
        detail: 'Overview cards fell back to direct issue summaries because aggregate cache rows are unavailable.',
      },
      {
        widget: 'assigneeMetrics',
        source: 'issue-summaries',
        fallbackUsed: true,
        detail: 'Assignee metrics fell back to direct issue summaries because aggregate cache rows are unavailable.',
      },
      {
        widget: 'teamMetrics',
        source: 'issue-summaries',
        fallbackUsed: true,
        detail: 'Team metrics fell back to direct issue summaries because aggregate cache rows are unavailable.',
      },
      {
        widget: 'breachMetrics',
        source: 'issue-summaries',
        fallbackUsed: true,
        detail: 'Breach metrics fell back to direct issue summaries because aggregate cache rows are unavailable.',
      },
    ],
  };
};
