import { mockRequestJira } from '../__mocks__/@forge/api';
import { fetchChangelog } from '../api/jira';

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
