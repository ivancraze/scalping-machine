import type { ILineToolsPlugin } from 'lightweight-charts-line-tools-core';

export type LineToolsStorageScope = {
  exchange: string;
  symbol: string;
  interval: string;
};

type StoredLineTools = LineToolsStorageScope & {
  version: number;
  lineTools: unknown[];
};

type LineToolsExporter = Pick<ILineToolsPlugin, 'exportLineTools'>;
type LineToolsImporter = Pick<ILineToolsPlugin, 'importLineTools'>;

const LINE_TOOLS_STORAGE_PREFIX = 'pulse-terminal:line-tools';
const LINE_TOOLS_STORAGE_VERSION = 1;

const storageKey = ({ exchange, symbol, interval }: LineToolsStorageScope) =>
  `${LINE_TOOLS_STORAGE_PREFIX}:v${LINE_TOOLS_STORAGE_VERSION}:${exchange}:${symbol}:${interval}`;

export const saveLineTools = (lineTools: LineToolsExporter, scope: LineToolsStorageScope) => {
  try {
    const exportedTools: unknown = JSON.parse(lineTools.exportLineTools());
    if (!Array.isArray(exportedTools)) return;
    const state: StoredLineTools = {
      ...scope,
      version: LINE_TOOLS_STORAGE_VERSION,
      lineTools: exportedTools,
    };
    localStorage.setItem(storageKey(scope), JSON.stringify(state));
  } catch {
    // Storage can be unavailable or contain a plugin export incompatible with JSON.
  }
};

export const restoreLineTools = (lineTools: LineToolsImporter, scope: LineToolsStorageScope) => {
  try {
    const rawState = localStorage.getItem(storageKey(scope));
    if (!rawState) return;
    const state: unknown = JSON.parse(rawState);
    if (
      typeof state !== 'object' ||
      state === null ||
      !('version' in state) ||
      !('exchange' in state) ||
      !('symbol' in state) ||
      !('interval' in state) ||
      !('lineTools' in state) ||
      state.version !== LINE_TOOLS_STORAGE_VERSION ||
      state.exchange !== scope.exchange ||
      state.symbol !== scope.symbol ||
      state.interval !== scope.interval ||
      !Array.isArray(state.lineTools)
    )
      return;
    lineTools.importLineTools(JSON.stringify(state.lineTools));
  } catch {
    // Ignore malformed or obsolete saved layouts so the chart remains usable.
  }
};

export const removeSavedLineTools = (scope: LineToolsStorageScope) => {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    // The visible chart has already been cleared even if browser storage is unavailable.
  }
};
