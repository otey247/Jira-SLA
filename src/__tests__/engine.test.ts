import { computeIssueSla } from '../sla/engine';
import { normalizeIssueEvents } from '../sla/events';
import { BusinessCalendar, JiraChangelogEntry, JiraIssue, RuleSet } from '../sla/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MONDAY_9AM = '2024-01-08T09:00:00.000Z';
const MONDAY_10AM = '2024-01-08T10:00:00.000Z';
const MONDAY_2PM = '2024-01-08T14:00:00.000Z';
const MONDAY_5PM = '2024-01-08T17:00:00.000Z';
const TUESDAY_9AM = '2024-01-09T09:00:00.000Z';
const TUESDAY_11AM = '2024-01-09T11:00:00.000Z';

const defaultCalendar: BusinessCalendar = {
  calendarId: 'cal-1',
  name: 'Default',
  timezone: 'UTC',
  workingDays: [1, 2, 3, 4, 5], // Mon–Fri
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  holidayDates: [],
  afterHoursMode: 'business-hours',
  createdAt: MONDAY_9AM,
  updatedAt: MONDAY_9AM,
};

const defaultRuleSet: RuleSet = {
  ruleSetId: 'rs-1',
  name: 'Default',
  projectKeys: ['PROJ'],
  teamIds: [],
  trackedAssigneeAccountIds: ['assignee-alice'],
  startMode: 'assignment',
  activeStatuses: ['In Progress', 'Open'],
  pausedStatuses: ['Waiting for Info', 'Blocked'],
  stoppedStatuses: ['Done', 'Closed', 'Resolved'],
  resumeRules: [],
  businessCalendarId: 'cal-1',
  timezone: 'UTC',
  priorityOverrides: {
    Critical: { mode: '24x7', slaTargetMinutes: 60 },
    High: { mode: 'business-hours', slaTargetMinutes: 480 },
  },
  version: 1,
  createdAt: MONDAY_9AM,
  updatedAt: MONDAY_9AM,
};

function makeIssue(
  assigneeId: string | null,
  created: string,
  status = 'Open',
): JiraIssue {
  return {
    key: 'PROJ-1',
    id: '1001',
    fields: {
      summary: 'Test issue',
      status: { name: status },
      priority: { name: 'High' },
      assignee: assigneeId
        ? { accountId: assigneeId, displayName: 'Alice' }
        : null,
      created,
      updated: created,
      resolutiondate: null,
      project: { key: 'PROJ', name: 'Project' },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('normalizeIssueEvents', () => {
  test('emits an issue_created event', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM);
    const events = normalizeIssueEvents(issue, []);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('issue_created');
    expect(events[0].to).toBe('assignee-alice');
  });

  test('includes assignee_changed events from changelog', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM);
    const changelog: JiraChangelogEntry[] = [
      {
        id: 'cl-1',
        created: MONDAY_10AM,
        author: { accountId: 'system', displayName: 'System' },
        items: [
          {
            field: 'assignee',
            fieldtype: 'jira',
            from: 'assignee-alice',
            fromString: 'Alice',
            to: 'assignee-bob',
            toString: 'Bob',
          },
        ],
      },
    ];
    const events = normalizeIssueEvents(issue, changelog);
    expect(events).toHaveLength(2);
    expect(events[1].eventType).toBe('assignee_changed');
    expect(events[1].to).toBe('Bob');
  });

  test('events are sorted chronologically', () => {
    const issue = makeIssue('assignee-alice', MONDAY_10AM);
    const changelog: JiraChangelogEntry[] = [
      {
        id: 'cl-2',
        created: MONDAY_2PM,
        author: { accountId: 'system', displayName: 'System' },
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: 'Open',
            fromString: 'Open',
            to: 'Done',
            toString: 'Done',
          },
        ],
      },
      {
        id: 'cl-1',
        created: MONDAY_10AM,
        author: { accountId: 'system', displayName: 'System' },
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: null,
            fromString: null,
            to: 'In Progress',
            toString: 'In Progress',
          },
        ],
      },
    ];
    const events = normalizeIssueEvents(issue, changelog);
    const timestamps = events.map((e) => e.timestamp);
    expect(timestamps).toEqual([...timestamps].sort());
  });
});

