import type { EChartsOption } from 'echarts';
import { DashboardSummary, TrendPoint, MemberComparison, SuperGap } from '../../core/api/models';

const CATEGORY_COLORS: Record<string, string> = {
  cash: '#60a5fa',
  investable: '#34d399',
  retirement: '#a78bfa',
  property: '#fbbf24',
  other: '#94a3b8',
  mortgage: '#f87171',
  personal: '#fb923c',
  credit: '#ef4444',
  student: '#a3a3a3',
  tax: '#d4d4d8',
};

const LABEL_MAP: Record<string, string> = {
  cash: 'Cash',
  investable: 'Investable',
  retirement: 'Retirement',
  property: 'Property',
  other: 'Other',
  immediate: 'Immediate',
  short_term: 'Short Term',
  long_term: 'Long Term',
  restricted: 'Restricted',
  growth: 'Growth',
  defensive: 'Defensive',
  mixed: 'Mixed',
  productive: 'Productive',
  neutral: 'Neutral',
  bad: 'Bad',
  mortgage: 'Mortgage',
  personal: 'Personal',
  credit: 'Credit',
  student: 'Student',
  tax: 'Tax',
};

function label(key: string): string {
  return LABEL_MAP[key] ?? key;
}

function currencyFormatter(value: number): string {
  return '$' + Math.round(value).toLocaleString();
}

function currencyAbbr(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
  return '$' + Math.round(value).toString();
}

const tooltipStyle = {
  trigger: 'axis' as const,
  axisPointer: { type: 'shadow' as const },
};

export function buildTrendOptions(data: TrendPoint[]): EChartsOption {
  return {
    tooltip: tooltipStyle,
    legend: { data: ['Assets', 'Financial Assets', 'Liabilities', 'Net Worth'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: data.map((d) => d.period) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currencyFormatter(v) } },
    series: [
      { name: 'Assets', type: 'line', data: data.map((d) => d.assets), smooth: true, itemStyle: { color: '#34d399' } },
      { name: 'Financial Assets', type: 'line', data: data.map((d) => d.financialAssets), smooth: true, itemStyle: { color: '#a78bfa' }, lineStyle: { type: 'dashed' } },
      { name: 'Liabilities', type: 'line', data: data.map((d) => d.liabilities), smooth: true, itemStyle: { color: '#f87171' } },
      { name: 'Net Worth', type: 'line', data: data.map((d) => d.netWorth), smooth: true, lineStyle: { type: 'dashed' }, itemStyle: { color: '#60a5fa' } },
    ],
  };
}

export function buildCompositionOptions(summary: DashboardSummary | null): EChartsOption {
  if (!summary) return {};
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: summary.assetsByCategory.map((c) => ({
          name: label(c.category),
          value: Math.round(c.value),
          itemStyle: { color: CATEGORY_COLORS[c.category] },
        })),
      },
    ],
  };
}

export function buildLiquidityOptions(summary: DashboardSummary | null): EChartsOption {
  if (!summary) return {};
  const items = summary.liquidityBreakdown;
  return {
    tooltip: { ...tooltipStyle, trigger: 'axis' },
    grid: { left: 100, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => currencyAbbr(v) } },
    yAxis: { type: 'category', data: items.map((i) => label(i.liquidity)) },
    series: [
      {
        type: 'bar',
        data: items.map((i) => ({ value: Math.round(i.value), itemStyle: { color: '#60a5fa' } })),
      },
    ],
  };
}

export function buildGrowthOptions(summary: DashboardSummary | null): EChartsOption {
  if (!summary) return {};
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: '65%',
        data: summary.growthBreakdown.map((g) => ({
          name: label(g.growthClass),
          value: Math.round(g.value),
          itemStyle: {
            color: g.growthClass === 'growth' ? '#34d399' : g.growthClass === 'defensive' ? '#60a5fa' : '#a78bfa',
          },
        })),
      },
    ],
  };
}

export function buildDebtQualityOptions(summary: DashboardSummary | null): EChartsOption {
  if (!summary || summary.debtQualityBreakdown.length === 0) return {};
  const items = summary.debtQualityBreakdown;
  return {
    tooltip: { ...tooltipStyle, trigger: 'axis' },
    grid: { left: 100, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => currencyAbbr(v) } },
    yAxis: { type: 'category', data: items.map((i) => label(i.debtQuality)) },
    series: [
      {
        type: 'bar',
        data: items.map((i) => ({
          value: Math.round(i.value),
          itemStyle: {
            color: i.debtQuality === 'productive' ? '#34d399' : i.debtQuality === 'bad' ? '#ef4444' : '#94a3b8',
          },
        })),
      },
    ],
  };
}

export function buildMemberOptions(data: MemberComparison[]): EChartsOption {
  if (data.length === 0) return {};
  return {
    tooltip: tooltipStyle,
    legend: { data: ['Assets', 'Liabilities', 'Net Worth'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: data.map((d) => d.displayName) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currencyFormatter(v) } },
    series: [
      { name: 'Assets', type: 'bar', data: data.map((d) => d.assets), itemStyle: { color: '#34d399' } },
      { name: 'Liabilities', type: 'bar', data: data.map((d) => d.liabilities), itemStyle: { color: '#f87171' } },
      { name: 'Net Worth', type: 'bar', data: data.map((d) => d.netWorth), itemStyle: { color: '#60a5fa' } },
    ],
  };
}

export function buildSuperGapOptions(data: SuperGap[]): EChartsOption {
  if (data.length === 0) return {};
  return {
    tooltip: tooltipStyle,
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d.displayName) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currencyFormatter(v) } },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({ value: d.superBalance, itemStyle: { color: '#a78bfa' } })),
      },
    ],
  };
}
