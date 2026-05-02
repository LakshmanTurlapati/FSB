/**
 * Tests for AgentScheduler cron support and schedule descriptions.
 * Run: node tests/test-agent-scheduler-cron.js
 */

// Minimal chrome.alarms mock
const alarms = {};
globalThis.chrome = {
  alarms: {
    create: async (name, opts) => { alarms[name] = opts; },
    clear: async (name) => { delete alarms[name]; },
    getAll: async () => Object.entries(alarms).map(([name, opts]) => ({ name, ...opts }))
  }
};

// Mock agentManager for rescheduleAllAgents
globalThis.agentManager = { listAgents: async () => [] };

// Load the scheduler
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('extension/agents/agent-scheduler.js', 'utf8');
vm.runInThisContext(src);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log('\n--- parseCron tests ---');

const p1 = agentScheduler.parseCron('0 9 * * 1-5');
assert(p1 !== null, 'parseCron("0 9 * * 1-5") returns non-null');
assert(p1 && p1.minute === 0, 'minute = 0');
assert(p1 && p1.hour === 9, 'hour = 9');
assert(p1 && p1.dayOfMonth === '*', 'dayOfMonth = *');
assert(p1 && p1.month === '*', 'month = *');
assert(p1 && deepEqual(p1.dayOfWeek, [1,2,3,4,5]), 'dayOfWeek = [1,2,3,4,5]');

const p2 = agentScheduler.parseCron('30 14 * * 1,4');
assert(p2 !== null, 'parseCron("30 14 * * 1,4") returns non-null');
assert(p2 && p2.minute === 30, 'minute = 30');
assert(p2 && p2.hour === 14, 'hour = 14');
assert(p2 && deepEqual(p2.dayOfWeek, [1,4]), 'dayOfWeek = [1,4]');

const p3 = agentScheduler.parseCron('0 0 1 * *');
assert(p3 !== null, 'parseCron("0 0 1 * *") returns non-null');
assert(p3 && p3.minute === 0, 'minute = 0');
assert(p3 && p3.hour === 0, 'hour = 0');
assert(p3 && deepEqual(p3.dayOfMonth, [1]), 'dayOfMonth = [1]');
assert(p3 && p3.dayOfWeek === '*', 'dayOfWeek = *');

const p4 = agentScheduler.parseCron('invalid');
assert(p4 === null, 'parseCron("invalid") returns null');

const p5 = agentScheduler.parseCron('0 25 * * *');
assert(p5 === null, 'parseCron("0 25 * * *") returns null (invalid hour)');

console.log('\n--- _calculateNextCronRun tests ---');

const nextWeekday = agentScheduler._calculateNextCronRun('0 9 * * 1-5');
assert(typeof nextWeekday === 'number' && nextWeekday > Date.now(), '_calculateNextCronRun returns future timestamp');
if (nextWeekday) {
  const d = new Date(nextWeekday);
  assert(d.getHours() === 9 && d.getMinutes() === 0, 'next run is at 09:00');
  assert(d.getDay() >= 1 && d.getDay() <= 5, 'next run is on a weekday');
}

const nextInvalid = agentScheduler._calculateNextCronRun('invalid');
assert(nextInvalid === null, '_calculateNextCronRun("invalid") returns null');

console.log('\n--- getScheduleDescription tests ---');

assert(agentScheduler.getScheduleDescription({ type: 'cron', cronExpression: '0 9 * * 1-5' }) === 'Every weekday at 09:00',
  'cron weekday description');

assert(agentScheduler.getScheduleDescription({ type: 'interval', intervalMinutes: 30 }) === 'Every 30 minutes',
  'interval 30 min description');

assert(agentScheduler.getScheduleDescription({ type: 'daily', dailyTime: '14:00' }) === 'Daily at 14:00',
  'daily description');

assert(agentScheduler.getScheduleDescription({ type: 'daily', dailyTime: '09:00', daysOfWeek: [1,3,5] }) === 'Mon, Wed, Fri at 09:00',
  'daily with days description');

assert(agentScheduler.getScheduleDescription({ type: 'once' }) === 'One-time execution',
  'once description');

console.log('\n--- scheduleAgent cron case ---');

(async () => {
  const cronAgent = {
    agentId: 'test_cron_1',
    enabled: true,
    schedule: { type: 'cron', cronExpression: '0 9 * * 1-5' },
    runCount: 0
  };
  const result = await agentScheduler.scheduleAgent(cronAgent);
  assert(result === true, 'scheduleAgent with cron returns true');
  const alarmName = agentScheduler.getAlarmName('test_cron_1');
  assert(alarms[alarmName] && alarms[alarmName].when > Date.now(), 'cron alarm has future "when" timestamp');

  console.log('\n--- isValidAlarmFire cron case ---');

  const recentAgent = { lastRunAt: Date.now() - 10000, schedule: { type: 'cron' } };
  assert(agentScheduler.isValidAlarmFire(recentAgent) === false, 'cron: too recent (10s) returns false');

  const oldAgent = { lastRunAt: Date.now() - 60000, schedule: { type: 'cron' } };
  assert(agentScheduler.isValidAlarmFire(oldAgent) === true, 'cron: 60s elapsed returns true');

  console.log('\n--- rescheduleCron ---');

  assert(typeof agentScheduler.rescheduleCron === 'function', 'rescheduleCron method exists');

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
})();
