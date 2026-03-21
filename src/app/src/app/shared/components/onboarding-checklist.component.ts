import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { OnboardingService } from '../../core/onboarding.service';

@Component({
  selector: 'app-onboarding-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button],
  template: `
    @if (onboarding.visible()) {
      <div class="onboarding-card">
        <div class="onboarding-header">
          <div>
            <h3>Get started with Clearfolio</h3>
            <p class="onboarding-progress">{{ onboarding.completedCount() }} of {{ onboarding.totalCount() }} complete</p>
          </div>
          <p-button icon="pi pi-times" [text]="true" [rounded]="true" size="small" (onClick)="onboarding.dismiss()" />
        </div>
        <div class="onboarding-track">
          <div class="onboarding-track-fill" [style.width.%]="(onboarding.completedCount() / onboarding.totalCount()) * 100"></div>
        </div>
        <div class="onboarding-steps">
          @for (step of onboarding.steps(); track step.id) {
            <a [routerLink]="step.route" class="onboarding-step" [class.complete]="step.complete">
              <span class="step-check">
                @if (step.complete) {
                  <i class="pi pi-check"></i>
                } @else {
                  <i [class]="'pi ' + step.icon"></i>
                }
              </span>
              <div class="step-text">
                <span class="step-label" [class.complete]="step.complete">{{ step.label }}</span>
                <span class="step-desc">{{ step.description }}</span>
              </div>
              @if (!step.complete) {
                <i class="pi pi-chevron-right step-arrow"></i>
              }
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .onboarding-card {
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.5rem;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .onboarding-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;

      h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }
    }
    .onboarding-progress {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .onboarding-track {
      height: 4px;
      background: var(--p-content-border-color);
      border-radius: 2px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .onboarding-track-fill {
      height: 100%;
      background: var(--p-primary-color);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .onboarding-steps {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .onboarding-step {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.375rem;
      text-decoration: none;
      color: var(--p-text-color);
      transition: background 0.15s;

      &:hover:not(.complete) {
        background: var(--p-content-hover-background);
      }
      &.complete {
        opacity: 0.6;
        cursor: default;
      }
    }
    .step-check {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.875rem;
      background: var(--p-content-border-color);
      color: var(--p-text-muted-color);

      .complete & {
        background: var(--p-primary-color);
        color: white;
      }
    }
    .step-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .step-label {
      font-size: 0.875rem;
      font-weight: 500;

      &.complete {
        text-decoration: line-through;
      }
    }
    .step-desc {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .step-arrow {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class OnboardingChecklistComponent {
  protected onboarding = inject(OnboardingService);
}
