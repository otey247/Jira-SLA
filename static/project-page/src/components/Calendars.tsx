import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

interface BusinessCalendar {
  calendarId: string;
  name: string;
  timezone: string;
  workingDays: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  holidayDates: string[];
  afterHoursMode: 'business-hours' | '24x7';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendars() {
  const [calendars, setCalendars] = useState<BusinessCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BusinessCalendar>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    invoke<BusinessCalendar[]>('listCalendars')
      .then((data) => setCalendars(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditingId('new');
    setForm({
      name: '',
      timezone: 'UTC',
      workingDays: [1, 2, 3, 4, 5],
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      holidayDates: [],
      afterHoursMode: 'business-hours',
    });
  };

  const handleSave = () => {
    setSaving(true);
    invoke('saveCalendar', {
      ...form,
      calendarId: editingId === 'new' ? undefined : editingId,
    })
      .then(() => {
        load();
        setEditingId(null);
      })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const toggleDay = (day: number) => {
    setForm((current) => {
      const days = current.workingDays ?? [];
      return {
        ...current,
        workingDays: days.includes(day)
          ? days.filter((value) => value !== day)
          : [...days, day].sort(),
      };
    });
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
        <h2 style={{ fontSize: '16px' }}>Business Calendars</h2>
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
          + New Calendar
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
            {editingId === 'new' ? 'New Calendar' : 'Edit Calendar'}
          </h3>
          {[
            { key: 'name', label: 'Name' },
            { key: 'timezone', label: 'Timezone (e.g. UTC, Asia/Kolkata)' },
            { key: 'workingHoursStart', label: 'Work Start (HH:MM)' },
            { key: 'workingHoursEnd', label: 'Work End (HH:MM)' },
            {
              key: 'holidayDates',
              label: 'Holiday Dates (comma-separated YYYY-MM-DD)',
            },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: '10px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#6b778c',
                  marginBottom: '4px',
                }}
              >
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
                  setForm((current) => ({
                    ...current,
                    [key]:
                      key === 'holidayDates'
                        ? e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
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
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#6b778c',
                marginBottom: '4px',
              }}
            >
              After-hours Mode
            </label>
            <select
              value={form.afterHoursMode ?? 'business-hours'}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  afterHoursMode: e.target.value as 'business-hours' | '24x7',
                }))
              }
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #dfe1e6',
                borderRadius: '4px',
              }}
            >
              <option value="business-hours">Business hours only</option>
              <option value="24x7">24x7</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#6b778c',
                marginBottom: '4px',
              }}
            >
              Working Days
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {DAY_NAMES.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #dfe1e6',
                    background: (form.workingDays ?? []).includes(idx)
                      ? '#0052cc'
                      : '#fff',
                    color: (form.workingDays ?? []).includes(idx) ? '#fff' : '#333',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
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

      {calendars.length === 0 ? (
        <div style={{ color: '#6b778c' }}>No calendars configured yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f4f5f7' }}>
              <th style={th}>Name</th>
              <th style={th}>Timezone</th>
              <th style={th}>Working Days</th>
              <th style={th}>Hours</th>
              <th style={th}>After Hours</th>
              <th style={th}>Holidays</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {calendars.map((cal) => (
              <tr key={cal.calendarId} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={td}>{cal.name}</td>
                <td style={td}>{cal.timezone}</td>
                <td style={td}>{cal.workingDays.map((d) => DAY_NAMES[d]).join(', ')}</td>
                <td style={td}>
                  {cal.workingHoursStart} – {cal.workingHoursEnd}
                </td>
                <td style={td}>{cal.afterHoursMode}</td>
                <td style={td}>{cal.holidayDates.length} days</td>
                <td style={td}>
                  <button
                    onClick={() => {
                      setEditingId(cal.calendarId);
                      setForm(cal);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    Edit
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

const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '12px',
  color: '#6b778c',
};

const td: React.CSSProperties = { padding: '8px 12px' };
