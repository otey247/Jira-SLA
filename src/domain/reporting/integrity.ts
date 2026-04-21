import type {
  DerivedDataIntegrityReport,
  IssueCheckpoint,
  IssueSegment,
  IssueSummary,
  RuleSet,
} from '../types';

export const validateDerivedData = ({
  issueKey,
  summary,
  segments,
  checkpoint,
  currentRuleSet,
}: {
  issueKey: string;
  summary?: IssueSummary;
  segments?: IssueSegment[];
  checkpoint?: IssueCheckpoint;
  currentRuleSet?: RuleSet;
}): DerivedDataIntegrityReport => {
  const messages: string[] = [];

  if (!summary) {
    messages.push('Missing derived issue summary.');
  }
  if (!segments) {
    messages.push('Missing derived segment timeline.');
  }
  if (!checkpoint) {
    messages.push('Missing derived checkpoint.');
  }

  if (!summary || !segments || !checkpoint) {
    return {
      issueKey,
      computeRunId: summary?.computeRunId ?? checkpoint?.computeRunId,
      valid: false,
      status: 'repairable',
      repaired: false,
      messages,
    };
  }

  if (summary.computeRunId !== checkpoint.computeRunId) {
    messages.push('Summary and checkpoint were written by different compute runs.');
  }
  if (!segments.every((segment) => segment.computeRunId === summary.computeRunId)) {
    messages.push('One or more stored segments were written by a different compute run than the summary.');
  }
  if (summary.ruleVersion !== checkpoint.summaryVersion) {
    messages.push('Summary rule version does not match checkpoint summary version.');
  }
  if (currentRuleSet && currentRuleSet.version !== summary.ruleVersion) {
    messages.push('Stored derived data is behind the current rule-set version and should be rebuilt.');
  }
  if (checkpoint.needsRebuild) {
    messages.push('Checkpoint is already marked for rebuild.');
  }
  if (checkpoint.derivedDataStatus === 'repairable' || summary.derivedDataStatus === 'repairable') {
    messages.push('Derived data is marked as repairable from an earlier incomplete write.');
  }

  const responseSeconds = segments.reduce(
    (total, segment) => total + (segment.countsTowardResponse ? segment.businessSeconds : 0),
    0,
  );
  const activeSeconds = segments.reduce(
    (total, segment) => total + (segment.countsTowardActive ? segment.businessSeconds : 0),
    0,
  );
  const pausedSeconds = segments.reduce(
    (total, segment) => total + (segment.segmentType === 'paused' ? segment.rawSeconds : 0),
    0,
  );
  const waitingSeconds = segments.reduce(
    (total, segment) => total + (segment.segmentType === 'waiting' ? segment.rawSeconds : 0),
    0,
  );

  if (summary.responseSeconds !== responseSeconds) {
    messages.push('Summary response rollup does not match stored segments.');
  }
  if (summary.activeSeconds !== activeSeconds) {
    messages.push('Summary active rollup does not match stored segments.');
  }
  if (summary.pausedSeconds !== pausedSeconds) {
    messages.push('Summary paused rollup does not match stored segments.');
  }
  if (summary.waitingSeconds !== waitingSeconds) {
    messages.push('Summary waiting rollup does not match stored segments.');
  }

  return {
    issueKey,
    computeRunId: summary.computeRunId,
    valid: messages.length === 0,
    status: messages.length === 0 ? 'complete' : 'repairable',
    repaired: false,
    messages: messages.length > 0 ? messages : ['Derived summary, segments, and checkpoint are aligned.'],
  };
};
