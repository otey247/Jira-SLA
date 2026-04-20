import { kvs, WhereConditions } from '@forge/kvs';
import {
  fetchAssignableUsers,
  fetchChangelog,
  fetchIssueWithFields,
  fetchProjects,
  fetchProjectStatuses,
  searchIssues,
  searchIssuesWithNames,
} from '../api/jira';
import { calculateIssueSla } from '../domain/rules/engine';
import type {
  AdminMetadata,
  BootstrapData,
  BootstrapRequest,
  BusinessCalendar,
  DashboardMetric,
  IssueCheckpoint,
  IssueSearchFilters,
  IssueSegment,
  IssueSnapshot,
  IssueSummary,
  OverviewMetrics,
  RebuildJob,
  RuleSet,
  SelectorOption,
} from '../domain/types';
import { extractTeamLabel, normalizeLiveJiraIssue } from '../integrations/jira/normalize';
import type { ApplicationStore } from './contracts';

const average = (values: number[]): number => (
  values.length > 0
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : 0
);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const storeKey = {
  ruleSet: (id: string) => `jira-store::rule-set::${id}`,
  ruleSetIndex: 'jira-store::rule-set::index',
  calendar: (id: string) => `jira-store::calendar::${id}`,
  calendarIndex: 'jira-store::calendar::index',
  snapshot: (issueKey: string) => `jira-store::snapshot::${issueKey}`,
  summary: (issueKey: string) => `jira-store::summary::${issueKey}`,
  summaryPrefix: 'jira-store::summary::',
  segments: (issueKey: string) => `jira-store::segments::${issueKey}`,
  segmentsPrefix: 'jira-store::segments::',
  checkpoint: (issueKey: string) => `jira-store::checkpoint::${issueKey}`,
  checkpointPrefix: 'jira-store::checkpoint::',
  rebuildJob: (jobId: string) => `jira-store::rebuild-job::${jobId}`,
  rebuildJobPrefix: 'jira-store::rebuild-job::',
};

const commonStatuses = [
  'To Do',
  'Open',
  'Assigned',
  'In Progress',
  'Working',
  'Waiting for customer',
  'Blocked',
  'Done',
  'Closed',
  'Resolved',
];

const queryByPrefix = async <T>(prefix: string): Promise<T[]> => {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    let query = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
    if (cursor) {
      query = query.cursor(cursor);
    }
    const page = await query.getMany<T>();
    results.push(...page.results.map((entry) => entry.value));
    cursor = page.nextCursor;
  } while (cursor);

  return results;
};

const createDefaultCalendar = (): BusinessCalendar => ({
  calendarId: `calendar-${Date.now()}`,
  name: 'Default Business Calendar',
  timezone: 'UTC',
  workingDays: [1, 2, 3, 4, 5],
  workingHours: {
    start: '09:00',
    end: '18:00',
  },
  holidays: [],
  afterHoursMode: 'business-hours',
});

const createDefaultRuleSet = (calendarId: string): RuleSet => ({
  ruleSetId: `rule-set-${Date.now()}`,
  name: 'Default Rule Set',
  version: 1,
  projectKeys: [],
  trackedAssignees: [],
  trackedTeams: [],
  startMode: 'assignment',
  activeStatuses: ['In Progress', 'Working'],
  pausedStatuses: ['Waiting for customer', 'Blocked'],
  stoppedStatuses: ['Done', 'Closed', 'Resolved'],
  resumeStatuses: ['In Progress', 'Working'],
  businessCalendarId: calendarId,
  priorityOverrides: [],
  enabled: true,
  defaultTimingMode: 'business-hours',
  defaultResponseThresholdSeconds: 7200,
  defaultActiveThresholdSeconds: 28800,
});

export class JiraApplicationStore implements ApplicationStore {
  private readonly configuredTeamFieldKey = process.env.TEAM_FIELD_KEY?.trim() || undefined;
  private defaultsEnsured = false;
  private primed = false;
  private detectedTeamFieldKey: string | undefined;

