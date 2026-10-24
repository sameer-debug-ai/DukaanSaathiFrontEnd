import type { ChartOptions } from 'chart.js';
import { compactInr } from './format';

/**
 * Chart palette (validated with the dataviz validator against the app's card
 * surfaces: #ffffff light, #1b1f25 dark - all checks pass). Series colors are
 * categorical slots 1 and 2; text never wears a series color.
 */
export interface ChartColors {
  series1: string;
  series2: string;
  series1Wash: string;
  grid: string;
  axis: string;
  ink: string;
  surface: string;
}

export function chartColors(dark: boolean): ChartColors {
  return dark
    ? { series1: '#3987e5', series2: '#d95926', series1Wash: 'rgba(57,135,229,0.12)', grid: '#2c323a', axis: '#9aa5b3', ink: '#e7eaee', surface: '#1b1f25' }
    : { series1: '#2a78d6', series2: '#eb6834', series1Wash: 'rgba(42,120,214,0.10)', grid: '#e9ecf0', axis: '#6b7480', ink: '#1b1f24', surface: '#ffffff' };
}

const rupeeTick = (v: string | number) => `₹${compactInr(Number(v) / 100)}`;
const rupeeLabel = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Shared options: hairline solid grid, recessive axes, hover tooltip with a crosshair-style index mode. */
export function baseOptions(c: ChartColors, opts: { horizontal?: boolean; legend?: boolean } = {}): ChartOptions {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: c.grid, lineWidth: 1, drawTicks: false },
    border: { display: false },
    ticks: { color: c.axis, font: { size: 11 }, padding: 8, maxTicksLimit: 5, callback: rupeeTick },
  };
  const categoryAxis = {
    grid: { display: false },
    border: { color: c.grid },
    ticks: { color: c.axis, font: { size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    indexAxis: opts.horizontal ? 'y' : 'x',
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 8 } },
    plugins: {
      legend: {
        display: opts.legend ?? false,
        position: 'top',
        align: 'end',
        labels: { color: c.ink, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.ink,
        bodyColor: c.ink,
        borderColor: c.grid,
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => {
            const raw = (opts.horizontal ? ctx.parsed.x : ctx.parsed.y) ?? 0;
            return ` ${ctx.dataset.label ?? ''}: ${rupeeLabel(raw)}`;
          },
        },
      },
    },
    scales: opts.horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
  } as ChartOptions;
}
