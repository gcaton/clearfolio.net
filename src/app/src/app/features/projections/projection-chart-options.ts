import type { EChartsOption } from 'echarts';
import { CompoundYearData, ScenarioYearData, MonteCarloYearData } from '../../core/api/models';

export function formatCurrency(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(0).replace(/[\d.,\s]/g, '').trim();
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${symbol}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

const AXIS_LABEL_COLOR = 'var(--p-text-muted-color, #94a3b8)';
const SPLIT_LINE_COLOR = 'var(--p-content-border-color, rgba(148,163,184,0.15))';

const baseGrid = { left: 70, right: 20, top: 20, bottom: 40 };

const tooltipBase = {
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

function baseTooltip(locale: string, currency: string) {
  return {
    ...tooltipBase,
    trigger: 'axis' as const,
    axisPointer: { type: 'shadow' as const },
    formatter: (params: unknown) => {
      const items = params as Array<{ seriesName: string; value: number; color: string }>;
      if (!items?.length) return '';
      const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
      let html = `<div style="font-weight:600;margin-bottom:4px">${year}</div>`;
      for (const p of items) {
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
        html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${p.seriesName}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${formatCurrency(p.value, locale, currency)}</span></div>`;
      }
      return html;
    },
  };
}

function baseXAxis(years: string[]) {
  return {
    type: 'category' as const,
    data: years,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontSize: 11, color: AXIS_LABEL_COLOR },
  };
}

function baseYAxis(locale: string, currency: string) {
  return {
    type: 'value' as const,
    axisLabel: { formatter: (v: number) => formatCurrency(v, locale, currency), fontSize: 11, color: AXIS_LABEL_COLOR },
    splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' as const } },
  };
}

function todayMarkLine(yearLabel: string) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { type: 'dashed' as const, color: 'var(--p-text-muted-color, #94a3b8)', width: 1.5 },
    label: {
      formatter: 'Today',
      position: 'insideEndTop' as const,
      fontSize: 11,
      fontWeight: 600 as const,
      color: 'var(--p-text-muted-color, #94a3b8)',
      fontFamily: "'DM Sans', sans-serif",
    },
    data: [{ xAxis: yearLabel }],
  };
}

function goalMarkLine(goalTarget: number, locale: string, currency: string) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { type: 'dashed' as const, color: '#34d399', width: 1.5 },
    label: {
      formatter: `Goal: ${formatCurrency(goalTarget, locale, currency)}`,
      position: 'insideEndBottom' as const,
      fontSize: 11,
      fontWeight: 600 as const,
      color: '#34d399',
      fontFamily: "'DM Sans', sans-serif",
    },
    data: [{ yAxis: goalTarget }],
  };
}

export interface ProjectionChartContext {
  locale: string;
  currency: string;
  goalTarget?: number | null;
}

export function buildCompoundOptions(data: CompoundYearData[], locale: string, currency: string, goalTarget?: number | null): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));
  const todayYear = years[0];

  const markLines: any[] = [todayMarkLine(todayYear)];
  if (goalTarget && goalTarget > 0) {
    markLines.push(goalMarkLine(goalTarget, locale, currency));
  }

  return {
    tooltip: baseTooltip(locale, currency),
    legend: { ...legendStyle, data: ['Net Worth', 'Assets', 'Liabilities'], bottom: 0 },
    grid: baseGrid,
    xAxis: baseXAxis(years),
    yAxis: baseYAxis(locale, currency),
    series: [
      {
        name: 'Net Worth',
        type: 'line',
        data: data.map((d) => d.netWorth),
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: data.length <= 20,
        itemStyle: { color: '#60a5fa', borderWidth: 2, borderColor: '#fff' },
        lineStyle: { color: '#60a5fa', width: 2.5 },
        emphasis: {
          itemStyle: { borderWidth: 3, shadowBlur: 8, shadowColor: 'rgba(96,165,250,0.4)' },
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(96,165,250,0.15)' },
              { offset: 1, color: 'rgba(96,165,250,0.02)' },
            ],
          },
        },
        markLine: markLines[0],
        z: 3,
      },
      {
        name: 'Assets',
        type: 'line',
        data: data.map((d) => d.assets),
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#34d399' },
        lineStyle: { color: '#34d399', type: 'dashed', width: 1.5, opacity: 0.7 },
        emphasis: { lineStyle: { width: 2.5, opacity: 1 } },
        z: 1,
      },
      {
        name: 'Liabilities',
        type: 'line',
        data: data.map((d) => d.liabilities),
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#f87171' },
        lineStyle: { color: '#f87171', type: 'dashed', width: 1.5, opacity: 0.7 },
        emphasis: { lineStyle: { width: 2.5, opacity: 1 } },
        ...(markLines.length > 1 ? { markLine: markLines[1] } : {}),
        z: 1,
      },
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut',
  };
}

export function buildScenarioOptions(data: ScenarioYearData[], locale: string, currency: string, goalTarget?: number | null): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));
  const todayYear = years[0];

  // Build the band between optimistic and pessimistic
  const pessimisticValues = data.map((d) => d.pessimistic.netWorth);
  const bandValues = data.map((d) => d.optimistic.netWorth - d.pessimistic.netWorth);

  const markLines: any[] = [todayMarkLine(todayYear)];
  if (goalTarget && goalTarget > 0) {
    markLines.push(goalMarkLine(goalTarget, locale, currency));
  }

  return {
    tooltip: {
      ...tooltipBase,
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; color: string }>;
        if (!items?.length) return '';
        const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
        const visible = items.filter((p) => p.seriesName !== '_band-base' && p.seriesName !== 'Range');
        let html = `<div style="font-weight:600;margin-bottom:4px">${year}</div>`;
        for (const p of visible) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${p.seriesName}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${formatCurrency(p.value, locale, currency)}</span></div>`;
        }
        return html;
      },
    },
    legend: { ...legendStyle, data: ['Optimistic', 'Base', 'Pessimistic'], bottom: 0 },
    grid: baseGrid,
    xAxis: baseXAxis(years),
    yAxis: baseYAxis(locale, currency),
    series: [
      // Band base (pessimistic, invisible — anchors the band)
      {
        name: '_band-base',
        type: 'line',
        data: pessimisticValues,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        stack: 'scenario-band',
        symbol: 'none',
        tooltip: { show: false },
      },
      // Band fill (optimistic - pessimistic)
      {
        name: 'Range',
        type: 'line',
        data: bandValues,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { color: 'rgba(96,165,250,0.12)' },
        areaStyle: { color: 'rgba(96,165,250,0.12)' },
        stack: 'scenario-band',
        symbol: 'none',
        tooltip: { show: false },
      },
      // Optimistic line
      {
        name: 'Optimistic',
        type: 'line',
        data: data.map((d) => d.optimistic.netWorth),
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#34d399' },
        lineStyle: { color: '#34d399', width: 1.5, type: 'dashed', opacity: 0.8 },
        emphasis: { lineStyle: { width: 2.5, opacity: 1 } },
        z: 2,
      },
      // Base case line (primary)
      {
        name: 'Base',
        type: 'line',
        data: data.map((d) => d.base.netWorth),
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: data.length <= 20,
        itemStyle: { color: '#60a5fa', borderWidth: 2, borderColor: '#fff' },
        lineStyle: { color: '#60a5fa', width: 2.5 },
        emphasis: {
          itemStyle: { borderWidth: 3, shadowBlur: 8, shadowColor: 'rgba(96,165,250,0.4)' },
        },
        markLine: markLines[0],
        ...(markLines.length > 1 ? {} : {}),
        z: 3,
      },
      // Pessimistic line
      {
        name: 'Pessimistic',
        type: 'line',
        data: data.map((d) => d.pessimistic.netWorth),
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#f87171' },
        lineStyle: { color: '#f87171', width: 1.5, type: 'dashed', opacity: 0.8 },
        emphasis: { lineStyle: { width: 2.5, opacity: 1 } },
        ...(markLines.length > 1 ? { markLine: markLines[1] } : {}),
        z: 2,
      },
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut',
  };
}

export function buildMonteCarloOptions(data: MonteCarloYearData[], locale: string, currency: string, goalTarget?: number | null): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));
  const todayYear = years[0];

  // Band series use stack trick: lower bound hidden, upper bound shows area
  const p10 = data.map((d) => d.p10);
  const p25 = data.map((d) => d.p25);
  const p50 = data.map((d) => d.p50);
  const p75 = data.map((d) => d.p75);
  const p90 = data.map((d) => d.p90);

  // For bands we render: p10 (transparent), p90-p10 (outer band), p25 (transparent), p75-p25 (inner band)
  const outerBand = data.map((d, i) => d.p90 - p10[i]);
  const innerBand = data.map((d, i) => d.p75 - p25[i]);

  const markLines: any[] = [todayMarkLine(todayYear)];
  if (goalTarget && goalTarget > 0) {
    markLines.push(goalMarkLine(goalTarget, locale, currency));
  }

  return {
    tooltip: {
      ...tooltipBase,
      trigger: 'axis' as const,
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number }>;
        if (!items?.length) return '';
        const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
        const point = data[parseInt(year) - data[0].year];
        if (!point) return '';
        const row = (label: string, value: number, color: string) => {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>`;
          return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot}${label}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${formatCurrency(value, locale, currency)}</span></div>`;
        };
        return `<div style="font-weight:600;margin-bottom:4px">${year}</div>`
          + row('P90', point.p90, 'rgba(96,165,250,0.3)')
          + row('P75', point.p75, 'rgba(96,165,250,0.5)')
          + row('P50 (median)', point.p50, '#60a5fa')
          + row('P25', point.p25, 'rgba(96,165,250,0.5)')
          + row('P10', point.p10, 'rgba(96,165,250,0.3)');
      },
    },
    legend: { ...legendStyle, data: ['P50 Median', 'P25–P75', 'P10–P90'], bottom: 0 },
    grid: baseGrid,
    xAxis: baseXAxis(years),
    yAxis: baseYAxis(locale, currency),
    series: [
      // Outer band base (P10, invisible)
      {
        name: 'P10–P90',
        type: 'line',
        data: p10,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        stack: 'outer',
        symbol: 'none',
        legendHoverLink: false,
      },
      // Outer band fill (P90 - P10)
      {
        name: 'P10–P90',
        type: 'line',
        data: outerBand,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { color: 'rgba(96,165,250,0.15)' },
        areaStyle: { color: 'rgba(96,165,250,0.15)' },
        stack: 'outer',
        symbol: 'none',
        legendHoverLink: false,
      },
      // Inner band base (P25, invisible)
      {
        name: 'P25–P75',
        type: 'line',
        data: p25,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        stack: 'inner',
        symbol: 'none',
        legendHoverLink: false,
      },
      // Inner band fill (P75 - P25)
      {
        name: 'P25–P75',
        type: 'line',
        data: innerBand,
        smooth: true,
        lineStyle: { opacity: 0 },
        itemStyle: { color: 'rgba(96,165,250,0.3)' },
        areaStyle: { color: 'rgba(96,165,250,0.3)' },
        stack: 'inner',
        symbol: 'none',
        legendHoverLink: false,
      },
      // P50 median line
      {
        name: 'P50 Median',
        type: 'line',
        data: p50,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: data.length <= 20,
        itemStyle: { color: '#60a5fa', borderWidth: 2, borderColor: '#fff' },
        lineStyle: { color: '#60a5fa', width: 2.5 },
        emphasis: {
          itemStyle: { borderWidth: 3, shadowBlur: 8, shadowColor: 'rgba(96,165,250,0.4)' },
        },
        markLine: markLines[0],
        z: 10,
      },
      // Invisible series just to carry the goal markLine
      ...(markLines.length > 1 ? [{
        name: '_goal',
        type: 'line' as const,
        data: [],
        markLine: markLines[1],
        tooltip: { show: false },
      }] : []),
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut',
  };
}
