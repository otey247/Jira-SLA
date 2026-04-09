import api, { route } from '@forge/api';
import {
  JiraChangelogEntry,
  JiraIssue,
  JiraWorklog,
} from '../sla/types';

/**
 * Fetches a single Jira issue with its basic fields.
 */
export async function fetchIssue(issueKey: string): Promise<JiraIssue> {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,status,priority,assignee,created,updated,resolutiondate,project`);

  if (!response.ok) {
    throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`);
  }

  return response.json() as Promise<JiraIssue>;
}

/**
 * Fetches all changelog entries for an issue, handling pagination.
 * If afterId is provided only entries with id > afterId are returned.
 */
export async function fetchChangelog(
  issueKey: string,
  afterId?: string | null,
): Promise<JiraChangelogEntry[]> {
  const entries: JiraChangelogEntry[] = [];
  let startAt = 0;
  const maxResults = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
      );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch changelog for ${issueKey}: ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      values: JiraChangelogEntry[];
      total: number;
      isLast: boolean;
    };

    for (const entry of data.values) {
      // If afterId is supplied, skip entries we have already processed
      if (afterId && !isChangelogEntryNewer(entry.id, afterId)) {
        continue;
      }
      entries.push(entry);
    }

    hasMore = !(data.isLast || startAt + maxResults >= data.total);
    if (hasMore) {
      startAt += maxResults;
    }
  }

  return entries;
}

/**
 * Fetches worklogs for an issue (used as a secondary audit signal).
 */
export async function fetchWorklogs(issueKey: string): Promise<JiraWorklog[]> {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}/worklog`);

  if (!response.ok) {
    throw new Error(`Failed to fetch worklogs for ${issueKey}: ${response.status}`);
  }

  const data = (await response.json()) as { worklogs: JiraWorklog[] };
  return data.worklogs ?? [];
}

/**
 * Searches for issues in a project using JQL.
 */
export async function searchIssues(
  jql: string,
  fields = 'summary,status,priority,assignee,created,updated,resolutiondate,project',
  maxResults = 100,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  let hasMore = true;

  while (hasMore) {
    const body = { jql, fields: fields.split(','), startAt, maxResults };

    const response = await api.asApp().requestJira(route`/rest/api/3/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`JQL search failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      issues: JiraIssue[];
      total: number;
    };

    issues.push(...data.issues);

    hasMore = !(issues.length >= data.total || data.issues.length === 0);
    if (hasMore) {
      startAt += maxResults;
    }
  }

  return issues;
}

function isChangelogEntryNewer(
  entryId: string,
  afterId: string,
): boolean {
  const entryNumericId = Number(entryId);
  const afterNumericId = Number(afterId);

  if (Number.isFinite(entryNumericId) && Number.isFinite(afterNumericId)) {
    return entryNumericId > afterNumericId;
  }

  return entryId > afterId;
}
