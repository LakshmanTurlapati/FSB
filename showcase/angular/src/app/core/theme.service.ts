import { Injectable } from '@angular/core';

const STORAGE_KEY = 'fsb-showcase-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private dark = true;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') {
      this.dark = false;
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  isDark(): boolean {
    return this.dark;
  }

  toggle(): void {
    this.dark = !this.dark;
    if (this.dark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem(STORAGE_KEY, 'light');
    }
  }
}
