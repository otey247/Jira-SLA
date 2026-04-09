import { fetchIssue, fetchChangelog } from '../api/jira';
import { normalizeIssueEvents } from '../sla/events';
import { computeIssueSla } from '../sla/engine';
import {
  getCheckpoint,
  getRuleSet,
  getCalendar,
  saveCheckpoint,
  saveSegments,
  saveSummary,
} from '../api/storage';
import { IssueCheckpoint } from '../sla/types';

export interface SyncIssueOptions {
  issueKey: string;
  ruleSetId: string;
  forceRebuild?: boolean;
}

/**
 * Fetches the latest Jira changelog for an issue, runs the SLA engine, and
 * persists updated segments and summary to storage.
 */
export async function syncIssueHistory(opts: SyncIssueOptions): Promise<void> {
  const { issueKey, ruleSetId, forceRebuild = false } = opts;

  const [ruleSet, checkpoint] = await Promise.all([
    getRuleSet(ruleSetId),
    getCheckpoint(issueKey),
  ]);

  if (!ruleSet) {
    throw new Error(`Rule set not found: ${ruleSetId}`);
  }

  const calendar = await getCalendar(ruleSet.businessCalendarId);
  if (!calendar) {
    throw new Error(
      `Business calendar not found: ${ruleSet.businessCalendarId}`,
    );
  }

  // Determine which changelog entries to fetch
  const afterId =
    forceRebuild ? null : (checkpoint?.lastProcessedChangelogId ?? null);

  const [issue, changelogs] = await Promise.all([
    fetchIssue(issueKey),
    fetchChangelog(issueKey, afterId),
  ]);

  // If nothing new, skip recompute
  if (!forceRebuild && changelogs.length === 0) {
    return;
  }

  const events = normalizeIssueEvents(issue, changelogs);
  const now = new Date().toISOString();

  const { segments, summary } = computeIssueSla(
    issueKey,
    events,
    ruleSet,
    calendar,
    now,
  );

  // Determine the id of the last processed changelog entry
  const lastId =
    changelogs.length > 0
      ? changelogs[changelogs.length - 1].id
      : (checkpoint?.lastProcessedChangelogId ?? null);

  const updatedCheckpoint: IssueCheckpoint = {
    issueKey,
    ruleSetId,
    lastProcessedChangelogId: lastId,
    lastProcessedAt: now,
    lastIssueUpdated: issue.fields.updated,
    summaryVersion: summary.summaryVersion,
    needsRebuild: false,
  };

  // Persist atomically (best-effort; Forge KVS does not guarantee XA)
  await Promise.all([
    saveSegments(issueKey, segments),
    saveSummary(summary),
    saveCheckpoint(updatedCheckpoint),
  ]);
}
