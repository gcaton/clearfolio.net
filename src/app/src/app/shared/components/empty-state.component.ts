import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <div class="empty-icon">
        <div class="icon-glow"></div>
        <i [class]="'pi ' + icon()" style="font-size: 2rem; position: relative; z-index: 1"></i>
      </div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }
    .empty-icon {
      position: relative;
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 50%;
      background: var(--p-content-border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: var(--p-text-muted-color);
    }
    .icon-glow {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(96, 165, 250, 0.15));
      animation: glow-pulse 3s ease-in-out infinite;
    }
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    h3 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
      color: var(--p-text-color);
    }
    p {
      margin: 0 0 1rem;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      max-width: 320px;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  icon = input<string>('pi-inbox');
  title = input<string>('No data yet');
  message = input<string>('');
}
