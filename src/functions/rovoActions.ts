import { getSummary, getSegments, listSummariesForProject } from '../api/storage';
import { IssueSummary, IssueSlaSegment } from '../sla/types';

// ─── Rovo action: get_issue_sla_summary ──────────────────────────────────────

export async function rovoGetIssueSummary(payload: {
  issueKey: string;
}): Promise<{ found: boolean; summary?: IssueSummary }> {
  const summary = await getSummary(payload.issueKey);
  if (!summary) return { found: false };
  return { found: true, summary };
}

// ─── Rovo action: explain_issue_timeline ─────────────────────────────────────

export async function rovoExplainIssue(payload: {
  issueKey: string;
}): Promise<{ found: boolean; explanation?: string; segments?: IssueSlaSegment[] }> {
  const [summary, segments] = await Promise.all([
    getSummary(payload.issueKey),
    getSegments(payload.issueKey),
  ]);

  if (!summary) return { found: false };

  const lines: string[] = [
    `SLA timeline for ${payload.issueKey}`,
    `Current state: ${summary.currentState}`,
    `Current assignee: ${summary.currentAssignee ?? 'unassigned'}`,
    `Current priority: ${summary.currentPriority}`,
    '',
    `Response time: ${formatMinutes(summary.responseSeconds / 60)}`,
    `Active handling: ${formatMinutes(summary.activeSeconds / 60)}`,
    `Paused duration: ${formatMinutes(summary.pausedSeconds / 60)}`,
    `Outside business hours: ${formatMinutes(summary.outsideHoursSeconds / 60)}`,
    '',
  ];

  if (summary.breachState) {
    lines.push(
      `⚠ SLA BREACHED – active handling exceeded ${summary.breachThresholdMinutes} minutes.`,
    );
  }

  if (segments.length > 0) {
    lines.push('Segment breakdown:');
    for (const seg of segments) {
      const start = new Date(seg.startedAt).toLocaleString();
      const end = new Date(seg.endedAt).toLocaleString();
      lines.push(
        `  [${seg.segmentType.toUpperCase()}] ${start} → ${end}` +
          `  assignee=${seg.assigneeAccountId ?? 'none'}` +
          `  status="${seg.status}"` +
          `  business=${formatMinutes(seg.businessSeconds / 60)}`,
      );
    }
  }

  return {
    found: true,
    explanation: lines.join('\n'),
    segments,
  };
}

// ─── Rovo action: list_breached_issues ───────────────────────────────────────

export async function rovoListBreaches(payload: {
  projectKey: string;
  priority?: string;
  assigneeAccountId?: string;
}): Promise<{ breaches: IssueSummary[] }> {
  const summaries = await listSummariesForProject(payload.projectKey);

  const breaches = summaries.filter((s) => {
    if (!s.breachState) return false;
    if (payload.priority && s.currentPriority !== payload.priority) return false;
    if (
      payload.assigneeAccountId &&
      s.currentAssignee !== payload.assigneeAccountId
    ) {
      return false;
    }
    return true;
  });

  return { breaches };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
