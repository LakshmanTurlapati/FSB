import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import DashboardPage from './pages/Dashboard';

export default function App() {
  const [hashKey, setHashKey] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('fsb_hash_key');
    if (stored) {
      setHashKey(stored);
    }
  }, []);

  function handleLogin(key) {
    setHashKey(key);
  }

  function handleLogout() {
    localStorage.removeItem('fsb_hash_key');
    setHashKey(null);
  }

  if (!hashKey) {
    return <Login onLogin={handleLogin} />;
  }

  return <DashboardPage hashKey={hashKey} onLogout={handleLogout} />;
}
