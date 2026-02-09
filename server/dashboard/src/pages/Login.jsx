import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [hashKey, setHashKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hashKey.trim()) return;

    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/validate', {
        headers: { 'X-FSB-Hash-Key': hashKey.trim() }
      });
      const data = await resp.json();

      if (data.valid) {
        localStorage.setItem('fsb_hash_key', hashKey.trim());
        onLogin(hashKey.trim());
      } else {
        setError('Invalid hash key. Please check and try again.');
      }
    } catch (err) {
      setError('Cannot connect to server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>FSB Dashboard</h2>
        <p>Enter your hash key to access agent monitoring and results.</p>

        {error && <div className="login-error">{error}</div>}

        <input
          type="text"
          className="login-input"
          placeholder="Paste your hash key here"
          value={hashKey}
          onChange={(e) => setHashKey(e.target.value)}
          autoFocus
        />

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={loading || !hashKey.trim()}
        >
          {loading ? 'Validating...' : 'Access Dashboard'}
        </button>
      </form>
    </div>
  );
}
