import type { BusinessCalendar, FieldMapping, RuleSet } from '../domain/types';
import type { JiraIssueFixture } from '../integrations/jira/normalize';

export const sampleCalendars: BusinessCalendar[] = [
  {
    calendarId: 'standard-utc',
    name: 'Standard UTC Business Hours',
    timezone: 'UTC',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: {
      start: '09:00',
      end: '18:00',
    },
    holidays: [],
    afterHoursMode: 'business-hours',
  },
];

export const sampleFieldMappings: FieldMapping[] = [
  {
    fieldMappingId: 'default-live-mapping',
    name: 'Default Jira mapping',
    assigneeFieldKey: 'assignee',
    statusFieldKey: 'status',
    priorityFieldKey: 'priority',
    resolutionFieldKey: 'resolutiondate',
    teamFieldKey: 'Team',
    ownershipFieldKey: 'Responsible Organization',
    responsibleOrganizationFieldKey: 'Responsible Organization',
  },
];

export const sampleRuleSets: RuleSet[] = [
  {
    ruleSetId: 'capgemini-support',
    name: 'Capgemini Support Rule Set',
    version: 1,
    projectKeys: ['ABC'],
    fieldMappingId: 'default-live-mapping',
    trackedAssignees: ['alice', 'bob', 'rishi'],
    trackedTeams: ['capgemini'],
    trackedOwnershipValues: ['Capgemini'],
    ownershipPrecedence: ['ownership', 'team', 'assignee'],
    startMode: 'ownership-field',
    activeStatuses: ['In Progress', 'Working'],
    pausedStatuses: ['Waiting for customer', 'Waiting for info', 'Need More Info', 'Blocked'],
    stoppedStatuses: ['Done', 'Closed', 'Resolved'],
    resumeStatuses: ['In Progress', 'Working'],
    resumeRules: [
      { fromStatus: 'Waiting for customer', toStatus: 'In Progress' },
      { fromStatus: 'Waiting for info', toStatus: 'In Progress' },
      { fromStatus: 'Need More Info', toStatus: 'In Progress' },
    ],
    businessCalendarId: 'standard-utc',
    priorityOverrides: [
      {
        priority: 'P1',
        timingMode: '24x7',
        responseThresholdSeconds: 5400,
        activeThresholdSeconds: 18000,
      },
    ],
    enabled: true,
    defaultTimingMode: 'business-hours',
    defaultResponseThresholdSeconds: 7200,
    defaultActiveThresholdSeconds: 28800,
  },
];

