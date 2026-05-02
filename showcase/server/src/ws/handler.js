const WebSocket = require('ws');

const ROOM_DIAGNOSTIC_LIMIT = 100;

// Room map: hashKey -> { extensions: Set<ws>, dashboards: Set<ws> }
const rooms = new Map();
const roomDiagnostics = new Map();

function getOrCreateRoomDiagnostics(hashKey) {
  if (!roomDiagnostics.has(hashKey)) {
    roomDiagnostics.set(hashKey, {
      events: [],
      receivedByType: {},
      deliveredByType: {},
      droppedByType: {},
      lastClose: null
    });
  }

  return roomDiagnostics.get(hashKey);
}

function incrementRoomCounter(hashKey, bucket, type, amount) {
  if (!type || !amount) return;
  const diagnostics = getOrCreateRoomDiagnostics(hashKey);
  diagnostics[bucket][type] = (diagnostics[bucket][type] || 0) + amount;
}

function pushRoomDiagnosticEvent(hashKey, details) {
  const diagnostics = getOrCreateRoomDiagnostics(hashKey);
  const entry = Object.assign({ ts: Date.now() }, details || {});
  diagnostics.events.push(entry);
  if (diagnostics.events.length > ROOM_DIAGNOSTIC_LIMIT) {
    diagnostics.events.shift();
  }
  return entry;
}

function normalizeCloseReason(reason) {
  if (!reason) return '';
  if (Buffer.isBuffer(reason)) return reason.toString();
  return String(reason);
}

function recordRoomConnectionEvent(hashKey, eventName, role, closeCode, closeReason) {
  const normalizedReason = normalizeCloseReason(closeReason);
  const entry = pushRoomDiagnosticEvent(hashKey, {
    event: eventName,
    role,
    hashKey,
    closeCode: typeof closeCode === 'number' ? closeCode : null,
    closeReason: normalizedReason
  });

  if (eventName === 'closed') {
    getOrCreateRoomDiagnostics(hashKey).lastClose = {
      role,
      hashKey,
      closeCode: typeof closeCode === 'number' ? closeCode : null,
      closeReason: normalizedReason,
      ts: entry.ts
    };
  }
}

function sendToClients(hashKey, clients, data, messageType, direction) {
  const type = messageType || 'unknown';
  let targetCount = 0;
  let deliveredCount = 0;
  let droppedCount = 0;

  for (const client of clients) {
    targetCount += 1;
    if (client.readyState !== WebSocket.OPEN) {
      droppedCount += 1;
      continue;
    }

    try {
      client.send(data);
      deliveredCount += 1;
    } catch {
      droppedCount += 1;
    }
  }

  incrementRoomCounter(hashKey, 'deliveredByType', type, deliveredCount);
  incrementRoomCounter(hashKey, 'droppedByType', type, droppedCount);

  pushRoomDiagnosticEvent(hashKey, {
    event: 'relay',
    direction,
    type,
    targetCount,
    deliveredCount,
    droppedCount
  });

  if (targetCount === 0 || droppedCount > 0) {
    pushRoomDiagnosticEvent(hashKey, {
      event: 'dropped-delivery',
      direction,
      type,
      targetCount,
      deliveredCount,
      droppedCount
    });
  }

  return { targetCount, deliveredCount, droppedCount };
}

function recordMissingRoomDelivery(hashKey, messageType, direction) {
  const type = messageType || 'unknown';
  pushRoomDiagnosticEvent(hashKey, {
    event: 'relay',
    direction,
    type,
    targetCount: 0,
    deliveredCount: 0,
    droppedCount: 0
  });
  pushRoomDiagnosticEvent(hashKey, {
    event: 'dropped-delivery',
    direction,
    type,
    targetCount: 0,
    deliveredCount: 0,
    droppedCount: 0
  });
  return { targetCount: 0, deliveredCount: 0, droppedCount: 0 };
}

function getRoomDiagnostics(hashKey) {
  const diagnostics = roomDiagnostics.get(hashKey);
  if (!diagnostics) return null;
  return {
    events: diagnostics.events.slice(),
    receivedByType: Object.assign({}, diagnostics.receivedByType),
    deliveredByType: Object.assign({}, diagnostics.deliveredByType),
    droppedByType: Object.assign({}, diagnostics.droppedByType),
    lastClose: diagnostics.lastClose ? Object.assign({}, diagnostics.lastClose) : null
  };
}

