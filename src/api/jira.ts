import api, { route } from '@forge/api';
import {
  JiraChangelogEntry,
  JiraIssue,
  JiraWorklog,
} from '../sla/types';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  active?: boolean;
}

export interface JiraFieldNameMap {
  [fieldId: string]: string;
}

export type JiraIssueWithDynamicFields = JiraIssue & {
  fields: JiraIssue['fields'] & Record<string, unknown>;
};

interface JiraSearchResponse {
  issues: JiraIssueWithDynamicFields[];
  total?: number;
  isLast?: boolean;
  nextPageToken?: string;
  names?: JiraFieldNameMap;
}

/**
 * Fetches a single Jira issue with its basic fields.
 */
export async function fetchIssue(issueKey: string): Promise<JiraIssue> {
  return fetchIssueWithFields(issueKey);
}

export async function fetchIssueWithFields(
  issueKey: string,
  extraFields: string[] = [],
): Promise<JiraIssueWithDynamicFields> {
  const fields = [
    'summary',
    'status',
    'priority',
    'assignee',
    'created',
    'updated',
    'resolutiondate',
    'project',
    ...extraFields,
  ];
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}?fields=${fields.join(',')}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`);
  }

  return response.json() as Promise<JiraIssueWithDynamicFields>;
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
  fields: string | string[] = 'summary,status,priority,assignee,created,updated,resolutiondate,project',
  maxResults = 100,
): Promise<JiraIssueWithDynamicFields[]> {
  const issues: JiraIssueWithDynamicFields[] = [];
  let nextPageToken: string | undefined;
  let hasMore = true;
  const requestedFields = Array.isArray(fields) ? fields : fields.split(',');

  while (hasMore) {
    const body = {
      jql,
      fields: requestedFields,
      maxResults,
      nextPageToken,
      fieldsByKeys: false,
    };

    const response = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`JQL search failed: ${response.status}`);
    }

    const data = (await response.json()) as JiraSearchResponse;

    issues.push(...(data.issues ?? []));

    hasMore = Boolean(data.nextPageToken) || data.isLast === false;
    nextPageToken = data.nextPageToken;
  }

  return issues;
}

export async function searchIssuesWithNames(
  jql: string,
  fields: string[] = ['summary', 'project', 'assignee', 'status', 'priority'],
  maxResults = 1,
): Promise<{ issues: JiraIssueWithDynamicFields[]; names: JiraFieldNameMap }> {
  const response = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql,
      fields,
      maxResults,
      expand: 'names',
      fieldsByKeys: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`JQL search with names failed: ${response.status}`);
  }

  const data = (await response.json()) as JiraSearchResponse;
  return {
    issues: data.issues ?? [],
    names: data.names ?? {},
  };
}

export async function fetchProjects(): Promise<JiraProject[]> {
  const projects: JiraProject[] = [];
  let startAt = 0;
  const maxResults = 50;
  let isLast = false;

  while (!isLast) {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch Jira projects: ${response.status}`);
    }

    const data = (await response.json()) as {
      values: JiraProject[];
      isLast: boolean;
      total: number;
    };

    projects.push(...(data.values ?? []));
    isLast = data.isLast || projects.length >= data.total;
    startAt += maxResults;
  }

  return projects;
}

export async function fetchAssignableUsers(projectKey: string): Promise<JiraUser[]> {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=1000&query=`);

  if (!response.ok) {
    throw new Error(`Failed to fetch assignable users for ${projectKey}: ${response.status}`);
  }

  return (await response.json()) as JiraUser[];
}

export async function fetchProjectStatuses(projectKey: string): Promise<string[]> {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/project/${projectKey}/statuses`);

  if (!response.ok) {
    throw new Error(`Failed to fetch statuses for ${projectKey}: ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    statuses: Array<{ id: string; name: string }>;
  }>;

  return [...new Set(data.flatMap((entry) => entry.statuses.map((status) => status.name)))];
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
