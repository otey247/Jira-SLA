import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface IssueSlaSegment {
  segmentId: string;
  segmentType: string;
  startedAt: string;
  endedAt: string;
  status: string;
  assigneeAccountId: string | null;
  rawSeconds: number;
  businessSeconds: number;
}

interface IssueSummary {
  issueKey: string;
  ruleSetId: string;
  currentState: string;
  currentStatus: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  outsideHoursSeconds: number;
  breachState: boolean;
  breachThresholdMinutes: number | null;
  currentAssignee: string | null;
  currentPriority: string;
  slaStartedAt: string | null;
  lastRecomputedAt: string;
}

interface Detail {
  summary: IssueSummary;
  segments: IssueSlaSegment[];
  explanation: string[];
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const SEGMENT_COLORS: Record<string, string> = {
  active: '#36b37e',
  paused: '#ffab00',
  waiting: '#ff7452',
  stopped: '#6b778c',
  response: '#0052cc',
  'outside-hours': '#c1c7d0',
};

const STATE_BG: Record<string, string> = {
  active: '#e3fcef',
  paused: '#fffae6',
  breached: '#ffebe6',
  met: '#e3f2fd',
  stopped: '#f4f5f7',
};

const STATE_COLOR: Record<string, string> = {
  active: '#006644',
  paused: '#974f0c',
  breached: '#de350b',
  met: '#0052cc',
  stopped: '#6b778c',
};

export default function App() {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [issueKey, setIssueKey] = useState('');

  const loadDetail = (key: string) =>
    invoke<Detail | null>('getIssueAudit', { issueKey: key })
      .then((data) => {
        if (!data) {
          setError('No SLA data yet for this issue. Trigger a sync first.');
        } else {
          setDetail(data);
          setError('');
        }
      })
      .catch((err: Error) => setError(err.message));

  useEffect(() => {
    view.getContext().then((ctx) => {
      const key =
        (ctx as unknown as { extension?: { issue?: { key?: string } } }).extension?.issue
          ?.key ?? '';
      setIssueKey(key);

      if (!key) {
        setError('Could not determine issue key from context.');
        setLoading(false);
        return;
      }

      loadDetail(key).finally(() => setLoading(false));
    });
  }, []);

  const handleRebuild = () => {
    if (!issueKey || !detail) return;
    setRebuilding(true);
    invoke('rebuildIssue', { issueKey, ruleSetId: detail.summary.ruleSetId })
      .then(() => loadDetail(issueKey))
      .catch(console.error)
      .finally(() => setRebuilding(false));
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', fontFamily: 'sans-serif', color: '#6b778c' }}>
        Loading SLA data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', fontFamily: 'sans-serif', color: '#de350b' }}>
        {error}
      </div>
    );
  }

  if (!detail) return null;

  const { summary, segments, explanation } = detail;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '12px', fontSize: '13px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '12px',
            background: STATE_BG[summary.currentState] ?? '#f4f5f7',
            color: STATE_COLOR[summary.currentState] ?? '#333',
            fontWeight: 700,
            fontSize: '12px',
          }}
        >
          {summary.currentState.toUpperCase()}
          {summary.breachState && ' ⚠ BREACHED'}
        </span>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          style={{
            padding: '4px 10px',
            background: '#fff',
            border: '1px solid #dfe1e6',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {rebuilding ? '…' : '↻ Refresh'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {[
          {
            label: 'SLA Start',
            value: summary.slaStartedAt
              ? new Date(summary.slaStartedAt).toLocaleString()
              : 'Not started',
          },
          { label: 'Response', value: formatMinutes(summary.responseSeconds) },
          { label: 'Active', value: formatMinutes(summary.activeSeconds) },
          { label: 'Paused', value: formatMinutes(summary.pausedSeconds) },
          { label: 'Status', value: summary.currentStatus || '—' },
          { label: 'Assignee', value: summary.currentAssignee ?? '—' },
          { label: 'Priority', value: summary.currentPriority },
          {
            label: 'Outside Hours',
            value: formatMinutes(summary.outsideHoursSeconds),
          },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{ background: '#f4f5f7', borderRadius: '4px', padding: '8px 10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{metric.value}</div>
            <div style={{ fontSize: '11px', color: '#6b778c' }}>{metric.label}</div>
          </div>
        ))}
      </div>

      {summary.breachState && (
        <div
          style={{
            background: '#ffebe6',
            border: '1px solid #ff8f73',
            borderRadius: '4px',
            padding: '8px 12px',
            marginBottom: '16px',
            color: '#de350b',
            fontSize: '12px',
          }}
        >
          ⚠ SLA breached — active handling exceeded {summary.breachThresholdMinutes} minutes
        </div>
      )}

      <div
        style={{
          background: '#f4f5f7',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#172b4d' }}>
          Explanation
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {explanation.map((line, index) => (
            <li key={`${summary.issueKey}-${index}`} style={{ marginBottom: '6px' }}>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ fontWeight: 600, marginBottom: '8px', color: '#172b4d' }}>
        Timeline
      </div>
      <div>
        {segments.map((segment) => (
          <div
            key={segment.segmentId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: SEGMENT_COLORS[segment.segmentType] ?? '#e0e0e0',
                marginTop: '3px',
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontWeight: 600,
                  color: SEGMENT_COLORS[segment.segmentType] ?? '#333',
                }}
              >
                {segment.segmentType} ·{' '}
                <span style={{ fontWeight: 400, color: '#6b778c' }}>
                  {formatMinutes(
                    segment.segmentType === 'outside-hours'
                      ? segment.rawSeconds
                      : segment.businessSeconds,
                  )}
                </span>
              </div>
              <div style={{ color: '#6b778c', fontSize: '11px' }}>
                {new Date(segment.startedAt).toLocaleString()} →{' '}
                {new Date(segment.endedAt).toLocaleString()}
              </div>
              <div style={{ color: '#6b778c', fontSize: '11px' }}>
                status: {segment.status || '—'} · assignee:{' '}
                {segment.assigneeAccountId ?? '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', fontSize: '11px', color: '#c1c7d0' }}>
        Last computed: {new Date(summary.lastRecomputedAt).toLocaleString()}
      </div>
    </div>
  );
}