/**
 * Set up WebSocket connection handling on the given WebSocketServer.
 * Called after upgrade authentication completes in server.js.
 */
function setupWSHandler(wss) {
  wss.on('connection', (ws, request, { hashKey, role }) => {
    console.log(`[WS] ${role} connected, hashKey: ${hashKey.substring(0, 8)}...`);
    addClient(hashKey, ws, role);
    recordRoomConnectionEvent(hashKey, 'connected', role, null, '');
    const room = rooms.get(hashKey);
    console.log(`[WS] Room ${hashKey.substring(0, 8)}...: ${room ? room.extensions.size : 0} ext, ${room ? room.dashboards.size : 0} dash`);

    // Notify dashboards when extension connects
    if (role === 'extension') {
      broadcast(hashKey, 'dashboards', {
        type: 'ext:status', payload: { online: true }, ts: Date.now()
      });
    }

    // When dashboard connects, tell it if an extension is already in the room
    if (role === 'dashboard') {
      const currentRoom = rooms.get(hashKey);
      if (currentRoom && currentRoom.extensions.size > 0) {
        ws.send(JSON.stringify({
          type: 'ext:status', payload: { online: true }, ts: Date.now()
        }));
      }
    }

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        pushRoomDiagnosticEvent(hashKey, {
          event: 'malformed-json',
          role,
          hashKey
        });
        return;
      }

      const messageType = typeof msg.type === 'string'
        ? msg.type
        : (msg && msg._lz ? 'compressed-envelope' : 'unknown');

      if (messageType === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return; // Do NOT relay pings
      }

      incrementRoomCounter(hashKey, 'receivedByType', messageType, 1);
      // TEMP DEBUG (Phase 212 diagnosis): log message types flowing through the relay
      // so we can see whether dash:dom-stream-start, ext:snapshot, ext:page-ready,
      // ext:dom-snapshot, ext:stream-state are firing in the expected order.
      const result = relayToRoom(hashKey, ws, data.toString(), messageType);
      console.log(`[WS] ${role}->${role === 'extension' ? 'dashboard' : 'extension'} room=${hashKey.substring(0, 8)} type=${messageType} delivered=${result?.deliveredCount || 0} dropped=${result?.droppedCount || 0}`);
    });

    ws.on('close', (closeCode, closeReason) => {
      console.log(`[WS] ${role} disconnected, hashKey: ${hashKey.substring(0, 8)}...`);
      recordRoomConnectionEvent(hashKey, 'closed', role, closeCode, closeReason);
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
function relayToRoom(hashKey, senderWs, rawMessage, messageType) {
  const room = rooms.get(hashKey);
  const direction = senderWs._fsbRole === 'extension'
    ? 'extension->dashboard'
    : 'dashboard->extension';
  if (!room) return recordMissingRoomDelivery(hashKey, messageType, direction);
  const targets = senderWs._fsbRole === 'extension' ? room.dashboards : room.extensions;
  return sendToClients(hashKey, targets, rawMessage, messageType, direction);
}

/**
 * Send a message object to one side of the room.
 * @param {string} hashKey - Room identifier
 * @param {'dashboards'|'extensions'} targetSide - Which side to send to
 * @param {object} messageObj - Will be JSON.stringified
 */
function broadcast(hashKey, targetSide, messageObj) {
  const room = rooms.get(hashKey);
  const direction = targetSide === 'dashboards' ? 'server->dashboard' : 'server->extension';
  if (!room) return recordMissingRoomDelivery(hashKey, messageObj && messageObj.type, direction);
  const data = JSON.stringify(messageObj);
  return sendToClients(hashKey, room[targetSide], data, messageObj && messageObj.type, direction);
}

/**
 * Broadcast a message to all dashboard clients in a room.
 * Used by agents.js for REST-triggered events (agent updates, run completions).
 */
function broadcastToRoom(hashKey, messageObj) {
  return broadcast(hashKey, 'dashboards', messageObj);
}

module.exports = { setupWSHandler, broadcastToRoom, getRoomDiagnostics, rooms };
