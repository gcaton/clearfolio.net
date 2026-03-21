import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  DashboardSummary,
  TrendPoint,
  MemberComparison,

  SuperGap,
  AssetPerformance,
  DashboardGoalProjection,
} from './api/models';
import {
  buildTrendOptions,
  buildCompositionOptions,
  buildLiquidityOptions,
  buildGrowthOptions,
  buildDebtQualityOptions,
  buildMemberOptions,
  buildSuperGapOptions,
} from '../features/dashboard/chart-options';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

export interface ReportData {
  summary: DashboardSummary;
  trend: TrendPoint[];
  members: MemberComparison[];
  superGap: SuperGap[];
  assetPerformance: AssetPerformance[];
  projection: DashboardGoalProjection | null;
  scope: string;
}

type RGB = [number, number, number];
type Colors = { primary: RGB; accent: RGB; positive: RGB; negative: RGB; muted: RGB; bg: RGB };

const HEADER_HEIGHT = 28;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs>
  <path d="M64 448 C128 400, 192 380, 240 320 C280 272, 300 200, 340 160 C380 120, 420 96, 448 64 L448 448 Z" fill="url(#g)" opacity="0.15"/>
  <path d="M64 448 C128 400, 192 380, 240 320 C280 272, 300 200, 340 160 C380 120, 420 96, 448 64" stroke="url(#g)" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="448" cy="64" r="24" fill="#34d399"/>