describe('computeIssueSla', () => {
  test('computes active seconds for a simple active segment', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM, 'In Progress');
    const events = normalizeIssueEvents(issue, []);
    const { summary } = computeIssueSla(
      'PROJ-1',
      events,
      defaultRuleSet,
      defaultCalendar,
      MONDAY_10AM,
    );
    // 1 hour active, all within business hours (9am–6pm UTC, Mon–Fri)
    expect(summary.activeSeconds).toBeGreaterThan(0);
    expect(summary.currentState).toBe('active');
  });

  test('marks issue as breached when active time exceeds threshold', () => {
    // Critical priority has 60-minute SLA target
    const issue = makeIssue('assignee-alice', MONDAY_9AM, 'In Progress');
    issue.fields.priority.name = 'Critical';

    const events = normalizeIssueEvents(issue, []);

    // Evaluate at 2+ hours after assignment
    const { summary } = computeIssueSla(
      'PROJ-1',
      events,
      { ...defaultRuleSet, priorityOverrides: { Critical: { mode: '24x7', slaTargetMinutes: 60 } } },
      defaultCalendar,
      MONDAY_2PM, // 5 hours later
    );

    expect(summary.breachState).toBe(true);
    expect(summary.currentState).toBe('breached');
  });

  test('paused segments do not count towards active time', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM, 'In Progress');
    const changelog: JiraChangelogEntry[] = [
      {
        id: 'cl-1',
        created: MONDAY_10AM,
        author: { accountId: 'system', displayName: 'System' },
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: 'In Progress',
            fromString: 'In Progress',
            to: 'Waiting for Info',
            toString: 'Waiting for Info',
          },
        ],
      },
    ];
    const events = normalizeIssueEvents(issue, changelog);
    const { summary, segments } = computeIssueSla(
      'PROJ-1',
      events,
      defaultRuleSet,
      defaultCalendar,
      MONDAY_2PM,
    );

    // There should be a paused segment after 10AM
    const pausedSeg = segments.find((s) => s.segmentType === 'paused');
    expect(pausedSeg).toBeDefined();
    expect(summary.pausedSeconds).toBeGreaterThan(0);
  });

  test('stopped segment terminates SLA accumulation', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM, 'In Progress');
    const changelog: JiraChangelogEntry[] = [
      {
        id: 'cl-1',
        created: MONDAY_10AM,
        author: { accountId: 'system', displayName: 'System' },
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: 'In Progress',
            fromString: 'In Progress',
            to: 'Done',
            toString: 'Done',
          },
        ],
      },
    ];
    const events = normalizeIssueEvents(issue, changelog);
    const { summary } = computeIssueSla(
      'PROJ-1',
      events,
      defaultRuleSet,
      defaultCalendar,
      MONDAY_2PM,
    );

    expect(summary.currentState).toBe('met');
  });

  test('returns empty summary for issue with no events', () => {
    const { summary, segments } = computeIssueSla(
      'PROJ-1',
      [],
      defaultRuleSet,
      defaultCalendar,
      MONDAY_9AM,
    );
    expect(segments).toHaveLength(0);
    expect(summary.activeSeconds).toBe(0);
  });

  test('per-assignee totals accumulate correctly', () => {
    const issue = makeIssue('assignee-alice', MONDAY_9AM, 'In Progress');
    const events = normalizeIssueEvents(issue, []);
    const { summary } = computeIssueSla(
      'PROJ-1',
      events,
      defaultRuleSet,
      defaultCalendar,
      MONDAY_2PM, // 5h window but only 9am–6pm counts
    );
    expect(summary.perAssigneeTotals['assignee-alice']).toBeGreaterThan(0);
  });
});
