// Phase 262 / UI-06 -- SSR-safe LocaleService.
//
// Source of truth for the active locale in browser-land. During prerender it
// MUST NOT touch `window` / `document` / `localStorage`; all browser-global
// access is guarded by `isPlatformBrowser` plus the typeof helpers below
// (mirrors `theme.service.ts` P1/D-20 pattern).
//
// Read priority at boot: URL prefix ONLY (= LOCALE_ID compiled into this
// per-locale bundle). Cookie + localStorage are write-only at this phase --
// reading them at boot would risk an NG0500 hydration mismatch (P3) because
// the server-prerendered HTML is already locale-pinned via the URL. Phase 263
// will set the cookie server-side BEFORE the prerendered HTML reaches the
// client, so the URL the user receives is already the right one.

import { Injectable, LOCALE_ID, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LOCALES, LOCALE_SUBPATHS, LocaleCode, SOURCE_LOCALE, isValidLocale } from './locale-constants';

const COOKIE_NAME = 'fsb-locale';
const STORAGE_KEY = 'fsbLocale';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
}

function hasDocument(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement;
}

@Injectable({ providedIn: 'root' })
export class LocaleService {
  // LOCALE_ID is injected per-locale build by @angular/localize; safe in SSR.
  private readonly localeId = inject(LOCALE_ID) as string;
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Source of truth for the active locale.
   * Priority during browser bootstrap:
   *   1. URL prefix (= LOCALE_ID compiled into this bundle) -- wins always.
   * Cookie + localStorage are persisted on picker change but NEVER override
   * the URL-pinned LOCALE_ID at read time (P3 prevention -- URL is the only
   * signal that survives prerender + hydration without mismatch).
   */
  current(): LocaleCode {
    if (isValidLocale(this.localeId)) return this.localeId;
    return SOURCE_LOCALE;
  }

  available(): readonly LocaleCode[] {
    return LOCALES;
  }

  /**
   * Cookie read -- browser only. Phase 262 does not consume this output beyond
   * picker UX; Phase 263 server middleware sets/reads the cookie indirectly.
   */
  readCookie(): LocaleCode | null {
    if (!isPlatformBrowser(this.platformId) || !hasDocument()) return null;
    const raw = document.cookie.split('; ').find(c => c.startsWith(COOKIE_NAME + '='));
    if (!raw) return null;
    const value = raw.split('=')[1];
    return isValidLocale(value) ? value : null;
  }

  readLocalStorage(): LocaleCode | null {
    if (!isPlatformBrowser(this.platformId) || !hasLocalStorage()) return null;
    const value = localStorage.getItem(STORAGE_KEY);
    return isValidLocale(value) ? value : null;
  }

  persist(locale: LocaleCode): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (hasDocument()) {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${COOKIE_NAME}=${locale}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax${secure}`;
    }
    if (hasLocalStorage()) {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        /* quota or privacy mode -- non-fatal */
      }
    }
  }

  switchTo(next: LocaleCode): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (next === this.current()) return;
    this.persist(next);
    const target = this.computeEquivalentPath(window.location.pathname, next);
    window.location.assign(target);
  }

  private computeEquivalentPath(currentPath: string, next: LocaleCode): string {
    const currentPrefix = LOCALE_SUBPATHS[this.current()];
    let body = currentPath;
    if (currentPrefix && currentPath.startsWith('/' + currentPrefix + '/')) {
      body = currentPath.slice(currentPrefix.length + 1);
    } else if (currentPrefix && currentPath === '/' + currentPrefix) {
      body = '/';
    }
    const nextPrefix = LOCALE_SUBPATHS[next];
    if (!nextPrefix) return body;                       // English -- no prefix
    if (body === '/') return '/' + nextPrefix + '/';    // bare locale root keeps trailing slash
    return '/' + nextPrefix + body;
  }
}
