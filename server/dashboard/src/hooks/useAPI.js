/**
 * API helper for making authenticated requests
 */

export function createAPI(hashKey) {
  const headers = {
    'Content-Type': 'application/json',
    'X-FSB-Hash-Key': hashKey
  };

  return {
    async get(path) {
      const resp = await fetch(`/api${path}`, { headers });
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      return resp.json();
    },

    async post(path, body) {
      const resp = await fetch(`/api${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      return resp.json();
    },

    async del(path) {
      const resp = await fetch(`/api${path}`, {
        method: 'DELETE',
        headers
      });
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      return resp.json();
    }
  };
}
