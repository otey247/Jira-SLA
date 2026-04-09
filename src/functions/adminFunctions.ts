import { v4 as uuidv4 } from 'uuid';
import { saveRuleSet as persistRuleSet, saveCalendar as persistCalendar } from '../api/storage';
import { RuleSet, BusinessCalendar } from '../sla/types';

// ─── Rule Set admin ───────────────────────────────────────────────────────────

type RuleSetInput = Omit<RuleSet, 'ruleSetId' | 'version' | 'createdAt' | 'updatedAt'> & {
  ruleSetId?: string;
};

export async function saveRuleSet(input: RuleSetInput): Promise<RuleSet> {
  const now = new Date().toISOString();
  const existing = input.ruleSetId;

  const ruleSet: RuleSet = {
    ...input,
    ruleSetId: existing ?? uuidv4(),
    version: 1,
    createdAt: now,
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

  const calendar: BusinessCalendar = {
    ...input,
    calendarId: input.calendarId ?? uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  await persistCalendar(calendar);
  return calendar;
}
