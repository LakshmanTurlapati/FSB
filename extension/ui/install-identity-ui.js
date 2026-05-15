/**
 * Privacy & Telemetry kill-switch UI wiring.
 *
 * Phase 269 / v0.9.69. Runs in the control_panel.html document context.
 * Extracted from an inline <script> block so it satisfies MV3's default
 * CSP (`script-src 'self'`); inline scripts are blocked at runtime on
 * extension pages.
 *
 * This file depends on `globalThis.fsbInstallIdentity` (provided by
 * extension/utils/install-identity.js, which control_panel.html loads
 * via <script src="../utils/install-identity.js"> BEFORE this file).
 * The module exports the storage-key constant (FSB_TELEMETRY_OPT_OUT_KEY)
 * + the API functions (isTelemetryOptedOut, setTelemetryOptOut) so this
 * file does NOT hardcode the storage string -- a future rename only
 * needs to touch install-identity.js.
 *
 * Storage semantics:
 *   - chrome.storage.local[FSB_TELEMETRY_OPT_OUT_KEY] === true means the
 *     user has opted OUT (telemetry OFF).
 *   - Toggle `checked` is the INVERSE: checked = telemetry ON.
 */

'use strict';

(function () {
  const TOGGLE_ID = 'fsbTelemetryOptOut';

  function applyAriaLabel(checked) {
    const el = document.getElementById(TOGGLE_ID);
    if (!el) return;
    el.setAttribute('aria-label', checked
      ? 'Anonymous usage data is being sent. Click to stop.'
      : 'Anonymous usage data is NOT being sent. Click to re-enable.');
  }

  function getModule() {
    return globalThis.fsbInstallIdentity || null;
  }

  async function initPrivacyToggle() {
    const el = document.getElementById(TOGGLE_ID);
    if (!el) return;
    const mod = getModule();
    try {
      // Prefer the module API. If the module failed to load (e.g., load-
      // order regression), fall back to a direct storage read using a
      // hardcoded key string so the UI degrades gracefully instead of
      // throwing on undefined.fsbInstallIdentity.isTelemetryOptedOut.
      let optedOut = false;
      if (mod && typeof mod.isTelemetryOptedOut === 'function') {
        optedOut = await mod.isTelemetryOptedOut();
      } else {
        const data = await chrome.storage.local.get(['fsbTelemetryOptOut']);
        optedOut = !!(data && data.fsbTelemetryOptOut === true);
      }
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
        const m = getModule();
        if (m && typeof m.setTelemetryOptOut === 'function') {
          await m.setTelemetryOptOut(optedOut);
        } else {
          await chrome.storage.local.set({ fsbTelemetryOptOut: optedOut });
        }
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
