import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShowcaseShellComponent as ShellFrameComponent } from './layout/showcase-shell/showcase-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ShellFrameComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}
