import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button],
  template: `
    <div class="not-found">
      <h1>404</h1>
      <p>Page not found.</p>
      <a routerLink="/dashboard">
        <p-button label="Back to Dashboard" icon="pi pi-arrow-left" [text]="true" />
      </a>
    </div>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 15vh;
    }
    h1 {
      font-size: 4rem;
      margin: 0;
      color: var(--p-text-muted-color);
      opacity: 0.5;
    }
    p {
      color: var(--p-text-muted-color);
      margin: 0.5rem 0 1.5rem;
    }
  `,
})
export class NotFoundComponent {}
