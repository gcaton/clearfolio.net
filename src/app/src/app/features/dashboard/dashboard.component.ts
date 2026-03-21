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
import {
  DashboardSummary,
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
  GoalProjection,
  AssetPerformance,
  CashflowSummary,
} from '../../core/api/models';
import { buildTrendOptions, buildCompositionOptions, buildLiquidityOptions, buildGrowthOptions, buildDebtQualityOptions, buildMemberOptions, buildSuperGapOptions } from './chart-options';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, FormsModule, RouterLink, DecimalPipe, CurrencyDisplayComponent, NetWorthChangeComponent, PeriodLabelPipe, Skeleton, ProgressBar, SelectButton, Button, Tabs, TabList, Tab, TabPanels, TabPanel, Toast, OnboardingChecklistComponent],
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

  protected trendOptions = computed(() => buildTrendOptions(this.trend()));
  protected compositionOptions = computed(() => buildCompositionOptions(this.summary()));
  protected liquidityOptions = computed(() => buildLiquidityOptions(this.summary()));
  protected growthOptions = computed(() => buildGrowthOptions(this.summary()));
  protected debtQualityOptions = computed(() => buildDebtQualityOptions(this.summary()));
  protected memberOptions = computed(() => buildMemberOptions(this.members()));
  protected superGapOptions = computed(() => buildSuperGapOptions(this.superGap()));

  protected savingsRateClass = computed(() => {
    const cf = this.cashflowSummary();
    if (!cf) return '';
    const rate = cf.savingsRate * 100;
    if (rate >= 20) return 'positive';
    if (rate >= 10) return 'amber';
    return 'negative';
  });

  protected netWorthGoal = computed(() => this.goalService.goal().netWorthTarget);
  protected projection = signal<GoalProjection | null>(null);

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
      const formatted = crossedMilestone >= 1000000
        ? `$${(crossedMilestone / 1000000).toFixed(crossedMilestone % 1000000 === 0 ? 0 : 1)}M`
        : `$${(crossedMilestone / 1000).toFixed(0)}K`;
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
