const express = require('express');

function createAgentsRouter(queries, sseClients) {
  const router = express.Router();

  // GET /api/agents - List all agents
  router.get('/', (req, res) => {
    try {
      const agents = queries.listAgents(req.hashKey);
      res.json({ agents });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents - Upsert agent definition
  router.post('/', (req, res) => {
    try {
      const { agentId, name, task, targetUrl, scheduleType, scheduleConfig, enabled } = req.body;

      if (!agentId || !name || !task || !targetUrl) {
        return res.status(400).json({ error: 'Missing required fields: agentId, name, task, targetUrl' });
      }

      queries.upsertAgentData(req.hashKey, {
        agentId, name, task, targetUrl,
        scheduleType: scheduleType || 'interval',
        scheduleConfig: scheduleConfig || '{}',
        enabled: enabled !== false
      });

      const agent = queries.getAgentData(req.hashKey, agentId);
      broadcastSSE(sseClients, req.hashKey, { type: 'agent_updated', agent });
      res.json({ success: true, agent });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/agents/:agentId - Delete agent
  router.delete('/:agentId', (req, res) => {
    try {
      const result = queries.removeAgent(req.hashKey, req.params.agentId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      broadcastSSE(sseClients, req.hashKey, { type: 'agent_deleted', agentId: req.params.agentId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/:agentId/runs - Report run result
  router.post('/:agentId/runs', (req, res) => {
    try {
      const { agentId } = req.params;
      const body = req.body;

      // Upsert agent data if provided
      if (body.name && body.task && body.targetUrl) {
        queries.upsertAgentData(req.hashKey, {
          agentId,
          name: body.name,
          task: body.task,
          targetUrl: body.targetUrl,
          scheduleType: body.scheduleType || 'interval',
          scheduleConfig: body.scheduleConfig || '{}',
          enabled: body.enabled !== false
        });
      }

      // Record the run
      const run = body.run || {};
      queries.recordRun(req.hashKey, agentId, {
        runId: run.runId || 'run_' + Date.now().toString(36),
        startedAt: run.startedAt || new Date().toISOString(),
        completedAt: run.completedAt || new Date().toISOString(),
        status: run.status || 'unknown',
        result: run.result || null,
        error: run.error || null,
        iterations: run.iterations || 0,
        tokensUsed: run.tokensUsed || 0,
        costUsd: run.costUsd || 0,
        durationMs: run.durationMs || 0
      });

      broadcastSSE(sseClients, req.hashKey, {
        type: 'run_completed',
        agentId,
        run: run
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/agents/:agentId/runs - Get run history (paginated)
  router.get('/:agentId/runs', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const runs = queries.listRuns(req.hashKey, req.params.agentId, limit, offset);
      const total = queries.countRuns(req.hashKey, req.params.agentId);
      res.json({ runs, total, limit, offset });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats - Aggregate stats
  router.get('/stats', (req, res) => {
    try {
      const stats = queries.getAgentStats(req.hashKey);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

function broadcastSSE(sseClients, hashKey, data) {
  const clients = sseClients.get(hashKey);
  if (!clients || clients.length === 0) return;

  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      // Client disconnected
    }
  }
}

module.exports = createAgentsRouter;
