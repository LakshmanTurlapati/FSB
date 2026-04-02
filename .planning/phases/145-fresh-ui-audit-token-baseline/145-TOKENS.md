# Phase 145: Token Audit & Structural Gap Analysis

Comprehensive audit of FSB extension CSS tokens as of 2026-04-02.
Single source of truth for all replica work in Phases 146-149.

---

## 1. fsb-ui-core.css Base Tokens

### :root (Light Mode Defaults)

| Token | Value |
|-------|-------|
| --fsb-primary | #ff6b35 |
| --fsb-primary-hover | #e55a2b |
| --fsb-primary-soft | rgba(255, 107, 53, 0.12) |
| --fsb-primary-soft-strong | rgba(255, 107, 53, 0.18) |
| --fsb-primary-glow | rgba(255, 107, 53, 0.24) |
| --fsb-success | #10b981 |
| --fsb-warning | #f59e0b |
| --fsb-danger | #dc2626 |
| --fsb-info | #0891b2 |
| --fsb-gray-50 | #faf8f6 |
| --fsb-gray-100 | #f5f1ed |
| --fsb-gray-150 | #ede6df |
| --fsb-gray-200 | #e2d8cf |
| --fsb-gray-300 | #cdbfb2 |
| --fsb-gray-400 | #a79383 |
| --fsb-gray-500 | #7c6859 |
| --fsb-gray-600 | #5f4f44 |
| --fsb-gray-700 | #443832 |
| --fsb-gray-800 | #2d2522 |
| --fsb-gray-900 | #171312 |
| --fsb-surface-base | #fffdfb |
| --fsb-surface-muted | #f8f4ef |
| --fsb-surface-muted-2 | #f1ebe4 |
| --fsb-surface-elevated | #ffffff |
| --fsb-surface-ink | #201917 |
| --fsb-text-primary | #1f1a17 |
| --fsb-text-secondary | #6a584d |
| --fsb-text-muted | #8d7a6e |
| --fsb-text-inverse | #fffaf6 |
| --fsb-border-subtle | rgba(41, 29, 20, 0.10) |
| --fsb-border-strong | rgba(41, 29, 20, 0.16) |
| --fsb-border-accent | rgba(255, 107, 53, 0.24) |
| --fsb-shadow-xs | 0 1px 2px rgba(22, 15, 11, 0.05) |
| --fsb-shadow-sm | 0 8px 24px rgba(22, 15, 11, 0.06) |
| --fsb-shadow-md | 0 14px 32px rgba(22, 15, 11, 0.10) |
| --fsb-shadow-accent | 0 12px 30px rgba(255, 107, 53, 0.16) |
| --fsb-radius-sm | 8px |
| --fsb-radius-md | 12px |
| --fsb-radius-lg | 18px |
| --fsb-radius-xl | 24px |
| --fsb-radius-pill | 999px |
| --fsb-space-1 | 4px |
| --fsb-space-2 | 8px |
| --fsb-space-3 | 12px |
| --fsb-space-4 | 16px |
| --fsb-space-5 | 20px |
| --fsb-space-6 | 24px |
| --fsb-space-8 | 32px |
| --fsb-space-12 | 48px |
| --fsb-focus-ring | 0 0 0 3px rgba(255, 107, 53, 0.14) |

### Compatibility Aliases (:root)

