import { describe, expect, it, vi } from 'vitest';
import { formatRulerDuration, formatRulerLabel } from '../lib/ruler-format';
import { LineToolRuler } from './ruler-tool';

vi.mock('lightweight-charts-line-tools-core', async () => {
  // Vitest resolves the package's legacy UMD `main`; production Vite uses this ESM `module` build.
  // @ts-expect-error The package does not publish declarations for its ESM subpath.
  return import('lightweight-charts-line-tools-core/dist/lightweight-charts-line-tools-core.js');
});

function createRuler(points: Array<{ timestamp: number; price: number }>) {
  return new LineToolRuler<number>(
    {} as never,
    { timeScale: () => ({}) } as never,
    {} as never,
    {} as never,
    {},
    points,
    {} as never,
  );
}

describe('ruler label', () => {
  it('formats a positive price change, percentage and duration', () => {
    expect(formatRulerLabel(100, 113.43, 1_000, 10_000, (price) => price.toFixed(2))).toBe(
      '+13.43 · +13.43% · 2ч 30м',
    );
  });

  it('formats a negative price change and ignores reversed time direction', () => {
    expect(formatRulerLabel(80_400, 76_800, 90_000, 3_600, (price) => price.toFixed(2))).toBe(
      '−3600.00 · −4.48% · 1д',
    );
  });

  it('keeps short durations compact', () => {
    expect(formatRulerDuration(155)).toBe('2м 35с');
    expect(formatRulerDuration(0)).toBe('0с');
  });

  it('uses an unavailable percentage when the starting price is zero', () => {
    expect(formatRulerLabel(0, 10, 0, 60, (price) => price.toFixed(2))).toBe('+10.00 · — · 1м');
  });
});

describe('ruler tool contract', () => {
  it('serializes two directional points and supports both rectangle creation gestures', () => {
    const points = [
      { timestamp: 120, price: 80 },
      { timestamp: 60, price: 100 },
    ];
    const ruler = createRuler(points);

    ruler.normalize();

    expect(ruler.toolType).toBe('Ruler');
    expect(ruler.pointsCount).toBe(2);
    expect(ruler.maxAnchorIndex).toBeUndefined();
    expect(ruler.supportsClickClickCreation()).toBe(true);
    expect(ruler.supportsClickDragCreation()).toBe(true);
    expect(ruler.getExportData()).toMatchObject({ toolType: 'Ruler', points });
  });
});
