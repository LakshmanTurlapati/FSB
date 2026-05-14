/**
 * Privacy & Telemetry kill-switch UI wiring.
 *
 * Phase 269 / v0.9.69. Extracted from the inline <script> block in
 * control_panel.html so the script runs under MV3's default CSP
 * (`script-src 'self'`), which forbids inline scripts. Inline scripts in
 * extension pages are blocked at runtime with no fallback execution; the
 * previous inline block silently failed and the toggle never persisted.
 *
 * Storage key `fsbTelemetryOptOut === true` means the user has opted OUT.
 * Toggle checkbox `checked` state is the INVERSE: checked = telemetry ON.
 *
 * Hardcoded string `'fsbTelemetryOptOut'` here mirrors the inline block's
 * prior shape; a follow-up commit replaces this with the install-identity
 * module's exported `FSB_TELEMETRY_OPT_OUT_KEY` constant + module API
 * (`isTelemetryOptedOut` / `setTelemetryOptOut`).
 */

'use strict';

(function () {
  const TOGGLE_ID = 'fsbTelemetryOptOut';
  const STORAGE_KEY = 'fsbTelemetryOptOut';

  function applyAriaLabel(checked) {
    const el = document.getElementById(TOGGLE_ID);
    if (!el) return;
    el.setAttribute('aria-label', checked
      ? 'Anonymous usage data is being sent. Click to stop.'
      : 'Anonymous usage data is NOT being sent. Click to re-enable.');
  }

  async function initPrivacyToggle() {
    const el = document.getElementById(TOGGLE_ID);
    if (!el) return;
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY]);
      const optedOut = data && data[STORAGE_KEY] === true;
      el.checked = !optedOut; // checked = telemetry ON
      applyAriaLabel(el.checked);
    } catch (_e) {
      // Storage unavailable -- default UI to ON (matches D-02 default-on policy).
      el.checked = true;
      applyAriaLabel(true);
    }
    el.addEventListener('change', async () => {
      const optedOut = !el.checked; // checked off -> opted out
      applyAriaLabel(el.checked);
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: optedOut });
      } catch (_e) {
        // No user-facing error per UI-SPEC ("no nag screen").
        console.warn('[FSB Telemetry] opt-out write failed');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrivacyToggle);
  } else {
    initPrivacyToggle();
  }
})();
