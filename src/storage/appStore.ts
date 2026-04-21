import { calculateIssueSla } from '../domain/rules/engine';
import type {
  AdminMetadata,
  BootstrapData,
  BootstrapRequest,
  BusinessCalendar,
  FieldMapping,
  DashboardMetric,
  IssueCheckpoint,
  IssueSearchFilters,
  IssueSegment,
  IssueSnapshot,
  IssueSummary,
  OverviewMetrics,
  RebuildJob,
  RuleSet,
} from '../domain/types';
import { normalizeJiraIssue } from '../integrations/jira/normalize';
import type { ApplicationStore } from './contracts';
import { JiraApplicationStore } from './jiraApplicationStore';
import {
  sampleCalendars,
  sampleFieldMappings,
  sampleIssues,
  sampleRuleSets,
} from './seed';

const average = (values: number[]): number => (values.length > 0 ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class MemoryApplicationStore implements ApplicationStore {
  private readonly snapshots = new Map<string, IssueSnapshot>();
  private readonly ruleSets = new Map<string, RuleSet>();
  private readonly fieldMappings = new Map<string, FieldMapping>();
  private readonly calendars = new Map<string, BusinessCalendar>();
  private readonly summaries = new Map<string, IssueSummary>();
  private readonly segments = new Map<string, IssueSegment[]>();
  private readonly checkpoints = new Map<string, IssueCheckpoint>();
  private readonly rebuildJobs: RebuildJob[] = [];

  constructor({
    issues = sampleIssues,
    ruleSets = sampleRuleSets,
    fieldMappings = sampleFieldMappings,
    calendars = sampleCalendars,
  }: {
    issues?: typeof sampleIssues;
    ruleSets?: RuleSet[];
    fieldMappings?: FieldMapping[];
    calendars?: BusinessCalendar[];
  } = {}) {
    for (const issue of issues) {
      const normalized = normalizeJiraIssue(issue);
      this.snapshots.set(normalized.issueKey, normalized);
    }
    for (const ruleSet of ruleSets) {
      this.ruleSets.set(ruleSet.ruleSetId, clone(ruleSet));
    }
    for (const fieldMapping of fieldMappings) {
      this.fieldMappings.set(fieldMapping.fieldMappingId, clone(fieldMapping));
    }
    for (const calendar of calendars) {
      this.calendars.set(calendar.calendarId, clone(calendar));
    }

    for (const issueKey of this.snapshots.keys()) {
      this.recomputeIssueSync(issueKey, 'seed');
    }
  }

  private getRuleSetForProject(projectKey: string): RuleSet {
    const ruleSet = [...this.ruleSets.values()].find((item) => item.enabled && item.projectKeys.includes(projectKey));
    if (!ruleSet) {
      throw new Error(`No rule set found for project ${projectKey}.`);
    }
    return clone(ruleSet);
  }

  private getCalendar(calendarId: string): BusinessCalendar {
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new Error(`No calendar found for ${calendarId}.`);
    }
    return clone(calendar);
  }

  private recomputeIssueSync(issueKey: string, source: RebuildJob['source']): IssueSummary {
    const snapshot = this.snapshots.get(issueKey);
    if (!snapshot) {
      throw new Error(`Issue ${issueKey} was not found.`);
    }

    const ruleSet = this.getRuleSetForProject(snapshot.projectKey);
    const calendar = this.getCalendar(ruleSet.businessCalendarId);
    const computation = calculateIssueSla({ snapshot, ruleSet, calendar });

    this.summaries.set(issueKey, clone(computation.summary));
    this.segments.set(issueKey, clone(computation.segments));
    this.checkpoints.set(issueKey, clone(computation.checkpoint));
    this.rebuildJobs.unshift({
      jobId: `${source}-${issueKey}-${this.rebuildJobs.length + 1}`,
      issueKey,
      source,
      status: 'completed',
      createdAt: computation.summary.recomputedAt,
      completedAt: computation.summary.recomputedAt,
      message: `Recomputed ${issueKey} from ${source} trigger.`,
    });

    return clone(computation.summary);
  }

  async listRuleSets(): Promise<RuleSet[]> {
    return [...this.ruleSets.values()].map(clone);
  }

  async listFieldMappings(): Promise<FieldMapping[]> {
    return [...this.fieldMappings.values()].map(clone);
  }

  async listCalendars(): Promise<BusinessCalendar[]> {
    return [...this.calendars.values()].map(clone);
  }

  async listRebuildJobs(): Promise<RebuildJob[]> {
    return this.rebuildJobs.map(clone);
  }

  async getIssueSnapshot(issueKey: string): Promise<IssueSnapshot | undefined> {
    const snapshot = this.snapshots.get(issueKey);
    return snapshot ? clone(snapshot) : undefined;
  }

  async getIssueSummary(issueKey: string): Promise<IssueSummary | undefined> {
    const summary = this.summaries.get(issueKey);
    return summary ? clone(summary) : undefined;
  }

  async getIssueSegments(issueKey: string): Promise<IssueSegment[]> {
    return clone(this.segments.get(issueKey) ?? []);
  }

  async listIssueSummaries(filters: IssueSearchFilters = {}): Promise<IssueSummary[]> {
    const snapshotByIssue = this.snapshots;
    return [...this.summaries.values()]
      .filter((summary) => {
        const snapshot = snapshotByIssue.get(summary.issueKey);
        if (!snapshot) {
          return false;
        }
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
        if (filters.status && !this.segments.get(summary.issueKey)?.some((segment) => segment.status === filters.status)) {
          return false;
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
    const nextRuleSet = clone({ ...ruleSet, version: ruleSet.version + 1 });
    this.ruleSets.set(nextRuleSet.ruleSetId, nextRuleSet);

    for (const snapshot of this.snapshots.values()) {
      if (nextRuleSet.projectKeys.includes(snapshot.projectKey)) {
        const checkpoint = this.checkpoints.get(snapshot.issueKey);
        if (checkpoint) {
          checkpoint.needsRebuild = true;
          this.checkpoints.set(snapshot.issueKey, checkpoint);
        }
      }
    }

    return clone(nextRuleSet);
  }

  async saveFieldMapping(fieldMapping: FieldMapping): Promise<FieldMapping> {
    this.fieldMappings.set(fieldMapping.fieldMappingId, clone(fieldMapping));
    return clone(fieldMapping);
  }

  async saveCalendar(calendar: BusinessCalendar): Promise<BusinessCalendar> {
    this.calendars.set(calendar.calendarId, clone(calendar));
    for (const checkpoint of this.checkpoints.values()) {
      checkpoint.needsRebuild = true;
    }
    return clone(calendar);
  }

  async markIssueForRebuild(issueKey: string): Promise<RebuildJob> {
    const checkpoint = this.checkpoints.get(issueKey);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for ${issueKey}.`);
    }
    checkpoint.needsRebuild = true;
    const job: RebuildJob = {
      jobId: `queued-${issueKey}-${Date.now()}`,
      issueKey,
      source: 'manual',
      status: 'queued',
      createdAt: new Date().toISOString(),
      message: `Issue ${issueKey} marked for rebuild.`,
    };
    this.rebuildJobs.unshift(job);
    return clone(job);
  }

  async recomputeIssue(issueKey: string, source: RebuildJob['source']): Promise<IssueSummary> {
    return this.recomputeIssueSync(issueKey, source);
  }

  async recomputePendingIssues(limit = 10): Promise<IssueSummary[]> {
    const pending = [...this.checkpoints.values()].filter((checkpoint) => checkpoint.needsRebuild).slice(0, limit);
    return pending.map((checkpoint) => this.recomputeIssueSync(checkpoint.issueKey, 'scheduled'));
  }

  async getCheckpoint(issueKey: string): Promise<IssueCheckpoint | undefined> {
    const checkpoint = this.checkpoints.get(issueKey);
    return checkpoint ? clone(checkpoint) : undefined;
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
    return [...totals.entries()].map(([label, value]) => ({
      label,
      valueSeconds: average([value.total / Math.max(value.count, 1)]),
      count: value.count,
    })).sort((left, right) => right.valueSeconds - left.valueSeconds);
  }

  private buildTeamMetrics(): DashboardMetric[] {
    const totals = new Map<string, { total: number; count: number }>();
    for (const segments of this.segments.values()) {
      for (const segment of segments.filter((entry) => entry.countsTowardActive)) {
        const label = segment.teamLabel ?? 'unmapped';
        const current = totals.get(label) ?? { total: 0, count: 0 };
        current.total += segment.businessSeconds;
        current.count += 1;
        totals.set(label, current);
      }
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

  private buildAdminMetadata(): AdminMetadata {
    const projects = [...new Set([...this.ruleSets.values()].flatMap((ruleSet) => ruleSet.projectKeys))]
      .sort((left, right) => left.localeCompare(right))
      .map((projectKey) => ({ value: projectKey, label: projectKey }));
    const assignees = [...new Set([...this.ruleSets.values()].flatMap((ruleSet) => ruleSet.trackedAssignees))]
      .sort((left, right) => left.localeCompare(right))
      .map((assignee) => ({ value: assignee, label: assignee }));
    const teams = [...new Set([...this.ruleSets.values()].flatMap((ruleSet) => ruleSet.trackedTeams))]
      .sort((left, right) => left.localeCompare(right))
      .map((team) => ({ value: team, label: team }));
    const statuses = [...new Set(
      [...this.ruleSets.values()].flatMap((ruleSet) => [
        ...ruleSet.activeStatuses,
        ...ruleSet.pausedStatuses,
        ...ruleSet.stoppedStatuses,
        ...ruleSet.resumeStatuses,
      ]),
    )].sort((left, right) => left.localeCompare(right));
    const jiraFields = [...this.fieldMappings.values()]
      .flatMap((mapping) => [
        mapping.assigneeFieldKey,
        mapping.statusFieldKey,
        mapping.priorityFieldKey,
        mapping.resolutionFieldKey,
        mapping.teamFieldKey,
        mapping.ownershipFieldKey,
        mapping.responsibleOrganizationFieldKey,
      ])
      .filter((field): field is string => Boolean(field))
      .filter((field, index, all) => all.indexOf(field) === index)
      .sort((left, right) => left.localeCompare(right))
      .map((field) => ({ value: field, label: field }));
    const fieldMappingDiagnostics = [...this.fieldMappings.values()].map((mapping) => {
      const messages = [
        mapping.ownershipFieldKey
          ? `Ownership field mapped to ${mapping.ownershipFieldKey}.`
          : 'Ownership field is not mapped; ownership-field start mode will fall back to team/assignee precedence.',
      ];
      return {
        fieldMappingId: mapping.fieldMappingId,
        valid: true,
        messages,
      };
    });

    return {
      projects,
      assignees,
      teams,
      statuses,
      jiraFields,
      warnings: ['Seed mode is enabled; issue data and selector options come from local fixtures.'],
      teamFieldConfigured: jiraFields.some((field) => field.value === 'Team'),
      teamFieldKey: jiraFields.find((field) => field.value === 'Team')?.value,
      fieldMappingDiagnostics,
    };
  }

  async getAdminMetadata(): Promise<AdminMetadata> {
    return this.buildAdminMetadata();
  }

  async getBootstrapData({ surface, issueKey }: BootstrapRequest): Promise<BootstrapData> {
    const summaries = await this.listIssueSummaries();
    const selectedSummary = issueKey ? await this.getIssueSummary(issueKey) : summaries[0];
    const selectedIssue = selectedSummary ? {
      summary: selectedSummary,
      segments: await this.getIssueSegments(selectedSummary.issueKey),
    } : undefined;

    return {
      surface,
      selectedIssueKey: selectedSummary?.issueKey,
      summaries,
      selectedIssue,
      ruleSets: await this.listRuleSets(),
      fieldMappings: await this.listFieldMappings(),
      calendars: await this.listCalendars(),
      rebuildJobs: await this.listRebuildJobs(),
      overview: this.buildOverview(summaries),
      assigneeMetrics: this.buildAssigneeMetrics(summaries),
      teamMetrics: this.buildTeamMetrics(),
      breachMetrics: this.buildBreachMetrics(summaries),
      adminMetadata: this.buildAdminMetadata(),
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

const shouldUseMemoryStore = (): boolean => (
  process.env.USE_SEED_DATA === 'true'
  || process.env.NODE_ENV === 'test'
  || process.env.NODE_ENV === 'development'
);

export const createApplicationStore = (): ApplicationStore => (
  shouldUseMemoryStore()
    ? new MemoryApplicationStore()
    : new JiraApplicationStore()
);
export const appStore: ApplicationStore = createApplicationStore();
