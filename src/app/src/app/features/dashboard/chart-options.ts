import type { EChartsOption } from 'echarts';
import { DashboardSummary, TrendPoint, MemberComparison, SuperGap } from '../../core/api/models';

export const CATEGORY_COLORS: Record<string, string> = {
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
  productive: 'Income-producing',
  neutral: 'Non-deductible',
  bad: 'Consumption',
  mortgage: 'Mortgage',
  personal: 'Personal',
  credit: 'Credit',
  student: 'Student',
  tax: 'Tax',
};

const LIQUIDITY_COLORS: Record<string, string> = {
  immediate: '#34d399',
  short_term: '#60a5fa',
  long_term: '#a78bfa',
  restricted: '#94a3b8',
};

function label(key: string): string {
  return LABEL_MAP[key] ?? key;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function currencyFormatter(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(value));
}

function currencyAbbr(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value);
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(0).replace(/[\d.,\s]/g, '').trim();
  if (abs >= 1_000_000) return symbol + (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return symbol + (value / 1_000).toFixed(0) + 'K';
  return symbol + Math.round(value).toString();
}

const AXIS_LABEL_COLOR = 'var(--p-text-muted-color, #94a3b8)';
const SPLIT_LINE_COLOR = 'var(--p-content-border-color, rgba(148,163,184,0.15))';
const BAR_BORDER_RADIUS = 4;

const tooltipStyle = {
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
};

const itemTooltipStyle = {
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
};

const legendStyle = {
  textStyle: {
    fontSize: 12,
    color: AXIS_LABEL_COLOR,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  icon: 'circle',
  itemWidth: 8,
  itemHeight: 8,
  itemGap: 16,
};

export interface TrendChartOptions {
  forPdf?: boolean;
}

export function buildTrendOptions(data: TrendPoint[], locale: string, currency: string, options?: TrendChartOptions): EChartsOption {
  const showDataZoom = !options?.forPdf && data.length > 12;
  return {
    tooltip: {
      ...tooltipStyle,
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const period = escapeHtml(params[0]?.axisValue ?? '');
        let html = `<div style="font-weight:600;margin-bottom:4px">${period}</div>`;
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(p.seriesName)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    legend: {
      ...legendStyle,
      data: ['Net Worth', 'Financial Assets', 'Liabilities'],
      bottom: showDataZoom ? 36 : 0,
      selected: { 'Net Worth': true, 'Financial Assets': true, 'Liabilities': true },
    },
    grid: { left: 60, right: 20, top: 10, bottom: showDataZoom ? 80 : 40 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.period),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: AXIS_LABEL_COLOR },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => currencyAbbr(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
    },
    ...(showDataZoom ? {
      dataZoom: [
        {
          type: 'slider',
          bottom: 4,
          height: 24,
          borderColor: 'transparent',
          backgroundColor: 'rgba(148,163,184,0.08)',
          fillerColor: 'rgba(96,165,250,0.12)',
          handleStyle: { color: '#60a5fa', borderColor: '#60a5fa' },
          textStyle: { fontSize: 10, color: AXIS_LABEL_COLOR },
          dataBackground: {
            lineStyle: { color: 'rgba(96,165,250,0.3)' },
            areaStyle: { color: 'rgba(96,165,250,0.05)' },
          },
          startValue: data[Math.max(0, data.length - 12)]?.period,
        },
      ],
    } : {}),
    series: [
      {
        name: 'Net Worth',
        type: 'line',
        data: data.map((d) => d.netWorth),
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 20,
        lineStyle: { width: 3, color: '#60a5fa' },
        itemStyle: { color: '#60a5fa', borderWidth: 2, borderColor: '#fff' },
        emphasis: {
          itemStyle: { borderWidth: 3, shadowBlur: 8, shadowColor: 'rgba(96,165,250,0.4)' },
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(96,165,250,0.25)' },
              { offset: 1, color: 'rgba(96,165,250,0.02)' },
            ],
          },
        },
        z: 3,
      },
      {
        name: 'Financial Assets',
        type: 'line',
        data: data.map((d) => d.financialAssets),
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#a78bfa', type: 'dashed', opacity: 0.7 },
        itemStyle: { color: '#a78bfa' },
        emphasis: {
          lineStyle: { width: 2.5, opacity: 1 },
        },
        z: 1,
      },
      {
        name: 'Liabilities',
        type: 'line',
        data: data.map((d) => d.liabilities),
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#f87171', type: 'dashed', opacity: 0.7 },
        itemStyle: { color: '#f87171' },
        emphasis: {
          lineStyle: { width: 2.5, opacity: 1 },
        },
        z: 1,
      },
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut',
  };
}

export function buildCompositionOptions(summary: DashboardSummary | null, locale: string, currency: string): EChartsOption {
  if (!summary) return {};
  const total = summary.assetsByCategory.reduce((sum, c) => sum + c.value, 0);
  const formattedTotal = currencyAbbr(total, locale, currency);
  return {
    tooltip: {
      ...itemTooltipStyle,
      formatter: (params: any) => {
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>`;
        return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(params.name)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(params.value, locale, currency)} (${params.percent}%)</span></div>`;
      },
    },
    legend: {
      ...legendStyle,
      orient: 'vertical',
      left: 'left',
      top: 'middle',
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['58%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: `{total|${escapeHtml(formattedTotal)}}\n{label|Total Assets}`,
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
              color: AXIS_LABEL_COLOR,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 18,
            },
          },
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: 'var(--p-content-background, #ffffff)',
          borderWidth: 2,
          borderRadius: 4,
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(0,0,0,0.15)',
          },
        },
        data: summary.assetsByCategory.map((c) => ({
          name: label(c.category),
          value: Math.round(c.value),
          itemStyle: { color: CATEGORY_COLORS[c.category] },
        })),
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}

