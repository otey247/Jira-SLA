import { appStore } from '../storage/appStore';

export const getIssueSlaSummary = async (issueKey: string) => {
  const summary = await appStore.getIssueSummary(issueKey);
  if (!summary) {
    throw new Error(`Unable to find summary for ${issueKey}.`);
  }
  return summary;
};

export const explainIssueTimeline = async (issueKey: string) => {
  const summary = await appStore.getIssueSummary(issueKey);
  const segments = await appStore.getIssueSegments(issueKey);
  if (!summary) {
    throw new Error(`Unable to explain ${issueKey} because no derived summary exists.`);
  }
  return {
    summary,
    segments,
    explanation: summary.timelineExplanation,
  };
};

export const listBreachedIssues = async () => {
  return appStore.listIssueSummaries({ breachState: 'breached' });
};
