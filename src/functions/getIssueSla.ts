import { getSummary, getSegments } from '../api/storage';
import { IssueSlaSegment, IssueSummary } from '../sla/types';

export interface IssueSlaDetail {
  summary: IssueSummary;
  segments: IssueSlaSegment[];
}

/**
 * Returns the precomputed SLA summary for a single issue.
 */
export async function getIssueSummary(
  issueKey: string,
): Promise<IssueSummary | null> {
  return getSummary(issueKey);
}

/**
 * Returns summary + full timeline segments for a single issue.
 */
export async function getIssueTimeline(
  issueKey: string,
): Promise<IssueSlaDetail | null> {
  const [summary, segments] = await Promise.all([
    getSummary(issueKey),
    getSegments(issueKey),
  ]);

  if (!summary) return null;

  return { summary, segments };
}