export const sampleIssues: JiraIssueFixture[] = [
  {
    key: 'ABC-123',
    fields: {
      projectKey: 'ABC',
      summary: 'Investigate failing payroll sync',
      created: '2026-04-01T09:00:00.000Z',
      updated: '2026-04-01T17:30:00.000Z',
      initialAssigneeAccountId: 'alice',
      initialTeamLabel: 'capgemini',
      initialOwnershipLabel: 'Capgemini',
      initialStatus: 'Assigned',
      initialPriority: 'P2',
      resolutionDate: '2026-04-01T17:30:00.000Z',
    },
    changelog: [
      {
        id: '1001',
        created: '2026-04-01T10:00:00.000Z',
        items: [{ field: 'status', from: 'Assigned', to: 'In Progress' }],
      },
      {
        id: '1002',
        created: '2026-04-01T13:00:00.000Z',
        items: [{ field: 'status', from: 'In Progress', to: 'Waiting for customer' }],
      },
      {
        id: '1003',
        created: '2026-04-01T15:00:00.000Z',
        items: [{ field: 'status', from: 'Waiting for customer', to: 'In Progress' }],
      },
      {
        id: '1004',
        created: '2026-04-01T17:30:00.000Z',
        items: [
          { field: 'status', from: 'In Progress', to: 'Done' },
          { field: 'resolution', to: 'Completed' },
        ],
      },
    ],
  },
  {
    key: 'ABC-456',
    fields: {
      projectKey: 'ABC',
      summary: 'Review overnight customer import errors',
      created: '2026-04-02T18:30:00.000Z',
      updated: '2026-04-03T12:30:00.000Z',
      initialAssigneeAccountId: 'alice',
      initialTeamLabel: 'capgemini',
      initialOwnershipLabel: 'Capgemini',
      initialStatus: 'Assigned',
      initialPriority: 'P2',
      resolutionDate: '2026-04-03T12:30:00.000Z',
    },
    changelog: [
      {
        id: '2001',
        created: '2026-04-03T09:30:00.000Z',
        items: [{ field: 'status', from: 'Assigned', to: 'In Progress' }],
      },
      {
        id: '2002',
        created: '2026-04-03T11:00:00.000Z',
        items: [{ field: 'assignee', from: 'alice', to: 'bob' }],
      },
      {
        id: '2003',
        created: '2026-04-03T12:30:00.000Z',
        items: [
          { field: 'status', from: 'In Progress', to: 'Done' },
          { field: 'resolution', to: 'Completed' },
        ],
      },
    ],
  },
  {
    key: 'ABC-789',
    fields: {
      projectKey: 'ABC',
      summary: 'Restore critical payment gateway incident',
      created: '2026-04-03T22:00:00.000Z',
      updated: '2026-04-04T04:00:00.000Z',
      initialAssigneeAccountId: 'rishi',
      initialTeamLabel: 'capgemini',
      initialOwnershipLabel: 'Capgemini',
      initialStatus: 'Assigned',
      initialPriority: 'P1',
      resolutionDate: '2026-04-04T04:00:00.000Z',
    },
    changelog: [
      {
        id: '3001',
        created: '2026-04-03T23:00:00.000Z',
        items: [{ field: 'status', from: 'Assigned', to: 'In Progress' }],
      },
      {
        id: '3002',
        created: '2026-04-04T01:00:00.000Z',
        items: [{ field: 'status', from: 'In Progress', to: 'Waiting for info' }],
      },
      {
        id: '3003',
        created: '2026-04-04T02:30:00.000Z',
        items: [{ field: 'status', from: 'Waiting for info', to: 'In Progress' }],
      },
      {
        id: '3004',
        created: '2026-04-04T04:00:00.000Z',
        items: [
          { field: 'status', from: 'In Progress', to: 'Done' },
          { field: 'resolution', to: 'Completed' },
        ],
      },
    ],
  },
  {
    key: 'ABC-900',
    fields: {
      projectKey: 'ABC',
      summary: 'Ownership transfers to Capgemini after customer triage',
      created: '2026-04-06T09:00:00.000Z',
      updated: '2026-04-06T14:00:00.000Z',
      initialStatus: 'Open',
      initialPriority: 'P2',
      initialOwnershipLabel: 'Customer',
    },
    changelog: [
      {
        id: '9001',
        created: '2026-04-06T10:00:00.000Z',
        items: [{ field: 'ownership', from: 'Customer', to: 'Capgemini' }],
      },
      {
        id: '9002',
        created: '2026-04-06T11:00:00.000Z',
        items: [{ field: 'status', from: 'Open', to: 'In Progress' }],
      },
      {
        id: '9003',
        created: '2026-04-06T12:00:00.000Z',
        items: [{ field: 'status', from: 'In Progress', to: 'Need More Info' }],
      },
      {
        id: '9004',
        created: '2026-04-06T13:00:00.000Z',
        items: [{ field: 'status', from: 'Need More Info', to: 'Assigned' }],
      },
      {
        id: '9005',
        created: '2026-04-06T13:30:00.000Z',
        items: [{ field: 'status', from: 'Assigned', to: 'In Progress' }],
      },
      {
        id: '9006',
        created: '2026-04-06T14:00:00.000Z',
        items: [
          { field: 'status', from: 'In Progress', to: 'Done' },
          { field: 'resolution', to: 'Completed' },
        ],
      },
    ],
  },
];
