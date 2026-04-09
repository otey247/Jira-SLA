import React, { useState } from 'react';
import { invoke } from '@forge/bridge';

export default function RebuildJobs() {
  const [issueKey, setIssueKey] = useState('');
  const [ruleSetId, setRuleSetId] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);

  const handleRebuild = () => {
    if (!issueKey.trim()) return;
    setRunning(true);
    setStatus('');
    invoke<{ success: boolean; message?: string }>('rebuildIssue', {
      issueKey: issueKey.trim().toUpperCase(),
      ruleSetId: ruleSetId.trim(),
    })
      .then((res) => {
        setStatus(res?.success ? '✓ Rebuild complete.' : `✗ ${res?.message ?? 'Failed'}`);
      })
      .catch((err: Error) => setStatus(`✗ ${err.message}`))
      .finally(() => setRunning(false));
  };

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Rebuild Jobs</h2>
      <p style={{ fontSize: '14px', color: '#6b778c', marginBottom: '20px' }}>
        Manually trigger an SLA recomputation for a specific issue. The scheduled
        trigger runs every 5 minutes for all recently-updated issues.
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Issue key (e.g. PROJ-123)"
          value={issueKey}
          onChange={(e) => setIssueKey(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid #dfe1e6', borderRadius: '4px', fontSize: '14px', width: '220px' }}
        />
        <input
          type="text"
          placeholder="Rule Set ID (optional)"
          value={ruleSetId}
          onChange={(e) => setRuleSetId(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid #dfe1e6', borderRadius: '4px', fontSize: '14px', width: '220px' }}
        />
        <button
          onClick={handleRebuild}
          disabled={running || !issueKey.trim()}
          style={{
            padding: '8px 16px',
            background: running ? '#6b778c' : '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running…' : '↻ Rebuild'}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: '16px',
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
    </div>
  );
}
