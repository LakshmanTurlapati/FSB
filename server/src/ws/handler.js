const WebSocket = require('ws');

// Room map: hashKey -> { extensions: Set<ws>, dashboards: Set<ws> }
const rooms = new Map();

/**
 * Set up WebSocket connection handling on the given WebSocketServer.
 * Called after upgrade authentication completes in server.js.
 */
function setupWSHandler(wss) {
  wss.on('connection', (ws, request, { hashKey, role }) => {
    addClient(hashKey, ws, role);

    // Notify dashboards when extension connects
    if (role === 'extension') {
      broadcast(hashKey, 'dashboards', {
        type: 'ext:status', payload: { online: true }, ts: Date.now()
      });
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return; // Do NOT relay pings
        }
        // Relay to opposite side of room
        relayToRoom(hashKey, ws, data.toString());
      } catch { /* ignore malformed JSON */ }
    });

    ws.on('close', () => {
      removeClient(hashKey, ws);
      if (role === 'extension') {
        broadcast(hashKey, 'dashboards', {
          type: 'ext:status', payload: { online: false }, ts: Date.now()
        });
      }
    });

    ws.on('error', () => {}); // Prevent unhandled error crashes; onclose fires after
  });
}

/**
 * Add a client to the appropriate room and side.
 */
function addClient(hashKey, ws, role) {
  if (!rooms.has(hashKey)) {
    rooms.set(hashKey, { extensions: new Set(), dashboards: new Set() });
  }
  const room = rooms.get(hashKey);
  const side = role === 'extension' ? 'extensions' : 'dashboards';
  room[side].add(ws);
  ws._fsbRole = role;
  ws._fsbHashKey = hashKey;
}

/**
 * Remove a client from its room. Clean up empty rooms.
 */
function removeClient(hashKey, ws) {
  const room = rooms.get(hashKey);
  if (!room) return;
  room.extensions.delete(ws);
  room.dashboards.delete(ws);
  if (room.extensions.size === 0 && room.dashboards.size === 0) {
    rooms.delete(hashKey);
  }
}

/**
 * Relay a raw message to the opposite side of the room.
 * Extension messages go to dashboards; dashboard messages go to extensions.
 */
function relayToRoom(hashKey, senderWs, rawMessage) {
  const room = rooms.get(hashKey);
  if (!room) return;
  const targets = senderWs._fsbRole === 'extension' ? room.dashboards : room.extensions;
  for (const client of targets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(rawMessage);
    }
  }
}

/**
 * Send a message object to one side of the room.
 * @param {string} hashKey - Room identifier
 * @param {'dashboards'|'extensions'} targetSide - Which side to send to
 * @param {object} messageObj - Will be JSON.stringified
 */
function broadcast(hashKey, targetSide, messageObj) {
  const room = rooms.get(hashKey);
  if (!room) return;
  const data = JSON.stringify(messageObj);
  for (const client of room[targetSide]) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

/**
 * Broadcast a message to all dashboard clients in a room.
 * Used by agents.js for REST-triggered events (agent updates, run completions).
 */
function broadcastToRoom(hashKey, messageObj) {
  const room = rooms.get(hashKey);
  if (!room) return;
  const data = JSON.stringify(messageObj);
  for (const client of room.dashboards) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

module.exports = { setupWSHandler, broadcastToRoom, rooms };
