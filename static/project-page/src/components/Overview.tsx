import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  currentState: string;
  currentStatus: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  breachState: boolean;
  currentAssignee: string | null;
  currentTeam: string | null;
  currentPriority: string;
  lastRecomputedAt: string;
}

interface IssueAudit {
  summary: IssueSummary & {
    slaStartedAt: string | null;
  };
  explanation: string[];
}

type SortBy =
  | 'issueKey'
  | 'responseSeconds'
  | 'activeSeconds'
  | 'pausedSeconds'
  | 'breachState'
  | 'currentPriority'
  | 'currentStatus'
  | 'lastRecomputedAt';

type SortDirection = 'asc' | 'desc';

interface Filters {
  assigneeAccountId: string;
  teamLabel: string;
  priority: string;
  currentStatus: string;
  breachedOnly: boolean;
  dateStart: string;
  dateEnd: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
}

const DEFAULT_FILTERS: Filters = {
  assigneeAccountId: '',
  teamLabel: '',
  priority: '',
  currentStatus: '',
  breachedOnly: false,
  dateStart: '',
  dateEnd: '',
  sortBy: 'activeSeconds',
  sortDirection: 'desc',
};

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? '#ffebe6' : '#f4f5f7',
        borderRadius: '4px',
        padding: '16px',
        minWidth: '140px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: highlight ? '#de350b' : '#172b4d',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}

