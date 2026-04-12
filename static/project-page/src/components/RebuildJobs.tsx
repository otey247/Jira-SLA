import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

interface RebuildJob {
  jobId: string;
  scope: 'issue' | 'project-window' | 'scheduled';
  status: 'queued' | 'running' | 'completed' | 'failed';
  projectKey: string | null;
  issueKey: string | null;
  ruleSetId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  requestedAt: string;
  completedAt: string | null;
  processedIssueCount: number;
  errorCount: number;
  message: string | null;
}

interface RebuildResult {
  success: boolean;
  job?: RebuildJob | null;
}

export default function RebuildJobs() {
  const [projectKey, setProjectKey] = useState('');
  const [issueKey, setIssueKey] = useState('');
  const [ruleSetId, setRuleSetId] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<RebuildJob[]>([]);

  const loadJobs = () =>
    invoke<RebuildJob[]>('listRebuildJobs')
      .then((data) => setJobs(data ?? []))
      .catch(console.error);

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
      })
      .catch(console.error);

    void loadJobs();
  }, []);

  const handleIssueRebuild = () => {
    if (!issueKey.trim()) return;
    setRunning(true);
    setStatus('');
    invoke<RebuildResult>('rebuildIssue', {
      issueKey: issueKey.trim().toUpperCase(),
      ruleSetId: ruleSetId.trim(),
    })
      .then((result) => {
        setStatus(
          result?.success
            ? '✓ Issue rebuild complete.'
            : `✗ ${result?.job?.message ?? 'Issue rebuild failed.'}`,
        );
      })
      .catch((err: Error) => setStatus(`✗ ${err.message}`))
      .finally(() => {
        setRunning(false);
        void loadJobs();
      });
  };

  const handleProjectRebuild = () => {
    if (!projectKey.trim()) return;
    setRunning(true);
    setStatus('');
    invoke<RebuildResult>('recomputeProjectWindow', {
      projectKey,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      ruleSetId: ruleSetId.trim() || undefined,
    })
      .then((result) => {
        setStatus(
          result?.success
            ? `✓ Project rebuild complete. ${result?.job?.processedIssueCount ?? 0} issue rebuilds processed.`
            : `✗ ${result?.job?.message ?? 'Project rebuild failed.'}`,
        );
      })
      .catch((err: Error) => setStatus(`✗ ${err.message}`))
      .finally(() => {
        setRunning(false);
        void loadJobs();
      });
  };

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Rebuild Jobs</h2>
      <p style={{ fontSize: '14px', color: '#6b778c', marginBottom: '20px' }}>
        Trigger targeted issue rebuilds or rebuild all issues in a project/date
        window. Recent job history is tracked below for diagnostics.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <label style={labelStyle}>
          Issue key
          <input
            type="text"
            placeholder="PROJ-123"
            value={issueKey}
            onChange={(e) => setIssueKey(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Rule Set ID (optional)
          <input
            type="text"
            placeholder="rule-set-id"
            value={ruleSetId}
            onChange={(e) => setRuleSetId(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Project key
          <input
            type="text"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Updated from
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Updated to
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={handleIssueRebuild}
          disabled={running || !issueKey.trim()}
          style={primaryButton}
        >
          {running ? 'Running…' : '↻ Rebuild Issue'}
        </button>
        <button
          onClick={handleProjectRebuild}
          disabled={running || !projectKey.trim()}
          style={secondaryButton}
        >
          {running ? 'Running…' : '↻ Rebuild Project Window'}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '4px',
            background: status.startsWith('✓') ? '#e3fcef' : '#ffebe6',
            color: status.startsWith('✓') ? '#006644' : '#de350b',
            fontSize: '14px',
          }}
        >
          {status}
        </div>
      )}

      <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Recent rebuild history</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f4f5f7' }}>
            <th style={th}>Requested</th>
            <th style={th}>Scope</th>
            <th style={th}>Target</th>
            <th style={th}>Status</th>
            <th style={th}>Processed</th>
            <th style={th}>Errors</th>
            <th style={th}>Message</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobId} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={td}>{new Date(job.requestedAt).toLocaleString()}</td>
              <td style={td}>{job.scope}</td>
              <td style={td}>
                {job.issueKey ?? job.projectKey}
                {job.dateStart || job.dateEnd
                  ? ` (${job.dateStart ?? '…'} → ${job.dateEnd ?? '…'})`
                  : ''}
              </td>
              <td
                style={{
                  ...td,
                  color:
                    job.status === 'completed'
                      ? '#36b37e'
                      : job.status === 'failed'
                        ? '#de350b'
                        : '#0052cc',
                }}
              >
                {job.status}
              </td>
              <td style={td}>{job.processedIssueCount}</td>
              <td style={td}>{job.errorCount}</td>
              <td style={td}>{job.message ?? '—'}</td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...td, textAlign: 'center', color: '#6b778c' }}>
                No rebuild jobs have run yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
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
};

const primaryButton: React.CSSProperties = {
  padding: '8px 16px',
  background: '#0052cc',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const secondaryButton: React.CSSProperties = {
  padding: '8px 16px',
  background: '#fff',
  color: '#0052cc',
  border: '1px solid #0052cc',
  borderRadius: '4px',
  cursor: 'pointer',
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
