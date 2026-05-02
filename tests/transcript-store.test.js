/**
 * Unit tests for ai/transcript-store.js
 *
 * Adapted from archive/remote-main tests/test-transcript-store.js. Local
 * uses an options-object constructor ({tokenBudget, compactThreshold,
 * keepRecentCount}) and exposes hydrate()/getStats() instead of the
 * archive's raw-number constructor + toJSON/fromJSON + length getter.
 * The compaction semantics (80% trigger, keep recent 5, summarize to
 * "{tool} returned {status}" across OpenAI/Anthropic/Gemini formats) are
 * identical — tests preserve that validation intent.
 *
 * Run: node tests/transcript-store.test.js
 */

'use strict';

const { TranscriptStore, estimateTokens } = require('../extension/ai/transcript-store.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

// --- estimateTokens heuristic --------------------------------------------

console.log('\n--- estimateTokens heuristic ---');
{
  // char/4 heuristic: 40 chars == 10 tokens (rounded up)
  assertEqual(estimateTokens([{ role: 'user', content: 'x'.repeat(40) }]), 10, '40-char string message ≈ 10 tokens');
  assertEqual(estimateTokens([]), 0, 'empty messages array is 0 tokens');
}

// --- constructor with defaults -------------------------------------------

console.log('\n--- constructor with defaults ---');
{
  const ts = new TranscriptStore();
  assertEqual(ts.messages.length, 0, 'new store is empty');
  assertEqual(ts.tokenBudget, 128000, 'default tokenBudget');
  assertEqual(ts.compactThreshold, 0.8, 'default compactThreshold');
  assertEqual(ts.keepRecentCount, 5, 'default keepRecentCount');
}

// --- constructor with options --------------------------------------------

console.log('\n--- constructor with options ---');
{
  const ts = new TranscriptStore({ tokenBudget: 1000, compactThreshold: 0.5, keepRecentCount: 2 });
  assertEqual(ts.tokenBudget, 1000, 'custom tokenBudget');
  assertEqual(ts.compactThreshold, 0.5, 'custom compactThreshold');
  assertEqual(ts.keepRecentCount, 2, 'custom keepRecentCount');
}

// --- append and replay preserve order ------------------------------------

console.log('\n--- append and replay preserve order ---');
{
  const ts = new TranscriptStore();
  ts.append({ role: 'user', content: 'hello' });
  ts.append({ role: 'assistant', content: 'hi' });
  ts.append({ role: 'tool', name: 'click', content: '{"success":true}' });
  const msgs = ts.replay();
  assertEqual(msgs.length, 3, 'replay returns 3 messages');
  assertEqual(msgs[0].content, 'hello', 'first message is user');
  assertEqual(msgs[1].content, 'hi', 'second message is assistant');
  assertEqual(msgs[2].role, 'tool', 'third message is tool');
}

// --- append returns this for chaining ------------------------------------

console.log('\n--- append returns this for chaining ---');
{
  const ts = new TranscriptStore();
  const returned = ts.append({ role: 'user', content: 'a' });
  assert(returned === ts, 'append returns the store instance');
}

// --- replay returns a copy, not a reference ------------------------------

console.log('\n--- replay returns a copy, not a reference ---');
{
  const ts = new TranscriptStore();
  ts.append({ role: 'user', content: 'hello' });
  const slice = ts.replay();
  slice.push({ role: 'fake', content: 'injected' });
  assertEqual(ts.messages.length, 1, 'internal array unaffected by mutating replay copy');
}

// --- compact: OpenAI tool-role format ------------------------------------

console.log('\n--- compact: OpenAI tool-role format ---');
{
  const ts = new TranscriptStore({ tokenBudget: 100, keepRecentCount: 5 });
  // 80% of 100 = 80 tokens trigger. char/4 heuristic: >320 chars needed.
  // Each message ~70 chars => 17 tokens. 10 messages ~170 tokens — well over 80.
  for (let i = 0; i < 10; i++) {
    ts.append({ role: 'tool', name: 'click', content: '{"success":true,"data":"' + 'x'.repeat(40) + '"}' });
  }
  const result = ts.compact();
  assertEqual(result.compacted, true, 'compaction triggered');
  assert(result.removedCount > 0, 'some messages compacted (removedCount > 0)');
  assertEqual(result.removedCount, 5, 'compacted oldest 5 (10 total - keep 5 = 5 compactable)');
}

// --- compact: keeps recent 5 tool results intact -------------------------

console.log('\n--- compact: keeps recent 5 tool results intact ---');
{
  const ts = new TranscriptStore({ tokenBudget: 100, keepRecentCount: 5 });
  const originalContent = '{"success":true,"data":"' + 'x'.repeat(60) + '"}';
  for (let i = 0; i < 8; i++) {
    ts.append({ role: 'tool', name: 'click', content: originalContent });
  }
  ts.compact();
  const msgs = ts.replay();
  // First 3 should be compacted summaries (8 - 5 = 3)
  for (let i = 0; i < 3; i++) {
    assertEqual(msgs[i].content, 'click returned success', 'message ' + i + ' compacted to summary');
  }
  // Last 5 should retain original content
  for (let i = 3; i < 8; i++) {
    assertEqual(msgs[i].content, originalContent, 'message ' + i + ' (recent 5) keeps original content');
  }
}

// --- compact: Anthropic content-array format -----------------------------

console.log('\n--- compact: Anthropic content-array format ---');
{
  const ts = new TranscriptStore({ tokenBudget: 50, keepRecentCount: 5 });
  for (let i = 0; i < 7; i++) {
    ts.append({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: 'tu_' + i,
        name: 'navigate',
        content: '{"success":true,"data":"' + 'y'.repeat(50) + '"}'
      }]
    });
  }
  ts.compact();
  const msgs = ts.replay();
  // First 2 should be compacted (7 - 5 = 2)
  assertEqual(msgs[0].content[0].type, 'tool_result', 'Anthropic format preserves type');
  assertEqual(msgs[0].content[0].content, 'navigate returned success', 'Anthropic format compacted to summary');
  assertEqual(msgs[0].content[0].tool_use_id, 'tu_0', 'Anthropic format preserves tool_use_id');
}

