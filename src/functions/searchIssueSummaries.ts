import { listSummariesForProject } from '../api/storage';
import { IssueSummary, SlaState } from '../sla/types';

export interface SearchFilters {
  projectKey: string;
  assigneeAccountId?: string;
  priority?: string;
  slaState?: SlaState;
  breachedOnly?: boolean;
}

/**
 * Returns precomputed SLA summaries for a project, optionally filtered.
 */
export async function searchIssueSummaries(
  filters: SearchFilters,
): Promise<IssueSummary[]> {
  const all = await listSummariesForProject(filters.projectKey);

  return all.filter((s) => {
    if (
      filters.assigneeAccountId &&
      s.currentAssignee !== filters.assigneeAccountId
    ) {
      return false;
    }
    if (filters.priority && s.currentPriority !== filters.priority) {
      return false;
    }
    if (filters.slaState && s.currentState !== filters.slaState) {
      return false;
    }
    if (filters.breachedOnly && !s.breachState) {
      return false;
    }
    return true;
  });
}
