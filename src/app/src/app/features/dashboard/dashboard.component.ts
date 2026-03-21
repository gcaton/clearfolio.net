import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { Skeleton } from 'primeng/skeleton';
import { ProgressBar } from 'primeng/progressbar';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { GoalService } from '../../core/auth/goal.service';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display.component';
import { NetWorthChangeComponent } from '../../shared/components/net-worth-change.component';
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
import { PdfReportService } from '../../core/pdf-report.service';
import { ViewStateService } from '../../core/auth/view-state.service';
import {
  DashboardSummary,
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
  GoalProjection,
  AssetPerformance,
} from '../../core/api/models';
import { buildTrendOptions, buildCompositionOptions, buildLiquidityOptions, buildGrowthOptions, buildDebtQualityOptions, buildMemberOptions, buildSuperGapOptions } from './chart-options';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, FormsModule, CurrencyDisplayComponent, NetWorthChangeComponent, PeriodLabelPipe, Skeleton, ProgressBar, SelectButton, Button],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);
  private goalService = inject(GoalService);
  private pdfReport = inject(PdfReportService);

  protected selectedScope = signal('all');
  protected scopeOptions = [
    { label: 'Total Net Worth', value: 'all' },
    { label: 'Financial Net Worth', value: 'financial' },
    { label: 'Liquid Net Worth', value: 'liquid' },
  ];
  protected summary = signal<DashboardSummary | null>(null);
  protected trend = signal<TrendPoint[]>([]);
  protected composition = signal<CompositionPoint[]>([]);
  protected members = signal<MemberComparison[]>([]);
  protected superGap = signal<SuperGap[]>([]);
  protected assetPerformance = signal<AssetPerformance[]>([]);

  protected trendOptions = computed(() => buildTrendOptions(this.trend()));
  protected compositionOptions = computed(() => buildCompositionOptions(this.summary()));
  protected liquidityOptions = computed(() => buildLiquidityOptions(this.summary()));
  protected growthOptions = computed(() => buildGrowthOptions(this.summary()));
  protected debtQualityOptions = computed(() => buildDebtQualityOptions(this.summary()));
  protected memberOptions = computed(() => buildMemberOptions(this.members()));
  protected superGapOptions = computed(() => buildSuperGapOptions(this.superGap()));

  protected netWorthGoal = computed(() => this.goalService.goal().netWorthTarget);
  protected projection = signal<GoalProjection | null>(null);

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      this.loadData(view);
    });
  }

  onScopeChange(scope: string) {
    this.selectedScope.set(scope);
    this.loadData(this.viewState.view());
  }

  private loadData(view: string) {
    const scope = this.selectedScope();
    const summaryParams: Record<string, string> = { view, scope };

    this.api.getDashboardSummary(summaryParams).subscribe((d) => this.summary.set(d));
    this.api.getDashboardTrend({ view, scope }).subscribe((d) => this.trend.set(d));
    this.api.getDashboardComposition({ scope }).subscribe((d) => this.composition.set(d));
    this.api.getDashboardMembers({ scope }).subscribe((d) => this.members.set(d));
    this.api.getSuperGap().subscribe((d) => this.superGap.set(d));
    this.api.getAssetPerformance({ view }).subscribe((d) => this.assetPerformance.set(d));

    const goal = this.goalService.goal().netWorthTarget;
    if (goal && goal > 0) {
      this.api.getGoalProjection(goal, view, scope).subscribe((d) => this.projection.set(d));
    } else {
      this.projection.set(null);
    }
  }

  exportReport() {
    const summary = this.summary();
    if (!summary) return;
    this.pdfReport.generate({
      summary,
      trend: this.trend(),
      members: this.members(),
      superGap: this.superGap(),
      assetPerformance: this.assetPerformance(),
      projection: this.projection(),
      scope: this.selectedScope(),
    });
  }

  protected timeToGoal = computed(() => {
    const p = this.projection();
    if (!p?.projectedPeriod) return null;

    const match = p.projectedPeriod.match(/^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/);
    if (!match) return null;

    const convention = match[1];
    const year = parseInt(match[2]);
    const quarter = match[3] ? parseInt(match[3][1]) : 1;

    // Convert to approximate month
    let targetMonth: number;
    if (convention === 'FY') {
      // FY Q1=Jul, Q2=Oct, Q3=Jan+1, Q4=Apr+1
      const baseYear = quarter <= 2 ? year - 1 : year;
      const monthMap = [7, 10, 1, 4];
      targetMonth = (baseYear * 12) + monthMap[quarter - 1];
    } else {
      const monthMap = [1, 4, 7, 10];
      targetMonth = (year * 12) + monthMap[quarter - 1];
    }

    const now = new Date();
    const currentMonth = (now.getFullYear() * 12) + (now.getMonth() + 1);
    const diff = targetMonth - currentMonth;

    if (diff <= 0) return null;

    const years = Math.floor(diff / 12);
    const months = diff % 12;

    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  });
}
