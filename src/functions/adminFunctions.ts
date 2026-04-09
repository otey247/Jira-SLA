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

  validateRuleSetInput(input);

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

  validateCalendarInput(input);

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

function validateRuleSetInput(input: RuleSetInput): void {
  if (!input.name?.trim()) {
    throw new Error('Rule set name is required.');
  }

  if (!input.timezone?.trim()) {
    throw new Error('Rule set timezone is required.');
  }

  assertValidTimeZone(input.timezone);

  if ((input.projectKeys ?? []).some((projectKey) => !/^[A-Z][A-Z0-9_]*$/.test(projectKey))) {
    throw new Error('Project keys must be uppercase Jira project keys.');
  }
}

function validateCalendarInput(input: CalendarInput): void {
  if (!input.name?.trim()) {
    throw new Error('Calendar name is required.');
  }

  if (!input.timezone?.trim()) {
    throw new Error('Calendar timezone is required.');
  }

  assertValidTimeZone(input.timezone);

  if ((input.workingDays ?? []).length === 0) {
    throw new Error('Select at least one working day.');
  }

  if (!isValidTime(input.workingHoursStart ?? '') || !isValidTime(input.workingHoursEnd ?? '')) {
    throw new Error('Working hours must use HH:MM format.');
  }
}

function assertValidTimeZone(timezone: string): void {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error(`Unsupported timezone: ${timezone}`);
  }
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}
