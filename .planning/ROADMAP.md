# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 **Reliability Improvements** -- Phases 1-11 (shipped 2026-02-14)
- v9.0.2 **AI Situational Awareness** -- Phases 1-10 (shipped 2026-02-18)
- v9.3 **Tech Debt Cleanup** -- Phases 4-8 (shipped 2026-02-23)
- v9.4 **Career Search Automation** -- Phases 9-14.3 (shipped 2026-02-27)
- v10.0 **CLI Architecture** -- Phases 15-29 (shipped 2026-03-15)
- v0.9.2 **Productivity Site Intelligence** -- Phase 30 (in progress)
- v0.9.3 **Memory Tab Overhaul** -- Phases 31-33 (planned)

## Phases

<details>
<summary>v0.9 Reliability Improvements (Phases 1-11) -- SHIPPED 2026-02-14</summary>

See `.planning/milestones/v0.9-ROADMAP.md` for full details.
11 phases, 24 plans.

</details>

<details>
<summary>v9.0.2 AI Situational Awareness (Phases 1-10) -- SHIPPED 2026-02-18</summary>

See `.planning/milestones/v9.0.2-ROADMAP.md` for full details.
10 phases, 21 plans, 22 requirements (100% satisfied).

</details>

<details>
<summary>v9.3 Tech Debt Cleanup (Phases 4-8) -- SHIPPED 2026-02-23</summary>

5 phases, 17 plans, 9 requirements (100% satisfied).

</details>

<details>
<summary>v9.4 Career Search Automation (Phases 9-14.3) -- SHIPPED 2026-02-27</summary>

See `.planning/milestones/v9.4-ROADMAP.md` for full details.
9 phases (6 main + 3 hotfix), 18 plans, 21 requirements (100% satisfied).

</details>

<details>
<summary>v10.0 CLI Architecture (Phases 15-29) -- SHIPPED 2026-03-15</summary>

See `.planning/milestones/v10.0-ROADMAP.md` for full details.
15 phases, 37 plans, 67 requirements (100% satisfied).

</details>

### v0.9.2 Productivity Site Intelligence (In Progress)

**Milestone Goal:** Expand custom site intelligence (fsbElements, multi-strategy selectors, keyboard-first guidance, workflows) to 7 productivity web apps -- replicating the Google Sheets treatment for apps where standard DOM automation fails.

- [x] **Phase 30: Productivity Site Intelligence** - Generalize fsbElements pipeline and create site guides with fsbElements, guidance, keyboard shortcuts, and workflows for Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, and Jira (completed 2026-03-16)

### v0.9.3 Memory Tab Overhaul (Planned)

**Milestone Goal:** Overhaul the Memory tab so one automation produces one consolidated Task Memory (a reconnaissance report) instead of 3-5 fragmented type-based memories, with graph visualization per task.

See `.planning/milestones/v0.9.3-ROADMAP.md` for full details.

- [x] **Phase 31: Task Memory Schema & Storage** - Define unified Task Memory object and backward-compatible storage layer (completed 2026-03-16)
- [x] **Phase 32: Extraction Pipeline & Consolidation** - Rewrite AI extraction to produce one memory per session, session-based dedup (completed 2026-03-16)
- [x] **Phase 33: Task Memory Display & Migration** - Task cards, detail view, graph visualization, and migration utility (completed 2026-03-16)

## Phase Details

