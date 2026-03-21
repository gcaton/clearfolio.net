import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, PercentPipe } from '@angular/common';
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
} from '../../core/api/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
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
    CurrencyPipe,
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

  protected incomeStreams = signal<IncomeStream[]>([]);
  protected expenses = signal<Expense[]>([]);
  protected categories = signal<ExpenseCategory[]>([]);
  protected summary = signal<CashflowSummary | null>(null);
  protected members = signal<Member[]>([]);
  protected loading = signal(true);

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
    const memberNames = s.incomeByMember.map((m) => m.displayName);
    const incomeData = s.incomeByMember.map((m) => m.annualIncome);
    // Try to match expenses to members — fall back to total
    const expenseTotal = s.totalAnnualExpenses;
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['Income', 'Expenses'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category' as const, data: memberNames },
      yAxis: { type: 'value' as const },
      series: [
        {
          name: 'Income',
          type: 'bar' as const,
          data: incomeData,
          itemStyle: { color: '#22c55e' },
        },
        {
          name: 'Expenses',
          type: 'bar' as const,
          data: memberNames.map(() => Math.round(expenseTotal / memberNames.length)),
          itemStyle: { color: '#ef4444' },
        },
      ],
    };
  });

  protected expensesByCategoryOptions = computed(() => {
    const s = this.summary();
    if (!s || !s.expensesByCategory.length) return null;
    return {
      tooltip: { trigger: 'item' as const },
      legend: { orient: 'vertical' as const, left: 'left' },
      series: [
        {
          name: 'Expenses',
          type: 'pie' as const,
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' as const },
          },
          labelLine: { show: false },
          data: s.expensesByCategory.map((c) => ({
            name: c.categoryName,
            value: c.annualAmount,
          })),
        },
      ],
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
          const msg = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg, life: 10000 });
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
      console.log('Expense form payload:', JSON.stringify(this.expenseForm));
      this.api.createExpense(this.expenseForm).subscribe({
        next: () => {
          this.expenseDialogVisible.set(false);
          this.loadExpenses();
          this.loadSummary(this.viewState.view());
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Expense created' });
        },
        error: (err) => {
          console.error('Expense create error:', err.status, err.error);
          const msg = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg, life: 10000 });
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
