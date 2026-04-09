import { kvs } from '@forge/kvs';
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
  checkpoint: (issueKey: string) => `issue_checkpoint::${issueKey}`,
  segments: (issueKey: string) => `issue_segments::${issueKey}`,
  summary: (issueKey: string) => `issue_summary::${issueKey}`,
  summaryIndex: (projectKey: string) => `issue_summary_index::${projectKey}`,
  aggregate: (date: string, project: string) =>
    `aggregate_daily::${date}::${project}`,
};

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
  await kvs.set(key.checkpoint(cp.issueKey), cp);
}

export async function getCheckpoint(
  issueKey: string,
): Promise<IssueCheckpoint | null> {
  return (await kvs.get<IssueCheckpoint>(key.checkpoint(issueKey))) ?? null;
}

// ─── Issue SLA Segments ───────────────────────────────────────────────────────

export async function saveSegments(
  issueKey: string,
  segments: IssueSlaSegment[],
): Promise<void> {
  await kvs.set(key.segments(issueKey), segments);
}

export async function getSegments(
  issueKey: string,
): Promise<IssueSlaSegment[]> {
  return (await kvs.get<IssueSlaSegment[]>(key.segments(issueKey))) ?? [];
}

// ─── Issue SLA Summaries ──────────────────────────────────────────────────────

export async function saveSummary(summary: IssueSummary): Promise<void> {
  await kvs.set(key.summary(summary.issueKey), summary);

  // Maintain a per-project index of issue keys
  const projectKey = summary.issueKey.split('-')[0];
  const index: string[] =
    (await kvs.get<string[]>(key.summaryIndex(projectKey))) ?? [];

  if (!index.includes(summary.issueKey)) {
    index.push(summary.issueKey);
    await kvs.set(key.summaryIndex(projectKey), index);
  }
}

export async function getSummary(
  issueKey: string,
): Promise<IssueSummary | null> {
  return (await kvs.get<IssueSummary>(key.summary(issueKey))) ?? null;
}

export async function listSummariesForProject(
  projectKey: string,
): Promise<IssueSummary[]> {
  const index: string[] =
    (await kvs.get<string[]>(key.summaryIndex(projectKey))) ?? [];
  const results = await Promise.all(index.map((k) => getSummary(k)));
  return results.filter((s): s is IssueSummary => s !== null);
}

// ─── Daily Aggregates ─────────────────────────────────────────────────────────

export async function saveAggregate(agg: AggregateDaily): Promise<void> {
  await kvs.set(key.aggregate(agg.date, agg.projectKey), agg);
}

export async function getAggregate(
  date: string,
  projectKey: string,
): Promise<AggregateDaily | null> {
  return (await kvs.get<AggregateDaily>(key.aggregate(date, projectKey))) ?? null;
}
