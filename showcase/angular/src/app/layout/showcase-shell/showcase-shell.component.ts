import { Component, HostListener, inject } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { APP_VERSION } from '../../core/seo/version';
import { ThemeService } from '../../core/theme.service';
import { LanguagePickerComponent } from '../language-picker/language-picker.component';

@Component({
  selector: 'app-showcase-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LanguagePickerComponent],
  templateUrl: './showcase-shell.component.html',
  styleUrl: './showcase-shell.component.scss',
})
export class ShowcaseShellComponent {
  private themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly appVersion = APP_VERSION;
  mobileMenuOpen = false;
  navScrolled = false;

  // Quick task 260526-ezk -- /stats-only chrome swap.
  // isStatsRoute drives three conditional renders in the template:
  //   1. hide global <nav> + .nav-mobile when true
  //   2. hide .footer-inner (brand + columns) when true
  //   3. show .stats-back-btn + .stats-glow-bg when true
  // Every other route remains visually and behaviorally identical -- the
  // blast radius is exactly one signal.
  isStatsRoute = false;
  // Counts in-app NavigationEnds so goBack() knows whether to call
  // location.back() (when there's actual in-app history to pop) or fall
  // back to router.navigate(['/']) (when /stats was opened as a deep link
  // in a fresh tab and there's no prior in-app navigation to return to).
  private navigationCount = 0;

  constructor() {
    // Seed isStatsRoute synchronously from the current URL so SSR /
    // pre-hydration renders the correct chrome on the first paint.
    this.isStatsRoute = this.matchesStatsRoute(this.router.url);

    // Drive isStatsRoute + navigation-history counter from NavigationEnd.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.navigationCount++;
        this.isStatsRoute = this.matchesStatsRoute(e.urlAfterRedirects);
      });
  }

  private matchesStatsRoute(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    // Match both `/stats` and any future `/<locale>/stats` shape, while
    // ignoring query/hash. `endsWith` is safe here because no other route
    // in app.routes.ts ends with `/stats`.
    return path === '/stats' || path.endsWith('/stats');
  }

  goBack(): void {
    if (this.navigationCount > 1) {
      // Initial /stats land counts as navigation #1; any value above 1
      // means at least one prior in-app navigation exists, so popping
      // history lands somewhere inside the app rather than escaping it.
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  get isDark(): boolean {
    return this.themeService.isDark();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.navScrolled = window.scrollY > 10;
  }
}
