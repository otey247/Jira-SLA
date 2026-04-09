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
  perAssigneeTotals: Record<string, number>;
}

interface IssueSlaDetail {
  summary: IssueSummary;
  segments: Array<{
    segmentId: string;
    segmentType: string;
    startedAt: string;
    endedAt: string;
    status: string;
    assigneeAccountId: string | null;
    businessSeconds: number;
  }>;
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const STATE_COLOR: Record<string, string> = {
  active: '#36b37e',
  paused: '#ffab00',
  breached: '#de350b',
  met: '#0052cc',
  stopped: '#6b778c',
};

export default function IssueExplorer() {
  const [issueKey, setIssueKey] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<IssueSlaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIssueKey(query.trim().toUpperCase());
  };

  useEffect(() => {
    if (!issueKey) return;
    setLoading(true);
    setError('');
    invoke<IssueSlaDetail | null>('getIssueTimeline', { issueKey })
      .then((d) => {
        if (!d) {
          setError(`No SLA data found for ${issueKey}.`);
          setDetail(null);
        } else {
          setDetail(d);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [issueKey]);

  const handleRebuild = () => {
    if (!issueKey || !detail) return;
    setRebuilding(true);
    invoke('rebuildIssue', { issueKey, ruleSetId: detail.summary.ruleSetId ?? '' })
      .then(() => {
        // Reload
        setIssueKey((k) => k + ' ');
        setTimeout(() => setIssueKey((k) => k.trim()), 100);
      })
      .catch(console.error)
      .finally(() => setRebuilding(false));
  };

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Issue Explorer</h2>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Enter issue key, e.g. PROJ-123"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            padding: '8px 12px',
            border: '2px solid #dfe1e6',
            borderRadius: '4px',
            fontSize: '14px',
            width: '280px',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '8px 16px',
            background: '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: '#de350b' }}>{error}</div>}

      {detail && (
        <div>
          {/* Summary header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div>
              <strong style={{ fontSize: '18px' }}>{detail.summary.issueKey}</strong>
              <span
                style={{
                  marginLeft: '12px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: STATE_COLOR[detail.summary.currentState] ?? '#e0e0e0',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {detail.summary.currentState.toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              style={{
                padding: '6px 14px',
                background: '#fff',
                border: '1px solid #0052cc',
                color: '#0052cc',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {rebuilding ? 'Rebuilding…' : '↻ Rebuild SLA'}
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {[
              { label: 'Response', value: formatMinutes(detail.summary.responseSeconds) },
              { label: 'Active', value: formatMinutes(detail.summary.activeSeconds) },
              { label: 'Paused', value: formatMinutes(detail.summary.pausedSeconds) },
              { label: 'Priority', value: detail.summary.currentPriority },
              { label: 'Assignee', value: detail.summary.currentAssignee ?? '—' },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: '#f4f5f7',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  minWidth: '110px',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{m.value}</div>
                <div style={{ fontSize: '12px', color: '#6b778c' }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Segment timeline */}
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Segment Timeline</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f4f5f7' }}>
                <th style={th}>Type</th>
                <th style={th}>Start</th>
                <th style={th}>End</th>
                <th style={th}>Status</th>
                <th style={th}>Assignee</th>
                <th style={th}>Biz Hours</th>
              </tr>
            </thead>
            <tbody>
              {detail.segments.map((seg) => (
                <tr key={seg.segmentId} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ ...td, color: STATE_COLOR[seg.segmentType] ?? '#333', fontWeight: 600 }}>
                    {seg.segmentType}
                  </td>
                  <td style={td}>{new Date(seg.startedAt).toLocaleString()}</td>
                  <td style={td}>{new Date(seg.endedAt).toLocaleString()}</td>
                  <td style={td}>{seg.status || '—'}</td>
                  <td style={td}>{seg.assigneeAccountId ?? '—'}</td>
                  <td style={td}>{formatMinutes(seg.businessSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
