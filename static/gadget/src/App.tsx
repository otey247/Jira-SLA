import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  currentAssignee: string | null;
  currentTeam: string | null;
  activeSeconds: number;
  responseSeconds: number;
  breachState: boolean;
  currentPriority: string;
  lastRecomputedAt: string;
}

interface GadgetState {
  totalIssues: number;
  breachCount: number;
  avgResponse: number;
  avgActive: number;
  byPriority: Record<string, { count: number; breachCount: number }>;
  byTeam: Array<{ team: string; avgActive: number; count: number }>;
  byAssignee: Array<{ id: string; avgResponse: number; count: number }>;
  dailyTrend: Array<{ date: string; breaches: number; issues: number }>;
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function computeState(summaries: IssueSummary[]): GadgetState {
  const byPriority: GadgetState['byPriority'] = {};
  const teamMap: Record<string, { count: number; totalActive: number }> = {};
  const assigneeMap: Record<string, { count: number; totalResponse: number }> = {};
  const trendMap: Record<string, { issues: number; breaches: number }> = {};

  for (const summary of summaries) {
    const priority = summary.currentPriority;
    if (!byPriority[priority]) byPriority[priority] = { count: 0, breachCount: 0 };
    byPriority[priority].count += 1;
    if (summary.breachState) byPriority[priority].breachCount += 1;

    const team = summary.currentTeam ?? 'unmapped';
    if (!teamMap[team]) teamMap[team] = { count: 0, totalActive: 0 };
    teamMap[team].count += 1;
    teamMap[team].totalActive += summary.activeSeconds;

    const assignee = summary.currentAssignee ?? 'unassigned';
    if (!assigneeMap[assignee]) assigneeMap[assignee] = { count: 0, totalResponse: 0 };
    assigneeMap[assignee].count += 1;
    assigneeMap[assignee].totalResponse += summary.responseSeconds;

    const trendDate = summary.lastRecomputedAt.slice(0, 10);
    if (!trendMap[trendDate]) trendMap[trendDate] = { issues: 0, breaches: 0 };
    trendMap[trendDate].issues += 1;
    if (summary.breachState) trendMap[trendDate].breaches += 1;
  }

  return {
    totalIssues: summaries.length,
    breachCount: summaries.filter((summary) => summary.breachState).length,
    avgResponse: summaries.length
      ? summaries.reduce((acc, summary) => acc + summary.responseSeconds, 0) /
        summaries.length
      : 0,
    avgActive: summaries.length
      ? summaries.reduce((acc, summary) => acc + summary.activeSeconds, 0) /
        summaries.length
      : 0,
    byPriority,
    byTeam: Object.entries(teamMap)
      .map(([team, value]) => ({
        team,
        count: value.count,
        avgActive: value.count ? value.totalActive / value.count : 0,
      }))
      .sort((left, right) => right.avgActive - left.avgActive)
      .slice(0, 10),
    byAssignee: Object.entries(assigneeMap)
      .map(([id, value]) => ({
        id,
        count: value.count,
        avgResponse: value.count ? value.totalResponse / value.count : 0,
      }))
      .sort((left, right) => right.avgResponse - left.avgResponse)
      .slice(0, 10),
    dailyTrend: Object.entries(trendMap)
      .map(([date, value]) => ({
        date,
        issues: value.issues,
        breaches: value.breaches,
      }))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-7),
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

        return invoke<IssueSummary[]>('searchIssueSummaries', { projectKey }).then(
          (summaries) => {
            setState(computeState(summaries ?? []));
          },
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '16px' }}>Loading…</div>;
  if (!state) return <div style={{ padding: '16px', color: '#6b778c' }}>No data.</div>;

  const maxIssues = Math.max(...state.dailyTrend.map((point) => point.issues), 1);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '12px', fontSize: '13px' }}>
      <h2 style={{ fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>
        SLA Metrics
      </h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Issues', value: state.totalIssues },
          { label: 'Breaches', value: state.breachCount, red: state.breachCount > 0 },
          { label: 'Avg Response', value: formatMinutes(state.avgResponse) },
          { label: 'Avg Active', value: formatMinutes(state.avgActive) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: kpi.red ? '#ffebe6' : '#f4f5f7',
              borderRadius: '4px',
              padding: '8px 14px',
              minWidth: '90px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: kpi.red ? '#de350b' : '#172b4d',
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: '11px', color: '#6b778c' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 600, marginBottom: '6px' }}>Breach Count by Priority</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Priority</th>
            <th style={th}>Count</th>
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
              <td style={{ ...td, color: data.breachCount > 0 ? '#de350b' : '#36b37e' }}>
                {data.breachCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginBottom: '6px' }}>Average Active Time by Team</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Team</th>
            <th style={th}>Issues</th>
            <th style={th}>Avg Active</th>
          </tr>
        </thead>
        <tbody>
          {state.byTeam.map((row) => (
            <tr key={row.team} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{row.team}</td>
              <td style={td}>{row.count}</td>
              <td style={td}>{formatMinutes(row.avgActive)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginBottom: '6px' }}>Average Response by Assignee</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Assignee</th>
            <th style={th}>Issues</th>
            <th style={th}>Avg Response</th>
          </tr>
        </thead>
        <tbody>
          {state.byAssignee.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{row.id}</td>
              <td style={td}>{row.count}</td>
              <td style={td}>{formatMinutes(row.avgResponse)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginBottom: '6px' }}>7 Day Breach Trend</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {state.dailyTrend.map((point) => (
          <div key={point.date} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', gap: '8px', alignItems: 'center' }}>
            <div style={{ color: '#6b778c', fontSize: '11px' }}>{point.date}</div>
            <div style={{ background: '#f4f5f7', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(point.issues / maxIssues) * 100}%`,
                  background: point.breaches > 0 ? '#ff5630' : '#36b37e',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '4px 8px',
                }}
              >
                {point.issues} issues
              </div>
            </div>
            <div style={{ fontSize: '11px', color: point.breaches > 0 ? '#de350b' : '#6b778c' }}>
              {point.breaches} br
            </div>
          </div>
        ))}
      </div>
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
