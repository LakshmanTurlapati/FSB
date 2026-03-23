#!/usr/bin/env node
/**
 * extract-test-cases.js
 *
 * Reads 50 v0.9.7 diagnostic reports (phases 47-96) and generates
 * VALIDATION-RUNNER.md -- a structured test harness for autopilot validation.
 *
 * Usage: node .planning/phases/103-validation/extract-test-cases.js
 *
 * Dependencies: Node.js built-in modules only (fs, path)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PHASES_DIR = path.join(PROJECT_ROOT, '.planning', 'phases');
const OUTPUT_FILE = path.join(__dirname, 'VALIDATION-RUNNER.md');

// Category sort order
const CATEGORY_ORDER = ['CANVAS', 'MICRO', 'SCROLL', 'CONTEXT', 'DARK'];

/**
 * Extract test case data from a single DIAGNOSTIC.md file.
 * Returns null if the file is missing or unparseable.
 */
function extractTestCase(phaseNum, dirName) {
  const diagPath = path.join(PHASES_DIR, dirName, `${phaseNum}-DIAGNOSTIC.md`);

  if (!fs.existsSync(diagPath)) {
    console.warn(`[WARN] Missing DIAGNOSTIC.md for phase ${phaseNum} (${dirName})`);
    return null;
  }

  const content = fs.readFileSync(diagPath, 'utf8');
  const lines = content.split('\n');

  // Extract phase description from directory name (after the number and dash)
  const description = dirName.replace(/^\d+-/, '');

  // Extract Requirement ID from "- Requirement: CANVAS-01" under ## Metadata
  let requirementId = '';
  for (const line of lines) {
    const reqMatch = line.match(/^- Requirement:\s*(\S+)/);
    if (reqMatch) {
      requirementId = reqMatch[1];
      break;
    }
  }

  // Extract Outcome -- only the first word after "Outcome: "
  let mcpOutcome = '';
  for (const line of lines) {
    const outcomeMatch = line.match(/^- Outcome:\s*(\S+)/);
    if (outcomeMatch) {
      mcpOutcome = outcomeMatch[1];
      break;
    }
  }

  // Extract prompt text -- the line immediately after "## Prompt Executed"
  let prompt = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Prompt Executed') {
      if (i + 1 < lines.length) {
        prompt = lines[i + 1].trim();
      }
      break;
    }
  }

  if (!prompt) {
    console.warn(`[WARN] No prompt found for phase ${phaseNum} (${dirName})`);
    return null;
  }

  // Adapt prompt for autopilot mode:
  // 1. Remove surrounding double quotes
  if (prompt.startsWith('"') && prompt.endsWith('"')) {
    prompt = prompt.slice(1, -1);
  }
  // 2. Remove " using MCP manual tools" suffix
  prompt = prompt.replace(/ using MCP manual tools/g, '');
  // 3. Remove " via MCP manual tools" suffix
  prompt = prompt.replace(/ via MCP manual tools/g, '');

  return {
    phase: phaseNum,
    description,
    requirementId,
    mcpOutcome,
    prompt
  };
}

/**
 * Parse the category prefix and number from a requirement ID.
 * e.g., "CANVAS-01" -> { category: "CANVAS", num: 1 }
 */
function parseReqId(reqId) {
  const match = reqId.match(/^(\w+)-(\d+)$/);
  if (!match) return { category: '', num: 0 };
  return { category: match[1], num: parseInt(match[2], 10) };
}

/**
 * Sort test cases by category order then requirement number.
 */
function sortTestCases(cases) {
  return cases.sort((a, b) => {
    const aReq = parseReqId(a.requirementId);
    const bReq = parseReqId(b.requirementId);
    const aCatIdx = CATEGORY_ORDER.indexOf(aReq.category);
    const bCatIdx = CATEGORY_ORDER.indexOf(bReq.category);
    if (aCatIdx !== bCatIdx) return aCatIdx - bCatIdx;
    return aReq.num - bReq.num;
  });
}

/**
 * Group test cases by category.
 */
function groupByCategory(cases) {
  const groups = {};
  for (const tc of cases) {
    const { category } = parseReqId(tc.requirementId);
    if (!groups[category]) groups[category] = [];
    groups[category].push(tc);
  }
  return groups;
}

/**
 * Count outcomes per category for the Quick Reference section.
 */
