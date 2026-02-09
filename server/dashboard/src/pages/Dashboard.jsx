import React, { useState, useEffect, useCallback } from 'react';
import { createAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import StatsPanel from '../components/StatsPanel';
import AgentCard from '../components/AgentCard';
import RunTimeline from '../components/RunTimeline';
import LiveIndicator from '../components/LiveIndicator';

export default function DashboardPage({ hashKey, onLogout }) {
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [runs, setRuns] = useState([]);
  const [view, setView] = useState('overview'); // overview | detail | live
  const [liveFeed, setLiveFeed] = useState([]);

  const api = createAPI(hashKey);

  const loadData = useCallback(async () => {
    try {
      const [statsData, agentsData] = await Promise.all([
        api.get('/stats'),
        api.get('/agents')
      ]);
      setStats(statsData);
      setAgents(agentsData.agents || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [hashKey]);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // SSE for real-time updates
  const handleSSEMessage = useCallback((data) => {
    setLiveFeed(prev => [{ ...data, timestamp: new Date().toISOString() }, ...prev].slice(0, 100));

    if (data.type === 'run_completed' || data.type === 'agent_updated' || data.type === 'agent_deleted') {
      loadData();
      // Refresh runs if viewing the affected agent
      if (selectedAgent && data.agentId === selectedAgent.agent_id) {
        loadAgentRuns(selectedAgent.agent_id);
      }
    }
  }, [selectedAgent, loadData]);

  const { connected } = useSSE(hashKey, handleSSEMessage);

  async function loadAgentRuns(agentId) {
    try {
      const data = await api.get(`/agents/${agentId}/runs?limit=50`);
      setRuns(data.runs || []);
    } catch (error) {
      console.error('Failed to load runs:', error);
    }
  }

  function selectAgent(agent) {
    setSelectedAgent(agent);
    setView('detail');
    loadAgentRuns(agent.agent_id);
  }

  function goBack() {
    setSelectedAgent(null);
    setRuns([]);
    setView('overview');
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>FSB Dashboard</h1>
          <span className="subtitle">Background Agent Monitoring</span>
        </div>
        <div className="header-actions">
          <LiveIndicator connected={connected} />
          <div className="nav-tabs" style={{ border: 'none', marginBottom: 0 }}>
            <button
              className={`nav-tab ${view === 'overview' ? 'active' : ''}`}
              onClick={goBack}
            >
              Overview
            </button>
            <button
              className={`nav-tab ${view === 'live' ? 'active' : ''}`}
              onClick={() => setView('live')}
            >
              Live Feed
            </button>
          </div>
          <button className="btn btn-sm" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <StatsPanel stats={stats} />

      {view === 'overview' && (
        <>
          <h3 style={{ marginBottom: '12px' }}>Agents</h3>
          {agents.length === 0 ? (
            <div className="empty-state">
              No agents synced yet. Enable server sync on agents in the extension to see them here.
            </div>
          ) : (
            <div className="agent-grid">
              {agents.map(agent => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  onClick={() => selectAgent(agent)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'detail' && selectedAgent && (
        <>
          <button className="btn btn-sm" onClick={goBack} style={{ marginBottom: '12px' }}>
            &larr; Back to Overview
          </button>
          <div className="card">
            <div className="card-header">
              <h3>{selectedAgent.name}</h3>
              <span className={`badge ${selectedAgent.enabled ? 'badge-active' : 'badge-disabled'}`}>
                {selectedAgent.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: '8px' }}><strong>Task:</strong> {selectedAgent.task}</p>
              <p style={{ marginBottom: '8px' }}><strong>URL:</strong> {selectedAgent.target_url}</p>
              <p><strong>Schedule:</strong> {selectedAgent.schedule_type}</p>
            </div>
          </div>

          <h3 style={{ marginBottom: '12px' }}>Run History</h3>
          <RunTimeline runs={runs} />
        </>
      )}

      {view === 'live' && (
        <>
          <h3 style={{ marginBottom: '12px' }}>
            Live Feed
            {connected && <span style={{ fontSize: '0.7em', color: 'var(--success)', marginLeft: '8px' }}>Connected</span>}
          </h3>
          {liveFeed.length === 0 ? (
            <div className="empty-state">
              Waiting for events... Agent run completions will appear here in real-time.
            </div>
          ) : (
            <div className="run-timeline">
              {liveFeed.map((event, i) => (
                <div key={i} className={`run-entry ${event.type === 'run_completed' && event.run?.status === 'success' ? 'success' : 'failed'}`}>
                  <div className="run-time">{new Date(event.timestamp).toLocaleTimeString()}</div>
                  <div className="run-result">
                    <span className="badge badge-active">{event.type}</span>
                    {' '}
                    {event.agentId && <span>Agent: {event.agentId.substring(0, 12)}...</span>}
                    {event.run?.status && <span> - {event.run.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
