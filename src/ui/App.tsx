import { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { formatDuration } from '../domain/rules/businessHours';
import type { BootstrapData, BootstrapRequest, BusinessCalendar, RuleSet, SelectorOption, StartMode, TimingMode, SurfaceKind } from '../domain/types';
import './styles.css';

const detectSurface = async (): Promise<{ surface: SurfaceKind; issueKey?: string }> => {
  try {
    const context = await view.getContext();
    const moduleKey = context.moduleKey ?? '';
    const extensionType = context.extension?.type ?? '';
    if (moduleKey.includes('issue-panel') || extensionType.includes('jira:issuePanel')) {
      return {
        surface: 'issuePanel',
        issueKey: context.extension?.issue?.key,
      };
    }
    if (moduleKey.includes('dashboard') || extensionType.includes('jira:dashboardGadget')) {
      return { surface: 'dashboardGadget' };
    }
  } catch {
    // Local preview fallback.
  }
  return { surface: 'projectPage' };
};

/* ── Constants for dropdowns / multi-selects ── */

const TIMING_MODE_OPTIONS: { value: TimingMode; label: string }[] = [
  { value: 'business-hours', label: 'Business Hours' },
  { value: '24x7', label: '24 × 7' },
];

const START_MODE_OPTIONS: { value: StartMode; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'status', label: 'Status change' },
  { value: 'assignment-or-status', label: 'Assignment or Status' },
];

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Stockholm', 'Europe/Warsaw',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Africa/Johannesburg', 'Africa/Lagos',
];

/* ── Multi-select chip helper ── */

const toggleInList = (list: string[], item: string): string[] =>
  list.includes(item) ? list.filter((v) => v !== item) : [...list, item];

/* ── Draft types ── */

type RuleSetDraft = RuleSet & {
  projectSearch?: string;
};

type CalendarDraft = BusinessCalendar & {
  newHoliday: string;
};

const toRuleSetDraft = (current: RuleSet): RuleSetDraft => ({
  ...current,
  projectSearch: '',
});

const toCalendarDraft = (current: BusinessCalendar): CalendarDraft => ({
  ...current,
  newHoliday: '',
});

const getOptionLabel = (options: SelectorOption[], value: string): string => (
  options.find((option) => option.value === value)?.label ?? value
);

const EMPTY_ADMIN_METADATA: BootstrapData['adminMetadata'] = {
  projects: [],
  assignees: [],
  teams: [],
  statuses: [],
  warnings: [],
  teamFieldConfigured: false,
};