function countOutcomes(cases) {
  const counts = { PASS: 0, PARTIAL: 0, FAIL: 0, 'SKIP-AUTH': 0 };
  for (const tc of cases) {
    if (counts.hasOwnProperty(tc.mcpOutcome)) {
      counts[tc.mcpOutcome]++;
    } else {
      // Handle unexpected outcomes
      counts[tc.mcpOutcome] = (counts[tc.mcpOutcome] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Category display names and descriptions.
 */
const CATEGORY_INFO = {
  CANVAS: {
    display: 'CANVAS (01-10)',
    fullName: 'CANVAS',
    description: 'Canvas/visual editor interactions requiring CDP coordinate-based tools (click_at, drag). Tests: TradingView drawing, Figma alignment, Google Maps tracing, browser games, image editors, 3D viewers, piano keys, PDF signatures, Miro boards.',
  },
  MICRO: {
    display: 'MICRO-INTERACTION (01-10)',
    fullName: 'MICRO-INTERACTION',
    description: 'Precise UI micro-interactions requiring exact positioning and timing. Tests: volume sliders, click-and-hold recording, drag-and-drop reorder, text selection, color pickers, carousel scrolling, mega-menu hover navigation, file upload dropzones, slider CAPTCHAs, podcast timeline scrubbing.',
  },
  SCROLL: {
    display: 'SCROLL (01-10)',
    fullName: 'SCROLL',
    description: 'Infinite scroll, pagination, and large dataset navigation. Tests: Twitter feed counting (150 posts), Amazon product scraping (500 items), GitHub activity log search, Reddit thread bottom reply, virtualized PDF readers, HN comment expansion, Airbnb map panning, TikTok search, pricing table extraction, date-stop scrolling.',
  },
  CONTEXT: {
    display: 'CONTEXT (01-10)',
    fullName: 'CONTEXT',
    description: 'Multi-tab, multi-step, and stateful workflows requiring context persistence. Tests: live score monitoring, Observable notebook editing, PDF-to-form data transfer, multi-tab flight comparison, checkout correction flows, chatbot conversations, 2FA flows, Google Doc editing, CRM cross-referencing, session expiry recovery.',
  },
  DARK: {
    display: 'DARK (01-10)',
    fullName: 'DARK',
    description: 'Dark pattern and adversarial UI detection and avoidance. Tests: fake download button avoidance, hidden cookie reject buttons, shuffled cancel buttons, camouflaged close buttons, adblocker modal bypass, misleading price highlighting, pre-checked newsletter uncheck, buried login links, skip-ad countdowns, anti-scrape text extraction.',
  },
};

/**
 * Generate the VALIDATION-RUNNER.md content.
 */
function generateRunner(testCases) {
  const grouped = groupByCategory(testCases);
  const now = new Date().toISOString();

  let md = '';

  // Header
  md += '# Phase 103: Autopilot Validation Runner\n\n';
  md += `**Generated:** ${now}\n`;
  md += '**Test Cases:** 50\n';
  md += '**Milestone Gate:** 90%+ pass rate (45/50 minimum)\n\n';

  // How To Use
  md += '## How To Use\n\n';
  md += '1. Open the FSB extension in Chrome with autopilot mode enabled\n';
  md += '2. For each test case below, paste the Autopilot Prompt into the FSB chat input\n';
  md += '3. Let autopilot execute the task\n';
  md += '4. Record results in the tracking columns:\n';
  md += '   - **Result**: PASS, FAIL, or SKIP (with reason)\n';
  md += '   - **CLI Parse Failures**: Count of CLI parse errors during the run (check console/logs)\n';
  md += '   - **Completion Correct**: YES if autopilot\'s done/not-done determination matched reality, NO if it declared done when not done or vice versa\n';
  md += '   - **Notes**: Any observations about the run\n';
  md += '5. After all 50 tests, scroll to the Metrics section for automatic tallies\n\n';

  // Quick Reference
  md += '## Quick Reference\n\n';
  md += '### Category Descriptions\n\n';

  for (const cat of CATEGORY_ORDER) {
    const info = CATEGORY_INFO[cat];
    const cases = grouped[cat] || [];
    const outcomes = countOutcomes(cases);
    md += `**${info.fullName}** -- ${info.description}\n`;
    md += `- MCP Baseline: ${outcomes.PASS} PASS, ${outcomes.PARTIAL} PARTIAL, ${outcomes.FAIL || 0} FAIL, ${outcomes['SKIP-AUTH'] || 0} SKIP-AUTH\n\n`;
  }

  md += '### Expected Difficulty Ranking (by MCP baseline performance)\n\n';

  // Calculate pass rates per category for ranking
  const catStats = CATEGORY_ORDER.map(cat => {
    const cases = grouped[cat] || [];
    const outcomes = countOutcomes(cases);
    const passRate = cases.length > 0 ? (outcomes.PASS / cases.length * 100) : 0;
    return { cat, passRate, outcomes, count: cases.length };
  });
  catStats.sort((a, b) => b.passRate - a.passRate);

  md += '| Rank | Category | MCP Pass Rate | Difficulty for Autopilot |\n';
  md += '|------|----------|---------------|-------------------------|\n';
  for (let i = 0; i < catStats.length; i++) {
    const s = catStats[i];
    const difficulty = s.passRate >= 30 ? 'Moderate' : (s.passRate >= 10 ? 'Hard' : 'Very Hard');
    md += `| ${i + 1} | ${s.cat} | ${s.outcomes.PASS}/${s.count} (${Math.round(s.passRate)}%) | ${difficulty} |\n`;
  }
  md += '\n';

  // Summary of all baselines
  const allOutcomes = countOutcomes(testCases);
  md += `### Overall MCP Baseline Summary\n\n`;
  md += `- PASS: ${allOutcomes.PASS}/50\n`;
  md += `- PARTIAL: ${allOutcomes.PARTIAL}/50\n`;
  md += `- FAIL: ${allOutcomes.FAIL || 0}/50\n`;
  md += `- SKIP-AUTH: ${allOutcomes['SKIP-AUTH'] || 0}/50\n\n`;

  // Test Cases by Category
  md += '## Test Cases\n\n';

  let globalNum = 0;
  for (const cat of CATEGORY_ORDER) {
    const info = CATEGORY_INFO[cat];
    const cases = grouped[cat] || [];

    md += `### ${info.display}\n\n`;
    md += '| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |\n';
    md += '|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|\n';

    for (const tc of cases) {
      globalNum++;
      // Escape pipe characters in prompt text for markdown table
      const safePrompt = tc.prompt.replace(/\|/g, '\\|');
      md += `| ${globalNum} | ${tc.requirementId} | ${tc.phase} | ${safePrompt} | ${tc.mcpOutcome} | | | | |\n`;
    }

    md += '\n';
  }

  // Metrics section
  md += '## Metrics\n\n';

  md += '### VALID-02: Pass Rate\n';
  md += '- Total tests: 50\n';
  md += '- Passed: ___ / 50\n';
  md += '- Pass rate: ___% (gate: 90% / 45 minimum)\n';
  md += '- Status: [ ] GATE MET / [ ] GATE NOT MET\n\n';

  md += '### VALID-03: CLI Parse Failure Rate\n';
  md += '- Total CLI actions across all 50 runs: ___\n';
  md += '- Total CLI parse failures: ___\n';
  md += '- Parse failure rate: ___% (gate: <5%)\n';
  md += '- Status: [ ] GATE MET / [ ] GATE NOT MET\n\n';

  md += '### VALID-04: Completion Accuracy\n';
  md += '- Total completion judgments: 50\n';
  md += '- Correct judgments: ___ / 50\n';
  md += '- Accuracy: ___% (gate: 90%+)\n';
  md += '- Status: [ ] GATE MET / [ ] GATE NOT MET\n\n';

  md += '### Overall Milestone Gate\n';
  md += '- [ ] VALID-02: Pass rate >= 90%\n';
  md += '- [ ] VALID-03: Parse failure rate < 5%\n';
  md += '- [ ] VALID-04: Completion accuracy >= 90%\n';
  md += '- [ ] ALL GATES MET -- v0.9.8 milestone complete\n';

  return md;
}

// --- Main ---

function main() {
  console.log('Scanning diagnostic reports in phases 47-96...');

  const testCases = [];
  const entries = fs.readdirSync(PHASES_DIR);

  for (let phaseNum = 47; phaseNum <= 96; phaseNum++) {
    // Find matching directory
    const dirName = entries.find(e => e.match(new RegExp(`^${phaseNum}-`)));
    if (!dirName) {
      console.warn(`[WARN] No directory found for phase ${phaseNum}`);
      continue;
    }

    const tc = extractTestCase(phaseNum, dirName);
    if (tc) {
      testCases.push(tc);
    }
  }

  console.log(`Extracted ${testCases.length} test cases.`);

  // Sort by category then number
  const sorted = sortTestCases(testCases);

  // Verify no MCP references remain
  let mcpCount = 0;
  for (const tc of sorted) {
    if (tc.prompt.includes('using MCP manual tools') || tc.prompt.includes('via MCP manual tools')) {
      console.error(`[ERROR] MCP reference not removed in phase ${tc.phase}: ${tc.prompt}`);
      mcpCount++;
    }
  }

  if (mcpCount > 0) {
    console.error(`[ERROR] ${mcpCount} prompts still contain MCP references!`);
    process.exit(1);
  }

  // Generate and write VALIDATION-RUNNER.md
  const content = generateRunner(sorted);
  fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
  console.log(`Generated: ${OUTPUT_FILE}`);
  console.log(`Total test cases: ${sorted.length}`);

  // Print category breakdown
  const grouped = groupByCategory(sorted);
  for (const cat of CATEGORY_ORDER) {
    const cases = grouped[cat] || [];
    console.log(`  ${cat}: ${cases.length} test cases`);
  }
}

main();