| Alias | Resolves To |
|-------|-------------|
| --primary | var(--fsb-primary) = #ff6b35 |
| --primary-hover | var(--fsb-primary-hover) = #e55a2b |
| --primary-gradient | linear-gradient(135deg, #ff6b35, #ff8c42) |
| --primary-glow | var(--fsb-primary-glow) = rgba(255, 107, 53, 0.24) |
| --primary-color | var(--fsb-primary) = #ff6b35 |
| --primary-color-dark | #ff8c42 |
| --primary-light | rgba(255, 107, 53, 0.10) |
| --bg-primary | var(--fsb-surface-elevated) = #ffffff |
| --bg-secondary | var(--fsb-surface-base) = #fffdfb |
| --bg-tertiary | var(--fsb-surface-muted-2) = #f1ebe4 |
| --bg-accent | var(--fsb-primary-soft) = rgba(255, 107, 53, 0.12) |
| --bg-card | var(--fsb-surface-elevated) = #ffffff |
| --bg-elevated | var(--fsb-surface-muted) = #f8f4ef |
| --bg-body | var(--fsb-surface-base) = #fffdfb |
| --bg-nav | rgba(255, 250, 246, 0.7) |
| --text-primary | var(--fsb-text-primary) = #1f1a17 |
| --text-secondary | var(--fsb-text-secondary) = #6a584d |
| --text-muted | var(--fsb-text-muted) = #8d7a6e |
| --text-inverse | var(--fsb-text-inverse) = #fffaf6 |
| --border-color | var(--fsb-border-subtle) = rgba(41, 29, 20, 0.10) |
| --border-hover | var(--fsb-border-strong) = rgba(41, 29, 20, 0.16) |

### [data-theme="dark"] Overrides

| Token | Value |
|-------|-------|
| --fsb-surface-base | #141110 |
| --fsb-surface-muted | #1d1816 |
| --fsb-surface-muted-2 | #26201d |
| --fsb-surface-elevated | #1a1513 |
| --fsb-surface-ink | #0d0a09 |
| --fsb-text-primary | #f6efe9 |
| --fsb-text-secondary | #d2c1b4 |
| --fsb-text-muted | #a99283 |
| --fsb-text-inverse | #141110 |
| --fsb-border-subtle | rgba(255, 241, 232, 0.10) |
| --fsb-border-strong | rgba(255, 241, 232, 0.18) |
| --fsb-border-accent | rgba(255, 140, 66, 0.28) |
| --fsb-shadow-xs | 0 1px 2px rgba(0, 0, 0, 0.28) |
| --fsb-shadow-sm | 0 10px 24px rgba(0, 0, 0, 0.30) |
| --fsb-shadow-md | 0 18px 40px rgba(0, 0, 0, 0.38) |
| --fsb-shadow-accent | 0 12px 30px rgba(255, 107, 53, 0.22) |
| --bg-nav | rgba(20, 17, 16, 0.72) |

---

## 2. Sidepanel Tokens (sidepanel.css)

### :root (Light Mode)

| Token | Value |
|-------|-------|
| --bg-primary | var(--fsb-surface-elevated) = #ffffff |
| --bg-secondary | var(--fsb-surface-base) = #fffdfb |
| --bg-tertiary | var(--fsb-surface-muted-2) = #f1ebe4 |
| --text-primary | var(--fsb-text-primary) = #1f1a17 |
| --text-secondary | var(--fsb-text-secondary) = #6a584d |
| --text-muted | var(--fsb-text-muted) = #8d7a6e |
| --border-color | var(--fsb-border-subtle) = rgba(41, 29, 20, 0.10) |
| --border-hover | var(--fsb-border-strong) = rgba(41, 29, 20, 0.16) |
| --shadow-sm | var(--fsb-shadow-sm) |
| --primary-color | var(--fsb-primary) = #ff6b35 |
| --primary-hover | var(--fsb-primary-hover) = #e55a2b |
| --system-bg | color-mix(in srgb, var(--fsb-surface-muted) 84%, white 16%) |
| --system-border | rgba(124, 104, 89, 0.16) |
| --ai-bg | rgba(8, 145, 178, 0.10) |
| --ai-text | #0f5c6a |
| --ai-border | rgba(8, 145, 178, 0.24) |
| --error-bg | rgba(220, 38, 38, 0.08) |
| --error-text | #991b1b |
| --error-border | rgba(220, 38, 38, 0.22) |
| --action-bg | rgba(16, 185, 129, 0.10) |
| --action-text | #166534 |
| --action-border | rgba(16, 185, 129, 0.24) |
| --status-bg | color-mix(in srgb, var(--fsb-primary-soft) 40%, var(--bg-secondary) 60%) |

### [data-theme="dark"] Overrides

| Token | Value |
|-------|-------|
| --bg-primary | #050505 |
| --bg-secondary | #050505 |
| --bg-tertiary | #121212 |
| --text-primary | var(--fsb-text-primary) = #f6efe9 |
| --text-secondary | var(--fsb-text-secondary) = #d2c1b4 |
| --text-muted | var(--fsb-text-muted) = #a99283 |
| --border-color | rgba(255, 255, 255, 0.06) |
| --border-hover | rgba(255, 255, 255, 0.14) |
| --system-bg | #1a1a1a |
| --system-border | rgba(255, 241, 232, 0.08) |
| --ai-bg | rgba(8, 145, 178, 0.14) |
| --ai-text | #8ed9e7 |
| --ai-border | rgba(77, 208, 225, 0.20) |
| --error-bg | rgba(229, 115, 115, 0.12) |
| --error-text | #f4aaaa |
| --error-border | rgba(229, 115, 115, 0.20) |
| --action-bg | rgba(129, 199, 132, 0.14) |
| --action-text | #b8e4ba |
| --action-border | rgba(129, 199, 132, 0.22) |
| --status-bg | color-mix(in srgb, var(--fsb-primary-soft) 44%, var(--bg-secondary) 56%) |

**Note:** Dark mode also forces `background: #050505 !important` on body, sidepanel-container, sidepanel-header, chat-messages-area, chat-input-area, history-view, and author-footer.

### Key Structural CSS

| Property | Value |
|----------|-------|
| .sidepanel-header padding | 18px 20px 14px |
| .brand-row h1 font-size | 16px |
| .brand-row h1 font-weight | 700 |
| .surface-subtitle font-size | 12px |
| .surface-subtitle font-weight | 500 |
| .status-indicator border-radius | 999px |
| .status-indicator padding | 6px 10px |
| .status-dot font-size | 10px (fa-circle icon) |
| .status-dot color | #10b981 (green) |
| .status-text font-size | 11px |
| .status-text font-weight | 600 |
| .status-text letter-spacing | 0.06em |
| .status-text text-transform | uppercase |
| .icon-btn size | 32px x 32px |
| .icon-btn border-radius | 10px |
| .icon-btn font-size | 14px |
| .header-actions gap | 8px |
| .chat-messages padding | 22px 20px 18px |
| .chat-messages gap | 14px |
| .message border-radius | 18px |
| .message font-size | 14px |
| .message padding | 12px 16px |
| .message max-width | 88% |
| .message.action font-size | 12px |
| .message.action font-family | 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace |
| .message.action border-radius | 12px |
| .chat-input-area padding | 16px 18px 10px |
| .input-wrapper min-height | 56px |
| .input-wrapper border-radius | 20px |
| .chat-input min-height | 48px |
| .chat-input font-size | 14px |
| .send-btn size | 36px x 36px (circular) |
| .send-btn background | linear-gradient(135deg, var(--primary-color), #ff8c42) |
| .mic-btn size | 36px x 36px (circular) |
| .mic-btn font-size | 15px |
| .author-footer padding | 8px 20px 12px |
| .author-footer span font-size | 10px |

### Message Bubble Colors (All 5 Types)

**Light Mode:**

| Type | Background | Text Color | Border |
|------|-----------|------------|--------|
| user | linear-gradient(135deg, var(--primary-color), #ff8c42) | white | transparent |
| system | color-mix(in srgb, var(--fsb-surface-muted) 84%, white 16%) | var(--text-secondary) = #6a584d | rgba(124, 104, 89, 0.16) |
| ai | rgba(8, 145, 178, 0.10) | #0f5c6a | rgba(8, 145, 178, 0.24) (left border) |
| action | rgba(16, 185, 129, 0.10) | #166534 | rgba(16, 185, 129, 0.24) (left border) |
| error | rgba(220, 38, 38, 0.08) | #991b1b | rgba(220, 38, 38, 0.22) (left border) |

**Dark Mode:**

| Type | Background | Text Color | Border |
|------|-----------|------------|--------|
| user | #e55a2b | white | transparent |
| system | #1a1a1a | var(--text-secondary) = #d2c1b4 | rgba(255, 241, 232, 0.08) |
| ai | rgba(8, 145, 178, 0.14) | #8ed9e7 | rgba(77, 208, 225, 0.20) (left border) |
| action | rgba(129, 199, 132, 0.14) | #b8e4ba | rgba(129, 199, 132, 0.22) (left border) |
| error | rgba(229, 115, 115, 0.12) | #f4aaaa | rgba(229, 115, 115, 0.20) (left border) |

---

## 3. Options/Dashboard Tokens (options.css)

### :root (Light Mode)

| Token | Value |
|-------|-------|
| --primary-color | var(--fsb-primary) = #ff6b35 |
| --primary-color-dark | #ff8c42 |
| --primary-hover | var(--fsb-primary-hover) = #e55a2b |
| --primary-light | var(--fsb-primary-soft) = rgba(255, 107, 53, 0.10) |
| --secondary-color | var(--fsb-gray-500) = #7c6859 |
| --secondary-hover | var(--fsb-gray-600) = #5f4f44 |
| --success-color | var(--fsb-success) = #10b981 |
| --success-light | rgba(16, 185, 129, 0.10) |
| --warning-color | var(--fsb-warning) = #f59e0b |
| --warning-light | rgba(245, 158, 11, 0.10) |
| --error-color | var(--fsb-danger) = #dc2626 |
| --error-light | rgba(220, 38, 38, 0.08) |
| --info-color | var(--fsb-info) = #0891b2 |
| --info-light | rgba(8, 145, 178, 0.10) |
| --gray-50 through --gray-900 | Maps to --fsb-gray-50 through --fsb-gray-900 |
| --bg-primary | var(--fsb-surface-elevated) = #ffffff |
| --bg-secondary | var(--fsb-surface-base) = #fffdfb |
| --bg-tertiary | var(--fsb-surface-muted-2) = #f1ebe4 |
| --bg-accent | var(--primary-light) = rgba(255, 107, 53, 0.10) |
| --text-primary | var(--gray-900) = #171312 |
| --text-secondary | var(--gray-600) = #5f4f44 |
| --text-muted | var(--gray-500) = #7c6859 |
| --text-inverse | #ffffff |
| --border-color | var(--fsb-border-subtle) = rgba(41, 29, 20, 0.10) |
| --border-hover | var(--fsb-border-strong) = rgba(41, 29, 20, 0.16) |
| --shadow-sm | var(--fsb-shadow-xs) |
| --shadow-md | var(--fsb-shadow-sm) |
| --shadow-lg | var(--fsb-shadow-md) |
| --shadow-xl | 0 20px 36px rgba(22, 15, 11, 0.12) |
| --radius-sm | var(--fsb-radius-sm) = 8px |
| --radius-md | var(--fsb-radius-md) = 12px |
| --radius-lg | var(--fsb-radius-lg) = 18px |
| --radius-xl | var(--fsb-radius-xl) = 24px |
| --surface-color | var(--bg-secondary) = #fffdfb |
| --card-bg | var(--bg-primary) = #ffffff |
| --hover-bg | var(--bg-tertiary) = #f1ebe4 |
| --font-system | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif |
| --font-mono | 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace |

### [data-theme="dark"] Overrides

| Token | Value |
|-------|-------|
| --bg-primary | #0d0d0d |
| --bg-secondary | #050505 |
| --bg-tertiary | #141414 |
| --bg-accent | rgba(255, 107, 53, 0.08) |
| --text-primary | var(--fsb-text-primary) = #f6efe9 |
| --text-secondary | var(--fsb-text-secondary) = #d2c1b4 |
| --text-muted | var(--fsb-text-muted) = #a99283 |
| --border-color | rgba(255, 255, 255, 0.08) |
| --border-hover | rgba(255, 255, 255, 0.14) |
| --shadow-xl | 0 20px 36px rgba(0, 0, 0, 0.32) |
| --success-color | #81c784 |
| --success-light | rgba(129, 199, 132, 0.14) |
| --warning-color | #e6b844 |
| --warning-light | rgba(230, 184, 68, 0.14) |
| --error-color | #e57373 |
| --error-light | rgba(229, 115, 115, 0.14) |
| --info-color | #4dd0e1 |
| --info-light | rgba(77, 208, 225, 0.14) |
| --surface-color | var(--bg-secondary) = #050505 |
| --card-bg | var(--bg-primary) = #0d0d0d |
| --hover-bg | var(--bg-tertiary) = #141414 |

**Note:** Dark mode also forces `background: #050505` on body, dashboard-container, dashboard-main, dashboard-content, dashboard-header, dashboard-sidebar.

### Key Structural CSS

| Property | Value |
|----------|-------|
| .dashboard-sidebar-width | 252px |
| .dashboard-content-max-width | 1120px |
| .dashboard-sidebar position | fixed, floating with border-radius var(--radius-lg) |
| .dashboard-sidebar border | 1px solid var(--border-color) |
| .nav-item padding | 0.8rem 0.9rem |
| .nav-item border-radius | var(--radius-md) = 12px |
| .nav-item font-size | 0.95rem |
| .nav-item.active background | linear-gradient(135deg, var(--bg-accent), rgba(255, 140, 66, 0.10)) |
| .nav-item i width | 1.25rem |
| .analytics-hero background (light) | linear-gradient(135deg, var(--primary-color), #ff8c42) |
| .analytics-hero background (dark) | var(--primary-color) = #ff6b35 |
| .analytics-hero border-radius | var(--radius-lg) = 18px |
| .analytics-hero padding | var(--space-xl) |
| .hero-metrics grid | repeat(auto-fit, minmax(150px, 1fr)) |
| .metric-value font-size | var(--dashboard-metric-size) = 2.2rem |
| .metric-label font-size | 0.875rem |
| .chart-section border-radius | var(--radius-lg) = 18px |
| .cost-breakdown gap | 32px |
| .cost-breakdown border-top | 1px solid rgba(255, 255, 255, 0.05) |
| .cost-label font-size | 0.75em |
| .cost-value font-size | 0.95em |
| .header-btn padding | 0.4rem 0.8rem |
| .header-btn border-radius | var(--radius-md) = 12px |
| .theme-toggle width | 2.3rem |

---

## 4. rec- Variable Comparison

### Dark Theme (`:root` in recreations.css)

| rec- Variable | Current Value | Real Extension Value | Source | Status |
|---------------|---------------|---------------------|--------|--------|
| --rec-frame-bg | #0a0a0a | N/A (no direct counterpart) | -- | NO_MATCH |
| --rec-topbar-bg | #050505 | N/A (no direct counterpart) | -- | NO_MATCH |
| --rec-sp-bg | #1f2937 | #050505 | sidepanel.css [dark] --bg-primary | STALE (should be #050505) |
| --rec-sp-input-bg | #111827 | #050505 | sidepanel.css [dark] --bg-secondary | STALE (should be #050505) |
| --rec-sp-border | rgba(255, 255, 255, 0.06) | rgba(255, 255, 255, 0.06) | sidepanel.css [dark] --border-color | MATCH |
| --rec-msg-system-bg | #374151 | #1a1a1a | sidepanel.css [dark] --system-bg | STALE (should be #1a1a1a) |
| --rec-msg-system-color | #d1d5db | #d2c1b4 | fsb-ui-core.css [dark] --fsb-text-secondary | STALE (should be #d2c1b4) |
| --rec-msg-ai-bg | rgba(33, 150, 243, 0.1) | rgba(8, 145, 178, 0.14) | sidepanel.css [dark] --ai-bg | STALE (should be rgba(8, 145, 178, 0.14)) |
| --rec-msg-ai-color | #90caf9 | #8ed9e7 | sidepanel.css [dark] --ai-text | STALE (should be #8ed9e7) |
| --rec-msg-action-bg | rgba(76, 175, 80, 0.08) | rgba(129, 199, 132, 0.14) | sidepanel.css [dark] --action-bg | STALE (should be rgba(129, 199, 132, 0.14)) |
| --rec-msg-action-color | #81c784 | #b8e4ba | sidepanel.css [dark] --action-text | STALE (should be #b8e4ba) |
| --rec-msg-status-color | #d1d5db | #d2c1b4 | fsb-ui-core.css [dark] --fsb-text-secondary | STALE (should be #d2c1b4) |
| --rec-sidebar-bg | #111827 | #050505 | options.css [dark] --bg-secondary | STALE (should be #050505) |
| --rec-main-bg | #0a0a0a | #050505 | options.css [dark] --bg-secondary | STALE (should be #050505) |
| --rec-page-bg | #0a0a0a | #050505 | options.css [dark] --bg-secondary | STALE (should be #050505) |
| --rec-text-primary | #f1f5f9 | #f6efe9 | fsb-ui-core.css [dark] --fsb-text-primary | STALE (should be #f6efe9) |
| --rec-text-secondary | #9ca3af | #d2c1b4 | fsb-ui-core.css [dark] --fsb-text-secondary | STALE (should be #d2c1b4) |
| --rec-text-muted | #6b7280 | #a99283 | fsb-ui-core.css [dark] --fsb-text-muted | STALE (should be #a99283) |
| --rec-text-link | #93c5fd | #8ed9e7 | sidepanel.css [dark] --ai-text (teal link color) | STALE (should be #8ed9e7) |
| --rec-text-bright | #e2e8f0 | #f6efe9 | fsb-ui-core.css [dark] --fsb-text-primary | STALE (should be #f6efe9) |
| --rec-text-heading | #f9fafb | #f6efe9 | fsb-ui-core.css [dark] --fsb-text-primary | STALE (should be #f6efe9) |
| --rec-input-bg | rgba(255, 255, 255, 0.04) | color-mix(in srgb, var(--bg-tertiary) 82%, var(--bg-primary) 18%) | sidepanel.css .input-wrapper | STALE (should be approx rgba(18, 18, 18, 0.82) blended -- closest: #121212 bg-tertiary mix) |
| --rec-input-border | rgba(255, 255, 255, 0.1) | rgba(255, 241, 232, 0.10) | fsb-ui-core.css [dark] --fsb-border-subtle | STALE (should be rgba(255, 241, 232, 0.10)) |
| --rec-input-text | #e2e8f0 | #f6efe9 | fsb-ui-core.css [dark] --fsb-text-primary | STALE (should be #f6efe9) |
| --rec-input-placeholder | #6b7280 | #a99283 | fsb-ui-core.css [dark] --fsb-text-muted | STALE (should be #a99283) |
| --rec-chart-bg | rgba(255, 255, 255, 0.03) | var(--bg-primary) = #0d0d0d | options.css [dark] .chart-section background | STALE (should be #0d0d0d) |
| --rec-chart-border | rgba(255, 255, 255, 0.06) | rgba(255, 255, 255, 0.08) | options.css [dark] --border-color | STALE (should be rgba(255, 255, 255, 0.08)) |
| --rec-address-bg | rgba(255, 255, 255, 0.06) | N/A (browser chrome, not extension) | -- | NO_MATCH |
| --rec-icon-btn-bg | rgba(255, 255, 255, 0.06) | color-mix(in srgb, var(--bg-secondary) 88%, white 12%) | sidepanel.css .icon-btn | STALE (real uses color-mix, approx result near rgba(5,5,5,0.88) -- visually close, but formula differs) |

### Light Theme (`[data-theme="light"]` in recreations.css)

| rec- Variable | Current Value | Real Extension Value | Source | Status |
|---------------|---------------|---------------------|--------|--------|
| --rec-frame-bg | #e8e8e8 | N/A | -- | NO_MATCH |
| --rec-topbar-bg | #dedede | N/A | -- | NO_MATCH |
| --rec-sp-bg | #ffffff | #ffffff (--fsb-surface-elevated) | sidepanel.css :root --bg-primary | MATCH |
| --rec-sp-input-bg | #f8f9fa | #fffdfb (--fsb-surface-base) | sidepanel.css :root --bg-secondary | STALE (should be #fffdfb) |
| --rec-sp-border | rgba(0, 0, 0, 0.08) | rgba(41, 29, 20, 0.10) | fsb-ui-core.css :root --fsb-border-subtle | STALE (should be rgba(41, 29, 20, 0.10)) |
| --rec-msg-system-bg | #f1f3f5 | color-mix(in srgb, #f8f4ef 84%, white 16%) | sidepanel.css :root --system-bg formula | STALE (should be approx #faf7f4 -- warm tint, not gray) |
| --rec-msg-system-color | #495057 | #6a584d | fsb-ui-core.css :root --fsb-text-secondary | STALE (should be #6a584d) |
| --rec-msg-ai-bg | #e3f2fd | rgba(8, 145, 178, 0.10) | sidepanel.css :root --ai-bg | STALE (should be rgba(8, 145, 178, 0.10)) |
| --rec-msg-ai-color | #1565c0 | #0f5c6a | sidepanel.css :root --ai-text | STALE (should be #0f5c6a) |
| --rec-msg-action-bg | #f0f8f0 | rgba(16, 185, 129, 0.10) | sidepanel.css :root --action-bg | STALE (should be rgba(16, 185, 129, 0.10)) |
| --rec-msg-action-color | #2e7d32 | #166534 | sidepanel.css :root --action-text | STALE (should be #166534) |
| --rec-msg-status-color | #495057 | #6a584d | fsb-ui-core.css :root --fsb-text-secondary | STALE (should be #6a584d) |
| --rec-sidebar-bg | #f8fafc | #fffdfb | fsb-ui-core.css :root --fsb-surface-base | STALE (should be #fffdfb) |
| --rec-main-bg | #ffffff | #fffdfb | options.css :root --bg-secondary | STALE (should be #fffdfb) |
| --rec-page-bg | #ffffff | #fffdfb | options.css :root --bg-secondary | STALE (should be #fffdfb) |
| --rec-text-primary | #0f172a | #1f1a17 | fsb-ui-core.css :root --fsb-text-primary | STALE (should be #1f1a17) |
| --rec-text-secondary | #475569 | #6a584d | fsb-ui-core.css :root --fsb-text-secondary | STALE (should be #6a584d) |
| --rec-text-muted | #94a3b8 | #8d7a6e | fsb-ui-core.css :root --fsb-text-muted | STALE (should be #8d7a6e) |
| --rec-text-link | #1e40af | #0f5c6a | sidepanel.css :root --ai-text (teal) | STALE (should be #0f5c6a) |
| --rec-text-bright | #1e293b | #1f1a17 | fsb-ui-core.css :root --fsb-text-primary | STALE (should be #1f1a17) |
| --rec-text-heading | #0f172a | #1f1a17 | fsb-ui-core.css :root --fsb-text-primary | STALE (should be #1f1a17) |
| --rec-input-bg | rgba(0, 0, 0, 0.03) | color-mix(in srgb, var(--bg-tertiary) 82%, var(--bg-primary) 18%) | sidepanel.css .input-wrapper | STALE (should be approx #f3eee7 warm tint) |
| --rec-input-border | rgba(0, 0, 0, 0.1) | rgba(41, 29, 20, 0.10) | fsb-ui-core.css :root --fsb-border-subtle | STALE (should be rgba(41, 29, 20, 0.10)) |
| --rec-input-text | #1e293b | #1f1a17 | fsb-ui-core.css :root --fsb-text-primary | STALE (should be #1f1a17) |
| --rec-input-placeholder | #94a3b8 | #8d7a6e | fsb-ui-core.css :root --fsb-text-muted | STALE (should be #8d7a6e) |
| --rec-chart-bg | rgba(0, 0, 0, 0.02) | #ffffff (--bg-primary) | options.css .chart-section background | STALE (should be #ffffff) |
| --rec-chart-border | rgba(0, 0, 0, 0.06) | rgba(41, 29, 20, 0.10) | options.css :root --border-color | STALE (should be rgba(41, 29, 20, 0.10)) |
| --rec-address-bg | rgba(0, 0, 0, 0.05) | N/A (browser chrome) | -- | NO_MATCH |
| --rec-icon-btn-bg | rgba(0, 0, 0, 0.06) | color-mix(in srgb, var(--bg-secondary) 88%, white 12%) | sidepanel.css .icon-btn | STALE (real uses warm color-mix) |

### Summary

- **MATCH:** 2 variables (dark --rec-sp-border, light --rec-sp-bg)
- **STALE:** 48+ variables need correction
- **NO_MATCH:** 6 variables (frame/topbar/address -- browser chrome, no real extension counterpart)

---

## 5. Structural HTML Gap Analysis

### Sidepanel: Recreation vs Real (sidepanel.html)

#### Header Structure

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .brand-row h1 | "FSB" (16px, 700 weight) | rec-sp-title "FSB" (14px, 600 weight) | Font size and weight differ |
| .surface-subtitle | "Persistent workspace" (12px, text-muted) | MISSING | Not present in recreation |
| .brand-row layout | h1 + subtitle side-by-side (baseline-aligned) | Only title exists | Missing subtitle element |
| .status-indicator | Pill-shaped with border, border-radius:999px, padding 6px 10px | rec-sp-status, no pill border | Missing pill border/background styling |
| .status-dot | Font Awesome fa-circle icon, 10px, with text-shadow | rec-status-dot, 8px div with background color | Different implementation (icon vs div) |
| .status-text | 11px, 600 weight, uppercase, 0.06em letter-spacing | rec-status-text, 11px, 500 weight | Font weight differs (600 vs 500) |
| .header-actions | 3 buttons: historyBtn (fa-clock-rotate-left), newChatBtn (fa-plus), settingsBtn (fa-cog) | 1 button: fa-gear only | MISSING: historyBtn, newChatBtn icons |
| .icon-btn | 32x32px, border-radius 10px, bordered | rec-sp-icon-btn 28x28px, border-radius 6px | Size and radius differ |

#### Messages Area

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .message padding | 12px 16px | rec-msg padding 10px 14px | Padding differs |
| .message border-radius | 18px | rec-msg border-radius 16px | Radius differs |
| .message font-size | 14px | rec-msg font-size 12.5px | Font size differs |
| .message max-width | 88% | rec-msg max-width 92% | Width differs |
| .message.ai border-left | 3px solid var(--ai-border) | rec-msg.ai uses hardcoded #2196f3 | Wrong border color (blue vs teal) |
| .message.action border-left | 3px solid var(--action-border) | rec-msg.action uses hardcoded #4caf50 | Wrong border color value |

#### Input Area

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .chat-input | contenteditable div, min-height 48px, font-size 14px | rec-sp-input-text span, 12px | Real uses editable div, rec uses static span |
| .mic-btn | fa-microphone, 36x36px, circular, bordered | MISSING | No microphone button in recreation |
| .send-btn | fa-arrow-up, 36x36px, circular, gradient bg | rec-sp-send-btn 28x28px, gradient bg | Size differs (36 vs 28) |
| .input-wrapper | border-radius 20px, min-height 56px | rec-sp-input-inner border-radius 20px, padding 8px 12px | Min-height not matched |

#### Footer

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .author-footer | Present with footer-version span, padding 8px 20px 12px | MISSING entirely | No footer in recreation |

### Dashboard: Recreation vs Real (control_panel.html)

#### Sidebar Navigation

| # | Real Extension | Recreation | Gap |
|---|---------------|------------|-----|
| 1 | Dashboard (fa-tachometer-alt) | Dashboard (fa-tachometer-alt) | MATCH |
| 2 | Agents (fa-server) | Background Agents (fa-robot) | WRONG ICON: fa-robot should be fa-server; label differs |
| 3 | API Configuration (fa-key) | API Configuration (fa-key) | MATCH |
| 4 | Passwords (fa-lock) with Beta badge | Passwords (fa-lock) with Beta badge | MATCH |
| 5 | Advanced Settings (fa-sliders-h) | Advanced Settings (fa-sliders-h) | MATCH |
| 6 | Memory (fa-brain) | Memory (fa-database) | WRONG ICON: fa-database should be fa-brain |
| 7 | Logs & Debugging (fa-terminal) | Logs & Debugging (fa-terminal) | MATCH |
| 8 | Help & Documentation (fa-question-circle) | MISSING | Not present in recreation |

**Sidebar item order:** Real extension has Agents as item 2. Recreation has it as item 4 (after Passwords). Real order: Dashboard, Agents, API Configuration, Passwords, Advanced Settings, Memory, Logs & Debugging, Help & Documentation.

#### Header Bar

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .connection-status | status-indicator with status-dot | rec-header-status with rec-header-status-dot | Similar but structural class names differ |
| Test API button | fa-plug + "Test API" | fa-plug + "Test API" | MATCH |
| Export button | fa-download + "Export" | fa-download + "Export" | MATCH |
| Theme toggle | fa-moon, 2.3rem width | fa-moon, rec-header-theme-toggle | MATCH (similar) |

#### Analytics Hero

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .analytics-hero | gradient bg, 4 hero-metric cards + cost-breakdown section | rec-analytics-hero, 4 metric cards only | MISSING: cost-breakdown section |
| .hero-metrics grid | repeat(auto-fit, minmax(150px, 1fr)) | rec-analytics-hero grid-template-columns: repeat(4, 1fr) | Grid template differs |
| .metric-value font-size | 2.2rem | 1.8rem | Font size differs |
| .metric-label font-size | 0.875rem | 0.65rem | Font size differs |
| .cost-breakdown | Contains Automation and Memory cost items | MISSING entirely | Not present in recreation |

#### Chart Section

| Element | Real Extension | Recreation | Gap |
|---------|---------------|------------|-----|
| .chart-section | Full card with border, border-radius 18px, canvas-based chart | rec-chart, 12px radius, SVG-based chart | Implementation differs (canvas vs SVG) |
| .chart-header h3 | "Token Usage Over Time" | rec-chart-title "Token Usage Over Time" | MATCH (text) |
| .chart-select | Standard select with 3 options | rec-chart-select with 3 options | MATCH (structure) |

### Summary of Critical Gaps

**Sidepanel (highest priority for Phase 146):**
1. Missing `surface-subtitle` ("Persistent workspace") in header
2. Missing `historyBtn` (fa-clock-rotate-left) and `newChatBtn` (fa-plus) icon buttons
3. Missing `mic-btn` (fa-microphone) in input area
4. Missing `author-footer` with version info
5. Wrong AI message border color (#2196f3 instead of teal from --ai-border)
6. Wrong action message border color (#4caf50 hardcoded instead of theme variable)
7. Various sizing mismatches (font-size, padding, border-radius, button dimensions)

**Dashboard (highest priority for Phase 147):**
1. Missing `Help & Documentation` (fa-question-circle) nav item
2. Wrong icon for Agents: fa-robot should be fa-server
3. Wrong icon for Memory: fa-database should be fa-brain
4. Wrong sidebar item order (Agents should be item 2, not item 4)
5. Missing `cost-breakdown` section in analytics hero
6. Various sizing mismatches in metrics and labels