export const App = () => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ruleSetDraft, setRuleSetDraft] = useState<RuleSetDraft | null>(null);
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft | null>(null);
  const [adminMetadataOverride, setAdminMetadataOverride] = useState<BootstrapData['adminMetadata'] | null>(null);

  const load = async (refresh = false): Promise<void> => {
    try {
      const surface = await detectSurface();
      if (refresh) {
        setRefreshing(true);
      }
      const response = await invoke<BootstrapData, BootstrapRequest>('bootstrap', {
        ...surface,
        refresh,
      });
      setData(response);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the SLA application.');
    } finally {
      if (refresh) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  useEffect(() => {
    setRuleSetDraft(data?.ruleSets[0] ? toRuleSetDraft(data.ruleSets[0]) : null);
    setCalendarDraft(data?.calendars[0] ? toCalendarDraft(data.calendars[0]) : null);
    setAdminMetadataOverride(null);
  }, [data]);

  useEffect(() => {
    if (!ruleSetDraft) {
      return;
    }

    let active = true;
    void invoke<BootstrapData['adminMetadata']>('getAdminMetadata', {
      projectKeys: ruleSetDraft.projectKeys,
    })
      .then((metadata) => {
        if (active) {
          setAdminMetadataOverride(metadata);
        }
      })
      .catch(() => {
        if (active) {
          setAdminMetadataOverride(null);
        }
      });

    return () => {
      active = false;
    };
  }, [ruleSetDraft?.projectKeys.join('|')]);

  const selectedSummary = data?.selectedIssue?.summary;
  const selectedSegments = data?.selectedIssue?.segments ?? [];
  const adminMetadata = adminMetadataOverride ?? data?.adminMetadata ?? EMPTY_ADMIN_METADATA;
  const availableStatuses = ruleSetDraft
    ? [...new Set([
        ...adminMetadata.statuses,
        ...ruleSetDraft.activeStatuses,
        ...ruleSetDraft.pausedStatuses,
        ...ruleSetDraft.stoppedStatuses,
        ...ruleSetDraft.resumeStatuses,
      ])].sort((left, right) => left.localeCompare(right))
    : adminMetadata.statuses;

  const toggleRuleSetValue = (
    field: 'projectKeys' | 'trackedAssignees' | 'trackedTeams' | 'activeStatuses' | 'pausedStatuses' | 'stoppedStatuses' | 'resumeStatuses',
    value: string,
  ): void => {
    setRuleSetDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [field]: toggleInList(current[field], value),
      };
    });
  };

  const runRebuild = async (issueKey: string): Promise<void> => {
    setSaving(true);
    try {
      await invoke('markIssueForRebuild', { issueKey });
      await invoke('runIssueRebuild', { issueKey });
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async (): Promise<void> => {
    const csv = await invoke<string>('exportCsv', {});
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jira-sla-export.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveRuleSetDraft = async (): Promise<void> => {
    if (!ruleSetDraft) {
      return;
    }
    setSaving(true);
    try {
      const { projectSearch: _discard, ...payload } = ruleSetDraft;
      await invoke('saveRuleSet', payload);
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  const saveCalendarDraft = async (): Promise<void> => {
    if (!calendarDraft) {
      return;
    }
    setSaving(true);
    try {
      const { newHoliday: _discard, ...rest } = calendarDraft;
      const payload: BusinessCalendar = rest;
      await invoke('saveBusinessCalendar', payload);
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <div className="shell"><p className="error">{error}</p></div>;
  }

  if (!data) {
    return <div className="shell"><p>Loading SLA analytics…</p></div>;
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Jira SLA Analytics</p>
          <h1>Deterministic SLA tracking for Jira assignments, pauses, and business hours</h1>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={() => void load(true)} disabled={saving || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
          <button className="secondary" onClick={() => void downloadCsv()} disabled={saving || refreshing}>Export CSV</button>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="card"><span>Tracked issues</span><strong>{data.overview.issueCount}</strong></article>
        <article className="card"><span>Breaches</span><strong>{data.overview.breachCount}</strong></article>
        <article className="card"><span>Avg response</span><strong>{formatDuration(data.overview.averageResponseSeconds)}</strong></article>
        <article className="card"><span>Avg active</span><strong>{formatDuration(data.overview.averageActiveSeconds)}</strong></article>
        <article className="card"><span>Total paused</span><strong>{formatDuration(data.overview.totalPausedSeconds)}</strong></article>
      </section>

      {data.surface === 'dashboardGadget' ? (
        <section className="grid two-up">
          <article className="card">
            <h2>Average active time by assignee</h2>
            <ul className="metric-list">
              {data.assigneeMetrics.map((metric) => (
                <li key={metric.label}><span>{metric.label}</span><strong>{formatDuration(metric.valueSeconds)}</strong></li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>Breaches by priority</h2>
            <ul className="metric-list">
              {data.breachMetrics.map((metric) => (
                <li key={metric.priority}><span>{metric.priority}</span><strong>{metric.count}</strong></li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      {selectedSummary && (data.surface === 'issuePanel' || data.surface === 'projectPage') ? (
        <section className="grid two-up">
          <article className="card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Issue detail</p>
                <h2>{selectedSummary.issueKey}</h2>
                <p>{selectedSummary.summary}</p>
              </div>
              <button onClick={() => void runRebuild(selectedSummary.issueKey)} disabled={saving}>Rebuild issue</button>
            </div>
            <dl className="detail-grid">
              <div><dt>SLA start</dt><dd>{selectedSummary.slaStartedAt ?? 'Not started'}</dd></div>
              <div><dt>Response</dt><dd>{formatDuration(selectedSummary.responseSeconds)}</dd></div>
              <div><dt>Active</dt><dd>{formatDuration(selectedSummary.activeSeconds)}</dd></div>
              <div><dt>Paused</dt><dd>{formatDuration(selectedSummary.pausedSeconds)}</dd></div>
              <div><dt>Outside hours</dt><dd>{formatDuration(selectedSummary.outsideHoursSeconds)}</dd></div>
              <div><dt>Breach state</dt><dd>{selectedSummary.breachState}</dd></div>
            </dl>
            <h3>Timeline explanation</h3>
            <ol className="timeline">
              {selectedSegments.map((segment) => (
                <li key={segment.segmentId}>
                  <div>
                    <strong>{segment.segmentType}</strong>
                    <span>{segment.startedAt} → {segment.endedAt}</span>
                  </div>
                  <p>{segment.reason}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="card">
            <h2>Issue explorer</h2>
            <table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Priority</th>
                  <th>Response</th>
                  <th>Active</th>
                  <th>Breach</th>
                </tr>
              </thead>
              <tbody>
                {data.summaries.map((summary) => (
                  <tr key={summary.issueKey}>
                    <td>{summary.issueKey}</td>
                    <td>{summary.currentPriority}</td>
                    <td>{formatDuration(summary.responseSeconds)}</td>
                    <td>{formatDuration(summary.activeSeconds)}</td>
                    <td>{summary.breachState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>
      ) : null}

      {data.surface === 'projectPage' ? (
        <section className="grid two-up">
          {adminMetadata.warnings.length > 0 ? (
            <article className="card warning-card full-span">
              <h2>Configuration notes</h2>
              <ul className="warning-list">
                {adminMetadata.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </article>
          ) : null}

          {ruleSetDraft && (
            <article className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Admin</p>
                  <h2>Rule set</h2>
                </div>
                <button onClick={() => void saveRuleSetDraft()} disabled={saving}>Save rule set</button>
              </div>
              <div className="form-grid">
                <label><span>Name</span><input value={ruleSetDraft.name ?? ''} onChange={(e) => setRuleSetDraft((c) => c ? { ...c, name: e.target.value } : c)} /></label>
                <label>
                  <span>Start mode</span>
                  <select value={ruleSetDraft.startMode} onChange={(e) => setRuleSetDraft((c) => c ? { ...c, startMode: e.target.value as StartMode } : c)}>
                    {START_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Default timing mode</span>
                  <select value={ruleSetDraft.defaultTimingMode} onChange={(e) => setRuleSetDraft((c) => c ? { ...c, defaultTimingMode: e.target.value as TimingMode } : c)}>
                    {TIMING_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={ruleSetDraft.enabled} onChange={(e) => setRuleSetDraft((c) => c ? { ...c, enabled: e.target.checked } : c)} />
                  <span>Enabled</span>
                </label>
              </div>

              <fieldset className="chip-fieldset">
                <legend>Projects</legend>
                <div className="chip-group">
                  {adminMetadata.projects.map((project) => (
                    <button key={project.value} type="button" className={ruleSetDraft.projectKeys.includes(project.value) ? 'chip selected' : 'chip'} onClick={() => toggleRuleSetValue('projectKeys', project.value)} title={project.description}>{project.label}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Tracked assignees</legend>
                <div className="chip-group">
                  {adminMetadata.assignees.map((assignee) => (
                    <button key={assignee.value} type="button" className={ruleSetDraft.trackedAssignees.includes(assignee.value) ? 'chip selected' : 'chip'} onClick={() => toggleRuleSetValue('trackedAssignees', assignee.value)} title={assignee.description}>{assignee.label}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Tracked teams</legend>
                <div className="chip-group">
                  {adminMetadata.teams.map((team) => (
                    <button key={team.value} type="button" className={ruleSetDraft.trackedTeams.includes(team.value) ? 'chip selected' : 'chip'} onClick={() => toggleRuleSetValue('trackedTeams', team.value)}>{team.label}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Active statuses</legend>
                <div className="chip-group">
                  {availableStatuses.map((s) => (
                    <button key={s} type="button" className={ruleSetDraft.activeStatuses.includes(s) ? 'chip selected' : 'chip'} onClick={() => setRuleSetDraft((c) => c ? { ...c, activeStatuses: toggleInList(c.activeStatuses, s) } : c)}>{s}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Paused statuses</legend>
                <div className="chip-group">
                  {availableStatuses.map((s) => (
                    <button key={s} type="button" className={ruleSetDraft.pausedStatuses.includes(s) ? 'chip selected' : 'chip'} onClick={() => setRuleSetDraft((c) => c ? { ...c, pausedStatuses: toggleInList(c.pausedStatuses, s) } : c)}>{s}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Stopped statuses</legend>
                <div className="chip-group">
                  {availableStatuses.map((s) => (
                    <button key={s} type="button" className={ruleSetDraft.stoppedStatuses.includes(s) ? 'chip selected' : 'chip'} onClick={() => setRuleSetDraft((c) => c ? { ...c, stoppedStatuses: toggleInList(c.stoppedStatuses, s) } : c)}>{s}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Resume statuses</legend>
                <div className="chip-group">
                  {availableStatuses.map((s) => (
                    <button key={s} type="button" className={ruleSetDraft.resumeStatuses.includes(s) ? 'chip selected' : 'chip'} onClick={() => setRuleSetDraft((c) => c ? { ...c, resumeStatuses: toggleInList(c.resumeStatuses, s) } : c)}>{s}</button>
                  ))}
                </div>
              </fieldset>

              {ruleSetDraft.trackedAssignees.length > 0 ? (
                <div className="selection-summary">
                  <strong>Selected assignees:</strong>
                  <span>{ruleSetDraft.trackedAssignees.map((value) => getOptionLabel(adminMetadata.assignees, value)).join(', ')}</span>
                </div>
              ) : null}

              {ruleSetDraft.trackedTeams.length > 0 ? (
                <div className="selection-summary">
                  <strong>Selected teams:</strong>
                  <span>{ruleSetDraft.trackedTeams.map((value) => getOptionLabel(adminMetadata.teams, value)).join(', ')}</span>
                </div>
              ) : null}
            </article>
          )}

          {calendarDraft && (
            <article className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Admin</p>
                  <h2>Business calendar</h2>
                </div>
                <button onClick={() => void saveCalendarDraft()} disabled={saving}>Save calendar</button>
              </div>
              <div className="form-grid">
                <label><span>Name</span><input value={calendarDraft.name ?? ''} onChange={(e) => setCalendarDraft((c) => c ? { ...c, name: e.target.value } : c)} /></label>
                <label>
                  <span>Timezone</span>
                  <select value={calendarDraft.timezone} onChange={(e) => setCalendarDraft((c) => c ? { ...c, timezone: e.target.value } : c)}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                  </select>
                </label>
                <label>
                  <span>Business day start</span>
                  <input type="time" value={calendarDraft.workingHours.start ?? ''} onChange={(e) => setCalendarDraft((c) => c ? { ...c, workingHours: { ...c.workingHours, start: e.target.value } } : c)} />
                </label>
                <label>
                  <span>Business day end</span>
                  <input type="time" value={calendarDraft.workingHours.end ?? ''} onChange={(e) => setCalendarDraft((c) => c ? { ...c, workingHours: { ...c.workingHours, end: e.target.value } } : c)} />
                </label>
                <label>
                  <span>After-hours mode</span>
                  <select value={calendarDraft.afterHoursMode} onChange={(e) => setCalendarDraft((c) => c ? { ...c, afterHoursMode: e.target.value as TimingMode } : c)}>
                    {TIMING_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              <fieldset className="chip-fieldset">
                <legend>Working days</legend>
                <div className="chip-group">
                  {DAY_LABELS.map((d) => (
                    <button key={d.value} type="button" className={calendarDraft.workingDays.includes(d.value) ? 'chip selected' : 'chip'} onClick={() => setCalendarDraft((c) => {
                      if (!c) return c;
                      const days = c.workingDays.includes(d.value) ? c.workingDays.filter((v) => v !== d.value) : [...c.workingDays, d.value];
                      return { ...c, workingDays: days };
                    })}>{d.label}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="chip-fieldset">
                <legend>Holidays</legend>
                <div className="holiday-list">
                  {calendarDraft.holidays.map((h) => (
                    <span key={h} className="chip selected">{h}<button type="button" className="chip-remove" onClick={() => setCalendarDraft((c) => c ? { ...c, holidays: c.holidays.filter((v) => v !== h) } : c)}>×</button></span>
                  ))}
                </div>
                <div className="holiday-add">
                  <input type="date" aria-label="Holiday date" value={calendarDraft.newHoliday} onChange={(e) => setCalendarDraft((c) => c ? { ...c, newHoliday: e.target.value } : c)} />
                  <button type="button" className="secondary" onClick={() => setCalendarDraft((c) => {
                    if (!c || !c.newHoliday || c.holidays.includes(c.newHoliday)) return c;
                    return { ...c, holidays: [...c.holidays, c.newHoliday].sort(), newHoliday: '' };
                  })}>Add holiday</button>
                </div>
              </fieldset>
            </article>
          )}
        </section>
      ) : null}

      {data.surface === 'projectPage' ? (
        <section className="grid two-up">
          <article className="card">
            <h2>Average active time by team</h2>
            <ul className="metric-list">
              {data.teamMetrics.map((metric) => (
                <li key={metric.label}><span>{metric.label}</span><strong>{formatDuration(metric.valueSeconds)}</strong></li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>Rebuild activity</h2>
            <ul className="metric-list">
              {data.rebuildJobs.slice(0, 6).map((job) => (
                <li key={job.jobId}><span>{job.issueKey} · {job.source}</span><strong>{job.status}</strong></li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </div>
  );
};
