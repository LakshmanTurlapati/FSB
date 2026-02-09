import React from 'react';

export default function StatsPanel({ stats }) {
  if (!stats) return null;

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-value">{stats.totalAgents}</div>
        <div className="stat-label">Total Agents</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.enabledAgents}</div>
        <div className="stat-label">Active</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.runsToday}</div>
        <div className="stat-label">Runs Today</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.successRate}%</div>
        <div className="stat-label">Success Rate</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">${stats.totalCost.toFixed(4)}</div>
        <div className="stat-label">Total Cost</div>
      </div>
    </div>
  );
}
