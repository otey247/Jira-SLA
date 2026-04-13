import { kvs, WhereConditions } from '@forge/kvs';
import {
  AggregateDaily,
  BusinessCalendar,
  IssueCheckpoint,
  IssueSlaSegment,
  IssueSummary,
  RebuildJob,
  RuleSet,
} from '../sla/types';

// ─── Key helpers ─────────────────────────────────────────────────────────────

const key = {
  ruleSet: (id: string) => `rule_set::${id}`,
  ruleSetIndex: 'rule_set::index',
  calendar: (id: string) => `business_calendar::${id}`,
  calendarIndex: 'business_calendar::index',
  issueRuleSet: (issueKey: string) => `issue_rule_set::${issueKey}`,
  checkpoint: (ruleSetId: string, issueKey: string) =>
    `issue_checkpoint::${ruleSetId}::${issueKey}`,
  segments: (ruleSetId: string, issueKey: string) =>
    `issue_segments::${ruleSetId}::${issueKey}`,
  summary: (ruleSetId: string, issueKey: string) =>
    `issue_summary::${ruleSetId}::${issueKey}`,
  summaryPrefix: (ruleSetId?: string) =>
    ruleSetId ? `issue_summary::${ruleSetId}::` : 'issue_summary::',
  segmentsPrefix: (ruleSetId?: string) =>
    ruleSetId ? `issue_segments::${ruleSetId}::` : 'issue_segments::',
  aggregate: (project: string, ruleSetId: string, date: string) =>
    `aggregate_daily::${project}::${ruleSetId}::${date}`,
  aggregatePrefix: (project: string, ruleSetId?: string) =>
    ruleSetId
      ? `aggregate_daily::${project}::${ruleSetId}::`
      : `aggregate_daily::${project}::`,
  rebuildJob: (id: string) => `rebuild_job::${id}`,
  rebuildJobPrefix: 'rebuild_job::',
};

async function queryByPrefix<T>(prefix: string): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    let query = kvs
      .query()
      .where('key', WhereConditions.beginsWith(prefix))
      .limit(100);

    if (cursor) {
      query = query.cursor(cursor);
    }

    const page = await query.getMany<T>();
    results.push(...page.results.map((result) => result.value));
    cursor = page.nextCursor;
  } while (cursor);

  return results;
}

// ─── Rule Sets ────────────────────────────────────────────────────────────────

export async function saveRuleSet(ruleSet: RuleSet): Promise<void> {
  await kvs.set(key.ruleSet(ruleSet.ruleSetId), ruleSet);

  const index: string[] = (await kvs.get<string[]>(key.ruleSetIndex)) ?? [];
  if (!index.includes(ruleSet.ruleSetId)) {
    index.push(ruleSet.ruleSetId);
    await kvs.set(key.ruleSetIndex, index);
  }
}

export async function getRuleSet(id: string): Promise<RuleSet | null> {
  return (await kvs.get<RuleSet>(key.ruleSet(id))) ?? null;
}

export async function listRuleSets(): Promise<RuleSet[]> {
  const index: string[] = (await kvs.get<string[]>(key.ruleSetIndex)) ?? [];
  const results = await Promise.all(index.map((id) => getRuleSet(id)));
  return results.filter((r): r is RuleSet => r !== null);
}

export async function deleteRuleSet(id: string): Promise<void> {
  await kvs.delete(key.ruleSet(id));
  const index: string[] = (await kvs.get<string[]>(key.ruleSetIndex)) ?? [];
  await kvs.set(
    key.ruleSetIndex,
    index.filter((i) => i !== id),
  );
}

// ─── Business Calendars ───────────────────────────────────────────────────────

export async function saveCalendar(calendar: BusinessCalendar): Promise<void> {
  await kvs.set(key.calendar(calendar.calendarId), calendar);

  const index: string[] = (await kvs.get<string[]>(key.calendarIndex)) ?? [];
  if (!index.includes(calendar.calendarId)) {
    index.push(calendar.calendarId);
    await kvs.set(key.calendarIndex, index);
  }
}

export async function getCalendar(id: string): Promise<BusinessCalendar | null> {
  return (await kvs.get<BusinessCalendar>(key.calendar(id))) ?? null;
}

