import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home-page.component').then(m => m.HomePageComponent) },
  { path: 'about', loadComponent: () => import('./pages/about/about-page.component').then(m => m.AboutPageComponent) },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent) },
  { path: 'privacy', loadComponent: () => import('./pages/privacy/privacy-page.component').then(m => m.PrivacyPageComponent) },
  { path: 'support', loadComponent: () => import('./pages/support/support-page.component').then(m => m.SupportPageComponent) },
  { path: '**', redirectTo: '' },
];
