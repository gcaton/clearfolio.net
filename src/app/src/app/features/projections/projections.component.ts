import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Skeleton } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ApiService } from '../../core/api/api.service';
import { ViewStateService } from '../../core/auth/view-state.service';
import { GoalService } from '../../core/auth/goal.service';
import { LocaleService } from '../../core/locale/locale.service';
import {
  ProjectionResult,
  ProjectionDefault,
  CompoundResult,
  ScenarioResult,
  MonteCarloResult,
} from '../../core/api/models';
import {
  buildCompoundOptions,
  buildScenarioOptions,
  buildMonteCarloOptions,
  formatCurrency,
} from './projection-chart-options';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

export type ProjectionMode = 'compound' | 'scenario' | 'monte-carlo';

interface EntityCard {
  id: string;
  label: string;
  category: string;
  entityType: string;
  finalValue: number;
  years: number;
}

@Component({
  selector: 'app-projections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, FormsModule, DecimalPipe, Select, InputNumber, Skeleton, Message],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './projections.component.html',
  styleUrl: './projections.component.scss',
})
export class ProjectionsComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);
  private goalService = inject(GoalService);
  private localeService = inject(LocaleService);

  protected selectedMode = signal<ProjectionMode>('compound');
  protected selectedHorizon = signal(5);
  protected selectedScope = signal('all');
  protected simulations = signal(1000);
  protected customHorizon = signal(false);
  protected inflationAdjusted = signal(false);
  protected inflationRate = signal(2.5);
  protected loading = signal(false);
  protected selectedEntityId = signal<string | null>(null);
  protected result = signal<ProjectionResult | null>(null);
  protected defaults = signal<ProjectionDefault[]>([]);

  protected horizonPresets = [1, 3, 5, 10, 20];

  protected modeOptions = [
    { label: 'Compound', value: 'compound' as ProjectionMode },
    { label: 'Scenario', value: 'scenario' as ProjectionMode },
    { label: 'Monte Carlo', value: 'monte-carlo' as ProjectionMode },
  ];

  protected scopeOptions = [
    { label: 'All', value: 'all' },
    { label: 'Financial', value: 'financial' },
    { label: 'Liquid', value: 'liquid' },
  ];

  protected chartOptions = computed(() => {
    const r = this.result();
    if (!r) return {};
    const locale = this.localeService.locale();
    const currency = this.localeService.currency();
    const goalTarget = this.goalService.goal().netWorthTarget;
    switch (r.mode) {
      case 'compound':
        return buildCompoundOptions((r as CompoundResult).years, locale, currency, goalTarget);
      case 'scenario':
        return buildScenarioOptions((r as ScenarioResult).years, locale, currency, goalTarget);
      case 'monte-carlo':
        return buildMonteCarloOptions((r as MonteCarloResult).years, locale, currency, goalTarget);
    }
  });

  protected summaryLabel = computed(() => {
    const base = this.selectedScope() === 'liquid' ? 'Projected Asset Value' : 'Projected Net Worth';
    return this.inflationAdjusted() ? `${base} (today's dollars)` : base;
  });

  protected entityCards = computed<EntityCard[]>(() => {
    const r = this.result();
    if (!r) return [];
    const horizon = r.horizon;

    switch (r.mode) {
      case 'compound': {
        const cr = r as CompoundResult;
        return cr.entities.map((e) => {
          const last = e.years[e.years.length - 1];
          return {
            id: e.id,
            label: e.label,
            category: e.category,
            entityType: e.entityType,
            finalValue: last?.value ?? 0,
            years: horizon,
          };
        });
      }
      case 'scenario': {
        const sr = r as ScenarioResult;
        return sr.entities.map((e) => {
          const last = e.years[e.years.length - 1];
          return {
            id: e.id,
            label: e.label,
            category: e.category,
            entityType: e.entityType,
            finalValue: last?.base ?? 0,
            years: horizon,
          };
        });
      }
      case 'monte-carlo': {
        const mr = r as MonteCarloResult;
        return mr.entities.map((e) => {
          const last = e.years[e.years.length - 1];
          return {
            id: e.id,
            label: e.label,
            category: e.category,
            entityType: e.entityType,
            finalValue: last?.p50 ?? 0,
            years: horizon,
          };
        });
      }
    }
  });

  // Convenience getters for template access to typed result
  protected get compoundResult(): CompoundResult | null {
    const r = this.result();
    return r?.mode === 'compound' ? (r as CompoundResult) : null;
  }

  protected get scenarioResult(): ScenarioResult | null {
    const r = this.result();
    return r?.mode === 'scenario' ? (r as ScenarioResult) : null;
  }

  protected get monteCarloResult(): MonteCarloResult | null {
    const r = this.result();
    return r?.mode === 'monte-carlo' ? (r as MonteCarloResult) : null;
  }

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      untracked(() => this.refresh());
    });

    this.api.getProjectionDefaults().subscribe((d) => this.defaults.set(d));
  }

  refresh() {
    const mode = this.selectedMode();
    const view = this.viewState.view();
    const entityId = this.selectedEntityId();
    const request = {
      horizon: this.selectedHorizon(),
      view,
      scope: this.selectedScope(),
      simulations: mode === 'monte-carlo' ? this.simulations() : undefined,
      entityIds: entityId ? [entityId] : undefined,
      inflationRate: this.inflationAdjusted() ? this.inflationRate() / 100 : undefined,
    };

    this.loading.set(true);

    switch (mode) {
      case 'compound':
        this.api.runCompoundProjection(request).subscribe({
          next: (r) => { this.result.set(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
      case 'scenario':
        this.api.runScenarioProjection(request).subscribe({
          next: (r) => { this.result.set(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
      case 'monte-carlo':
        this.api.runMonteCarloProjection(request).subscribe({
          next: (r) => { this.result.set(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
    }
  }

  onModeChange(mode: ProjectionMode) {
    this.selectedMode.set(mode);
    this.refresh();
  }

  onScopeChange(scope: string) {
    this.selectedScope.set(scope);
    this.refresh();
  }

  selectHorizon(years: number) {
    this.customHorizon.set(false);
    this.selectedHorizon.set(years);
    this.refresh();
  }

  onSimulationsChange(sims: number) {
    this.simulations.set(sims);
    this.refresh();
  }

  toggleInflation() {
    this.inflationAdjusted.set(!this.inflationAdjusted());
    this.refresh();
  }

  onInflationRateChange(rate: number) {
    this.inflationRate.set(rate);
    if (this.inflationAdjusted()) this.refresh();
  }

  selectEntity(id: string) {
    this.selectedEntityId.set(this.selectedEntityId() === id ? null : id);
    this.refresh();
  }

  protected formatCurrency(value: number): string {
    return formatCurrency(value, this.localeService.locale(), this.localeService.currency());
  }

  protected getFinalYearData() {
    const r = this.result();
    if (!r) return null;
    const years = (r as CompoundResult).years;
    return years?.[years.length - 1] ?? null;
  }

  protected getFinalCompound() {
    const r = this.result() as CompoundResult | null;
    if (r?.mode !== 'compound') return null;
    return r.years[r.years.length - 1] ?? null;
  }

  protected getFinalScenario() {
    const r = this.result() as ScenarioResult | null;
    if (r?.mode !== 'scenario') return null;
    return r.years[r.years.length - 1] ?? null;
  }

  protected getFinalMonteCarlo() {
    const r = this.result() as MonteCarloResult | null;
    if (r?.mode !== 'monte-carlo') return null;
    return r.years[r.years.length - 1] ?? null;
  }

  protected getGrowthPercent(): number | null {
    const r = this.result() as CompoundResult | null;
    if (r?.mode !== 'compound' || !r.years.length) return null;
    const first = r.years[0];
    const last = r.years[r.years.length - 1];
    if (!first.netWorth) return null;
    return ((last.netWorth - first.netWorth) / Math.abs(first.netWorth)) * 100;
  }
}
