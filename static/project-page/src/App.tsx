import React, { useState } from 'react';
import Overview from './components/Overview';
import IssueExplorer from './components/IssueExplorer';
import AssigneeAnalytics from './components/AssigneeAnalytics';
import RuleSets from './components/RuleSets';
import Calendars from './components/Calendars';
import RebuildJobs from './components/RebuildJobs';

type Tab =
  | 'overview'
  | 'explorer'
  | 'assignee'
  | 'rulesets'
  | 'calendars'
  | 'rebuild';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'explorer', label: 'Tracked Issues' },
  { id: 'assignee', label: 'Assignee Analytics' },
  { id: 'rulesets', label: 'Rule Sets' },
  { id: 'calendars', label: 'Calendars' },
  { id: 'rebuild', label: 'Rebuild Jobs' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
        SLA Analytics
      </h1>

      {/* Tab bar */}
      <nav
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '24px',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid #0052cc'
                  : '2px solid transparent',
              color: activeTab === tab.id ? '#0052cc' : '#333',
              fontWeight: activeTab === tab.id ? 700 : 400,
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'overview' && <Overview />}
      {activeTab === 'explorer' && <IssueExplorer />}
      {activeTab === 'assignee' && <AssigneeAnalytics />}
      {activeTab === 'rulesets' && <RuleSets />}
      {activeTab === 'calendars' && <Calendars />}
      {activeTab === 'rebuild' && <RebuildJobs />}
    </div>
  );
}
