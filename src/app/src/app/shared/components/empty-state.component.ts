import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <div class="empty-icon">
        <i [class]="'pi ' + icon()" style="font-size: 2.5rem"></i>
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
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      background: var(--p-surface-100, #f3f4f6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      color: var(--p-surface-400, #9ca3af);
    }
    h3 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
      color: var(--p-surface-700, #374151);
    }
    p {
      margin: 0;
      color: var(--p-surface-500, #6b7280);
      font-size: 0.875rem;
      max-width: 300px;
    }
  `,
})
export class EmptyStateComponent {
  icon = input<string>('pi-inbox');
  title = input<string>('No data yet');
  message = input<string>('');
}
