import { fetchWorklogs } from '../api/jira';
import { getSummary, getSegments } from '../api/storage';
import { IssueSlaSegment, IssueSummary, JiraWorklog } from '../sla/types';

export interface IssueSlaDetail {
  summary: IssueSummary;
  segments: IssueSlaSegment[];
  explanation: string[];
}

export interface IssueAuditDetail extends IssueSlaDetail {
  worklogs: JiraWorklog[];
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

  return {
    summary,
    segments,
    explanation: buildExplanation(summary, segments),
  };
}

/**
 * Returns a richer audit payload for issue drill-down surfaces.
 */
export async function getIssueAudit(
  issueKey: string,
): Promise<IssueAuditDetail | null> {
  const timeline = await getIssueTimeline(issueKey);
  if (!timeline) return null;

  let worklogs: JiraWorklog[] = [];
  try {
    worklogs = await fetchWorklogs(issueKey);
  } catch (error) {
    console.error(`[getIssueAudit] Failed to fetch worklogs for ${issueKey}:`, error);
  }

  return {
    ...timeline,
    worklogs,
  };
}

export function buildExplanation(
  summary: IssueSummary,
  segments: IssueSlaSegment[],
): string[] {
  const lines: string[] = [];

  if (summary.slaStartedAt) {
    lines.push(`SLA started at ${formatDateTime(summary.slaStartedAt)}.`);
  } else {
    lines.push('SLA has not started yet for this issue.');
  }

  for (const segment of segments) {
    const duration = formatMinutes(segment.segmentType === 'outside-hours'
      ? segment.rawSeconds
      : segment.businessSeconds);
    const statusLabel = segment.status ? ` in status "${segment.status}"` : '';
    const assigneeLabel = segment.assigneeAccountId
      ? ` for ${segment.assigneeAccountId}`
      : '';

    switch (segment.segmentType) {
      case 'response':
        lines.push(
          `Response clock ran${assigneeLabel}${statusLabel} from ${formatDateTime(
            segment.startedAt,
          )} to ${formatDateTime(segment.endedAt)} (${duration}).`,
        );
        break;
      case 'active':
        lines.push(
          `Active handling counted${assigneeLabel}${statusLabel} from ${formatDateTime(
            segment.startedAt,
          )} to ${formatDateTime(segment.endedAt)} (${duration}).`,
        );
        break;
      case 'paused':
      case 'waiting':
        lines.push(
          `SLA paused because the issue was ${segment.segmentType}${statusLabel} from ${formatDateTime(
            segment.startedAt,
          )} to ${formatDateTime(segment.endedAt)} (${duration}).`,
        );
        break;
      case 'outside-hours':
        lines.push(
          `Time outside business hours was excluded from ${formatDateTime(
            segment.startedAt,
          )} to ${formatDateTime(segment.endedAt)} (${duration}).`,
        );
        break;
      case 'stopped':
        lines.push(
          `SLA stopped${statusLabel} at ${formatDateTime(segment.startedAt)}.`,
        );
        break;
    }
  }

  if (summary.breachState && summary.breachThresholdMinutes !== null) {
    lines.push(
      `The issue breached its SLA after exceeding ${summary.breachThresholdMinutes} minutes of counted active handling.`,
    );
  }

  return lines;
}

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
