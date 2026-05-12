'use strict';

// Defensive regression test for issue #29 follow-up.
// extension/ai/agent-loop.js callProviderWithTools (the tool_use path) was
// patched in PR #30 to seed a starter user turn for Gemini when the non
// system conversation is empty. extension/ai/universal-provider.js
// formatGeminiRequest is a parallel code path used by ai-integration.js
// (CLI/legacy mode and compaction). This test locks in the same defensive
// guard there so neither path can resurface the "contents is not specified"
// 400 from Gemini.

const { UniversalProvider } = require('../extension/ai/universal-provider.js');

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

function newGeminiProvider() {
  return new UniversalProvider({ modelProvider: 'gemini', modelName: 'gemini-flash-latest' });
}

console.log('\n--- formatGeminiRequest: system-only single message seeds a user turn ---');
{
  const provider = newGeminiProvider();
  const out = provider.formatGeminiRequest({
    messages: [{ role: 'system', content: 'You are a browser agent.' }]
  });
  assert(Array.isArray(out.contents), 'contents is an array');
  assert(out.contents.length > 0, 'contents is non-empty (would otherwise 400 "contents is not specified")');
  assert(out.contents[0].role === 'user', 'seeded turn has role=user');
  assert(typeof out.contents[0].parts?.[0]?.text === 'string' && out.contents[0].parts[0].text.length > 0, 'seeded turn has non-empty text');
}

console.log('\n--- formatGeminiRequest: user-only single message still works ---');
{
  const provider = newGeminiProvider();
  const out = provider.formatGeminiRequest({
    messages: [{ role: 'user', content: 'hello' }]
  });
  assert(out.contents.length === 1, 'one content entry');
  assert(out.contents[0].parts[0].text.includes('hello'), 'user text preserved');
}

console.log('\n--- formatGeminiRequest: legacy system+user pair preserved (no regression) ---');
{
  const provider = newGeminiProvider();
  const out = provider.formatGeminiRequest({
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' }
    ]
  });
  assert(out.contents.length === 1, 'one combined content entry');
  assert(out.contents[0].parts[0].text.includes('sys') && out.contents[0].parts[0].text.includes('usr'), 'system and user text are combined');
}

console.log('\n--- formatGeminiRequest: multi-turn with system + user + assistant ---');
{
  const provider = newGeminiProvider();
  const out = provider.formatGeminiRequest({
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' }
    ]
  });
  assert(out.contents.length === 3, 'three content entries (system folded into first user turn)');
  assert(out.contents[0].role === 'user' && out.contents[0].parts[0].text.includes('sys') && out.contents[0].parts[0].text.includes('u1'), 'first user turn has system prepended');
  assert(out.contents[1].role === 'model', 'assistant becomes model role');
  assert(out.contents[2].role === 'user' && out.contents[2].parts[0].text === 'u2', 'second user turn has no system prefix');
}

console.log('\n--- formatGeminiRequest: multi-turn with only system messages seeds a user turn ---');
{
  const provider = newGeminiProvider();
  const out = provider.formatGeminiRequest({
    messages: [
      { role: 'system', content: 'sys-a' },
      { role: 'system', content: 'sys-b' },
      { role: 'system', content: 'sys-c' }
    ]
  });
  assert(out.contents.length === 1, 'seeded single user turn');
  assert(out.contents[0].role === 'user', 'seeded role=user');
  assert(typeof out.contents[0].parts[0].text === 'string' && out.contents[0].parts[0].text.length > 0, 'seeded text is non-empty');
}

console.log('\n--- Summary ---');
console.log('  Passed:', passed);
console.log('  Failed:', failed);

if (failed > 0) process.exit(1);
