// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultMarketGridSettings, saveMarketGridSettings } from './storage';
import type { MarketGridPreset } from './types';
import { useMarketGridControls, type MarketGridPresetDraft } from './use-market-grid-controls';

const first: MarketGridPreset = {
  id: 'first',
  name: 'Оборот',
  view: 'all',
  filters: { ...defaultMarketGridSettings().filters, minVolume: 100 },
  sortField: 'volume',
  sortDirection: 'desc',
  limit: 10,
  timeframe: '5м',
  blacklist: ['XRPUSDT'],
};
const second: MarketGridPreset = {
  id: 'second',
  name: 'NATR',
  view: 'gainers',
  filters: { ...defaultMarketGridSettings().filters, minVolume: null, minNatr: 2 },
  sortField: 'natr',
  sortDirection: 'desc',
  limit: 20,
  timeframe: '30м',
  blacklist: ['DOGEUSDT'],
};

let root: Root;
let container: HTMLDivElement;
let controls!: ReturnType<typeof useMarketGridControls>;

function captureControls(next: ReturnType<typeof useMarketGridControls>) {
  controls = next;
}

function Harness({ onUpdate }: { onUpdate: typeof captureControls }) {
  const value = useMarketGridControls();
  useEffect(() => onUpdate(value), [onUpdate, value]);
  return null;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', { randomUUID: () => 'new-preset' });
  saveMarketGridSettings({
    ...defaultMarketGridSettings(),
    presets: [first, second],
    activePresetId: first.id,
    symbolTimeframes: { BTCUSDT: '1м' },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('market grid presets', () => {
  it('selects and updates an active preset, then deletes it', async () => {
    await act(() => root.render(<Harness onUpdate={captureControls} />));

    await act(() => controls.selectPreset(second.id));
    expect(controls.settings).toMatchObject({
      activePresetId: second.id,
      view: second.view,
      filters: second.filters,
      sortField: second.sortField,
      sortDirection: second.sortDirection,
      limit: second.limit,
      timeframe: second.timeframe,
      blacklist: second.blacklist,
      symbolTimeframes: {},
    });

    const updated = { ...second, name: 'NATR 2+', limit: 25 };
    await act(() => controls.savePreset(updated));
    expect(controls.settings.presets).toEqual([first, updated]);

    await act(() => controls.deleteActivePreset());
    expect(controls.settings.activePresetId).toBeNull();
    expect(controls.settings.presets).toEqual([first]);
  });

  it('detaches manual filter changes and saves them as a new preset', async () => {
    await act(() => root.render(<Harness onUpdate={captureControls} />));
    await act(() => controls.updateSettings({ limit: 7 }));
    expect(controls.settings.activePresetId).toBeNull();

    const draft: MarketGridPresetDraft = {
      ...first,
      name: 'Новый',
      limit: 7,
    };
    await act(() => controls.savePreset(draft));

    expect(controls.settings.activePresetId).toBe('new-preset');
    expect(controls.settings.presets.at(-1)).toEqual({ ...draft, id: 'new-preset' });
    expect(controls.settings.symbolTimeframes).toEqual({});
  });
});
