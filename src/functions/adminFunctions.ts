import { v4 as uuidv4 } from 'uuid';
import {
  getCalendar,
  getRuleSet,
  saveRuleSet as persistRuleSet,
  saveCalendar as persistCalendar,
} from '../api/storage';
import { RuleSet, BusinessCalendar } from '../sla/types';

// ─── Rule Set admin ───────────────────────────────────────────────────────────

type RuleSetInput = Omit<RuleSet, 'ruleSetId' | 'version' | 'createdAt' | 'updatedAt'> & {
  ruleSetId?: string;
};

export async function saveRuleSet(input: RuleSetInput): Promise<RuleSet> {
  const now = new Date().toISOString();
  const existing = input.ruleSetId
    ? await getRuleSet(input.ruleSetId)
    : null;

  const businessCalendarId =
    input.businessCalendarId ?? existing?.businessCalendarId ?? null;

  if (!businessCalendarId) {
    throw new Error('A business calendar is required for every rule set.');
  }

  const ruleSet: RuleSet = {
    ...existing,
    ...input,
    ruleSetId: existing?.ruleSetId ?? input.ruleSetId ?? uuidv4(),
    teamIds: input.teamIds ?? existing?.teamIds ?? [],
    trackedAssigneeAccountIds:
      input.trackedAssigneeAccountIds ?? existing?.trackedAssigneeAccountIds ?? [],
    projectKeys: input.projectKeys ?? existing?.projectKeys ?? [],
    activeStatuses: input.activeStatuses ?? existing?.activeStatuses ?? [],
    pausedStatuses: input.pausedStatuses ?? existing?.pausedStatuses ?? [],
    stoppedStatuses: input.stoppedStatuses ?? existing?.stoppedStatuses ?? [],
    resumeRules: input.resumeRules ?? existing?.resumeRules ?? [],
    businessCalendarId,
    priorityOverrides: input.priorityOverrides ?? existing?.priorityOverrides ?? {},
    version: existing ? existing.version + 1 : 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await persistRuleSet(ruleSet);
  return ruleSet;
}

// ─── Business Calendar admin ──────────────────────────────────────────────────

type CalendarInput = Omit<BusinessCalendar, 'calendarId' | 'createdAt' | 'updatedAt'> & {
  calendarId?: string;
};

export async function saveBusinessCalendar(
  input: CalendarInput,
): Promise<BusinessCalendar> {
  const now = new Date().toISOString();
  const existing = input.calendarId ? await getCalendar(input.calendarId) : null;

  const calendar: BusinessCalendar = {
    ...existing,
    ...input,
    calendarId: existing?.calendarId ?? input.calendarId ?? uuidv4(),
    afterHoursMode:
      input.afterHoursMode ?? existing?.afterHoursMode ?? 'business-hours',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await persistCalendar(calendar);
  return calendar;
}
