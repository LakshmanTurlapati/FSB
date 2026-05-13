// Phase 262 / UI-01, UI-02 -- Standalone language picker (nav + footer; native
// <select> for accessibility + CJK system-font rendering).
//
// Two render modes share one component:
//   [mode]="'icon'" -- globe icon + native dropdown overlay (nav top-right).
//   [mode]="'text'" -- plain <select> styled as a text link (footer).
//
// Option labels are LOCALE_NATIVE_LABELS (native autonyms only -- UI-02 lock,
// no flag emojis). `translate="no"` on <option> stops Phase 265 AI translator
// from rewriting autonyms.

import { Component, Input, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { LocaleService } from '../../core/i18n/locale.service';
import { LOCALES, LOCALE_NATIVE_LABELS, LocaleCode } from '../../core/i18n/locale-constants';

@Component({
  selector: 'app-language-picker',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './language-picker.component.html',
  styleUrl: './language-picker.component.scss',
})
export class LanguagePickerComponent {
  @Input() mode: 'icon' | 'text' = 'icon';

  private readonly localeService = inject(LocaleService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly locales = LOCALES;
  readonly labels = LOCALE_NATIVE_LABELS;

  get current(): LocaleCode {
    return this.localeService.current();
  }

  onChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const next = target.value as LocaleCode;
    if (!next || next === this.current) return;
    if (!isPlatformBrowser(this.platformId)) return;
    this.localeService.switchTo(next);
  }
}
