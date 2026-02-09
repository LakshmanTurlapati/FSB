import React from 'react';

export default function LiveIndicator({ connected }) {
  if (!connected) return null;

  return (
    <div className="live-indicator">
      <div className="live-dot" />
      <span>Live</span>
    </div>
  );
}
