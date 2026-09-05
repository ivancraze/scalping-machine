import type { LineToolType } from 'lightweight-charts-line-tools-core';
export type ChartTool = LineToolType | null;

export type ChartPalette = {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
};
