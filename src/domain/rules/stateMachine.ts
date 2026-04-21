import type { ResumeRule } from '../types';

export const shouldResumeFromStatusPause = ({
  previousStatus,
  nextStatus,
  resumeStatuses,
  resumeRules,
}: {
  previousStatus: string;
  nextStatus: string;
  resumeStatuses: string[];
  resumeRules: ResumeRule[];
}): boolean => {
  if (resumeRules.length > 0) {
    return resumeRules.some((rule) => {
      const fromMatches = !rule.fromStatus || rule.fromStatus === previousStatus;
      return fromMatches && rule.toStatus === nextStatus;
    });
  }

  if (resumeStatuses.length > 0) {
    return resumeStatuses.includes(nextStatus);
  }

  return true;
};