### Phase 30: Productivity Site Intelligence
**Goal**: Users can automate tasks on Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, and Jira with the same reliability as Google Sheets -- the AI receives app-specific fsbElements, keyboard shortcuts, interaction guidance, and step-by-step workflows for each app
**Depends on**: Phase 29 (v10.0 CLI Architecture)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, KEEP-01, KEEP-02, TODO-01, TODO-02, TREL-01, TREL-02, GCAL-01, GCAL-02, NOTN-01, NOTN-02, JIRA-01, JIRA-02, ATBL-01, ATBL-02
**Success Criteria** (what must be TRUE):
  1. The fsbElements injection pipeline fires for any site guide that defines fsbElements (not just Google Sheets), and Google subdomains (calendar.google.com, keep.google.com, docs.google.com/spreadsheets) route to their correct site guide without cross-contamination
  2. User can ask FSB to create, edit, and navigate items on Google Keep and Todoist using keyboard-shortcut-first workflows, with Todoist Quick Add natural language syntax (#project @label p1 tomorrow) documented in guidance
  3. User can ask FSB to create and manage cards on Trello and create/edit events on Google Calendar, with fsbElements providing reliable selector-based targeting for toolbar buttons, create actions, and navigation controls
  4. User can ask FSB to create pages and blocks in Notion, create and transition issues in Jira, and navigate/edit records in Airtable, with robust multi-strategy fsbElements (5 selectors each, aria/role-first) surviving CSS Module hash changes and React DOM updates
  5. All 7 apps are discoverable via keyword matching in site-guides/index.js -- asking FSB to "create a Notion page" or "add a Trello card" loads the correct site guide without the user needing to configure anything
**Plans**: 4 plans

Plans:
- [ ] 30-01-PLAN.md -- Infrastructure: generalize fsbElements pipeline, keyword matching, _shared.js, file registration
- [ ] 30-02-PLAN.md -- Simple apps: Google Keep + Todoist site guides
- [ ] 30-03-PLAN.md -- Medium apps: Trello + Google Calendar site guides + drag-and-drop tool
- [ ] 30-04-PLAN.md -- Complex apps: Notion + Jira + Airtable site guides

### Phase 31: Task Memory Schema & Storage
**Goal**: A unified Task Memory schema exists and the storage layer can persist and retrieve it alongside old-format memories
**Depends on**: Phase 30 (v0.9.2 complete) -- parallel milestone, no code dependency
**Requirements**: MEM-01, STOR-01
**Success Criteria** (what must be TRUE):
  1. A Task Memory object with `type: "task"` contains episodic data (steps timeline, outcome), semantic data (selectors discovered, site structure), and procedural data (reusable patterns) in a single document
  2. `memory-storage.js` can save and retrieve Task Memory objects from `fsb_memories` with the new schema
  3. Old type-based memories (episodic, semantic, procedural) still load and render correctly -- the reader is backward-compatible
  4. The inverted index and hybrid search in `memory-retriever.js` work with Task Memory fields (domain, task description, selectors, patterns)
**Plans**: 2 plans

Plans:
- [x] 31-01-PLAN.md -- Task Memory schema: createTaskMemory factory, TASK type constant, validation
- [x] 31-02-PLAN.md -- Storage/retriever/UI wiring: inverted index, scoring boost, type filter, card rendering

### Phase 32: Extraction Pipeline & Consolidation
**Goal**: Every completed automation session produces exactly one Task Memory through a rewritten AI extraction prompt and session-based consolidation
**Depends on**: Phase 31
**Requirements**: MEM-02, MEM-03, CONS-01
**Success Criteria** (what must be TRUE):
  1. `extractAndStoreMemories` (called from 13 sites in background.js) produces exactly one Task Memory per session instead of 1-5 fragmented memories
  2. The AI extraction prompt returns a single consolidated recon-style report containing: task description, outcome, step-by-step timeline, selectors discovered, site structure encountered, and patterns learned
  3. The consolidator groups memories by domain + task similarity instead of text similarity, merging repeat runs of the same task into one memory with run history
  4. No changes needed at the 13 call sites in background.js -- the pipeline change is internal to memory-extractor.js and memory-manager.js
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md -- Rewrite extraction prompt and parser for single Task Memory output
- [x] 32-02-PLAN.md -- Update consolidator for domain+task dedup and unified task enrichment

### Phase 33: Task Memory Display & Graph
**Goal**: Users see polished task cards with a full recon report detail view, per-task 2D graph visualization, and task data feeding into the FSB Intelligence knowledge graph
**Depends on**: Phase 32
**Requirements**: DISP-01, DISP-02, DISP-03
**Success Criteria** (what must be TRUE):
  1. Task Memory cards are polished with better outcome badge styling, domain indicator, and the Refine button is removed from all memory types
  2. Clicking a card expands to a full recon report with collapsible sections: summary+outcome at top, then Timeline, Discoveries, Procedures — AI analysis integrated into relevant sections
  3. Each Task Memory detail view includes an inline 2D graph (SiteGraph-style) showing pages visited, elements interacted with, and navigation paths
  4. Task Memory discoveries auto-update the FSB Intelligence knowledge graph data structure
  5. Old-format memories remain visible and functional alongside Task Memories
**Plans**: 2 plans

Plans:
- [ ] 33-01-PLAN.md -- Card polish, Refine button removal, full recon report detail view with collapsible sections
- [ ] 33-02-PLAN.md -- Per-task graph visualization and FSB Intelligence knowledge graph integration

## Progress

**Execution Order:**
v0.9.2: Phase 30
v0.9.3: Phase 31 -> Phase 32 -> Phase 33

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Productivity Site Intelligence | 4/4 | Complete    | 2026-03-16 |
| 31. Task Memory Schema & Storage | 2/2 | Complete    | 2026-03-16 |
| 32. Extraction Pipeline & Consolidation | 2/2 | Complete    | 2026-03-16 |
| 33. Task Memory Display & Graph | 2/2 | Complete   | 2026-03-16 |

| Milestone | Phases | Plans | Requirements | Status | Shipped |
|-----------|--------|-------|-------------|--------|---------|
| v0.9 Reliability | 1-11 | 24 | -- | Complete | 2026-02-14 |
| v9.0.2 Situational Awareness | 1-10 | 21 | 22/22 | Complete | 2026-02-18 |
| v9.3 Tech Debt | 4-8 | 17 | 9/9 | Complete | 2026-02-23 |
| v9.4 Career Search | 9-14.3 | 18 | 21/21 | Complete | 2026-02-27 |
| v10.0 CLI Architecture | 15-29 | 37 | 67/67 | Complete | 2026-03-15 |
| v0.9.2 Productivity Site Intelligence | 30 | 4 | 0/17 | In progress | - |
| v0.9.3 Memory Tab Overhaul | 31-33 | TBD | 0/9 | Planned | - |

---
*Updated: 2026-03-16 after Phase 33 planning*
