import { Component } from '@angular/core';

@Component({
  selector: 'app-support-page',
  standalone: true,
  templateUrl: './support-page.component.html',
  styleUrl: './support-page.component.scss',
})
export class SupportPageComponent {
  toggleFaq(event: Event): void {
    const question = event.currentTarget as HTMLElement;
    const item = question.closest('.faq-item');
    if (item) {
      item.classList.toggle('active');
    }
  }
}
