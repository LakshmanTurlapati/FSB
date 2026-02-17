---
created: 2026-02-14T11:54
title: Smart multi-tab management with context-aware navigation
area: general
files:
  - background.js
  - ai/ai-integration.js
  - content.js
---

## Problem

Currently when FSB needs to navigate somewhere, it almost always defaults to Google regardless of the query context. For example, if the user says "buy headphones on Amazon", the extension should navigate directly to Amazon rather than searching Google first. The navigation routing lacks intelligence about matching queries to appropriate websites.

Additionally, there is no tab awareness:
- If the target site (e.g., Google) is already open in another tab, FSB should switch to that tab instead of opening a duplicate or navigating away from the current page
- If the user is on an unrelated tab (e.g., LinkedIn), FSB should NOT overwrite that tab -- it should open a new tab and work there
- If multiple tabs of the same site exist (e.g., 3 Google tabs), FSB needs a strategy to pick the right one (e.g., most recently active, or least busy)

## Solution

Three parts:

1. **Context-aware URL routing** - Maintain a curated mapping of common domains/keywords to URLs (Amazon, YouTube, GitHub, LinkedIn, Reddit, etc.). When the AI decides to navigate, match the task intent against this list before defaulting to Google search. Not overly complex -- a focused list of top ~20-30 sites.

2. **Open tab discovery** - Use Chrome tabs API (`chrome.tabs.query`) to get all open tabs. Before navigating, check if the target domain is already open. If yes, switch to that tab (`chrome.tabs.update(tabId, {active: true})`). For duplicate tabs of the same domain, prefer the most recently active one or the one whose URL most closely matches the intended destination.

3. **Tab preservation policy** - Never overwrite the user's current tab if it's on an unrelated site. If the current tab doesn't match the target domain, open a new tab for the automation work. This prevents losing the user's context on pages they were browsing independently.
