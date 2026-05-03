import { Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_VERSION } from '../../core/seo/version';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-showcase-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './showcase-shell.component.html',
  styleUrl: './showcase-shell.component.scss',
})
export class ShowcaseShellComponent {
  private themeService = inject(ThemeService);
  readonly appVersion = APP_VERSION;
  mobileMenuOpen = false;
  navScrolled = false;

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
