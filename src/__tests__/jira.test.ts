import { mockRequestJira } from '../__mocks__/@forge/api';
import { fetchChangelog } from '../api/jira';
import { normalizeLiveJiraIssue } from '../integrations/jira/normalize';

describe('fetchChangelog', () => {
  beforeEach(() => {
    mockRequestJira.mockReset();
  });

  test('filters changelog entries numerically when afterId is provided', async () => {
    mockRequestJira.mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [
          { id: '9', created: '2024-01-08T09:00:00Z', author: { accountId: '1', displayName: 'A' }, items: [] },
          { id: '10', created: '2024-01-08T10:00:00Z', author: { accountId: '1', displayName: 'A' }, items: [] },
          { id: '11', created: '2024-01-08T11:00:00Z', author: { accountId: '1', displayName: 'A' }, items: [] },
        ],
        total: 3,
        isLast: true,
      }),
    });

    const changelog = await fetchChangelog('PROJ-1', '9');

    expect(changelog.map((entry) => entry.id)).toEqual(['10', '11']);
  });
});

describe('normalizeLiveJiraIssue', () => {
  test('maps ownership and team custom fields into deterministic events', () => {
    const snapshot = normalizeLiveJiraIssue({
      issue: {
        key: 'PROJ-9',
        id: '1009',
        fields: {
          summary: 'Ownership mapping test',
          status: { name: 'Open' },
          priority: { name: 'High' },
          assignee: null,
          created: '2024-01-08T09:00:00Z',
          updated: '2024-01-08T11:00:00Z',
          resolutiondate: null,
          project: { key: 'PROJ', name: 'Project' },
          customfield_10010: { value: 'Capgemini' },
          customfield_10011: { value: 'Support L2' },
        },
      },
      changelog: [
        {
          id: '11',
          created: '2024-01-08T10:00:00Z',
          author: { accountId: '1', displayName: 'A' },
          items: [
            {
              field: 'Responsible Organization',
              fieldId: 'customfield_10010',
              fieldtype: 'custom',
              from: 'Customer',
              fromString: 'Customer',
              to: 'Capgemini',
              toString: 'Capgemini',
            },
            {
              field: 'Team',
              fieldId: 'customfield_10011',
              fieldtype: 'custom',
              from: 'Support L1',
              fromString: 'Support L1',
              to: 'Support L2',
              toString: 'Support L2',
            },
          ],
        },
      ],
      fieldMapping: {
        fieldMappingId: 'fm-1',
        name: 'Customer mapping',
        ownershipFieldKey: 'customfield_10010',
        teamFieldKey: 'customfield_10011',
      },
    });

    expect(snapshot.initialState.ownershipLabel).toBe('Capgemini');
    expect(snapshot.initialState.teamLabel).toBe('Support L2');
    expect(snapshot.events.map((event) => event.field)).toEqual(['ownership', 'team']);
    expect(snapshot.events[0].sourceFieldId).toBe('customfield_10010');
  });
});