// --- compact: Gemini functionResponse format -----------------------------

console.log('\n--- compact: Gemini functionResponse format ---');
{
  const ts = new TranscriptStore({ tokenBudget: 50, keepRecentCount: 5 });
  for (let i = 0; i < 7; i++) {
    ts.append({
      role: 'user',
      parts: [{ functionResponse: { name: 'click', response: { success: true, data: 'z'.repeat(50) } } }]
    });
  }
  ts.compact();
  const msgs = ts.replay();
  const frPart = msgs[0].parts.find(function (p) { return p.functionResponse; });
  assertEqual(frPart.functionResponse.response.result, 'click returned success', 'Gemini format compacted to summary');
}

// --- compact: error status detection -------------------------------------

console.log('\n--- compact: error status detection ---');
{
  const ts = new TranscriptStore({ tokenBudget: 50, keepRecentCount: 5 });
  for (let i = 0; i < 7; i++) {
    ts.append({ role: 'tool', name: 'navigate', content: '{"success":false,"error":"timeout"}' });
  }
  ts.compact();
  const msgs = ts.replay();
  assertEqual(msgs[0].content, 'navigate returned error', 'error status detected in compaction summary');
}

// --- compact: returns compacted=false when under threshold ---------------

console.log('\n--- compact: returns compacted=false when under threshold ---');
{
  const ts = new TranscriptStore({ tokenBudget: 128000 });
  ts.append({ role: 'user', content: 'short message' });
  const result = ts.compact();
  assertEqual(result.compacted, false, 'no compaction needed');
  assertEqual(result.removedCount, 0, 'zero removed');
  assert(typeof result.estimatedTokens === 'number', 'still reports estimatedTokens');
}

// --- compact: no compaction if not enough tool_results to compact --------

console.log('\n--- compact: fewer tool_results than keepRecentCount ---');
{
  const ts = new TranscriptStore({ tokenBudget: 10, keepRecentCount: 5 });
  // Only 3 tool_result messages — fewer than keep-5, so nothing is compactable
  for (let i = 0; i < 3; i++) {
    ts.append({ role: 'tool', name: 'click', content: '{"success":true,"data":"' + 'x'.repeat(200) + '"}' });
  }
  const result = ts.compact();
  assertEqual(result.compacted, false, 'no compaction when tool_results <= keepRecentCount');
  assertEqual(result.removedCount, 0, 'nothing removed');
}

// --- flush clears messages and returns old array ------------------------

console.log('\n--- flush clears messages and returns old array ---');
{
  const ts = new TranscriptStore();
  ts.append({ role: 'user', content: 'a' });
  ts.append({ role: 'assistant', content: 'b' });
  const old = ts.flush();
  assertEqual(ts.messages.length, 0, 'messages array empty after flush');
  assertEqual(ts.replay().length, 0, 'replay returns empty after flush');
  assertEqual(old.length, 2, 'flush returns old messages');
  assertEqual(old[0].content, 'a', 'old[0] preserved');
  assertEqual(old[1].content, 'b', 'old[1] preserved');
}

// --- getStats reports counts and compaction metrics ---------------------

console.log('\n--- getStats reports counts and compaction metrics ---');
{
  const ts = new TranscriptStore({ tokenBudget: 50, keepRecentCount: 5 });
  for (let i = 0; i < 8; i++) {
    ts.append({ role: 'tool', name: 'click', content: '{"success":true,"data":"' + 'x'.repeat(50) + '"}' });
  }
  const before = ts.getStats();
  assertEqual(before.messageCount, 8, 'messageCount before compact');
  assertEqual(before.compactionCount, 0, 'compactionCount starts at 0');
  assertEqual(before.totalTokensSaved, 0, 'totalTokensSaved starts at 0');

  ts.compact();

  const after = ts.getStats();
  assertEqual(after.messageCount, 8, 'messageCount unchanged by compact (messages edited in place)');
  assertEqual(after.compactionCount, 1, 'compactionCount incremented');
  assert(after.totalTokensSaved > 0, 'totalTokensSaved > 0 after compact');
}

// --- hydrate replaces messages from array --------------------------------

console.log('\n--- hydrate replaces messages from array ---');
{
  const ts = new TranscriptStore();
  ts.append({ role: 'user', content: 'old' });
  ts.hydrate([
    { role: 'user', content: 'new1' },
    { role: 'assistant', content: 'new2' }
  ]);
  assertEqual(ts.messages.length, 2, 'messages replaced');
  assertEqual(ts.messages[0].content, 'new1', 'first hydrated message');
  assertEqual(ts.messages[1].content, 'new2', 'second hydrated message');
}

// --- hydrate throws on non-array input -----------------------------------

console.log('\n--- hydrate throws on non-array input ---');
{
  const ts = new TranscriptStore();
  let threw = false;
  try { ts.hydrate(null); } catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'hydrate(null) throws TypeError');

  threw = false;
  try { ts.hydrate('not an array'); } catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'hydrate(string) throws TypeError');

  threw = false;
  try { ts.hydrate({ length: 0 }); } catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'hydrate(object) throws TypeError');
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
