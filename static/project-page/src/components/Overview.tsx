import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  currentState: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  breachState: boolean;
  currentAssignee: string | null;
  currentPriority: string;
}

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
      <div style={{ fontSize: '24px', fontWeight: 700, color: highlight ? '#de350b' : '#172b4d' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

export default function Overview() {
  const [summaries, setSummaries] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectKey, setProjectKey] = useState('');

  useEffect(() => {
    // In a real app the project key would come from Forge context
    const key = (window as unknown as { __FORGE_PROJECT_KEY__?: string }).__FORGE_PROJECT_KEY__ ?? '';
    setProjectKey(key);
    if (!key) { setLoading(false); return; }

    invoke<IssueSummary[]>('searchIssueSummaries', { projectKey: key })
      .then((data) => setSummaries(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const breachCount = summaries.filter((s) => s.breachState).length;
  const avgResponse = summaries.length
    ? summaries.reduce((acc, s) => acc + s.responseSeconds, 0) / summaries.length
    : 0;
  const avgActive = summaries.length
    ? summaries.reduce((acc, s) => acc + s.activeSeconds, 0) / summaries.length
    : 0;
  const avgPaused = summaries.length
    ? summaries.reduce((acc, s) => acc + s.pausedSeconds, 0) / summaries.length
    : 0;

  if (loading) return <div>Loading…</div>;
  if (!projectKey) return <div>No project context available.</div>;

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>
        Project: {projectKey}
      </h2>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <KpiCard label="Avg Response" value={formatMinutes(avgResponse)} />
        <KpiCard label="Avg Active Handling" value={formatMinutes(avgActive)} />
        <KpiCard label="Avg Paused" value={formatMinutes(avgPaused)} />
        <KpiCard label="SLA Breaches" value={String(breachCount)} highlight={breachCount > 0} />
        <KpiCard label="Total Issues" value={String(summaries.length)} />
      </div>

      {/* Issue table */}
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}
      >
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Issue</th>
            <th style={th}>State</th>
            <th style={th}>Priority</th>
            <th style={th}>Assignee</th>
            <th style={th}>Active (biz hrs)</th>
            <th style={th}>Paused</th>
            <th style={th}>Breach</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.issueKey} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{s.issueKey}</td>
              <td style={td}>{s.currentState}</td>
              <td style={td}>{s.currentPriority}</td>
              <td style={td}>{s.currentAssignee ?? '—'}</td>
              <td style={td}>{formatMinutes(s.activeSeconds)}</td>
              <td style={td}>{formatMinutes(s.pausedSeconds)}</td>
              <td style={{ ...td, color: s.breachState ? '#de350b' : '#36b37e' }}>
                {s.breachState ? '⚠ Breached' : '✓ OK'}
              </td>
            </tr>
          ))}
          {summaries.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...td, textAlign: 'center', color: '#6b778c' }}>
                No SLA data available yet. Trigger a sync or wait for the scheduled job.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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