export default function Overview() {
  const [unfilteredSummaries, setUnfilteredSummaries] = useState<IssueSummary[]>([]);
  const [summaries, setSummaries] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedIssue, setSelectedIssue] = useState<IssueAudit | null>(null);
  const [selectedIssueKey, setSelectedIssueKey] = useState('');

  useEffect(() => {
    view
      .getContext()
      .then((ctx) => {
        const key =
          (
            ctx as unknown as {
              extension?: { project?: { key?: string } };
            }
          ).extension?.project?.key ?? '';

        setProjectKey(key);
        if (!key) return;

        return invoke<IssueSummary[]>('searchIssueSummaries', { projectKey: key }).then((data) => {
          const nextSummaries = data ?? [];
          setUnfilteredSummaries(nextSummaries);
          setSummaries(nextSummaries);
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectKey) return;

    setFilterLoading(true);
    invoke<IssueSummary[]>('searchIssueSummaries', {
      projectKey,
      ...normalizeFilters(filters),
    })
      .then((data) => setSummaries(data ?? []))
      .catch(console.error)
      .finally(() => setFilterLoading(false));
  }, [filters, projectKey]);

  useEffect(() => {
    if (!selectedIssueKey) {
      setSelectedIssue(null);
      return;
    }

    invoke<IssueAudit | null>('getIssueAudit', { issueKey: selectedIssueKey })
      .then((detail) => setSelectedIssue(detail))
      .catch(console.error);
  }, [selectedIssueKey]);

  const breachCount = summaries.filter((summary) => summary.breachState).length;
  const avgResponse = summaries.length
    ? summaries.reduce((acc, summary) => acc + summary.responseSeconds, 0) /
      summaries.length
    : 0;
  const avgActive = summaries.length
    ? summaries.reduce((acc, summary) => acc + summary.activeSeconds, 0) /
      summaries.length
    : 0;
  const avgPaused = summaries.length
    ? summaries.reduce((acc, summary) => acc + summary.pausedSeconds, 0) /
      summaries.length
    : 0;

  const assignees = uniqueValues(unfilteredSummaries.map((summary) => summary.currentAssignee ?? ''));
  const teams = uniqueValues(unfilteredSummaries.map((summary) => summary.currentTeam ?? ''));
  const priorities = uniqueValues(unfilteredSummaries.map((summary) => summary.currentPriority));
  const statuses = uniqueValues(unfilteredSummaries.map((summary) => summary.currentStatus));

  const exportCsv = () => {
    const rows = [
      [
        'Issue Key',
        'SLA State',
        'Status',
        'Priority',
        'Assignee',
        'Team',
        'Response Seconds',
        'Active Seconds',
        'Paused Seconds',
        'Breached',
        'Last Recomputed At',
      ],
      ...summaries.map((summary) => [
        summary.issueKey,
        summary.currentState,
        summary.currentStatus,
        summary.currentPriority,
        summary.currentAssignee ?? '',
        summary.currentTeam ?? '',
        String(summary.responseSeconds),
        String(summary.activeSeconds),
        String(summary.pausedSeconds),
        summary.breachState ? 'yes' : 'no',
        summary.lastRecomputedAt,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectKey || 'jira-sla'}-sla-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div>Loading…</div>;
  if (!projectKey) return <div>No project context available.</div>;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontSize: '16px', margin: 0 }}>Project: {projectKey}</h2>
        <button
          onClick={exportCsv}
          style={{
            padding: '8px 16px',
            background: '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <FilterSelect
          label="Assignee"
          value={filters.assigneeAccountId}
          options={assignees}
          onChange={(assigneeAccountId) =>
            setFilters((current) => ({ ...current, assigneeAccountId }))
          }
        />
        <FilterSelect
          label="Team"
          value={filters.teamLabel}
          options={teams}
          onChange={(teamLabel) => setFilters((current) => ({ ...current, teamLabel }))}
        />
        <FilterSelect
          label="Priority"
          value={filters.priority}
          options={priorities}
          onChange={(priority) => setFilters((current) => ({ ...current, priority }))}
        />
        <FilterSelect
          label="Status"
          value={filters.currentStatus}
          options={statuses}
          onChange={(currentStatus) => setFilters((current) => ({ ...current, currentStatus }))}
        />
        <label style={filterLabel}>
          Last recomputed from
          <input
            type="date"
            value={filters.dateStart}
            onChange={(e) =>
              setFilters((current) => ({ ...current, dateStart: e.target.value }))
            }
            style={inputStyle}
          />
        </label>
        <label style={filterLabel}>
          Last recomputed to
          <input
            type="date"
            value={filters.dateEnd}
            onChange={(e) =>
              setFilters((current) => ({ ...current, dateEnd: e.target.value }))
            }
            style={inputStyle}
          />
        </label>
        <label style={filterLabel}>
          Sort by
          <select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                sortBy: e.target.value as SortBy,
              }))
            }
            style={inputStyle}
          >
            <option value="issueKey">Issue</option>
            <option value="responseSeconds">Response</option>
            <option value="activeSeconds">Active</option>
            <option value="pausedSeconds">Paused</option>
            <option value="breachState">Breach</option>
            <option value="currentPriority">Priority</option>
            <option value="currentStatus">Status</option>
            <option value="lastRecomputedAt">Last recomputed</option>
          </select>
        </label>
        <label style={filterLabel}>
          Direction
          <select
            value={filters.sortDirection}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                sortDirection: e.target.value as SortDirection,
              }))
            }
            style={inputStyle}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label
          style={{
            ...filterLabel,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: '#f4f5f7',
            borderRadius: '4px',
          }}
        >
          Breaches only
          <input
            type="checkbox"
            checked={filters.breachedOnly}
            onChange={(e) =>
              setFilters((current) => ({ ...current, breachedOnly: e.target.checked }))
            }
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <KpiCard label="Avg Response" value={formatMinutes(avgResponse)} />
        <KpiCard label="Avg Active Handling" value={formatMinutes(avgActive)} />
        <KpiCard label="Avg Paused" value={formatMinutes(avgPaused)} />
        <KpiCard
          label="SLA Breaches"
          value={String(breachCount)}
          highlight={breachCount > 0}
        />
        <KpiCard label="Filtered Issues" value={String(summaries.length)} />
      </div>

      {filterLoading && (
        <div style={{ marginBottom: '12px', color: '#6b778c', fontSize: '12px' }}>
          Updating results…
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Issue</th>
            <th style={th}>State</th>
            <th style={th}>Status</th>
            <th style={th}>Priority</th>
            <th style={th}>Assignee</th>
            <th style={th}>Team</th>
            <th style={th}>Active</th>
            <th style={th}>Paused</th>
            <th style={th}>Breach</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.issueKey} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{summary.issueKey}</td>
              <td style={td}>{summary.currentState}</td>
              <td style={td}>{summary.currentStatus || '—'}</td>
              <td style={td}>{summary.currentPriority}</td>
              <td style={td}>{summary.currentAssignee ?? '—'}</td>
              <td style={td}>{summary.currentTeam ?? '—'}</td>
              <td style={td}>{formatMinutes(summary.activeSeconds)}</td>
              <td style={td}>{formatMinutes(summary.pausedSeconds)}</td>
              <td style={{ ...td, color: summary.breachState ? '#de350b' : '#36b37e' }}>
                {summary.breachState ? '⚠ Breached' : '✓ OK'}
              </td>
              <td style={td}>
                <button
                  onClick={() => setSelectedIssueKey(summary.issueKey)}
                  style={{
                    padding: '6px 10px',
                    background: '#fff',
                    border: '1px solid #0052cc',
                    borderRadius: '4px',
                    color: '#0052cc',
                    cursor: 'pointer',
                  }}
                >
                  Drill down
                </button>
              </td>
            </tr>
          ))}
          {summaries.length === 0 && (
            <tr>
              <td colSpan={10} style={{ ...td, textAlign: 'center', color: '#6b778c' }}>
                No SLA data matches the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedIssue && (
        <div
          style={{
            marginTop: '24px',
            background: '#f4f5f7',
            borderRadius: '4px',
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Audit drill-down: {selectedIssue.summary.issueKey}
            </h3>
            <button
              onClick={() => setSelectedIssueKey('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b778c',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ marginBottom: '12px', color: '#6b778c', fontSize: '13px' }}>
            SLA start:{' '}
            {selectedIssue.summary.slaStartedAt
              ? new Date(selectedIssue.summary.slaStartedAt).toLocaleString()
              : 'Not started'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#172b4d' }}>
            {selectedIssue.explanation.map((line, index) => (
              <li
                key={`${selectedIssue.summary.issueKey}-${index}`}
                style={{ marginBottom: '6px' }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalizeFilters(filters: Filters): Partial<Filters> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== false),
  ) as Partial<Filters>;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={filterLabel}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

const filterLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '12px',
  color: '#6b778c',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #dfe1e6',
  borderRadius: '4px',
  fontSize: '13px',
  background: '#fff',
};

const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '12px',
  color: '#6b778c',
};

const td: React.CSSProperties = {
  padding: '8px 12px',
};
