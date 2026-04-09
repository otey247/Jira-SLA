import { useEffect, useMemo, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { formatDuration } from '../domain/rules/businessHours';
import type { BootstrapData, BusinessCalendar, RuleSet, SurfaceKind } from '../domain/types';
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

const textToList = (value: string): string[] => value.split(',').map((item) => item.trim()).filter(Boolean);

export const App = () => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (): Promise<void> => {
    try {
      const surface = await detectSurface();
      const response = await invoke<BootstrapData>('bootstrap', surface);
      setData(response);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the SLA application.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedSummary = data?.selectedIssue?.summary;
  const selectedSegments = data?.selectedIssue?.segments ?? [];

  const ruleSetDraft = useMemo(() => {
    const current = data?.ruleSets[0];
    if (!current) {
      return null;
    }
    return {
      ...current,
      projectKeysText: current.projectKeys.join(', '),
      trackedAssigneesText: current.trackedAssignees.join(', '),
      trackedTeamsText: current.trackedTeams.join(', '),
      activeStatusesText: current.activeStatuses.join(', '),
      pausedStatusesText: current.pausedStatuses.join(', '),
      stoppedStatusesText: current.stoppedStatuses.join(', '),
      resumeStatusesText: current.resumeStatuses.join(', '),
    };
  }, [data]);

  const calendarDraft = useMemo(() => {
    const current = data?.calendars[0];
    if (!current) {
      return null;
    }
    return {
      ...current,
      workingDaysText: current.workingDays.join(', '),
      holidaysText: current.holidays.join(', '),
    };
  }, [data]);

  const runRebuild = async (issueKey: string): Promise<void> => {
    setSaving(true);
    try {
      await invoke('markIssueForRebuild', { issueKey });
      await invoke('runIssueRebuild', { issueKey });
      await load();
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
      const payload: RuleSet = {
        ...ruleSetDraft,
        projectKeys: textToList(ruleSetDraft.projectKeysText),
        trackedAssignees: textToList(ruleSetDraft.trackedAssigneesText),
        trackedTeams: textToList(ruleSetDraft.trackedTeamsText),
        activeStatuses: textToList(ruleSetDraft.activeStatusesText),
        pausedStatuses: textToList(ruleSetDraft.pausedStatusesText),
        stoppedStatuses: textToList(ruleSetDraft.stoppedStatusesText),
        resumeStatuses: textToList(ruleSetDraft.resumeStatusesText),
      };
      await invoke('saveRuleSet', payload);
      await load();
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
      const payload: BusinessCalendar = {
        ...calendarDraft,
        workingDays: textToList(calendarDraft.workingDaysText).map((item) => Number(item)),
        holidays: textToList(calendarDraft.holidaysText),
      };
      await invoke('saveBusinessCalendar', payload);
      await load();
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
        <button className="secondary" onClick={() => void downloadCsv()}>Export CSV</button>
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
                <label><span>Name</span><input defaultValue={ruleSetDraft.name} onChange={(event) => { ruleSetDraft.name = event.target.value; }} /></label>
                <label><span>Projects</span><input defaultValue={ruleSetDraft.projectKeysText} onChange={(event) => { ruleSetDraft.projectKeysText = event.target.value; }} /></label>
                <label><span>Tracked assignees</span><input defaultValue={ruleSetDraft.trackedAssigneesText} onChange={(event) => { ruleSetDraft.trackedAssigneesText = event.target.value; }} /></label>
                <label><span>Tracked teams</span><input defaultValue={ruleSetDraft.trackedTeamsText} onChange={(event) => { ruleSetDraft.trackedTeamsText = event.target.value; }} /></label>
                <label><span>Active statuses</span><input defaultValue={ruleSetDraft.activeStatusesText} onChange={(event) => { ruleSetDraft.activeStatusesText = event.target.value; }} /></label>
                <label><span>Paused statuses</span><input defaultValue={ruleSetDraft.pausedStatusesText} onChange={(event) => { ruleSetDraft.pausedStatusesText = event.target.value; }} /></label>
                <label><span>Stopped statuses</span><input defaultValue={ruleSetDraft.stoppedStatusesText} onChange={(event) => { ruleSetDraft.stoppedStatusesText = event.target.value; }} /></label>
                <label><span>Resume statuses</span><input defaultValue={ruleSetDraft.resumeStatusesText} onChange={(event) => { ruleSetDraft.resumeStatusesText = event.target.value; }} /></label>
              </div>
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
                <label><span>Name</span><input defaultValue={calendarDraft.name} onChange={(event) => { calendarDraft.name = event.target.value; }} /></label>
                <label><span>Timezone</span><input defaultValue={calendarDraft.timezone} onChange={(event) => { calendarDraft.timezone = event.target.value; }} /></label>
                <label><span>Working days</span><input defaultValue={calendarDraft.workingDaysText} onChange={(event) => { calendarDraft.workingDaysText = event.target.value; }} /></label>
                <label><span>Holidays</span><input defaultValue={calendarDraft.holidaysText} onChange={(event) => { calendarDraft.holidaysText = event.target.value; }} /></label>
                <label><span>Business day start</span><input defaultValue={calendarDraft.workingHours.start} onChange={(event) => { calendarDraft.workingHours.start = event.target.value; }} /></label>
                <label><span>Business day end</span><input defaultValue={calendarDraft.workingHours.end} onChange={(event) => { calendarDraft.workingHours.end = event.target.value; }} /></label>
              </div>
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