  private async ensureDefaults(): Promise<void> {
    if (this.defaultsEnsured) {
      return;
    }

    const [ruleSetIndex, calendarIndex] = await Promise.all([
      kvs.get<string[]>(storeKey.ruleSetIndex),
      kvs.get<string[]>(storeKey.calendarIndex),
    ]);

    let activeCalendarIds = calendarIndex ?? [];
    if (activeCalendarIds.length === 0) {
      const calendar = createDefaultCalendar();
      await kvs.set(storeKey.calendar(calendar.calendarId), calendar);
      activeCalendarIds = [calendar.calendarId];
      await kvs.set(storeKey.calendarIndex, activeCalendarIds);
    }

    if ((ruleSetIndex ?? []).length === 0) {
      const ruleSet = createDefaultRuleSet(activeCalendarIds[0]);
      await kvs.set(storeKey.ruleSet(ruleSet.ruleSetId), ruleSet);
      await kvs.set(storeKey.ruleSetIndex, [ruleSet.ruleSetId]);
    }

    this.defaultsEnsured = true;
  }

  private async loadRuleSetIndex(): Promise<string[]> {
    await this.ensureDefaults();
    return (await kvs.get<string[]>(storeKey.ruleSetIndex)) ?? [];
  }

  private async loadCalendarIndex(): Promise<string[]> {
    await this.ensureDefaults();
    return (await kvs.get<string[]>(storeKey.calendarIndex)) ?? [];
  }

  private async getRuleSetForProject(projectKey: string): Promise<RuleSet> {
    const ruleSet = (await this.listRuleSets()).find(
      (item) => item.enabled && item.projectKeys.includes(projectKey),
    );
    if (!ruleSet) {
      throw new Error(`No enabled rule set found for project ${projectKey}.`);
    }
    return clone(ruleSet);
  }

  private async getCalendarForRuleSet(ruleSet: RuleSet): Promise<BusinessCalendar> {
    const calendar = await kvs.get<BusinessCalendar>(storeKey.calendar(ruleSet.businessCalendarId));
    if (!calendar) {
      throw new Error(`Business calendar ${ruleSet.businessCalendarId} was not found.`);
    }
    return clone(calendar);
  }

  private async saveSnapshot(snapshot: IssueSnapshot): Promise<void> {
    await kvs.set(storeKey.snapshot(snapshot.issueKey), snapshot);
  }

  private async saveSegments(issueKey: string, segments: IssueSegment[]): Promise<void> {
    await kvs.set(storeKey.segments(issueKey), segments);
  }

  private async saveSummary(summary: IssueSummary): Promise<void> {
    await kvs.set(storeKey.summary(summary.issueKey), summary);
  }

  private async saveCheckpoint(checkpoint: IssueCheckpoint): Promise<void> {
    await kvs.set(storeKey.checkpoint(checkpoint.issueKey), checkpoint);
  }

  private async saveRebuildJob(job: RebuildJob): Promise<void> {
    await kvs.set(storeKey.rebuildJob(job.jobId), job);
  }

  private async resolveTeamFieldKey(projectKeys: string[]): Promise<string | undefined> {
    if (this.configuredTeamFieldKey) {
      return this.configuredTeamFieldKey;
    }
    if (this.detectedTeamFieldKey) {
      return this.detectedTeamFieldKey;
    }

    for (const projectKey of projectKeys) {
      try {
        const { names } = await searchIssuesWithNames(
          `project = "${projectKey}" ORDER BY updated DESC`,
          ['*all'],
          1,
        );
        const detected = Object.entries(names).find(([, label]) => label === 'Team')?.[0];
        if (detected) {
          this.detectedTeamFieldKey = detected;
          return detected;
        }
      } catch {
        // Ignore discovery failures and fall back to the warning path.
      }
    }

    return undefined;
  }

  private async syncIssue(
    issueKey: string,
    source: RebuildJob['source'],
    recordJob: boolean,
  ): Promise<IssueSummary> {
    const projectKey = issueKey.split('-')[0] ?? '';
    const teamFieldKey = await this.resolveTeamFieldKey(projectKey ? [projectKey] : []);
    const extraFields = teamFieldKey ? [teamFieldKey] : [];
    const issue = await fetchIssueWithFields(issueKey, extraFields);
    const ruleSet = await this.getRuleSetForProject(issue.fields.project.key);
    const calendar = await this.getCalendarForRuleSet(ruleSet);
    const changelog = await fetchChangelog(issueKey);
    const snapshot = normalizeLiveJiraIssue({
      issue,
      changelog,
      teamFieldKey,
    });
    const computation = calculateIssueSla({ snapshot, ruleSet, calendar });
    const checkpoint: IssueCheckpoint = {
      issueKey: snapshot.issueKey,
      ruleSetId: ruleSet.ruleSetId,
      lastProcessedChangelogId: changelog.at(-1)?.id ?? '',
      lastIssueUpdatedTimestamp: snapshot.updatedAt,
      lastRecomputedAt: computation.summary.recomputedAt,
      summaryVersion: computation.checkpoint.summaryVersion,
      needsRebuild: false,
    };

    await Promise.all([
      this.saveSnapshot(snapshot),
      this.saveSegments(issueKey, computation.segments),
      this.saveSummary(computation.summary),
      this.saveCheckpoint(checkpoint),
    ]);

    if (recordJob) {
      await this.saveRebuildJob({
        jobId: `${source}-${issueKey}-${Date.now()}`,
        issueKey,
        source,
        status: 'completed',
        createdAt: computation.summary.recomputedAt,
        completedAt: computation.summary.recomputedAt,
        message: `Synced ${issueKey} from Jira.`,
      });
    }

    return clone(computation.summary);
  }