</svg>`;

function renderLogoDataUrl(): Promise<string> {
  return new Promise((resolve) => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const blob = new Blob([LOGO_SVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

function drawPageHeader(doc: jsPDF, data: ReportData, colors: Colors, margin: number, pageWidth: number, subtitle: string, logoDataUrl: string) {
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  // Logo
  const logoSize = 14;
  const logoY = (HEADER_HEIGHT - logoSize) / 2;
  try {
    doc.addImage(logoDataUrl, 'PNG', margin, logoY, logoSize, logoSize);
  } catch {
    // fallback if logo render failed
  }
  const textX = margin + logoSize + 4;

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Clearfolio', textX, 11);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, textX, 18);

  // Period + date
  doc.text(`Period: ${formatPeriod(data.summary.period)}`, textX, 24);

  // Right side
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 220);
  doc.text('clearfolio.net', pageWidth - margin, 11, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  const scopeLabel = data.scope === 'financial' ? 'Financial Net Worth' : data.scope === 'liquid' ? 'Liquid Net Worth' : 'Total Net Worth';
  doc.text(scopeLabel, pageWidth - margin, 18, { align: 'right' });
  doc.text(
    new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    pageWidth - margin, 24, { align: 'right' },
  );
}

@Injectable({ providedIn: 'root' })
export class PdfReportService {
  async generate(data: ReportData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const colors: Colors = {
      primary: [30, 58, 95],
      accent: [52, 152, 219],
      positive: [39, 174, 96],
      negative: [231, 76, 60],
      muted: [127, 140, 141],
      bg: [245, 247, 250],
    };

    const logoDataUrl = await renderLogoDataUrl();

    const totalPages = data.assetPerformance.length > 0 ? 3 : 2;

    // ===== PAGE 1: Tables =====
    this.buildPage1(doc, data, colors, margin, contentWidth, pageWidth, logoDataUrl);
    drawFooter(doc, margin, pageWidth, pageHeight, colors.muted, 1, totalPages);

    // ===== PAGE 2: Charts =====
    doc.addPage();
    this.buildPage2(doc, data, colors, margin, contentWidth, pageWidth, logoDataUrl);
    drawFooter(doc, margin, pageWidth, pageHeight, colors.muted, 2, totalPages);

    // ===== PAGE 3: Asset Performance =====
    if (data.assetPerformance.length > 0) {
      doc.addPage();
      this.buildPage3(doc, data, colors, margin, contentWidth, pageWidth, logoDataUrl);
      drawFooter(doc, margin, pageWidth, pageHeight, colors.muted, 3, totalPages);
    }

    doc.save(`financial-summary-${data.summary.period}.pdf`);
  }

  private buildPage1(doc: jsPDF, data: ReportData, colors: Colors, margin: number, contentWidth: number, pageWidth: number, logoDataUrl: string) {
    drawPageHeader(doc, data, colors, margin, pageWidth, 'Financial Summary Report', logoDataUrl);
    let y = HEADER_HEIGHT + 6;

    // --- Key Metrics ---
    const metricBoxWidth = contentWidth / 4;
    const metrics = [
      { label: 'Net Worth', value: data.summary.netWorth },
      { label: 'Total Assets', value: data.summary.totalAssets },
      { label: 'Total Liabilities', value: data.summary.totalLiabilities },
      { label: 'Period Change', value: data.summary.netWorthChange, isChange: true },
    ];

    doc.setFillColor(...colors.bg);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

    metrics.forEach((m, i) => {
      const x = margin + i * metricBoxWidth + metricBoxWidth / 2;
      doc.setFontSize(7);
      doc.setTextColor(...colors.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, x, y + 7, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (m.isChange) {
        const val = m.value ?? 0;
        doc.setTextColor(...(val >= 0 ? colors.positive : colors.negative));
        const sign = val >= 0 ? '+' : '';
        const pct = data.summary.netWorthChangePercent;
        const pctStr = pct != null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : '';
        doc.text(`${sign}${formatCurrency(val)}${pctStr}`, x, y + 15, { align: 'center' });
      } else {
        doc.setTextColor(...colors.primary);
        doc.text(formatCurrency(m.value), x, y + 15, { align: 'center' });
      }
    });
    y += 28;

    // --- Two-column layout for breakdowns ---
    const colWidth = (contentWidth - 4) / 2;
    const leftX = margin;
    const rightX = margin + colWidth + 4;
    let leftY = y;
    let rightY = y;

    // Left column: Asset Breakdown
    leftY = drawSectionHeader(doc, 'Asset Breakdown', leftX, leftY, colWidth, colors.primary);
    if (data.summary.assetsByCategory.length > 0) {
      const total = data.summary.totalAssets;
      const assetRows = data.summary.assetsByCategory
        .sort((a, b) => b.value - a.value)
        .map((c) => [
          formatCategory(c.category),
          formatCurrency(c.value),
          total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '0%',
        ]);

      autoTable(doc, {
        startY: leftY,
        margin: { left: leftX },
        tableWidth: colWidth,
        columns: [
          { header: 'Category', dataKey: 'cat' },
          { header: 'Value', dataKey: 'val' },
          { header: '%', dataKey: 'pct' },
        ],
        body: assetRows.map(([cat, val, pct]) => ({ cat, val, pct })),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { val: { halign: 'right' }, pct: { halign: 'right' } },
        ...alignHeaders(new Set(['val', 'pct'])),
      });
      leftY = (doc as any).lastAutoTable.finalY + 4;
    }

    // Right column: Liability Breakdown
    rightY = drawSectionHeader(doc, 'Liability Breakdown', rightX, rightY, colWidth, colors.primary);
    if (data.summary.liabilitiesByCategory.length === 0) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...colors.muted);
      doc.text('No liabilities recorded', rightX, rightY + 2);
      rightY += 8;
    } else {
      const total = data.summary.totalLiabilities;
      const liabilityRows = data.summary.liabilitiesByCategory
        .sort((a, b) => b.value - a.value)
        .map((c) => [
          formatCategory(c.category),
          formatCurrency(c.value),
          total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '0%',
        ]);

      autoTable(doc, {
        startY: rightY,
        margin: { left: rightX },
        tableWidth: colWidth,
        columns: [
          { header: 'Category', dataKey: 'cat' },
          { header: 'Value', dataKey: 'val' },
          { header: '%', dataKey: 'pct' },
        ],
        body: liabilityRows.map(([cat, val, pct]) => ({ cat, val, pct })),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { val: { halign: 'right' }, pct: { halign: 'right' } },
        ...alignHeaders(new Set(['val', 'pct'])),
      });
      rightY = (doc as any).lastAutoTable.finalY + 4;
    } // end else (liabilities exist)

    // Allocation tables below liabilities in right column
    if (data.summary.liquidityBreakdown.length > 0) {
      rightY = drawSectionHeader(doc, 'Liquidity Profile', rightX, rightY, colWidth, colors.primary);
      const liqRows = data.summary.liquidityBreakdown
        .sort((a, b) => b.value - a.value)
        .map((l) => [formatCategory(l.liquidity), formatCurrency(l.value)]);
      autoTable(doc, {
        startY: rightY,
        margin: { left: rightX },
        tableWidth: colWidth,
        columns: [
          { header: 'Type', dataKey: 'type' },
          { header: 'Value', dataKey: 'val' },
        ],
        body: liqRows.map(([type, val]) => ({ type, val })),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { val: { halign: 'right' } },
        ...alignHeaders(new Set(['val'])),
      });
      rightY = (doc as any).lastAutoTable.finalY + 4;
    }

    // Growth/Defensive below assets in left column
    if (data.summary.growthBreakdown.length > 0) {
      leftY = drawSectionHeader(doc, 'Growth vs Defensive', leftX, leftY, colWidth, colors.primary);
      const growthRows = data.summary.growthBreakdown
        .sort((a, b) => b.value - a.value)
        .map((g) => [formatCategory(g.growthClass), formatCurrency(g.value)]);
      autoTable(doc, {
        startY: leftY,
        margin: { left: leftX },
        tableWidth: colWidth,
        columns: [
          { header: 'Type', dataKey: 'type' },
          { header: 'Value', dataKey: 'val' },
        ],
        body: growthRows.map(([type, val]) => ({ type, val })),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { val: { halign: 'right' } },
        ...alignHeaders(new Set(['val'])),
      });
      leftY = (doc as any).lastAutoTable.finalY + 4;
    }

    y = Math.max(leftY, rightY) + 2;

    // --- Net Worth Trend (yearly) ---
    if (data.trend.length > 1) {
      const yearly = aggregateByYear(data.trend);
      y = drawSectionHeader(doc, 'Net Worth Trend', margin, y, contentWidth, colors.primary);

      const rightCols = new Set(['assets', 'finAssets', 'liabilities', 'netWorth', 'change']);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        columns: [
          { header: 'Year', dataKey: 'year' },
          { header: 'Total Assets', dataKey: 'assets' },
          { header: 'Financial Assets', dataKey: 'finAssets' },
          { header: 'Liabilities', dataKey: 'liabilities' },
          { header: 'Net Worth', dataKey: 'netWorth' },
          { header: 'Change', dataKey: 'change' },
        ],
        body: yearly.map((row, i) => {
          const prev = i > 0 ? yearly[i - 1] : null;
          const pct = prev && prev.netWorth !== 0 ? ((row.netWorth - prev.netWorth) / Math.abs(prev.netWorth)) * 100 : null;
          const changeStr = pct == null ? '-' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
          return {
            year: row.year,
            assets: formatCurrency(row.assets),
            finAssets: formatCurrency(row.financialAssets),
            liabilities: formatCurrency(row.liabilities),
            netWorth: formatCurrency(row.netWorth),
            change: changeStr,
          };
        }),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
          assets: { halign: 'right' },
          finAssets: { halign: 'right' },
          liabilities: { halign: 'right' },
          netWorth: { halign: 'right' },
          change: { halign: 'right' },
        },
        didParseCell: (cellData: any) => {
          // Header alignment
          if (cellData.section === 'head' && rightCols.has(cellData.column.dataKey)) {
            cellData.cell.styles.halign = 'right';
          }
          // Color the change column
          if (cellData.section === 'body' && cellData.column.dataKey === 'change') {
            const text = cellData.cell.raw as string;
            if (text.startsWith('+')) cellData.cell.styles.textColor = [39, 174, 96];
            else if (text.startsWith('-')) cellData.cell.styles.textColor = [231, 76, 60];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // --- Member Comparison ---
    if (data.members.length > 1) {
      y = drawSectionHeader(doc, 'Member Comparison', margin, y, contentWidth, colors.primary);
      const memberRows = data.members.map((m) => [
        m.displayName,
        formatCurrency(m.assets),
        formatCurrency(m.liabilities),
        formatCurrency(m.netWorth),
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        columns: [
          { header: 'Member', dataKey: 'member' },
          { header: 'Assets', dataKey: 'assets' },
          { header: 'Liabilities', dataKey: 'liabilities' },
          { header: 'Net Worth', dataKey: 'netWorth' },
        ],
        body: memberRows.map(([member, assets, liabilities, netWorth]) => ({ member, assets, liabilities, netWorth })),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { assets: { halign: 'right' }, liabilities: { halign: 'right' }, netWorth: { halign: 'right' } },
        ...alignHeaders(new Set(['assets', 'liabilities', 'netWorth'])),
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // --- Goal Progress ---
    if (data.projection && data.projection.target > 0) {
      y = drawSectionHeader(doc, 'Goal Progress', margin, y, contentWidth, colors.primary);
      const p = data.projection;
      const barY = y + 2;

      doc.setFillColor(230, 230, 230);
      doc.roundedRect(margin, barY, contentWidth, 5, 1, 1, 'F');
      const progressWidth = Math.min((p.progressPercent / 100) * contentWidth, contentWidth);
      doc.setFillColor(...(p.progressPercent >= 100 ? colors.positive : colors.accent));
      doc.roundedRect(margin, barY, progressWidth, 5, 1, 1, 'F');

      doc.setFontSize(7);
      doc.setTextColor(...colors.primary);
      doc.text(`${p.progressPercent}% of ${formatCurrency(p.target)}`, margin, barY + 10);

      if (p.projectedYear) {
        doc.text(`Projected: ${p.projectedYear}`, pageWidth - margin, barY + 10, { align: 'right' });
      }
    }
  }

  private buildPage2(doc: jsPDF, data: ReportData, colors: Colors, margin: number, contentWidth: number, pageWidth: number, logoDataUrl: string) {
    drawPageHeader(doc, data, colors, margin, pageWidth, 'Charts & Visualisations', logoDataUrl);
    let y = HEADER_HEIGHT + 6;
    const pxPerMm = 6;

    const colWidth = (contentWidth - 6) / 2;
    const wideChartH = 55;  // full-width chart height in mm
    const halfChartH = 50;  // half-width chart height in mm
    const gap = 4;          // vertical gap between rows

    // --- Row 1: Net Worth Trend (full width) ---
    if (data.trend.length > 1) {
      y = drawSectionHeader(doc, 'Net Worth Trend', margin, y, contentWidth, colors.primary);
      const img = renderChart(buildTrendOptions(data.trend), contentWidth * pxPerMm, wideChartH * pxPerMm);
      if (img) {
        doc.addImage(img, 'PNG', margin, y, contentWidth, wideChartH);
        y += wideChartH + gap;
      }
    }

    // --- Row 2: Asset Composition + Liquidity Breakdown ---
    y = this.addChartRow(doc, y, margin, colWidth, halfChartH, gap, pxPerMm, colors,
      data.summary.assetsByCategory?.length > 0 ? { title: 'Asset Composition', options: buildCompositionOptions(data.summary) } : null,
      data.summary.liquidityBreakdown?.length > 0 ? { title: 'Liquidity Breakdown', options: buildLiquidityOptions(data.summary) } : null,
    );

    // --- Row 3: Growth vs Defensive + Debt Quality ---
    y = this.addChartRow(doc, y, margin, colWidth, halfChartH, gap, pxPerMm, colors,
      data.summary.growthBreakdown?.length > 0 ? { title: 'Growth vs Defensive', options: buildGrowthOptions(data.summary) } : null,
      data.summary.debtQualityBreakdown?.length > 0 ? { title: 'Debt Quality', options: buildDebtQualityOptions(data.summary) } : null,
    );

    // --- Row 4: Member Comparison + Super Gap ---
    this.addChartRow(doc, y, margin, colWidth, halfChartH, gap, pxPerMm, colors,
      data.members.length > 1 ? { title: 'Member Comparison', options: buildMemberOptions(data.members) } : null,
      data.superGap.length > 0 ? { title: 'Super Gap', options: buildSuperGapOptions(data.superGap) } : null,
    );
  }

  private addChartRow(
    doc: jsPDF, y: number, margin: number, colWidth: number, chartH: number, gap: number, pxPerMm: number, colors: Colors,
    left: { title: string; options: any } | null,
    right: { title: string; options: any } | null,
  ): number {
    if (!left && !right) return y;
    const rightX = margin + colWidth + 6;
    let drawn = false;

    if (left) {
      const headerY = drawSectionHeader(doc, left.title, margin, y, colWidth, colors.primary);
      const img = renderChart(left.options, colWidth * pxPerMm, chartH * pxPerMm);
      if (img) {
        doc.addImage(img, 'PNG', margin, headerY, colWidth, chartH);
        drawn = true;
      }
    }

    if (right) {
      const headerY = drawSectionHeader(doc, right.title, rightX, y, colWidth, colors.primary);
      const img = renderChart(right.options, colWidth * pxPerMm, chartH * pxPerMm);
      if (img) {
        doc.addImage(img, 'PNG', rightX, headerY, colWidth, chartH);
        drawn = true;
      }
    }

    return drawn ? y + 8 + chartH + gap : y;
  }

  private buildPage3(doc: jsPDF, data: ReportData, colors: Colors, margin: number, contentWidth: number, pageWidth: number, logoDataUrl: string) {
    drawPageHeader(doc, data, colors, margin, pageWidth, 'Asset Performance (YoY)', logoDataUrl);
    let y = HEADER_HEIGHT + 6;

    // Collect all years across all assets
    const allYears = new Set<string>();
    for (const asset of data.assetPerformance) {
      for (const yv of asset.years) allYears.add(yv.year);
    }
    const years = Array.from(allYears).sort();

    // Group assets by category
    const categories = new Map<string, AssetPerformance[]>();
    for (const asset of data.assetPerformance) {
      const cat = formatCategory(asset.category);
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(asset);
    }

    const rightCols = new Set([...years, 'yoy']);

    for (const [category, assets] of categories) {
      y = drawSectionHeader(doc, category, margin, y, contentWidth, colors.primary);

      const columns = [
        { header: 'Asset', dataKey: 'asset' },
        ...years.map((yr) => ({ header: yr, dataKey: yr })),
        { header: 'YoY', dataKey: 'yoy' },
      ];

      const body = assets.map((a) => {
        const row: Record<string, string> = { asset: a.label };
        let prevVal: number | null = null;
        let lastVal: number | null = null;

        for (const yr of years) {
          const yv = a.years.find((v) => v.year === yr);
          if (yv) {
            row[yr] = formatCurrency(yv.value);
            prevVal = lastVal;
            lastVal = yv.value;
          } else {
            row[yr] = '-';
          }
        }

        if (prevVal != null && lastVal != null && prevVal !== 0) {
          const pct = ((lastVal - prevVal) / Math.abs(prevVal)) * 100;
          row['yoy'] = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        } else {
          row['yoy'] = '-';
        }
        return row;
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        columns,
        body,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: false, textColor: colors.primary, fontStyle: 'bold', fontSize: 6.5 },
        columnStyles: Object.fromEntries(
          [...years, 'yoy'].map((k) => [k, { halign: 'right' as const }]),
        ),
        didParseCell: (cellData: any) => {
          if (cellData.section === 'head' && rightCols.has(cellData.column.dataKey)) {
            cellData.cell.styles.halign = 'right';
          }
          if (cellData.section === 'body' && cellData.column.dataKey === 'yoy') {
            const text = cellData.cell.raw as string;
            if (text.startsWith('+')) cellData.cell.styles.textColor = [39, 174, 96];
            else if (text.startsWith('-') && text !== '-') cellData.cell.styles.textColor = [231, 76, 60];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
  }
}

function renderChart(options: any, width: number, height: number): string | null {
  if (!options || Object.keys(options).length === 0) return null;

  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const chart = echarts.init(container);
    // Override tooltip/animation for static render
    chart.setOption({
      ...options,
      animation: false,
      tooltip: { show: false },
    });
    const dataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    chart.dispose();
    return dataUrl;
  } finally {
    document.body.removeChild(container);
  }
}

function alignHeaders(rightColumns: Set<string>) {
  return {
    didParseCell: (data: any) => {
      if (data.section === 'head' && rightColumns.has(data.column.dataKey)) {
        data.cell.styles.halign = 'right';
      }
    },
  };
}

function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number, width: number, color: [number, number, number]): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(title, x, y + 3);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x, y + 5, x + width, y + 5);
  return y + 8;
}

function drawFooter(doc: jsPDF, margin: number, pageWidth: number, pageHeight: number, mutedColor: [number, number, number], page: number, totalPages: number) {
  const footerY = pageHeight - 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedColor);
  doc.text('Clearfolio — For discussion purposes only. Not financial advice.', margin, footerY);
  doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
}

interface YearlyTrend {
  year: string;
  assets: number;
  financialAssets: number;
  liabilities: number;
  netWorth: number;
}

function aggregateByYear(trend: TrendPoint[]): YearlyTrend[] {
  // Extract year from period (e.g. CY2024-Q3 → CY 2024, FY2025 → FY 2025)
  // Take the last quarter's values for each year as the year-end snapshot
  const yearMap = new Map<string, TrendPoint>();
  for (const t of trend) {
    const match = t.period.match(/^(CY|FY)(\d{4})/);
    if (!match) continue;
    const yearKey = `${match[1]} ${match[2]}`;
    yearMap.set(yearKey, t); // last quarter wins
  }
  return Array.from(yearMap.entries()).map(([year, t]) => ({
    year,
    assets: t.assets,
    financialAssets: t.financialAssets,
    liabilities: t.liabilities,
    netWorth: t.netWorth,
  }));
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPeriod(period: string): string {
  const match = period.match(/^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/);
  if (!match) return period;
  const [, convention, year, quarter] = match;
  return quarter ? `${convention} ${year} ${quarter}` : `${convention} ${year}`;
}

function formatCategory(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