export function buildLiquidityOptions(summary: DashboardSummary | null, locale: string, currency: string): EChartsOption {
  if (!summary) return {};
  const items = summary.liquidityBreakdown;
  return {
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        let html = '';
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(p.name)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    grid: { left: 100, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => currencyAbbr(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: items.map((i) => label(i.liquidity)),
      axisLabel: { fontSize: 12, color: AXIS_LABEL_COLOR },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { borderRadius: [0, BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0] },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' },
        },
        data: items.map((i) => ({
          value: Math.round(i.value),
          itemStyle: { color: LIQUIDITY_COLORS[i.liquidity] ?? '#60a5fa' },
        })),
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}

export function buildGrowthOptions(summary: DashboardSummary | null, locale?: string, currency?: string): EChartsOption {
  if (!summary) return {};
  return {
    tooltip: {
      ...itemTooltipStyle,
      formatter: (params: any) => {
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>`;
        const formattedValue = locale && currency
          ? currencyFormatter(params.value, locale, currency)
          : params.value.toLocaleString();
        return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(params.name)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${formattedValue} (${params.percent}%)</span></div>`;
      },
    },
    legend: {
      ...legendStyle,
      bottom: 0,
      data: summary.growthBreakdown.map(g => label(g.growthClass)),
    },
    series: [
      {
        type: 'pie',
        radius: ['38%', '65%'],
        center: ['50%', '45%'],
        itemStyle: {
          borderColor: 'var(--p-content-background, #ffffff)',
          borderWidth: 2,
          borderRadius: 4,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(0,0,0,0.15)',
          },
        },
        data: summary.growthBreakdown.map((g) => ({
          name: label(g.growthClass),
          value: Math.round(g.value),
          itemStyle: {
            color: g.growthClass === 'growth' ? '#34d399' : g.growthClass === 'defensive' ? '#60a5fa' : '#a78bfa',
          },
        })),
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}

export function buildDebtQualityOptions(summary: DashboardSummary | null, locale: string, currency: string): EChartsOption {
  if (!summary || summary.debtQualityBreakdown.length === 0) return {};
  const items = summary.debtQualityBreakdown;
  return {
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        let html = '';
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(p.name)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    grid: { left: 130, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => currencyAbbr(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: items.map((i) => label(i.debtQuality)),
      axisLabel: { fontSize: 12, color: AXIS_LABEL_COLOR },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { borderRadius: [0, BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0] },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' },
        },
        data: items.map((i) => ({
          value: Math.round(i.value),
          itemStyle: {
            color: i.debtQuality === 'productive' ? '#34d399' : i.debtQuality === 'bad' ? '#ef4444' : '#94a3b8',
          },
        })),
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}

export function buildMemberOptions(data: MemberComparison[], locale: string, currency: string): EChartsOption {
  if (data.length === 0) return {};
  return {
    tooltip: {
      ...tooltipStyle,
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const name = escapeHtml(params[0]?.axisValue ?? '');
        let html = `<div style="font-weight:600;margin-bottom:4px">${name}</div>`;
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${escapeHtml(p.seriesName)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    legend: { ...legendStyle, data: ['Assets', 'Liabilities', 'Net Worth'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.displayName),
      axisLabel: { fontSize: 12, color: AXIS_LABEL_COLOR },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => currencyAbbr(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
    },
    series: [
      {
        name: 'Assets',
        type: 'bar',
        data: data.map((d) => d.assets),
        itemStyle: { color: '#34d399', borderRadius: [BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' } },
        barMaxWidth: 40,
      },
      {
        name: 'Liabilities',
        type: 'bar',
        data: data.map((d) => d.liabilities),
        itemStyle: { color: '#f87171', borderRadius: [BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' } },
        barMaxWidth: 40,
      },
      {
        name: 'Net Worth',
        type: 'bar',
        data: data.map((d) => d.netWorth),
        itemStyle: { color: '#60a5fa', borderRadius: [BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' } },
        barMaxWidth: 40,
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}

export function buildSuperGapOptions(data: SuperGap[], locale: string, currency: string): EChartsOption {
  if (data.length === 0) return {};
  return {
    tooltip: {
      ...tooltipStyle,
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const name = escapeHtml(params[0]?.axisValue ?? '');
        let html = `<div style="font-weight:600;margin-bottom:4px">${name}</div>`;
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}Super Balance</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${currencyFormatter(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.displayName),
      axisLabel: { fontSize: 12, color: AXIS_LABEL_COLOR },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => currencyAbbr(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 48,
        itemStyle: {
          color: '#a78bfa',
          borderRadius: [BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0, 0],
        },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' },
        },
        data: data.map((d) => ({ value: d.superBalance, itemStyle: { color: '#a78bfa' } })),
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
}