  private async primeSummariesIfNeeded(): Promise<void> {
    if (this.primed) {
      return;
    }

    const existing = await queryByPrefix<IssueSummary>(storeKey.summaryPrefix);
    if (existing.length > 0) {
      this.primed = true;
      return;
    }

    const ruleSets = await this.listRuleSets();
    for (const ruleSet of ruleSets.filter((item) => item.enabled)) {
      for (const projectKey of ruleSet.projectKeys) {
        const teamFieldKey = await this.resolveTeamFieldKey([projectKey]);
        const issues = await searchIssues(
          `project = "${projectKey}" ORDER BY updated DESC`,
          [
            'summary',
            'status',
            'priority',
            'assignee',
            'created',
            'updated',
            'resolutiondate',
            'project',
            ...(teamFieldKey ? [teamFieldKey] : []),
          ],
          50,
        );

        for (const issue of issues) {
          await this.syncIssue(issue.key, 'scheduled', false);
        }
      }
    }

    this.primed = true;
  }

  private async refreshProjectSummaries(projectKey: string): Promise<void> {
    const teamFieldKey = await this.resolveTeamFieldKey([projectKey]);
    const issues = await searchIssues(
      `project = "${projectKey}" ORDER BY updated DESC`,
      [
        'summary',
        'status',
        'priority',
        'assignee',
        'created',
        'updated',
        'resolutiondate',
        'project',
        ...(teamFieldKey ? [teamFieldKey] : []),
      ],
      100,
    );

    for (const issue of issues) {
      await this.syncIssue(issue.key, 'manual', false);
    }
  }

  private async refreshBootstrapData(issueKey?: string): Promise<void> {
    const ruleSets = await this.listRuleSets();
    const projectKeys = [...new Set(
      ruleSets
        .filter((ruleSet) => ruleSet.enabled)
        .flatMap((ruleSet) => ruleSet.projectKeys),
    )];

    for (const projectKey of projectKeys) {
      await this.refreshProjectSummaries(projectKey);
    }

    const issueProjectKey = issueKey?.split('-')[0];
    if (issueKey && issueProjectKey && !projectKeys.includes(issueProjectKey)) {
      await this.syncIssue(issueKey, 'manual', false);
    }

    this.primed = true;
  }

  private buildOverview(summaries: IssueSummary[]): OverviewMetrics {
    return {
      issueCount: summaries.length,
      breachCount: summaries.filter((summary) => summary.breachState === 'breached').length,
      averageResponseSeconds: average(summaries.map((summary) => summary.responseSeconds)),
      averageActiveSeconds: average(summaries.map((summary) => summary.activeSeconds)),
      totalPausedSeconds: summaries.reduce((total, summary) => total + summary.pausedSeconds, 0),
    };
  }

  private buildAssigneeMetrics(summaries: IssueSummary[]): DashboardMetric[] {
    const totals = new Map<string, { total: number; count: number }>();
    for (const summary of summaries) {
      for (const metric of summary.assigneeMetrics) {
        const current = totals.get(metric.assigneeAccountId) ?? { total: 0, count: 0 };
        current.total += metric.activeSeconds;
        current.count += 1;
        totals.set(metric.assigneeAccountId, current);
      }
    }
    return [...totals.entries()]
      .map(([label, value]) => ({
        label,
        valueSeconds: average([value.total / Math.max(value.count, 1)]),
        count: value.count,
      }))
      .sort((left, right) => right.valueSeconds - left.valueSeconds);
  }

