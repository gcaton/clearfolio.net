import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display.component';
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
  imports: [NgxEchartsDirective, CurrencyDisplayComponent, PeriodLabelPipe],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);

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

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      this.loadData(view);
    });
  }

  private loadData(view: string) {
    this.api.getDashboardSummary({ view }).subscribe((d) => this.summary.set(d));
    this.api.getDashboardTrend({ periods: 8, view }).subscribe((d) => this.trend.set(d));
    this.api.getDashboardComposition().subscribe((d) => this.composition.set(d));
    this.api.getDashboardMembers().subscribe((d) => this.members.set(d));
    this.api.getSuperGap().subscribe((d) => this.superGap.set(d));
  }
}
