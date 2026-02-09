import React from 'react';

function formatSchedule(agent) {
  const config = agent.schedule_config ? JSON.parse(agent.schedule_config) : {};
  const type = agent.schedule_type;

  if (type === 'interval') {
    const mins = config.intervalMinutes || 1;
    if (mins >= 60) return `Every ${(mins / 60).toFixed(0)}h`;
    return `Every ${mins}m`;
  }
  if (type === 'daily') return `Daily at ${config.dailyTime || '09:00'}`;
  if (type === 'once') return 'One-time';
  return type;
}

export default function AgentCard({ agent, onClick }) {
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div>
          <span className="agent-card-name">{agent.name}</span>
          {' '}
          <span className={`badge ${agent.enabled ? 'badge-active' : 'badge-disabled'}`}>
            {agent.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>
          {formatSchedule(agent)}
        </span>
      </div>
      <div className="card-body">
        <div className="agent-card-task">{agent.task}</div>
        <div className="agent-meta">
          <span>URL: {agent.target_url}</span>
        </div>
      </div>
    </div>
  );
}
