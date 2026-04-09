import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  currentAssignee: string | null;
  activeSeconds: number;
  breachState: boolean;
  currentPriority: string;
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface AssigneeRow {
  accountId: string;
  totalActive: number;
  issueCount: number;
  breachCount: number;
}

export default function AssigneeAnalytics() {
  const [rows, setRows] = useState<AssigneeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    view
      .getContext()
      .then((ctx) => {
        const projectKey =
          (
            ctx as unknown as {
              extension?: { project?: { key?: string } };
            }
          ).extension?.project?.key ?? '';

        if (!projectKey) return;

        return invoke<IssueSummary[]>('searchIssueSummaries', { projectKey })
          .then((summaries) => {
            const map = new Map<string, AssigneeRow>();
            for (const s of summaries ?? []) {
              const id = s.currentAssignee ?? 'unassigned';
              const existing = map.get(id) ?? {
                accountId: id,
                totalActive: 0,
                issueCount: 0,
                breachCount: 0,
              };
              existing.totalActive += s.activeSeconds;
              existing.issueCount += 1;
              if (s.breachState) existing.breachCount += 1;
              map.set(id, existing);
            }
            setRows([...map.values()].sort((a, b) => b.totalActive - a.totalActive));
          });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Assignee Analytics</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Assignee</th>
            <th style={th}>Issues</th>
            <th style={th}>Total Active (biz hrs)</th>
            <th style={th}>Avg Active</th>
            <th style={th}>Breaches</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{r.accountId}</td>
              <td style={td}>{r.issueCount}</td>
              <td style={td}>{formatMinutes(r.totalActive)}</td>
              <td style={td}>{formatMinutes(r.totalActive / r.issueCount)}</td>
              <td style={{ ...td, color: r.breachCount > 0 ? '#de350b' : '#36b37e' }}>
                {r.breachCount}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...td, textAlign: 'center', color: '#6b778c' }}>
                No data available.
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
