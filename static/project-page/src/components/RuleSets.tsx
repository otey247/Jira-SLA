import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

interface RuleSet {
  ruleSetId: string;
  name: string;
  projectKeys: string[];
  activeStatuses: string[];
  pausedStatuses: string[];
  stoppedStatuses: string[];
  trackedAssigneeAccountIds: string[];
  startMode: 'assignment' | 'status';
  timezone: string;
}

function strList(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function RuleSets() {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RuleSet>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    invoke<RuleSet[]>('listRuleSets')
      .then((data) => setRuleSets(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startNew = () => {
    setEditingId('new');
    setForm({
      name: '',
      projectKeys: [],
      activeStatuses: ['In Progress', 'Open'],
      pausedStatuses: ['Waiting for Info', 'Blocked'],
      stoppedStatuses: ['Done', 'Closed', 'Resolved'],
      trackedAssigneeAccountIds: [],
      startMode: 'assignment',
      timezone: 'UTC',
    });
  };

  const startEdit = (rs: RuleSet) => {
    setEditingId(rs.ruleSetId);
    setForm(rs);
  };

  const handleSave = () => {
    setSaving(true);
    invoke('saveRuleSet', { ...form, ruleSetId: editingId === 'new' ? undefined : editingId })
      .then(() => { load(); setEditingId(null); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this rule set?')) return;
    invoke('deleteRuleSet', { ruleSetId: id }).then(load).catch(console.error);
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '16px' }}>Rule Sets</h2>
        <button
          onClick={startNew}
          style={{
            padding: '8px 16px',
            background: '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          + New Rule Set
        </button>
      </div>

      {editingId && (
        <div
          style={{
            background: '#f4f5f7',
            padding: '16px',
            borderRadius: '4px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>
            {editingId === 'new' ? 'New Rule Set' : 'Edit Rule Set'}
          </h3>
          {[
            { key: 'name', label: 'Name' },
            { key: 'projectKeys', label: 'Project Keys (comma-separated)' },
            { key: 'trackedAssigneeAccountIds', label: 'Tracked Assignee IDs (comma-separated)' },
            { key: 'activeStatuses', label: 'Active Statuses (comma-separated)' },
            { key: 'pausedStatuses', label: 'Paused Statuses (comma-separated)' },
            { key: 'stoppedStatuses', label: 'Stopped Statuses (comma-separated)' },
            { key: 'timezone', label: 'Timezone (e.g. UTC, Asia/Kolkata)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b778c', marginBottom: '4px' }}>
                {label}
              </label>
              <input
                type="text"
                value={
                  Array.isArray((form as Record<string, unknown>)[key])
                    ? ((form as Record<string, unknown>)[key] as string[]).join(', ')
                    : ((form as Record<string, unknown>)[key] as string) ?? ''
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [key]: ['projectKeys', 'trackedAssigneeAccountIds', 'activeStatuses', 'pausedStatuses', 'stoppedStatuses'].includes(key)
                      ? strList(e.target.value)
                      : e.target.value,
                  }))
                }
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #dfe1e6',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              />
            </div>
          ))}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b778c', marginBottom: '4px' }}>
              Start Mode
            </label>
            <select
              value={form.startMode ?? 'assignment'}
              onChange={(e) =>
                setForm((f) => ({ ...f, startMode: e.target.value as 'assignment' | 'status' }))
              }
              style={{ padding: '6px 10px', border: '1px solid #dfe1e6', borderRadius: '4px' }}
            >
              <option value="assignment">Assignment</option>
              <option value="status">Status change</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 16px',
                background: '#0052cc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingId(null)}
              style={{
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #dfe1e6',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {ruleSets.length === 0 ? (
        <div style={{ color: '#6b778c' }}>No rule sets configured yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f4f5f7' }}>
              <th style={th}>Name</th>
              <th style={th}>Projects</th>
              <th style={th}>Start Mode</th>
              <th style={th}>Timezone</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ruleSets.map((rs) => (
              <tr key={rs.ruleSetId} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={td}>{rs.name}</td>
                <td style={td}>{rs.projectKeys.join(', ')}</td>
                <td style={td}>{rs.startMode}</td>
                <td style={td}>{rs.timezone}</td>
                <td style={td}>
                  <button
                    onClick={() => startEdit(rs)}
                    style={{ marginRight: '8px', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rs.ruleSetId)}
                    style={{ color: '#de350b', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '12px', color: '#6b778c' };
const td: React.CSSProperties = { padding: '8px 12px' };