export async function listCalendars(): Promise<BusinessCalendar[]> {
  const index: string[] = (await kvs.get<string[]>(key.calendarIndex)) ?? [];
  const results = await Promise.all(index.map((id) => getCalendar(id)));
  return results.filter((c): c is BusinessCalendar => c !== null);
}

// ─── Issue Checkpoints ────────────────────────────────────────────────────────

export async function saveCheckpoint(cp: IssueCheckpoint): Promise<void> {
  await kvs.set(key.checkpoint(cp.ruleSetId, cp.issueKey), cp);
}

export async function getCheckpoint(
  ruleSetId: string,
  issueKey: string,
): Promise<IssueCheckpoint | null> {
  return (
    (await kvs.get<IssueCheckpoint>(key.checkpoint(ruleSetId, issueKey))) ?? null
  );
}

// ─── Issue SLA Segments ───────────────────────────────────────────────────────

export async function saveSegments(
  ruleSetId: string,
  issueKey: string,
  segments: IssueSlaSegment[],
): Promise<void> {
  await Promise.all([
    kvs.set(key.segments(ruleSetId, issueKey), segments),
    kvs.set(key.issueRuleSet(issueKey), ruleSetId),
  ]);
}

export async function getSegments(
  issueKey: string,
  ruleSetId?: string,
): Promise<IssueSlaSegment[]> {
  const resolvedRuleSetId =
    ruleSetId ?? (await kvs.get<string>(key.issueRuleSet(issueKey))) ?? undefined;

  if (!resolvedRuleSetId) {
    return [];
  }

  return (
    (await kvs.get<IssueSlaSegment[]>(
      key.segments(resolvedRuleSetId, issueKey),
    )) ?? []
  );
}

// ─── Issue SLA Summaries ──────────────────────────────────────────────────────

export async function saveSummary(summary: IssueSummary): Promise<void> {
  await Promise.all([
    kvs.set(key.summary(summary.ruleSetId, summary.issueKey), summary),
    kvs.set(key.issueRuleSet(summary.issueKey), summary.ruleSetId),
  ]);
}

export async function getSummary(
  issueKey: string,
  ruleSetId?: string,
): Promise<IssueSummary | null> {
  const resolvedRuleSetId =
    ruleSetId ?? (await kvs.get<string>(key.issueRuleSet(issueKey))) ?? undefined;

  if (!resolvedRuleSetId) {
    return null;
  }

  return (
    (await kvs.get<IssueSummary>(key.summary(resolvedRuleSetId, issueKey))) ??
    null
  );
}

export async function listSummariesForProject(
  projectKey: string,
  ruleSetId?: string,
): Promise<IssueSummary[]> {
  const summaries = await queryByPrefix<IssueSummary>(key.summaryPrefix(ruleSetId));
  return summaries.filter((summary) =>
    summary.issueKey.startsWith(`${projectKey}-`),
  );
}

export async function listAllSummaries(ruleSetId?: string): Promise<IssueSummary[]> {
  return queryByPrefix<IssueSummary>(key.summaryPrefix(ruleSetId));
}

// ─── Daily Aggregates ─────────────────────────────────────────────────────────

export async function saveAggregate(agg: AggregateDaily): Promise<void> {
  await kvs.set(key.aggregate(agg.projectKey, agg.ruleSetId, agg.date), agg);
}

export async function getAggregate(
  ruleSetId: string,
  date: string,
  projectKey: string,
): Promise<AggregateDaily | null> {
  return (
    (await kvs.get<AggregateDaily>(key.aggregate(projectKey, ruleSetId, date))) ??
    null
  );
}

export async function listAggregatesForProject(
  projectKey: string,
  ruleSetId?: string,
): Promise<AggregateDaily[]> {
  return queryByPrefix<AggregateDaily>(key.aggregatePrefix(projectKey, ruleSetId));
}

// ─── Rebuild Jobs ──────────────────────────────────────────────────────────────

export async function saveRebuildJob(job: RebuildJob): Promise<void> {
  await kvs.set(key.rebuildJob(job.jobId), job);
}

export async function getRebuildJob(id: string): Promise<RebuildJob | null> {
  return (await kvs.get<RebuildJob>(key.rebuildJob(id))) ?? null;
}

export async function listRebuildJobs(): Promise<RebuildJob[]> {
  const jobs = await queryByPrefix<RebuildJob>(key.rebuildJobPrefix);
  return jobs
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
    .slice(0, 100);
}
