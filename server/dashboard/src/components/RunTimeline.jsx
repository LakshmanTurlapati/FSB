import React from 'react';

function formatDuration(ms) {
  if (!ms) return '--';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
}

export default function RunTimeline({ runs }) {
  if (!runs || runs.length === 0) {
    return <div className="empty-state">No runs recorded yet.</div>;
  }

  return (
    <div className="run-timeline">
      {runs.map((run) => (
        <div key={run.id || run.run_id} className={`run-entry ${run.status === 'success' ? 'success' : 'failed'}`}>
          <div className="run-time">
            {new Date(run.completed_at).toLocaleString()}
          </div>
          <div className="run-result">
            <span className={`badge badge-${run.status === 'success' ? 'success' : 'failed'}`}>
              {run.status}
            </span>
            {' '}
            {run.result && <span>{run.result.substring(0, 150)}</span>}
            {run.error && <span style={{ color: 'var(--error)' }}>{run.error.substring(0, 150)}</span>}
            {run.iterations > 0 && (
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '0.9em' }}>
                {run.iterations} iterations
              </span>
            )}
          </div>
          <div className="run-duration">{formatDuration(run.duration_ms)}</div>
        </div>
      ))}
    </div>
  );
}
