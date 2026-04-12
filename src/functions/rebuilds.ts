import { v4 as uuidv4 } from 'uuid';
import { searchIssues } from '../api/jira';
import {
  listRebuildJobs as listStoredRebuildJobs,
  listRuleSets,
  saveRebuildJob,
} from '../api/storage';
import { RebuildJob, RuleSet } from '../sla/types';
import { syncIssueHistory } from './syncIssueHistory';

interface RecomputeIssueInput {
  issueKey: string;
  ruleSetId?: string;
}

interface RecomputeProjectWindowInput {
  projectKey: string;
  dateStart?: string;
  dateEnd?: string;
  ruleSetId?: string;
}

interface JobRunResult {
  processedIssueCount: number;
  errorCount: number;
  message: string;
}

export async function recomputeIssueSla(
  input: RecomputeIssueInput,
): Promise<{ success: boolean; job: RebuildJob }> {
  const issueKey = input.issueKey.trim().toUpperCase();
  const ruleSet = await resolveRuleSetForIssue(issueKey, input.ruleSetId);

  if (!ruleSet) {
    return {
      success: false,
      job: await failFastJob({
        scope: 'issue',
        issueKey,
        projectKey: issueKey.split('-')[0] ?? null,
        ruleSetId: input.ruleSetId ?? null,
        dateStart: null,
        dateEnd: null,
        message: `No rule set found for ${issueKey}.`,
      }),
    };
  }

  const job = createJob({
    scope: 'issue',
    issueKey,
    projectKey: issueKey.split('-')[0] ?? null,
    ruleSetId: ruleSet.ruleSetId,
    dateStart: null,
    dateEnd: null,
  });

  const completed = await runTrackedJob(job, async () => {
    await syncIssueHistory({
      issueKey,
      ruleSetId: ruleSet.ruleSetId,
      forceRebuild: true,
    });

    return {
      processedIssueCount: 1,
      errorCount: 0,
      message: `Rebuilt ${issueKey}.`,
    };
  });

  return { success: completed.status === 'completed', job: completed };
}

export async function recomputeProjectWindow(
  input: RecomputeProjectWindowInput,
): Promise<{ success: boolean; job: RebuildJob }> {
  const projectKey = input.projectKey.trim().toUpperCase();
  const matchingRuleSets = await resolveRuleSetsForProject(projectKey, input.ruleSetId);

  if (matchingRuleSets.length === 0) {
    return {
      success: false,
      job: await failFastJob({
        scope: 'project-window',
        issueKey: null,
        projectKey,
        ruleSetId: input.ruleSetId ?? null,
        dateStart: input.dateStart ?? null,
        dateEnd: input.dateEnd ?? null,
        message: `No rule set found for project ${projectKey}.`,
      }),
    };
  }

  const job = createJob({
    scope: 'project-window',
    issueKey: null,
    projectKey,
    ruleSetId: input.ruleSetId ?? null,
    dateStart: input.dateStart ?? null,
    dateEnd: input.dateEnd ?? null,
  });

  const completed = await runTrackedJob(job, async () => {
    const issues = await searchIssues(buildProjectRebuildJql(projectKey, input));
    let processedIssueCount = 0;
    let errorCount = 0;

    for (const ruleSet of matchingRuleSets) {
      for (const issue of issues) {
        try {
          await syncIssueHistory({
            issueKey: issue.key,
            ruleSetId: ruleSet.ruleSetId,
            forceRebuild: true,
          });
          processedIssueCount += 1;
        } catch (error) {
          errorCount += 1;
          console.error(
            `[recomputeProjectWindow] Failed to rebuild ${issue.key} for ${ruleSet.ruleSetId}:`,
            error,
          );
        }
      }
    }

    return {
      processedIssueCount,
      errorCount,
      message: `Processed ${processedIssueCount} issue rebuilds for ${projectKey}.`,
    };
  });

  return { success: completed.status === 'completed', job: completed };
}

export async function listRebuildJobs(): Promise<RebuildJob[]> {
  return listStoredRebuildJobs();
}

async function runTrackedJob(
  job: RebuildJob,
  run: () => Promise<JobRunResult>,
): Promise<RebuildJob> {
  const startedAt = new Date().toISOString();
  await saveRebuildJob({
    ...job,
    status: 'running',
    startedAt,
  });

  try {
    const result = await run();
    const completedAt = new Date().toISOString();

    const completedJob: RebuildJob = {
      ...job,
      status: result.errorCount > 0 ? 'failed' : 'completed',
      startedAt,
      completedAt,
      processedIssueCount: result.processedIssueCount,
      errorCount: result.errorCount,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      message: result.message,
    };

    await saveRebuildJob(completedJob);
    return completedJob;
  } catch (error) {
    const completedAt = new Date().toISOString();
    const failedJob: RebuildJob = {
      ...job,
      status: 'failed',
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      errorCount: 1,
      message: error instanceof Error ? error.message : String(error),
    };

    await saveRebuildJob(failedJob);
    return failedJob;
  }
}

function createJob(
  input: Pick<
    RebuildJob,
    'scope' | 'projectKey' | 'issueKey' | 'ruleSetId' | 'dateStart' | 'dateEnd'
  >,
): RebuildJob {
  return {
    jobId: uuidv4(),
    scope: input.scope,
    status: 'queued',
    projectKey: input.projectKey,
    issueKey: input.issueKey,
    ruleSetId: input.ruleSetId,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
    requestedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    processedIssueCount: 0,
    errorCount: 0,
    durationMs: null,
    message: null,
  };
}

async function failFastJob(
  input: Pick<
    RebuildJob,
    'scope' | 'projectKey' | 'issueKey' | 'ruleSetId' | 'dateStart' | 'dateEnd'
  > & { message: string },
): Promise<RebuildJob> {
  const job: RebuildJob = {
    ...createJob(input),
    status: 'failed',
    completedAt: new Date().toISOString(),
    durationMs: 0,
    errorCount: 1,
    message: input.message,
  };

  await saveRebuildJob(job);
  return job;
}

async function resolveRuleSetForIssue(
  issueKey: string,
  requestedRuleSetId?: string,
): Promise<RuleSet | null> {
  const projectKey = issueKey.split('-')[0];
  const ruleSets = await listRuleSets();

  if (requestedRuleSetId) {
    return ruleSets.find((ruleSet) => ruleSet.ruleSetId === requestedRuleSetId) ?? null;
  }

  return (
    ruleSets.find((ruleSet) => ruleSet.projectKeys.includes(projectKey))
      ?? ruleSets.find((ruleSet) => ruleSet.projectKeys.length === 0)
      ?? null
  );
}

async function resolveRuleSetsForProject(
  projectKey: string,
  requestedRuleSetId?: string,
): Promise<RuleSet[]> {
  const ruleSets = await listRuleSets();

  if (requestedRuleSetId) {
    return ruleSets.filter((ruleSet) => ruleSet.ruleSetId === requestedRuleSetId);
  }

  return ruleSets.filter(
    (ruleSet) =>
      ruleSet.projectKeys.includes(projectKey) || ruleSet.projectKeys.length === 0,
  );
}

function buildProjectRebuildJql(
  projectKey: string,
  input: RecomputeProjectWindowInput,
): string {
  const clauses = [`project = "${projectKey}"`];

  if (input.dateStart) {
    clauses.push(`updated >= "${input.dateStart}"`);
  }

  if (input.dateEnd) {
    clauses.push(`updated <= "${input.dateEnd}"`);
  }

  return `${clauses.join(' AND ')} ORDER BY updated ASC`;
}
