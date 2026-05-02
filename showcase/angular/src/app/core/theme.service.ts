import { Injectable } from '@angular/core';

const STORAGE_KEY = 'fsb-showcase-theme';

// Prerender-safe storage helpers: in the @angular/ssr Node prerender environment
// `localStorage` may exist as a stub object whose methods are not functions. Guard
// every call with both `typeof` and a function check (PITFALLS.md P1, D-20).
function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
}

function hasDocument(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private dark = true;

  constructor() {
    if (!hasLocalStorage()) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') {
      this.dark = false;
      if (hasDocument()) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }

  isDark(): boolean {
    return this.dark;
  }

  toggle(): void {
    this.dark = !this.dark;
    if (this.dark) {
      if (hasDocument()) {
        document.documentElement.removeAttribute('data-theme');
      }
      if (hasLocalStorage()) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      if (hasDocument()) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      if (hasLocalStorage()) {
        localStorage.setItem(STORAGE_KEY, 'light');
      }
    }
  }
}
