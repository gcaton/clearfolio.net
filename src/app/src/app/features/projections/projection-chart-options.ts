import type { EChartsOption } from 'echarts';
import { CompoundYearData, ScenarioYearData, MonteCarloYearData } from '../../core/api/models';

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

const baseGrid = { left: 70, right: 20, top: 20, bottom: 40 };

const baseTooltip = {
  trigger: 'axis' as const,
  axisPointer: { type: 'shadow' as const },
  formatter: (params: unknown) => {
    const items = params as Array<{ seriesName: string; value: number; marker: string }>;
    if (!items?.length) return '';
    const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
    const lines = items.map((p) => `${p.marker} ${p.seriesName}: <strong>${formatCurrency(p.value)}</strong>`);
    return `<div style="font-size:0.8125rem"><strong>Year ${year}</strong><br/>${lines.join('<br/>')}</div>`;
  },
};

export function buildCompoundOptions(data: CompoundYearData[]): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));
  return {
    tooltip: baseTooltip,
    legend: { data: ['Net Worth', 'Assets', 'Liabilities'], bottom: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: years },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => formatCurrency(v) },
    },
    series: [
      {
        name: 'Net Worth',
        type: 'line',
        data: data.map((d) => d.netWorth),
        smooth: true,
        itemStyle: { color: '#60a5fa' },
        lineStyle: { color: '#60a5fa', width: 2 },
      },
      {
        name: 'Assets',
        type: 'line',
        data: data.map((d) => d.assets),
        smooth: true,
        itemStyle: { color: '#34d399' },
        lineStyle: { color: '#34d399', type: 'dashed', width: 2 },
      },
      {
        name: 'Liabilities',
        type: 'line',
        data: data.map((d) => d.liabilities),
        smooth: true,
        itemStyle: { color: '#f87171' },
        lineStyle: { color: '#f87171', type: 'dashed', width: 2 },
      },
    ],
  };
}

export function buildScenarioOptions(data: ScenarioYearData[]): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));
  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; marker: string }>;
        if (!items?.length) return '';
        const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
        const visible = items.filter((p) => p.seriesName !== 'Band');
        const lines = visible.map((p) => `${p.marker} ${p.seriesName}: <strong>${formatCurrency(p.value)}</strong>`);
        return `<div style="font-size:0.8125rem"><strong>Year ${year}</strong><br/>${lines.join('<br/>')}</div>`;
      },
    },
    legend: { data: ['Optimistic', 'Base', 'Pessimistic'], bottom: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: years },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => formatCurrency(v) },
    },
    series: [
      {
        name: 'Optimistic',
        type: 'line',
        data: data.map((d) => d.optimistic.netWorth),
        smooth: true,
        itemStyle: { color: '#34d399' },
        lineStyle: { color: '#34d399', width: 2 },
        areaStyle: { color: 'rgba(52,211,153,0.08)' },
        stack: undefined,
      },
      {
        name: 'Base',
        type: 'line',
        data: data.map((d) => d.base.netWorth),
        smooth: true,
        itemStyle: { color: '#60a5fa' },
        lineStyle: { color: '#60a5fa', width: 2.5 },
      },
      {
        name: 'Pessimistic',
        type: 'line',
        data: data.map((d) => d.pessimistic.netWorth),
        smooth: true,
        itemStyle: { color: '#f87171' },
        lineStyle: { color: '#f87171', width: 2 },
        areaStyle: { color: 'rgba(248,113,113,0.08)' },
      },
    ],
  };
}

export function buildMonteCarloOptions(data: MonteCarloYearData[]): EChartsOption {
  if (!data?.length) return {};
  const years = data.map((d) => String(d.year));

  // Band series use stack trick: lower bound hidden, upper bound shows area
  const p10 = data.map((d) => d.p10);
  const p25 = data.map((d) => d.p25);
  const p50 = data.map((d) => d.p50);
  const p75 = data.map((d) => d.p75);
  const p90 = data.map((d) => d.p90);

  // For bands we render: p10 (transparent), p90-p10 (outer band), p25 (transparent), p75-p25 (inner band)
  const outerBand = data.map((d, i) => d.p90 - p10[i]);
  const innerBand = data.map((d, i) => d.p75 - p25[i]);

  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; marker: string }>;
        if (!items?.length) return '';
        const year = (params as Array<{ axisValueLabel: string }>)[0].axisValueLabel;
        const point = data[parseInt(year) - data[0].year];
        if (!point) return '';
        return `<div style="font-size:0.8125rem">
          <strong>Year ${year}</strong><br/>
          P90: <strong>${formatCurrency(point.p90)}</strong><br/>
          P75: <strong>${formatCurrency(point.p75)}</strong><br/>
          P50 (median): <strong>${formatCurrency(point.p50)}</strong><br/>
          P25: <strong>${formatCurrency(point.p25)}</strong><br/>
          P10: <strong>${formatCurrency(point.p10)}</strong>
        </div>`;
      },
    },
    legend: { data: ['P50 Median', 'P25–P75', 'P10–P90'], bottom: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: years },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => formatCurrency(v) },
    },
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
        itemStyle: { color: '#60a5fa' },
        lineStyle: { color: '#60a5fa', width: 2.5 },
        symbol: 'none',
        z: 10,
      },
    ],
  };
}
