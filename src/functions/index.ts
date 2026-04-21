import Resolver from '@forge/resolver';
import {
  exportCsv,
  getAdminMetadata,
  getBootstrapData,
  getIssueSummary,
  getIssueTimeline,
  markIssueForRebuild,
  runIssueRebuild,
  saveBusinessCalendar,
  saveFieldMapping,
  saveRuleSet,
  searchIssueSummaries,
} from './app';
import { scheduledSync } from './scheduledSync';
import { automationRecompute } from './automationRecompute';
import {
  rovoExplainIssue,
  rovoGetAssigneeMetrics,
  rovoGetIssueSummary,
  rovoListBreaches,
} from './rovoActions';
import type { BootstrapRequest } from '../domain/types';

const resolver = new Resolver();
const issuePayload = (payload: unknown): { issueKey: string } => payload as { issueKey: string };
const bootstrapPayload = (payload: unknown): BootstrapRequest => (
  payload && typeof payload === 'object'
    ? payload as BootstrapRequest
    : { surface: 'projectPage' }
);
const adminMetadataPayload = (payload: unknown): { projectKeys?: string[] } => (
  payload && typeof payload === 'object'
    ? payload as { projectKeys?: string[] }
    : {}
);

resolver.define('bootstrap', async ({ payload }) => getBootstrapData(bootstrapPayload(payload)));
resolver.define('getIssueSummary', async ({ payload }) => getIssueSummary(issuePayload(payload).issueKey));
resolver.define('getIssueTimeline', async ({ payload }) => getIssueTimeline(issuePayload(payload).issueKey));
resolver.define('searchIssueSummaries', async ({ payload }) => searchIssueSummaries(payload ?? {}));
resolver.define('saveRuleSet', async ({ payload }) => saveRuleSet(payload));
resolver.define('saveFieldMapping', async ({ payload }) => saveFieldMapping(payload));
resolver.define('saveBusinessCalendar', async ({ payload }) => saveBusinessCalendar(payload));
resolver.define('getAdminMetadata', async ({ payload }) => getAdminMetadata(adminMetadataPayload(payload).projectKeys ?? []));
resolver.define('markIssueForRebuild', async ({ payload }) => markIssueForRebuild(issuePayload(payload).issueKey));
resolver.define('runIssueRebuild', async ({ payload }) => runIssueRebuild(issuePayload(payload).issueKey));
resolver.define('exportCsv', async ({ payload }) => exportCsv(payload ?? {}));

export const uiResolver = resolver.getDefinitions();
export { scheduledSync };
export { automationRecompute };
export { rovoListBreaches };
export { rovoGetIssueSummary };
export { rovoExplainIssue };
export { rovoGetAssigneeMetrics };
