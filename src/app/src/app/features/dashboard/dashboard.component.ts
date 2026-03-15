import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { Skeleton } from 'primeng/skeleton';
import { ProgressBar } from 'primeng/progressbar';
import { GoalService } from '../../core/auth/goal.service';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display.component';
import { NetWorthChangeComponent } from '../../shared/components/net-worth-change.component';
import { PeriodSelectorComponent } from '../../shared/components/period-selector.component';
import { PeriodLabelPipe } from '../../shared/pipes/period-label.pipe';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ApiService } from '../../core/api/api.service';
import { ViewStateService } from '../../core/auth/view-state.service';
import {
  DashboardSummary,
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
} from '../../core/api/models';
import { buildTrendOptions, buildCompositionOptions, buildLiquidityOptions, buildGrowthOptions, buildDebtQualityOptions, buildMemberOptions, buildSuperGapOptions } from './chart-options';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, FormsModule, CurrencyDisplayComponent, NetWorthChangeComponent, PeriodSelectorComponent, PeriodLabelPipe, Skeleton, ProgressBar],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);
  private goalService = inject(GoalService);

  protected selectedPeriod = signal<string | null>(null);
  protected summary = signal<DashboardSummary | null>(null);
  protected trend = signal<TrendPoint[]>([]);
  protected composition = signal<CompositionPoint[]>([]);
  protected members = signal<MemberComparison[]>([]);
  protected superGap = signal<SuperGap[]>([]);

  protected trendOptions = computed(() => buildTrendOptions(this.trend()));
  protected compositionOptions = computed(() => buildCompositionOptions(this.summary()));
  protected liquidityOptions = computed(() => buildLiquidityOptions(this.summary()));
  protected growthOptions = computed(() => buildGrowthOptions(this.summary()));
  protected debtQualityOptions = computed(() => buildDebtQualityOptions(this.summary()));
  protected memberOptions = computed(() => buildMemberOptions(this.members()));
  protected superGapOptions = computed(() => buildSuperGapOptions(this.superGap()));

  protected netWorthGoal = computed(() => this.goalService.goal().netWorthTarget);
  protected netWorthProgress = computed(() => {
    const target = this.netWorthGoal();
    const current = this.summary()?.netWorth ?? 0;
    if (!target || target <= 0) return null;
    return Math.min(Math.round((current / target) * 100), 100);
  });

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      this.loadData(view);
    });
  }

  onPeriodChange(period: string) {
    this.selectedPeriod.set(period);
    this.loadData(this.viewState.view());
  }

  private loadData(view: string) {
    const period = this.selectedPeriod() ?? undefined;
    this.api.getDashboardSummary({ view, period }).subscribe((d) => this.summary.set(d));
    this.api.getDashboardTrend({ periods: 8, view }).subscribe((d) => this.trend.set(d));
    this.api.getDashboardComposition({ period }).subscribe((d) => this.composition.set(d));
    this.api.getDashboardMembers({ period }).subscribe((d) => this.members.set(d));
    this.api.getSuperGap().subscribe((d) => this.superGap.set(d));
  }
}
