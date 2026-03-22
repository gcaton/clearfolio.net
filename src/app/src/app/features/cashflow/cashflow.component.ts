import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PercentPipe } from '@angular/common';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { LocaleService } from '../../core/locale/locale.service';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { ViewStateService } from '../../core/auth/view-state.service';
import {
  IncomeStream,
  CreateIncomeStreamRequest,
  Expense,
  CreateExpenseRequest,
  ExpenseCategory,
  CashflowSummary,
  Member,
  Asset,
} from '../../core/api/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FadeInDirective } from '../../shared/directives/fade-in.directive';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

@Component({
  selector: 'app-cashflow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppCurrencyPipe,
    PercentPipe,
    NgxEchartsDirective,
    TableModule,
    Tag,
    Button,
    DialogModule,
    InputText,
    Select,
    InputNumber,
    Textarea,
    ConfirmDialog,
    Toast,
    Skeleton,
    EmptyStateComponent,
    RouterLink,
    FadeInDirective,
  ],
  providers: [ConfirmationService, MessageService, provideEchartsCore({ echarts })],
  templateUrl: './cashflow.component.html',
  styleUrl: './cashflow.component.scss',
})
export class CashflowComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private viewState = inject(ViewStateService);
  protected localeService = inject(LocaleService);

  protected incomeStreams = signal<IncomeStream[]>([]);
  protected expenses = signal<Expense[]>([]);
  protected categories = signal<ExpenseCategory[]>([]);
  protected summary = signal<CashflowSummary | null>(null);
  protected members = signal<Member[]>([]);
  protected loading = signal(true);
  protected savingsAssets = signal<Asset[]>([]);
  protected incomeTotal = computed(() =>
    this.incomeStreams().reduce((sum, i) => sum + this.annualise(i.amount, i.frequency), 0)
  );
  protected expenseTotal = computed(() =>
    this.expenses().reduce((sum, e) => sum + this.annualise(e.amount, e.frequency), 0)
  );
  protected savingsTotal = computed(() =>
    this.savingsAssets().reduce((sum, a) => sum + this.annualise(a.contributionAmount ?? 0, a.contributionFrequency ?? 'monthly'), 0)
  );

  // Income dialog
  protected incomeDialogVisible = signal(false);
  protected editingIncome = signal<IncomeStream | null>(null);
  protected incomeForm: CreateIncomeStreamRequest = this.emptyIncomeForm();

  // Expense dialog
  protected expenseDialogVisible = signal(false);
  protected editingExpense = signal<Expense | null>(null);
  protected expenseForm: CreateExpenseRequest = this.emptyExpenseForm();

  protected frequencyOptions = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Fortnightly', value: 'fortnightly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  protected incomeTypeOptions = [
    { label: 'Primary', value: 'Primary' },
    { label: 'Additional', value: 'Additional' },
  ];

  protected ownerOptionsForExpense = computed(() => {
    const list: { label: string; value: string | null }[] = [
      { label: 'Household', value: null },
    ];
    for (const m of this.members()) {
      list.push({ label: m.displayName, value: m.id });
    }
    return list;
  });

  protected savingsRateClass = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const rate = s.savingsRate * 100;
    if (rate >= 20) return 'rate-good';
    if (rate >= 10) return 'rate-warn';
    return 'rate-bad';
  });

  protected debtToIncomeClass = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const ratio = s.debtToIncomeRatio * 100;
    if (ratio <= 30) return 'rate-good';
    if (ratio <= 50) return 'rate-warn';
    return 'rate-bad';
  });

  // Charts
  protected incomeVsExpenseOptions = computed(() => {
    const s = this.summary();
    if (!s || !s.incomeByMember.length) return null;
    const locale = this.localeService.locale();
    const currency = this.localeService.currency();
    const memberNames = s.incomeByMember.map((m) => m.displayName);
    const incomeData = s.incomeByMember.map((m) => m.annualIncome);
    // Try to match expenses to members — fall back to total
    const expenseTotal = s.totalAnnualExpenses;
    const currencyAbbr = (v: number) => {
      const abs = Math.abs(v);
      const sym = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
        .format(0).replace(/[\d.,\s]/g, '').trim();
      if (abs >= 1_000_000) return sym + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (abs >= 1_000) return sym + (v / 1_000).toFixed(0) + 'K';
      return sym + Math.round(v).toString();
    };
    const currencyFull = (v: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(v));
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'var(--p-content-background, #ffffff)',
        borderColor: 'var(--p-content-border-color, #e2e8f0)',
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
        textStyle: {
          color: 'var(--p-text-color, #1e293b)',
          fontSize: 13,
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);',
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          const name = params[0]?.axisValue ?? '';
          let html = `<div style="font-weight:600;margin-bottom:4px">${name}</div>`;
          for (const p of params) {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${p.seriesName}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFull(p.value)}</span></div>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Income', 'Expenses'],
        bottom: 0,
        textStyle: { fontSize: 12, color: 'var(--p-text-muted-color, #94a3b8)' },
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
      },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: memberNames,
        axisLabel: { margin: 10, fontSize: 12, color: 'var(--p-text-muted-color, #94a3b8)' },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => currencyAbbr(v), fontSize: 11, color: 'var(--p-text-muted-color, #94a3b8)' },
        splitLine: { lineStyle: { color: 'var(--p-content-border-color, rgba(148,163,184,0.15))', type: 'dashed' as const } },
      },
      series: [
        {
          name: 'Income',
          type: 'bar' as const,
          data: incomeData,
          itemStyle: { color: '#22c55e', borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' } },
          barMaxWidth: 40,
        },
        {
          name: 'Expenses',
          type: 'bar' as const,
          data: memberNames.map(() => Math.round(expenseTotal / memberNames.length)),
          itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' } },
          barMaxWidth: 40,
        },
      ],
      animationDuration: 600,
      animationEasing: 'cubicOut' as const,
    };
  });

  protected expensesByCategoryOptions = computed(() => {
    const s = this.summary();
    if (!s || !s.expensesByCategory.length) return null;
    const total = s.expensesByCategory.reduce((sum, c) => sum + c.annualAmount, 0);
    const locale = this.localeService.locale();
    const currency = this.localeService.currency();
    const formattedTotal = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(total));
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'var(--p-content-background, #ffffff)',
        borderColor: 'var(--p-content-border-color, #e2e8f0)',
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
        textStyle: {
          color: 'var(--p-text-color, #1e293b)',
          fontSize: 13,
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);',
        formatter: (params: any) => {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>`;
          return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${params.name}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${params.value.toLocaleString()} (${params.percent}%)</span></div>`;
        },
      },
      legend: {
        orient: 'vertical' as const,
        left: 'left',
        top: 'middle',
        textStyle: { fontSize: 12, color: 'var(--p-text-muted-color, #94a3b8)' },
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 12,
      },
      series: [
        {
          name: 'Expenses',
          type: 'pie' as const,
          radius: ['42%', '68%'],
          center: ['58%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: 'var(--p-content-background, #ffffff)',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'center',
            formatter: `{total|${formattedTotal}}\n{label|Total Expenses}`,
            rich: {
              total: {
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--p-text-color, #1e293b)',
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 28,
              },
              label: {
                fontSize: 11,
                color: 'var(--p-text-muted-color, #94a3b8)',
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 18,
              },
            },
          },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.15)',
            },
          },
          data: s.expensesByCategory.map((c) => ({
            name: c.categoryName,
            value: c.annualAmount,
          })),
        },
      ],
      animationDuration: 600,
      animationEasing: 'cubicOut' as const,
    };
  });

  constructor() {
    effect(() => {
      const view = this.viewState.view();
      this.loadSummary(view);
    });
  }

  ngOnInit() {
    this.loadIncomeStreams();
    this.loadExpenses();
    this.loadSavingsAssets();
    this.api.getExpenseCategories().subscribe((d) => this.categories.set(d));
    this.api.getMembers().subscribe((d) => this.members.set(d));
  }

  // --- Helpers ---

  annualise(amount: number, frequency: string): number {
    return amount * (FREQUENCY_MULTIPLIER[frequency] ?? 12);
  }

  getCategorySubtotal(categoryName: string): number {
    return this.expenses()
      .filter(e => e.expenseCategoryName === categoryName)
      .reduce((sum, e) => sum + this.annualise(e.amount, e.frequency), 0);
  }

  // --- Income CRUD ---

  openNewIncome() {
    this.incomeForm = this.emptyIncomeForm();
    this.editingIncome.set(null);
    this.incomeDialogVisible.set(true);
  }

  openEditIncome(income: IncomeStream) {
    this.incomeForm = {
      ownerMemberId: income.ownerMemberId,
      label: income.label,
      incomeType: income.incomeType,
      amount: income.amount,
      frequency: income.frequency,
      isActive: income.isActive,
      notes: income.notes,
    };
    this.editingIncome.set(income);
    this.incomeDialogVisible.set(true);
  }

  saveIncome() {
    const current = this.editingIncome();
    if (current) {
      this.api.updateIncomeStream(current.id, this.incomeForm).subscribe(() => {
        this.incomeDialogVisible.set(false);
        this.loadIncomeStreams();
        this.loadSummary(this.viewState.view());
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Income stream updated' });
      });
    } else {
      this.api.createIncomeStream(this.incomeForm).subscribe({
        next: () => {
          this.incomeDialogVisible.set(false);
          this.loadIncomeStreams();
          this.loadSummary(this.viewState.view());
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Income stream created' });
        },
        error: (err) => {
          const msg = typeof err.error === 'string' ? err.error : 'Failed to create income stream';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        },
      });
    }
  }

  confirmDeleteIncome(income: IncomeStream) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${income.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteIncomeStream(income.id).subscribe(() => {
          this.loadIncomeStreams();
          this.loadSummary(this.viewState.view());
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Income stream removed' });
        });
      },
    });
  }

  // --- Expense CRUD ---

  openNewExpense() {
    this.expenseForm = this.emptyExpenseForm();
    this.editingExpense.set(null);
    this.expenseDialogVisible.set(true);
  }

  openEditExpense(expense: Expense) {
    this.expenseForm = {
      ownerMemberId: expense.ownerMemberId,
      expenseCategoryId: expense.expenseCategoryId,
      label: expense.label,
      amount: expense.amount,
      frequency: expense.frequency,
      isActive: expense.isActive,
      notes: expense.notes,
    };
    this.editingExpense.set(expense);
    this.expenseDialogVisible.set(true);
  }

  saveExpense() {
    const current = this.editingExpense();
    if (current) {
      this.api.updateExpense(current.id, this.expenseForm).subscribe(() => {
        this.expenseDialogVisible.set(false);
        this.loadExpenses();
        this.loadSummary(this.viewState.view());
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Expense updated' });
      });
    } else {
      this.api.createExpense(this.expenseForm).subscribe({
        next: () => {
          this.expenseDialogVisible.set(false);
          this.loadExpenses();
          this.loadSummary(this.viewState.view());
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Expense created' });
        },
        error: (err) => {
          const msg = typeof err.error === 'string' ? err.error : 'Failed to create expense';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        },
      });
    }
  }

  confirmDeleteExpense(expense: Expense) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${expense.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteExpense(expense.id).subscribe(() => {
          this.loadExpenses();
          this.loadSummary(this.viewState.view());
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Expense removed' });
        });
      },
    });
  }

  // --- Data loading ---

  private loadIncomeStreams() {
    this.loading.set(true);
    this.api.getIncomeStreams().subscribe((data) => {
      this.incomeStreams.set(data);
      this.loading.set(false);
    });
  }

  private loadExpenses() {
    this.api.getExpenses().subscribe((data) => this.expenses.set(data));
  }

  private loadSavingsAssets() {
    this.api.getAssets().subscribe((data) =>
      this.savingsAssets.set(data.filter(a => a.contributionAmount && a.contributionAmount > 0))
    );
  }

  private loadSummary(view: string) {
    this.api.getCashflowSummary({ view }).subscribe((d) => this.summary.set(d));
  }

  // --- Empty forms ---

  private emptyIncomeForm(): CreateIncomeStreamRequest {
    return {
      ownerMemberId: '',
      label: '',
      incomeType: 'Primary',
      amount: 0,
      frequency: 'monthly',
      isActive: true,
      notes: null,
    };
  }

  private emptyExpenseForm(): CreateExpenseRequest {
    return {
      ownerMemberId: null,
      expenseCategoryId: '',
      label: '',
      amount: 0,
      frequency: 'monthly',
      isActive: true,
      notes: null,
    };
  }
}
