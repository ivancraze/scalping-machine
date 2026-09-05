import type { ILineToolsPlugin } from 'lightweight-charts-line-tools-core';

export type LineToolsStorageScope = {
  exchange: string;
  symbol: string;
};

type StoredLineTools = LineToolsStorageScope & {
  version: number;
  lineTools: unknown[];
};
type LegacyStoredLineTools = LineToolsStorageScope & {
  version: number;
  interval: string;
  lineTools: unknown[];
};
type LineToolsExporter = Pick<ILineToolsPlugin, 'exportLineTools'>;
type LineToolsImporter = Pick<ILineToolsPlugin, 'importLineTools'>;
type StorageListener = (change: { sourceId: string; lineTools: unknown[] | null }) => void;

const LINE_TOOLS_STORAGE_PREFIX = 'pulse-terminal:line-tools';
const LINE_TOOLS_STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 1;
const listeners = new Map<string, Set<StorageListener>>();

const storageKey = ({ exchange, symbol }: LineToolsStorageScope) =>
  `${LINE_TOOLS_STORAGE_PREFIX}:v${LINE_TOOLS_STORAGE_VERSION}:${exchange}:${symbol}`;

const legacyStoragePrefix = ({ exchange, symbol }: LineToolsStorageScope) =>
  `${LINE_TOOLS_STORAGE_PREFIX}:v${LEGACY_STORAGE_VERSION}:${exchange}:${symbol}:`;

const isStoredLineTools = (value: unknown, scope: LineToolsStorageScope): value is StoredLineTools =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  'exchange' in value &&
  'symbol' in value &&
  'lineTools' in value &&
  value.version === LINE_TOOLS_STORAGE_VERSION &&
  value.exchange === scope.exchange &&
  value.symbol === scope.symbol &&
  Array.isArray(value.lineTools);

const isLegacyStoredLineTools = (
  value: unknown,
  scope: LineToolsStorageScope,
): value is LegacyStoredLineTools =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  'exchange' in value &&
  'symbol' in value &&
  'interval' in value &&
  'lineTools' in value &&
  value.version === LEGACY_STORAGE_VERSION &&
  value.exchange === scope.exchange &&
  value.symbol === scope.symbol &&
  typeof value.interval === 'string' &&
  Array.isArray(value.lineTools);

const publish = (scope: LineToolsStorageScope, sourceId: string, lineTools: unknown[] | null) => {
  listeners.get(storageKey(scope))?.forEach((listener) => listener({ sourceId, lineTools }));
};

const mergeLineTools = (layouts: unknown[][]) => {
  const ids = new Set<string>();
  return layouts.flat().filter((lineTool) => {
    if (typeof lineTool !== 'object' || lineTool === null || !('id' in lineTool)) return false;
    if (typeof lineTool.id !== 'string' || ids.has(lineTool.id)) return false;
    ids.add(lineTool.id);
    return true;
  });
};

const saveState = (scope: LineToolsStorageScope, lineTools: unknown[]) => {
  const state: StoredLineTools = { ...scope, version: LINE_TOOLS_STORAGE_VERSION, lineTools };
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

const legacyLayouts = (scope: LineToolsStorageScope, preferredInterval: string) => {
  const preferred: unknown[][] = [];
  const remaining: unknown[][] = [];
  const keys: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(legacyStoragePrefix(scope))) continue;
      const rawState = localStorage.getItem(key);
      if (!rawState) continue;
      const state: unknown = JSON.parse(rawState);
      if (!isLegacyStoredLineTools(state, scope)) continue;
      (state.interval === preferredInterval ? preferred : remaining).push(state.lineTools);
      keys.push(key);
    }
  } catch {
    return { keys: [], lineTools: [] };
  }
  return { keys, lineTools: mergeLineTools([...preferred, ...remaining]) };
};

export const saveLineTools = (
  lineTools: LineToolsExporter,
  scope: LineToolsStorageScope,
  sourceId: string,
) => {
  try {
    const exportedTools: unknown = JSON.parse(lineTools.exportLineTools());
    if (!Array.isArray(exportedTools)) return;
    saveState(scope, exportedTools);
    publish(scope, sourceId, exportedTools);
  } catch {
    // The plugin can be unavailable while a chart is being destroyed.
  }
};

export const restoreLineTools = (
  lineTools: LineToolsImporter,
  scope: LineToolsStorageScope,
  preferredLegacyInterval: string,
) => {
  try {
    const rawState = localStorage.getItem(storageKey(scope));
    const state: unknown = rawState ? JSON.parse(rawState) : null;
    if (isStoredLineTools(state, scope)) {
      lineTools.importLineTools(JSON.stringify(state.lineTools));
      return;
    }
    const legacy = legacyLayouts(scope, preferredLegacyInterval);
    if (legacy.lineTools.length === 0 || !saveState(scope, legacy.lineTools)) return;
    try {
      legacy.keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      // The v2 layout has already been saved, so retain inaccessible legacy entries.
    }
    lineTools.importLineTools(JSON.stringify(legacy.lineTools));
    publish(scope, 'migration', legacy.lineTools);
  } catch {
    // Ignore malformed or obsolete saved layouts so the chart remains usable.
  }
};

export const removeSavedLineTools = (scope: LineToolsStorageScope, sourceId: string) => {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    // The visible chart has already been cleared even if browser storage is unavailable.
  }
  publish(scope, sourceId, null);
};

export const subscribeToLineTools = (scope: LineToolsStorageScope, listener: StorageListener) => {
  const key = storageKey(scope);
  const scopeListeners = listeners.get(key) ?? new Set<StorageListener>();
  scopeListeners.add(listener);
  listeners.set(key, scopeListeners);
  return () => {
    scopeListeners.delete(listener);
    if (scopeListeners.size === 0) listeners.delete(key);
  };
};