  private buildTeamMetrics(segments: IssueSegment[]): DashboardMetric[] {
    const totals = new Map<string, { total: number; count: number }>();
    for (const segment of segments.filter((entry) => entry.countsTowardActive)) {
      const label = segment.teamLabel ?? 'unmapped';
      const current = totals.get(label) ?? { total: 0, count: 0 };
      current.total += segment.businessSeconds;
      current.count += 1;
      totals.set(label, current);
    }
    return [...totals.entries()].map(([label, value]) => ({
      label,
      valueSeconds: average([value.total / Math.max(value.count, 1)]),
      count: value.count,
    }));
  }

  private buildBreachMetrics(summaries: IssueSummary[]): Array<{ priority: string; count: number }> {
    const counts = new Map<string, number>();
    for (const summary of summaries.filter((item) => item.breachState === 'breached')) {
      counts.set(summary.currentPriority, (counts.get(summary.currentPriority) ?? 0) + 1);
    }
    return [...counts.entries()].map(([priority, count]) => ({ priority, count }));
  }

  private async buildAdminMetadata(projectKeys: string[] = []): Promise<AdminMetadata> {
    const warnings: string[] = [];
    let projects: SelectorOption[] = [];
    let assignees: SelectorOption[] = [];
    let statuses: string[] = [];
    let teams: SelectorOption[] = [];
    const teamFieldKey = projectKeys.length > 0 ? await this.resolveTeamFieldKey(projectKeys) : undefined;

    try {
      const jiraProjects = await fetchProjects();
      projects = jiraProjects.map((project) => ({
        value: project.key,
        label: project.key,
        description: project.name,
      }));
    } catch (cause) {
      warnings.push(cause instanceof Error ? cause.message : 'Unable to load Jira projects.');
    }

    if (projectKeys.length === 0) {
      warnings.push('Select one or more Jira projects to load assignees, teams, and statuses.');
    }

    if (projectKeys.length > 0) {
      try {
        const userMap = new Map<string, SelectorOption>();
        for (const projectKey of projectKeys) {
          const users = await fetchAssignableUsers(projectKey);
          for (const user of users.filter((entry) => entry.active !== false)) {
            userMap.set(user.accountId, {
              value: user.accountId,
              label: user.displayName,
              description: projectKey,
            });
          }
        }
        assignees = [...userMap.values()].sort((left, right) => left.label.localeCompare(right.label));
      } catch (cause) {
        warnings.push(cause instanceof Error ? cause.message : 'Unable to load Jira assignees.');
      }

      try {
        const statusSet = new Set<string>();
        for (const projectKey of projectKeys) {
          const projectStatuses = await fetchProjectStatuses(projectKey);
          for (const status of projectStatuses) {
            statusSet.add(status);
          }
        }
        statuses = [...statusSet].sort((left, right) => left.localeCompare(right));
      } catch (cause) {
        warnings.push(cause instanceof Error ? cause.message : 'Unable to load Jira statuses.');
      }

      if (teamFieldKey) {
        try {
          const teamSet = new Set<string>();
          for (const projectKey of projectKeys) {
            const issues = await searchIssues(
              `project = "${projectKey}" AND ${teamFieldKey} IS NOT EMPTY ORDER BY updated DESC`,
              [
                'summary',
                'status',
                'priority',
                'assignee',
                'created',
                'updated',
                'resolutiondate',
                'project',
                teamFieldKey,
              ],
              100,
            );
            for (const issue of issues) {
              const label = extractTeamLabel(issue.fields[teamFieldKey]);
              if (label) {
                teamSet.add(label);
              }
            }
          }
          teams = [...teamSet]
            .sort((left, right) => left.localeCompare(right))
            .map((team) => ({ value: team, label: team }));
        } catch (cause) {
          warnings.push(cause instanceof Error ? cause.message : 'Unable to load Jira team options.');
        }
      } else {
        warnings.push('A Jira Team field could not be detected. Set TEAM_FIELD_KEY if your tenant uses a custom team field key.');
      }
    }

    const selectedRuleSet = (await this.listRuleSets())[0];
    const fallbackStatuses = selectedRuleSet
      ? [...new Set([...commonStatuses, ...selectedRuleSet.activeStatuses, ...selectedRuleSet.pausedStatuses, ...selectedRuleSet.stoppedStatuses, ...selectedRuleSet.resumeStatuses])]
      : commonStatuses;

    return {
      projects,
      assignees,
      teams,
      statuses: statuses.length > 0 ? statuses : fallbackStatuses,
      warnings,
      teamFieldConfigured: Boolean(teamFieldKey),
      teamFieldKey,
    };
  }

