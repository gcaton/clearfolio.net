import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { ProgressBar } from 'primeng/progressbar';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { GoalService } from '../../core/auth/goal.service';
import { OnboardingService } from '../../core/onboarding.service';
import { OnboardingChecklistComponent } from '../../shared/components/onboarding-checklist.component';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display.component';
import { NetWorthChangeComponent } from '../../shared/components/net-worth-change.component';
import { PeriodLabelPipe } from '../../shared/pipes/period-label.pipe';
import { DecimalPipe } from '@angular/common';
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
import { LocaleService } from '../../core/locale/locale.service';
import {
  DashboardSummary,
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
  AssetPerformance,
  CashflowSummary,
  CompoundResult,
  DashboardGoalProjection,
} from '../../core/api/models';
import { buildTrendOptions, buildCompositionOptions, buildLiquidityOptions, buildGrowthOptions, buildDebtQualityOptions, buildMemberOptions, buildSuperGapOptions } from './chart-options';
import { FadeInDirective } from '../../shared/directives/fade-in.directive';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, FormsModule, RouterLink, DecimalPipe, CurrencyDisplayComponent, NetWorthChangeComponent, PeriodLabelPipe, Skeleton, ProgressBar, SelectButton, Button, Tabs, TabList, Tab, TabPanels, TabPanel, Toast, OnboardingChecklistComponent, FadeInDirective],
  providers: [provideEchartsCore({ echarts }), MessageService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);
  private goalService = inject(GoalService);
  private pdfReport = inject(PdfReportService);
  private messageService = inject(MessageService);
  private onboarding = inject(OnboardingService);
  protected localeService = inject(LocaleService);

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
  protected cashflowSummary = signal<CashflowSummary | null>(null);

  protected trendOptions = computed(() => buildTrendOptions(this.trend(), this.localeService.locale(), this.localeService.currency()));
  protected compositionOptions = computed(() => buildCompositionOptions(this.summary()));
  protected liquidityOptions = computed(() => buildLiquidityOptions(this.summary(), this.localeService.locale(), this.localeService.currency()));
  protected growthOptions = computed(() => buildGrowthOptions(this.summary()));
  protected debtQualityOptions = computed(() => buildDebtQualityOptions(this.summary(), this.localeService.locale(), this.localeService.currency()));
  protected memberOptions = computed(() => buildMemberOptions(this.members(), this.localeService.locale(), this.localeService.currency()));
  protected superGapOptions = computed(() => buildSuperGapOptions(this.superGap(), this.localeService.locale(), this.localeService.currency()));

  protected savingsRateClass = computed(() => {
    const cf = this.cashflowSummary();
    if (!cf) return '';
    const rate = cf.savingsRate * 100;
    if (rate >= 20) return 'positive';
    if (rate >= 10) return 'amber';
    return 'negative';
  });

  protected netWorthGoal = computed(() => this.goalService.goal().netWorthTarget);
  protected projection = signal<DashboardGoalProjection | null>(null);

  private milestoneChecked = false;

  protected sparklinePoints = computed(() => {
    const data = this.trend();
    if (data.length < 2) return '';
    const values = data.map(d => d.netWorth);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const width = 80;
    const height = 24;
    const padding = 2;
    return values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = padding + ((max - v) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      this.loadData(view);
    });
    this.onboarding.check();

    effect(() => {
      const s = this.summary();
      const t = this.trend();
      if (s && t.length > 0 && !this.milestoneChecked) {
        this.milestoneChecked = true;
        this.checkMilestones(s, t);
      }
    });
  }

  onScopeChange(scope: string) {
    this.selectedScope.set(scope);
    this.loadData(this.viewState.view());
  }

  private loadData(view: string) {
    this.milestoneChecked = false;
    const scope = this.selectedScope();
    const summaryParams: Record<string, string> = { view, scope };

    this.api.getDashboardSummary(summaryParams).subscribe((d) => this.summary.set(d));
    this.api.getCashflowSummary({ view }).subscribe((d) => this.cashflowSummary.set(d));
    this.api.getDashboardTrend({ view, scope }).subscribe((d) => this.trend.set(d));
    this.api.getDashboardComposition({ scope }).subscribe((d) => this.composition.set(d));
    this.api.getDashboardMembers({ scope }).subscribe((d) => this.members.set(d));
    this.api.getSuperGap().subscribe((d) => this.superGap.set(d));
    this.api.getAssetPerformance({ view }).subscribe((d) => this.assetPerformance.set(d));

    const goal = this.goalService.goal().netWorthTarget;
    if (goal && goal > 0) {
      this.api.runCompoundProjection({ horizon: 30, view, scope }).subscribe((result) => {
        this.buildGoalProjection(result, goal);
      });
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

  private checkMilestones(summary: DashboardSummary, trend: TrendPoint[]) {
    if (trend.length < 2) return;

    const current = summary.netWorth;
    const previous = summary.previousNetWorth;
    if (previous === null || current <= previous) return;

    // Check all-time high
    const allTimeHigh = trend.every(t => current >= t.netWorth);

    // Check round number milestones
    const milestones = [50000, 100000, 250000, 500000, 750000, 1000000, 1500000, 2000000, 5000000, 10000000];
    const crossedMilestone = milestones.find(m => current >= m && previous < m);

    if (crossedMilestone) {
      const symbol = new Intl.NumberFormat(this.localeService.locale(), {
        style: 'currency', currency: this.localeService.currency(), maximumFractionDigits: 0
      }).format(0).replace(/[\d.,\s]/g, '').trim();
      const formatted = crossedMilestone >= 1000000
        ? `${symbol}${(crossedMilestone / 1000000).toFixed(crossedMilestone % 1000000 === 0 ? 0 : 1)}M`
        : `${symbol}${(crossedMilestone / 1000).toFixed(0)}K`;
      this.messageService.add({
        severity: 'success',
        summary: `Milestone reached!`,
        detail: `Your net worth has crossed ${formatted}`,
        life: 6000,
      });
    } else if (allTimeHigh) {
      this.messageService.add({
        severity: 'success',
        summary: 'New all-time high!',
        detail: 'Your net worth is at its highest recorded value',
        life: 5000,
      });
    }
  }

  private buildGoalProjection(result: CompoundResult, target: number) {
    const current = result.years[0]?.netWorth ?? 0;
    const progressPercent = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

    if (current >= target) {
      this.projection.set({ target, current, progressPercent: 100, projectedYear: null, goalReached: true });
      return;
    }

    const goalYear = result.years.find(y => y.netWorth >= target);
    this.projection.set({
      target,
      current,
      progressPercent,
      projectedYear: goalYear?.year ?? null,
      goalReached: false,
    });
  }

  protected timeToGoal = computed(() => {
    const p = this.projection();
    if (!p?.projectedYear) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const targetMonths = (p.projectedYear - currentYear) * 12 - currentMonth;

    if (targetMonths <= 0) return null;

    const years = Math.floor(targetMonths / 12);
    const months = targetMonths % 12;

    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  });
}
