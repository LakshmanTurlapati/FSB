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

      case 'cron': {
        const nextRun = this._calculateNextCronRun(schedule.cronExpression);
        if (!nextRun) {
          console.warn('[FSB Scheduler] Could not calculate next cron run for:', agent.agentId);
          return false;
        }
        await chrome.alarms.create(alarmName, { when: nextRun });
        console.log('[FSB Scheduler] Cron alarm created:', alarmName, 'next at', new Date(nextRun).toLocaleString());
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
   * Reschedule a cron agent for its next occurrence (called after each run)
   * @param {Object} agent
   */
  async rescheduleCron(agent) {
    if (agent.schedule.type !== 'cron') return;
    await this.scheduleAgent(agent);
  }

  /**
   * Parse a standard 5-field cron expression (minute hour dayOfMonth month dayOfWeek).
   * Supports: numeric values, wildcards (*), ranges (1-5), lists (1,3,5).
   * @param {string} expression - Cron expression string
   * @returns {Object|null} Parsed object or null if invalid
   */
  parseCron(expression) {
    if (!expression || typeof expression !== 'string') return null;

    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const limits = [
      { min: 0, max: 59 },  // minute
      { min: 0, max: 23 },  // hour
      { min: 1, max: 31 },  // dayOfMonth
      { min: 1, max: 12 },  // month
      { min: 0, max: 6 }    // dayOfWeek
    ];

    const fieldNames = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
    const parsed = {};

    for (let i = 0; i < 5; i++) {
      const field = parts[i];
      const { min, max } = limits[i];

      if (field === '*') {
        parsed[fieldNames[i]] = '*';
        continue;
      }

      // Check for range (e.g., 1-5)
      if (field.includes('-') && !field.includes(',')) {
        const [startStr, endStr] = field.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) return null;
        const arr = [];
        for (let v = start; v <= end; v++) arr.push(v);
        parsed[fieldNames[i]] = arr;
        continue;
      }

      // Check for list (e.g., 1,3,5)
      if (field.includes(',')) {
        const values = field.split(',').map(v => parseInt(v.trim(), 10));
        if (values.some(v => isNaN(v) || v < min || v > max)) return null;
        parsed[fieldNames[i]] = values;
        continue;
      }

      // Single numeric value
      const val = parseInt(field, 10);
      if (isNaN(val) || val < min || val > max) return null;
      // Single values for minute/hour stored as number, day fields as array for consistency
      if (i <= 1) {
        parsed[fieldNames[i]] = val;
      } else {
        parsed[fieldNames[i]] = [val];
      }
    }

    return parsed;
  }

  /**
   * Calculate the next matching timestamp for a cron expression from now.
   * @param {string} cronExpression - 5-field cron expression
   * @returns {number|null} Timestamp of next run, or null if invalid
   */
  _calculateNextCronRun(cronExpression) {
    const cron = this.parseCron(cronExpression);
    if (!cron) return null;

    const now = new Date();
    const candidate = new Date(now);
    // Round up to next minute
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    // Search up to 366 days ahead
    const maxTime = now.getTime() + 366 * 24 * 60 * 60 * 1000;

    while (candidate.getTime() < maxTime) {
      const matches = this._cronFieldMatches(cron, candidate);
      if (matches) return candidate.getTime();

      // Optimization: skip ahead when possible
      if (cron.hour !== '*' && !this._valueInField(candidate.getHours(), cron.hour)) {
        // Skip to next hour
        candidate.setMinutes(0);
        candidate.setHours(candidate.getHours() + 1);
        continue;
      }

      // Advance by 1 minute
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return null;
  }

  /**
   * Check if a date matches all cron fields
   * @param {Object} cron - Parsed cron object
   * @param {Date} date
   * @returns {boolean}
   */
  _cronFieldMatches(cron, date) {
    if (!this._valueInField(date.getMinutes(), cron.minute)) return false;
    if (!this._valueInField(date.getHours(), cron.hour)) return false;
    if (!this._valueInField(date.getDate(), cron.dayOfMonth)) return false;
    if (!this._valueInField(date.getMonth() + 1, cron.month)) return false;
    if (!this._valueInField(date.getDay(), cron.dayOfWeek)) return false;
    return true;
  }

  /**
   * Check if a value matches a cron field (wildcard, number, or array)
   * @param {number} value
   * @param {string|number|number[]} field
   * @returns {boolean}
   */
  _valueInField(value, field) {
    if (field === '*') return true;
    if (typeof field === 'number') return value === field;
    if (Array.isArray(field)) return field.includes(value);
    return false;
  }

  /**
   * Generate a human-readable description for any schedule type
   * @param {Object} schedule - Schedule configuration object
   * @returns {string}
   */
  getScheduleDescription(schedule) {
    if (!schedule || !schedule.type) return 'Unknown schedule';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    switch (schedule.type) {
      case 'interval': {
        const mins = schedule.intervalMinutes || 1;
        if (mins >= 60 && mins % 60 === 0) {
          const hours = mins / 60;
          return hours === 1 ? 'Every 1 hour' : `Every ${hours} hours`;
        }
        return `Every ${mins} minutes`;
      }

      case 'daily': {
        const time = schedule.dailyTime || '00:00';
        if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0 && schedule.daysOfWeek.length < 7) {
          const names = schedule.daysOfWeek.map(d => dayNames[d]).join(', ');
          return `${names} at ${time}`;
        }
        return `Daily at ${time}`;
      }

      case 'once':
        return 'One-time execution';

      case 'cron': {
        const expr = schedule.cronExpression;
        if (!expr) return 'Cron: (no expression)';
        const cron = this.parseCron(expr);
        if (!cron) return `Cron: ${expr}`;

        // Try to produce natural language for common patterns
        const timeStr = String(typeof cron.hour === 'number' ? cron.hour : '').padStart(2, '0') + ':' +
                        String(typeof cron.minute === 'number' ? cron.minute : '').padStart(2, '0');
        const hasSpecificTime = typeof cron.hour === 'number' && typeof cron.minute === 'number';

        // Weekday pattern: * * 1-5 or [1,2,3,4,5]
        if (hasSpecificTime && cron.dayOfMonth === '*' && cron.month === '*' &&
            Array.isArray(cron.dayOfWeek) && cron.dayOfWeek.length === 5 &&
            [1,2,3,4,5].every(d => cron.dayOfWeek.includes(d))) {
          return `Every weekday at ${timeStr}`;
        }

        // Specific days of week
        if (hasSpecificTime && cron.dayOfMonth === '*' && cron.month === '*' &&
            Array.isArray(cron.dayOfWeek)) {
          const names = cron.dayOfWeek.map(d => dayNames[d]).join(', ');
          return `${names} at ${timeStr}`;
        }

        // Day of month pattern (e.g., 1st of every month)
        if (hasSpecificTime && Array.isArray(cron.dayOfMonth) && cron.month === '*' && cron.dayOfWeek === '*') {
          const dom = cron.dayOfMonth;
          if (dom.length === 1) {
            const suffix = dom[0] === 1 ? 'st' : dom[0] === 2 ? 'nd' : dom[0] === 3 ? 'rd' : 'th';
            return `${dom[0]}${suffix} of every month at ${timeStr}`;
          }
        }

        // Every day at specific time
        if (hasSpecificTime && cron.dayOfMonth === '*' && cron.month === '*' && cron.dayOfWeek === '*') {
          return `Daily at ${timeStr}`;
        }

        // Fallback
        return `Cron: ${expr}`;
      }

      default:
        return 'Unknown schedule';
    }
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

    if (agent.schedule.type === 'cron') {
      // Cron intervals vary; require at least 50 seconds since last run to prevent double-fire
      return timeSinceLastRun >= 50 * 1000;
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
