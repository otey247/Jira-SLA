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
  currentState: string;
  responseSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  outsideHoursSeconds: number;
  breachState: boolean;
  breachThresholdMinutes: number | null;
  currentAssignee: string | null;
  currentPriority: string;
  lastRecomputedAt: string;
}

interface Detail {
  summary: IssueSummary;
  segments: IssueSlaSegment[];
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

  useEffect(() => {
    // Get the issue key from the Forge context
    view.getContext().then((ctx) => {
      const key =
        (ctx as unknown as { extension?: { issue?: { key?: string } } }).extension?.issue?.key ?? '';
      setIssueKey(key);

      if (!key) {
        setError('Could not determine issue key from context.');
        setLoading(false);
        return;
      }

      invoke<Detail | null>('getIssueTimeline', { issueKey: key })
        .then((d) => {
          if (!d) {
            setError('No SLA data yet for this issue. Trigger a sync first.');
          } else {
            setDetail(d);
          }
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, []);

  const handleRebuild = () => {
    if (!issueKey || !detail) return;
    setRebuilding(true);
    invoke('rebuildIssue', { issueKey, ruleSetId: '' })
      .then(() =>
        invoke<Detail | null>('getIssueTimeline', { issueKey }).then((d) => {
          if (d) setDetail(d);
        }),
      )
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

  const { summary, segments } = detail;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '12px', fontSize: '13px' }}>
      {/* State badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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
          {summary.breachState && ` ⚠ BREACHED`}
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

      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {[
          { label: 'Response', value: formatMinutes(summary.responseSeconds) },
          { label: 'Active', value: formatMinutes(summary.activeSeconds) },
          { label: 'Paused', value: formatMinutes(summary.pausedSeconds) },
          { label: 'Outside Hours', value: formatMinutes(summary.outsideHoursSeconds) },
          { label: 'Priority', value: summary.currentPriority },
          { label: 'Assignee', value: summary.currentAssignee ?? '—' },
        ].map((m) => (
          <div
            key={m.label}
            style={{ background: '#f4f5f7', borderRadius: '4px', padding: '8px 10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{m.value}</div>
            <div style={{ fontSize: '11px', color: '#6b778c' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Breach warning */}
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
          ⚠ SLA breached — active handling exceeded{' '}
          {summary.breachThresholdMinutes} minutes
        </div>
      )}

      {/* Segment timeline */}
      <div style={{ fontWeight: 600, marginBottom: '8px', color: '#172b4d' }}>
        Timeline
      </div>
      <div>
        {segments.map((seg) => (
          <div
            key={seg.segmentId}
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
                background: SEGMENT_COLORS[seg.segmentType] ?? '#e0e0e0',
                marginTop: '3px',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: SEGMENT_COLORS[seg.segmentType] ?? '#333' }}>
                {seg.segmentType}
                {' · '}
                <span style={{ fontWeight: 400, color: '#6b778c' }}>
                  {formatMinutes(seg.businessSeconds)} (biz hrs)
                </span>
              </div>
              <div style={{ color: '#6b778c', fontSize: '11px' }}>
                {new Date(seg.startedAt).toLocaleString()} →{' '}
                {new Date(seg.endedAt).toLocaleString()}
              </div>
              {seg.status && (
                <div style={{ color: '#6b778c', fontSize: '11px' }}>
                  status: {seg.status}
                </div>
              )}
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
