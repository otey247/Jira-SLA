import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  currentState: string;
  activeSeconds: number;
  responseSeconds: number;
  breachState: boolean;
  currentAssignee: string | null;
  currentPriority: string;
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface GadgetState {
  totalIssues: number;
  breachCount: number;
  avgResponse: number;
  avgActive: number;
  byPriority: Record<string, { count: number; breachCount: number; avgActive: number }>;
  byAssignee: Array<{ id: string; count: number; avgActive: number; breachCount: number }>;
}

function computeState(summaries: IssueSummary[]): GadgetState {
  const byPriority: GadgetState['byPriority'] = {};
  const assigneeMap: Record<string, { count: number; totalActive: number; breachCount: number }> = {};

  for (const s of summaries) {
    // Priority rollup
    const p = s.currentPriority;
    if (!byPriority[p]) byPriority[p] = { count: 0, breachCount: 0, avgActive: 0 };
    byPriority[p].count += 1;
    byPriority[p].avgActive += s.activeSeconds;
    if (s.breachState) byPriority[p].breachCount += 1;

    // Assignee rollup
    const a = s.currentAssignee ?? 'unassigned';
    if (!assigneeMap[a]) assigneeMap[a] = { count: 0, totalActive: 0, breachCount: 0 };
    assigneeMap[a].count += 1;
    assigneeMap[a].totalActive += s.activeSeconds;
    if (s.breachState) assigneeMap[a].breachCount += 1;
  }

  // Average priorities
  for (const p of Object.keys(byPriority)) {
    byPriority[p].avgActive = byPriority[p].count
      ? byPriority[p].avgActive / byPriority[p].count
      : 0;
  }

  const byAssignee = Object.entries(assigneeMap)
    .map(([id, v]) => ({
      id,
      count: v.count,
      avgActive: v.count ? v.totalActive / v.count : 0,
      breachCount: v.breachCount,
    }))
    .sort((a, b) => b.avgActive - a.avgActive)
    .slice(0, 10);

  const totalBreaches = summaries.filter((s) => s.breachState).length;
  const avgResponse = summaries.length
    ? summaries.reduce((acc, s) => acc + s.responseSeconds, 0) / summaries.length
    : 0;
  const avgActive = summaries.length
    ? summaries.reduce((acc, s) => acc + s.activeSeconds, 0) / summaries.length
    : 0;

  return {
    totalIssues: summaries.length,
    breachCount: totalBreaches,
    avgResponse,
    avgActive,
    byPriority,
    byAssignee,
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#de350b',
  High: '#ff5630',
  Medium: '#ff8b00',
  Low: '#36b37e',
};

export default function App() {
  const [state, setState] = useState<GadgetState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    view
      .getContext()
      .then((ctx) => {
        const extension = (
          ctx as unknown as {
            extension?: {
              project?: { key?: string };
              gadgetConfiguration?: { projectKey?: string };
            };
          }
        ).extension;
        const projectKey =
          extension?.project?.key ?? extension?.gadgetConfiguration?.projectKey ?? '';

        if (!projectKey) return;

        return invoke<IssueSummary[]>('searchIssueSummaries', { projectKey })
          .then((summaries) => {
            setState(computeState(summaries ?? []));
          });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '16px' }}>Loading…</div>;
  if (!state) return <div style={{ padding: '16px', color: '#6b778c' }}>No data.</div>;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '12px', fontSize: '13px' }}>
      <h2 style={{ fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>SLA Metrics</h2>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Issues', value: state.totalIssues },
          { label: 'Breaches', value: state.breachCount, red: state.breachCount > 0 },
          { label: 'Avg Response', value: formatMinutes(state.avgResponse) },
          { label: 'Avg Active', value: formatMinutes(state.avgActive) },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: (k as { red?: boolean }).red ? '#ffebe6' : '#f4f5f7',
              borderRadius: '4px',
              padding: '8px 14px',
              minWidth: '90px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: (k as { red?: boolean }).red ? '#de350b' : '#172b4d',
              }}
            >
              {k.value}
            </div>
            <div style={{ fontSize: '11px', color: '#6b778c' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* By priority */}
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>By Priority</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Priority</th>
            <th style={th}>Count</th>
            <th style={th}>Avg Active</th>
            <th style={th}>Breaches</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(state.byPriority).map(([priority, data]) => (
            <tr key={priority} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ ...td, color: PRIORITY_COLORS[priority] ?? '#333', fontWeight: 600 }}>
                {priority}
              </td>
              <td style={td}>{data.count}</td>
              <td style={td}>{formatMinutes(data.avgActive)}</td>
              <td style={{ ...td, color: data.breachCount > 0 ? '#de350b' : '#36b37e' }}>
                {data.breachCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* By assignee */}
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>Top Assignees by Avg Active</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Assignee</th>
            <th style={th}>Issues</th>
            <th style={th}>Avg Active</th>
            <th style={th}>Breaches</th>
          </tr>
        </thead>
        <tbody>
          {state.byAssignee.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{row.id}</td>
              <td style={td}>{row.count}</td>
              <td style={td}>{formatMinutes(row.avgActive)}</td>
              <td style={{ ...td, color: row.breachCount > 0 ? '#de350b' : '#36b37e' }}>
                {row.breachCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#6b778c',
};
const td: React.CSSProperties = { padding: '6px 10px' };
