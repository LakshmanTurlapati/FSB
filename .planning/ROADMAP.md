# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 **Reliability Improvements** -- Phases 1-11 (shipped 2026-02-14)
- v9.0.2 **AI Situational Awareness** -- Phases 1-10 (shipped 2026-02-18)
- v9.3 **Tech Debt Cleanup** -- Phases 4-8 (shipped 2026-02-23)
- v9.4 **Career Search Automation** -- Phases 9-14.3 (shipped 2026-02-27)
- v10.0 **CLI Architecture** -- Phases 15-29 (shipped 2026-03-15)
- v0.9.2 **Productivity Site Intelligence** -- Phase 30 (in progress)

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

- [ ] **Phase 30: Productivity Site Intelligence** - Generalize fsbElements pipeline and create site guides with fsbElements, guidance, keyboard shortcuts, and workflows for Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, and Jira

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

## Progress

**Execution Order:**
Phase 30 is the sole phase for v0.9.2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Productivity Site Intelligence | 0/4 | Not started | - |

| Milestone | Phases | Plans | Requirements | Status | Shipped |
|-----------|--------|-------|-------------|--------|---------|
| v0.9 Reliability | 1-11 | 24 | -- | Complete | 2026-02-14 |
| v9.0.2 Situational Awareness | 1-10 | 21 | 22/22 | Complete | 2026-02-18 |
| v9.3 Tech Debt | 4-8 | 17 | 9/9 | Complete | 2026-02-23 |
| v9.4 Career Search | 9-14.3 | 18 | 21/21 | Complete | 2026-02-27 |
| v10.0 CLI Architecture | 15-29 | 37 | 67/67 | Complete | 2026-03-15 |
| v0.9.2 Productivity Site Intelligence | 30 | 4 | 0/17 | In progress | - |

---
*Updated: 2026-03-16 after phase 30 planning complete*
