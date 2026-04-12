import { listSummariesForProject } from '../api/storage';
import { IssueSummary, SlaState } from '../sla/types';

export interface SearchFilters {
  projectKey: string;
  assigneeAccountId?: string;
  teamLabel?: string;
  priority?: string;
  currentStatus?: string;
  slaState?: SlaState;
  breachedOnly?: boolean;
  dateStart?: string;
  dateEnd?: string;
  sortBy?:
    | 'issueKey'
    | 'responseSeconds'
    | 'activeSeconds'
    | 'pausedSeconds'
    | 'breachState'
    | 'currentPriority'
    | 'currentStatus'
    | 'lastRecomputedAt';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Returns precomputed SLA summaries for a project, optionally filtered and sorted.
 */
export async function searchIssueSummaries(
  filters: SearchFilters,
): Promise<IssueSummary[]> {
  const all = await listSummariesForProject(filters.projectKey);

  const filtered = all.filter((summary) => matchesFilters(summary, filters));
  return sortSummaries(filtered, filters.sortBy, filters.sortDirection);
}

function matchesFilters(summary: IssueSummary, filters: SearchFilters): boolean {
  if (
    filters.assigneeAccountId &&
    summary.currentAssignee !== filters.assigneeAccountId
  ) {
    return false;
  }

  if (filters.teamLabel && summary.currentTeam !== filters.teamLabel) {
    return false;
  }

  if (filters.priority && summary.currentPriority !== filters.priority) {
    return false;
  }

  if (filters.currentStatus && summary.currentStatus !== filters.currentStatus) {
    return false;
  }

  if (filters.slaState && summary.currentState !== filters.slaState) {
    return false;
  }

  if (filters.breachedOnly && !summary.breachState) {
    return false;
  }

  if (filters.dateStart && summary.lastRecomputedAt < `${filters.dateStart}T00:00:00.000Z`) {
    return false;
  }

  if (filters.dateEnd && summary.lastRecomputedAt > `${filters.dateEnd}T23:59:59.999Z`) {
    return false;
  }

  return true;
}

function sortSummaries(
  summaries: IssueSummary[],
  sortBy: SearchFilters['sortBy'] = 'issueKey',
  sortDirection: SearchFilters['sortDirection'] = 'asc',
): IssueSummary[] {
  const direction = sortDirection === 'desc' ? -1 : 1;

  return [...summaries].sort((left, right) => {
    const leftValue = getComparableValue(left, sortBy);
    const rightValue = getComparableValue(right, sortBy);

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return left.issueKey.localeCompare(right.issueKey);
  });
}

function getComparableValue(
  summary: IssueSummary,
  sortBy: NonNullable<SearchFilters['sortBy']>,
): boolean | number | string {
  switch (sortBy) {
    case 'responseSeconds':
      return summary.responseSeconds;
    case 'activeSeconds':
      return summary.activeSeconds;
    case 'pausedSeconds':
      return summary.pausedSeconds;
    case 'breachState':
      return summary.breachState;
    case 'currentPriority':
      return summary.currentPriority;
    case 'currentStatus':
      return summary.currentStatus;
    case 'lastRecomputedAt':
      return summary.lastRecomputedAt;
    case 'issueKey':
    default:
      return summary.issueKey;
  }
}
