/**
 * Background Agent Scheduler for FSB
 * Manages chrome.alarms for scheduled agent execution.
 * Alarm names are prefixed with 'fsb_agent_' to avoid collisions.
 */

class AgentScheduler {
  constructor() {
    this.ALARM_PREFIX = 'fsb_agent_';
  }

  /**
   * Get the alarm name for an agent
   * @param {string} agentId
   * @returns {string}
   */
  getAlarmName(agentId) {
    return this.ALARM_PREFIX + agentId;
  }

  /**
   * Extract agentId from alarm name
   * @param {string} alarmName
   * @returns {string|null}
   */
  getAgentIdFromAlarm(alarmName) {
    if (!alarmName || !alarmName.startsWith(this.ALARM_PREFIX)) return null;
    return alarmName.substring(this.ALARM_PREFIX.length);
  }

  /**
   * Schedule an alarm for an agent based on its schedule configuration
   * @param {Object} agent - Agent data with schedule field
   * @returns {Promise<boolean>} Whether alarm was created
   */
  async scheduleAgent(agent) {
    if (!agent || !agent.enabled || !agent.schedule) {
      return false;
    }

    const alarmName = this.getAlarmName(agent.agentId);

    // Clear any existing alarm first
    await this.clearAlarm(agent.agentId);

    const schedule = agent.schedule;

    switch (schedule.type) {
      case 'interval': {
        const minutes = Math.max(1, schedule.intervalMinutes || 1);
        await chrome.alarms.create(alarmName, {
          delayInMinutes: minutes,
          periodInMinutes: minutes
        });
        console.log('[FSB Scheduler] Interval alarm created:', alarmName, 'every', minutes, 'min');
        return true;
      }

      case 'daily': {
        const nextRun = this._calculateNextDailyRun(schedule.dailyTime, schedule.daysOfWeek);
        if (!nextRun) {
          console.warn('[FSB Scheduler] Could not calculate next daily run for:', agent.agentId);
          return false;
        }
        await chrome.alarms.create(alarmName, { when: nextRun });
        console.log('[FSB Scheduler] Daily alarm created:', alarmName, 'at', new Date(nextRun).toLocaleString());
        return true;
      }

      case 'once': {
        // For 'once' type, schedule immediately if never run, or skip if already run
        if (agent.runCount > 0) {
          console.log('[FSB Scheduler] Once agent already ran, skipping:', agent.agentId);
          return false;
        }
        // Run in 1 minute (minimum alarm delay)
        await chrome.alarms.create(alarmName, { delayInMinutes: 1 });
        console.log('[FSB Scheduler] One-time alarm created:', alarmName);
        return true;
      }

      default:
        console.warn('[FSB Scheduler] Unknown schedule type:', schedule.type);
        return false;
    }
  }

  /**
   * Calculate the next occurrence timestamp for a daily schedule
   * @param {string} dailyTime - HH:MM format
   * @param {number[]} [daysOfWeek] - 0-6 (Sun-Sat), null/empty = every day
   * @returns {number|null} Timestamp of next run
   */
  _calculateNextDailyRun(dailyTime, daysOfWeek) {
    if (!dailyTime) return null;

    const [hours, minutes] = dailyTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time already passed today, start from tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    // If specific days are specified, find the next matching day
    if (daysOfWeek && daysOfWeek.length > 0) {
      const validDays = new Set(daysOfWeek);
      let attempts = 0;
      while (!validDays.has(target.getDay()) && attempts < 7) {
        target.setDate(target.getDate() + 1);
        attempts++;
      }
      if (attempts >= 7) return null; // No valid days
    }

    return target.getTime();
  }

  /**
   * Clear the alarm for an agent
   * @param {string} agentId
   */
  async clearAlarm(agentId) {
    const alarmName = this.getAlarmName(agentId);
    try {
      await chrome.alarms.clear(alarmName);
    } catch (error) {
      // Alarm may not exist, that's fine
    }
  }

  /**
   * Clear all FSB agent alarms
   */
  async clearAllAlarms() {
    try {
      const allAlarms = await chrome.alarms.getAll();
      for (const alarm of allAlarms) {
        if (alarm.name.startsWith(this.ALARM_PREFIX)) {
          await chrome.alarms.clear(alarm.name);
        }
      }
      console.log('[FSB Scheduler] All agent alarms cleared');
    } catch (error) {
      console.error('[FSB Scheduler] Error clearing alarms:', error.message);
    }
  }

  /**
   * Reschedule all enabled agents. Called on SW startup/install.
   */
  async rescheduleAllAgents() {
    try {
      const agents = await agentManager.listAgents();
      let scheduled = 0;

      for (const agent of agents) {
        if (agent.enabled) {
          const success = await this.scheduleAgent(agent);
          if (success) scheduled++;
        }
      }

      console.log('[FSB Scheduler] Rescheduled', scheduled, 'of', agents.length, 'agents');
    } catch (error) {
      console.error('[FSB Scheduler] Error rescheduling agents:', error.message);
    }
  }

  /**
   * Reschedule a daily agent for its next occurrence (called after each run)
   * @param {Object} agent
   */
  async rescheduleDaily(agent) {
    if (agent.schedule.type !== 'daily') return;
    await this.scheduleAgent(agent);
  }

  /**
   * Check if an alarm fire is valid (guard against double-runs)
   * @param {Object} agent
   * @returns {boolean}
   */
  isValidAlarmFire(agent) {
    if (!agent.lastRunAt) return true;

    const timeSinceLastRun = Date.now() - agent.lastRunAt;

    if (agent.schedule.type === 'interval') {
      // Must have at least 80% of interval elapsed to prevent double-fire
      const intervalMs = (agent.schedule.intervalMinutes || 1) * 60 * 1000;
      return timeSinceLastRun >= intervalMs * 0.8;
    }

    if (agent.schedule.type === 'once') {
      // Once agents should only run once
      return agent.runCount === 0;
    }

    // Daily: must be at least 23 hours since last run
    return timeSinceLastRun >= 23 * 60 * 60 * 1000;
  }

  /**
   * Get all active alarms for FSB agents
   * @returns {Promise<Object[]>}
   */
  async getActiveAlarms() {
    try {
      const allAlarms = await chrome.alarms.getAll();
      return allAlarms.filter(a => a.name.startsWith(this.ALARM_PREFIX));
    } catch (error) {
      return [];
    }
  }
}

// Export for service worker importScripts
const agentScheduler = new AgentScheduler();
