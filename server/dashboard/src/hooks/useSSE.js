import { useEffect, useRef, useState } from 'react';

/**
 * Hook for subscribing to Server-Sent Events
 * @param {string} hashKey - Auth hash key
 * @param {Function} onMessage - Callback for incoming messages
 * @returns {{ connected: boolean }}
 */
export function useSSE(hashKey, onMessage) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!hashKey) return;

    const url = `/api/sse`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // EventSource doesn't support custom headers natively.
    // We use a workaround: pass hashKey as query param for SSE.
    // The server SSE route reads from header, but for browser EventSource
    // we need to use a different approach.
    es.close();

    // Use fetch-based SSE instead
    const controller = new AbortController();

    async function connect() {
      try {
        const response = await fetch('/api/sse', {
          headers: { 'X-FSB-Hash-Key': hashKey },
          signal: controller.signal
        });

        if (!response.ok) {
          setConnected(false);
          return;
        }

        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type !== 'connected' && onMessage) {
                  onMessage(data);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setConnected(false);
          // Reconnect after 5 seconds
          setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [hashKey]);

  return { connected };
}
