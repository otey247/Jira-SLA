import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

interface IssueSummary {
  issueKey: string;
  ruleSetId: string;
  currentState: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  breachState: boolean;
  currentAssignee: string | null;
  currentPriority: string;
  currentStatus: string;
  slaStartedAt: string | null;
}

interface Worklog {
  id: string;
  started: string;
  timeSpentSeconds: number;
  author: { accountId: string; displayName: string };
}

interface IssueAuditDetail {
  summary: IssueSummary;
  explanation: string[];
  worklogs: Worklog[];
  segments: Array<{
    segmentId: string;
    segmentType: string;
    startedAt: string;
    endedAt: string;
    status: string;
    assigneeAccountId: string | null;
    businessSeconds: number;
    rawSeconds: number;
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
  const [detail, setDetail] = useState<IssueAuditDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  const loadIssue = (key: string) => {
    setLoading(true);
    setError('');
    invoke<IssueAuditDetail | null>('getIssueAudit', { issueKey: key })
      .then((audit) => {
        if (!audit) {
          setError(`No SLA data found for ${key}.`);
          setDetail(null);
        } else {
          setDetail(audit);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!issueKey) return;
    loadIssue(issueKey);
  }, [issueKey]);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIssueKey(query.trim().toUpperCase());
  };

  const handleRebuild = () => {
    if (!issueKey || !detail) return;
    setRebuilding(true);
    invoke<{ success: boolean }>('rebuildIssue', {
      issueKey,
      ruleSetId: detail.summary.ruleSetId ?? '',
    })
      .then(() => loadIssue(issueKey))
      .catch(console.error)
      .finally(() => setRebuilding(false));
  };

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Issue Explorer</h2>

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

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {[
              { label: 'SLA Start', value: detail.summary.slaStartedAt ? new Date(detail.summary.slaStartedAt).toLocaleString() : 'Not started' },
              { label: 'Response', value: formatMinutes(detail.summary.responseSeconds) },
              { label: 'Active', value: formatMinutes(detail.summary.activeSeconds) },
              { label: 'Paused', value: formatMinutes(detail.summary.pausedSeconds) },
              { label: 'Status', value: detail.summary.currentStatus || '—' },
              { label: 'Assignee', value: detail.summary.currentAssignee ?? '—' },
            ].map((metric) => (
              <div
                key={metric.label}
                style={{
                  background: '#f4f5f7',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  minWidth: '130px',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{metric.value}</div>
                <div style={{ fontSize: '12px', color: '#6b778c' }}>{metric.label}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            <div>
              <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Segment Timeline</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f4f5f7' }}>
                    <th style={th}>Type</th>
                    <th style={th}>Start</th>
                    <th style={th}>End</th>
                    <th style={th}>Status</th>
                    <th style={th}>Assignee</th>
                    <th style={th}>Counted</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.segments.map((segment) => (
                    <tr key={segment.segmentId} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td
                        style={{
                          ...td,
                          color: STATE_COLOR[segment.segmentType] ?? '#333',
                          fontWeight: 600,
                        }}
                      >
                        {segment.segmentType}
                      </td>
                      <td style={td}>{new Date(segment.startedAt).toLocaleString()}</td>
                      <td style={td}>{new Date(segment.endedAt).toLocaleString()}</td>
                      <td style={td}>{segment.status || '—'}</td>
                      <td style={td}>{segment.assigneeAccountId ?? '—'}</td>
                      <td style={td}>
                        {formatMinutes(
                          segment.segmentType === 'outside-hours'
                            ? segment.rawSeconds
                            : segment.businessSeconds,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                background: '#f4f5f7',
                borderRadius: '4px',
                padding: '16px',
              }}
            >
              <h3 style={{ fontSize: '14px', marginTop: 0 }}>Audit Explanation</h3>
              <ul style={{ paddingLeft: '18px', marginTop: 0 }}>
                {detail.explanation.map((line, index) => (
                  <li key={`${detail.summary.issueKey}-${index}`} style={{ marginBottom: '8px' }}>
                    {line}
                  </li>
                ))}
              </ul>

              <h3 style={{ fontSize: '14px' }}>Worklog Comparison</h3>
              {detail.worklogs.length === 0 ? (
                <div style={{ color: '#6b778c', fontSize: '12px' }}>No worklogs found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#fff' }}>
                      <th style={th}>Author</th>
                      <th style={th}>Started</th>
                      <th style={th}>Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.worklogs.map((worklog) => (
                      <tr key={worklog.id} style={{ borderBottom: '1px solid #dfe1e6' }}>
                        <td style={td}>{worklog.author.displayName}</td>
                        <td style={td}>{new Date(worklog.started).toLocaleString()}</td>
                        <td style={td}>{formatMinutes(worklog.timeSpentSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
