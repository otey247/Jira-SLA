import { kvs, WhereConditions } from '@forge/kvs';
import {
  AggregateDaily,
  BusinessCalendar,
  IssueCheckpoint,
  IssueSlaSegment,
  IssueSummary,
  RuleSet,
} from '../sla/types';

// ─── Key helpers ─────────────────────────────────────────────────────────────

const key = {
  ruleSet: (id: string) => `rule_set::${id}`,
  ruleSetIndex: 'rule_set::index',
  calendar: (id: string) => `business_calendar::${id}`,
  calendarIndex: 'business_calendar::index',
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
  aggregate: (ruleSetId: string, date: string, project: string) =>
    `aggregate_daily::${ruleSetId}::${date}::${project}`,
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
  await kvs.set(key.segments(ruleSetId, issueKey), segments);
}

export async function getSegments(
  issueKey: string,
  ruleSetId?: string,
): Promise<IssueSlaSegment[]> {
  if (ruleSetId) {
    return (
      (await kvs.get<IssueSlaSegment[]>(key.segments(ruleSetId, issueKey))) ?? []
    );
  }

  const allSegments = await queryByPrefix<IssueSlaSegment[]>(
    key.segmentsPrefix(),
  );

  return allSegments.find((segments) =>
    segments.some((segment) => segment.issueKey === issueKey),
  ) ?? [];
}

// ─── Issue SLA Summaries ──────────────────────────────────────────────────────

export async function saveSummary(summary: IssueSummary): Promise<void> {
  await kvs.set(key.summary(summary.ruleSetId, summary.issueKey), summary);
}

export async function getSummary(
  issueKey: string,
  ruleSetId?: string,
): Promise<IssueSummary | null> {
  if (ruleSetId) {
    return (
      (await kvs.get<IssueSummary>(key.summary(ruleSetId, issueKey))) ?? null
    );
  }

  const allSummaries = await queryByPrefix<IssueSummary>(key.summaryPrefix());
  return allSummaries.find((summary) => summary.issueKey === issueKey) ?? null;
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

// ─── Daily Aggregates ─────────────────────────────────────────────────────────

export async function saveAggregate(agg: AggregateDaily): Promise<void> {
  await kvs.set(key.aggregate(agg.ruleSetId, agg.date, agg.projectKey), agg);
}

export async function getAggregate(
  ruleSetId: string,
  date: string,
  projectKey: string,
): Promise<AggregateDaily | null> {
  return (
    (await kvs.get<AggregateDaily>(key.aggregate(ruleSetId, date, projectKey))) ??
    null
  );
}