  async getAdminMetadata(projectKeys: string[] = []): Promise<AdminMetadata> {
    await this.ensureDefaults();
    return this.buildAdminMetadata(projectKeys);
  }

  async listRuleSets(): Promise<RuleSet[]> {
    const index = await this.loadRuleSetIndex();
    const results = await Promise.all(index.map((id) => kvs.get<RuleSet>(storeKey.ruleSet(id))));
    return results.filter((item): item is RuleSet => Boolean(item)).map(clone);
  }

  async listCalendars(): Promise<BusinessCalendar[]> {
    const index = await this.loadCalendarIndex();
    const results = await Promise.all(index.map((id) => kvs.get<BusinessCalendar>(storeKey.calendar(id))));
    return results.filter((item): item is BusinessCalendar => Boolean(item)).map(clone);
  }

  async listRebuildJobs(): Promise<RebuildJob[]> {
    const jobs = await queryByPrefix<RebuildJob>(storeKey.rebuildJobPrefix);
    return jobs
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100)
      .map(clone);
  }

  async getIssueSnapshot(issueKey: string): Promise<IssueSnapshot | undefined> {
    const snapshot = await kvs.get<IssueSnapshot>(storeKey.snapshot(issueKey));
    if (snapshot) {
      return clone(snapshot);
    }
    await this.syncIssue(issueKey, 'manual', false);
    const refreshed = await kvs.get<IssueSnapshot>(storeKey.snapshot(issueKey));
    return refreshed ? clone(refreshed) : undefined;
  }

  async getIssueSummary(issueKey: string): Promise<IssueSummary | undefined> {
    const summary = await kvs.get<IssueSummary>(storeKey.summary(issueKey));
    if (summary) {
      return clone(summary);
    }
    const refreshed = await this.syncIssue(issueKey, 'manual', false);
    return clone(refreshed);
  }

  async getIssueSegments(issueKey: string): Promise<IssueSegment[]> {
    const segments = await kvs.get<IssueSegment[]>(storeKey.segments(issueKey));
    if (segments) {
      return clone(segments);
    }
    await this.syncIssue(issueKey, 'manual', false);
    return clone((await kvs.get<IssueSegment[]>(storeKey.segments(issueKey))) ?? []);
  }

  async listIssueSummaries(filters: IssueSearchFilters = {}): Promise<IssueSummary[]> {
    await this.primeSummariesIfNeeded();
    const summaries = await queryByPrefix<IssueSummary>(storeKey.summaryPrefix);
    return summaries
      .filter((summary) => {
        if (filters.projectKey && summary.projectKey !== filters.projectKey) {
          return false;
        }
        if (filters.assigneeAccountId && summary.currentAssignee !== filters.assigneeAccountId) {
          return false;
        }
        if (filters.priority && summary.currentPriority !== filters.priority) {
          return false;
        }
        if (filters.breachState && summary.breachState !== filters.breachState) {
          return false;
        }
        if (filters.status) {
          return summary.timelineExplanation.some((line) => line.includes(filters.status ?? ''));
        }
        if (filters.query) {
          const query = filters.query.toLowerCase();
          return summary.issueKey.toLowerCase().includes(query) || summary.summary.toLowerCase().includes(query);
        }
        return true;
      })
      .sort((left, right) => right.activeSeconds - left.activeSeconds)
      .map(clone);
  }

  async saveRuleSet(ruleSet: RuleSet): Promise<RuleSet> {
    await this.ensureDefaults();
    const existing = await kvs.get<RuleSet>(storeKey.ruleSet(ruleSet.ruleSetId));
    const nextRuleSet: RuleSet = {
      ...ruleSet,
      version: (existing?.version ?? Math.max(ruleSet.version - 1, 0)) + 1,
    };
    await kvs.set(storeKey.ruleSet(nextRuleSet.ruleSetId), nextRuleSet);

    const index = await this.loadRuleSetIndex();
    if (!index.includes(nextRuleSet.ruleSetId)) {
      await kvs.set(storeKey.ruleSetIndex, [...index, nextRuleSet.ruleSetId]);
    }

    const checkpoints = await queryByPrefix<IssueCheckpoint>(storeKey.checkpointPrefix);
    for (const checkpoint of checkpoints) {
      if (nextRuleSet.projectKeys.includes(checkpoint.issueKey.split('-')[0])) {
        await this.saveCheckpoint({ ...checkpoint, ruleSetId: nextRuleSet.ruleSetId, needsRebuild: true });
      }
    }

    this.primed = false;
    return clone(nextRuleSet);
  }

  async saveCalendar(calendar: BusinessCalendar): Promise<BusinessCalendar> {
    await this.ensureDefaults();
    await kvs.set(storeKey.calendar(calendar.calendarId), calendar);

    const index = await this.loadCalendarIndex();
    if (!index.includes(calendar.calendarId)) {
      await kvs.set(storeKey.calendarIndex, [...index, calendar.calendarId]);
    }

    const checkpoints = await queryByPrefix<IssueCheckpoint>(storeKey.checkpointPrefix);
    for (const checkpoint of checkpoints) {
      await this.saveCheckpoint({ ...checkpoint, needsRebuild: true });
    }

    return clone(calendar);
  }

  async markIssueForRebuild(issueKey: string): Promise<RebuildJob> {
    const existingCheckpoint = await kvs.get<IssueCheckpoint>(storeKey.checkpoint(issueKey));
    if (existingCheckpoint) {
      await this.saveCheckpoint({ ...existingCheckpoint, needsRebuild: true });
    }

    const job: RebuildJob = {
      jobId: `queued-${issueKey}-${Date.now()}`,
      issueKey,
      source: 'manual',
      status: 'queued',
      createdAt: new Date().toISOString(),
      message: `Issue ${issueKey} marked for rebuild.`,
    };
    await this.saveRebuildJob(job);
    return clone(job);
  }

  async recomputeIssue(issueKey: string, source: RebuildJob['source']): Promise<IssueSummary> {
    return this.syncIssue(issueKey, source, true);
  }

  async recomputePendingIssues(limit = 10): Promise<IssueSummary[]> {
    const checkpoints = await queryByPrefix<IssueCheckpoint>(storeKey.checkpointPrefix);
    const pending = checkpoints.filter((checkpoint) => checkpoint.needsRebuild).slice(0, limit);
    const results: IssueSummary[] = [];
    for (const checkpoint of pending) {
      results.push(await this.syncIssue(checkpoint.issueKey, 'scheduled', true));
    }
    return results.map(clone);
  }

  async getCheckpoint(issueKey: string): Promise<IssueCheckpoint | undefined> {
    const checkpoint = await kvs.get<IssueCheckpoint>(storeKey.checkpoint(issueKey));
    return checkpoint ? clone(checkpoint) : undefined;
  }

  async getBootstrapData({ surface, issueKey, refresh = false }: BootstrapRequest): Promise<BootstrapData> {
    await this.ensureDefaults();
    if (refresh) {
      await this.refreshBootstrapData(issueKey);
    } else {
      await this.primeSummariesIfNeeded();
    }

    const [ruleSets, calendars, summaries, jobs, allSegments] = await Promise.all([
      this.listRuleSets(),
      this.listCalendars(),
      this.listIssueSummaries(),
      this.listRebuildJobs(),
      queryByPrefix<IssueSegment[]>(storeKey.segmentsPrefix),
    ]);

    const selectedSummary = issueKey
      ? await this.getIssueSummary(issueKey)
      : summaries[0];
    const selectedIssue = selectedSummary
      ? {
          summary: selectedSummary,
          segments: await this.getIssueSegments(selectedSummary.issueKey),
        }
      : undefined;

    const selectedRuleSet = ruleSets[0];
    const adminMetadata = await this.buildAdminMetadata(selectedRuleSet?.projectKeys ?? []);

    return {
      surface,
      selectedIssueKey: selectedSummary?.issueKey,
      summaries,
      selectedIssue,
      ruleSets,
      calendars,
      rebuildJobs: jobs,
      overview: this.buildOverview(summaries),
      assigneeMetrics: this.buildAssigneeMetrics(summaries),
      teamMetrics: this.buildTeamMetrics(allSegments.flat()),
      breachMetrics: this.buildBreachMetrics(summaries),
      adminMetadata,
    };
  }

  async exportCsv(filters: IssueSearchFilters = {}): Promise<string> {
    const summaries = await this.listIssueSummaries(filters);
    const header = 'Issue Key,Summary,Priority,Current State,Response Seconds,Active Seconds,Paused Seconds,Breach State';
    const rows = summaries.map((summary) => [
      summary.issueKey,
      JSON.stringify(summary.summary),
      summary.currentPriority,
      summary.currentState,
      summary.responseSeconds,
      summary.activeSeconds,
      summary.pausedSeconds,
      summary.breachState,
    ].join(','));
    return [header, ...rows].join('\n');
  }
}
