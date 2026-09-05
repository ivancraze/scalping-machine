import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Candle } from '../../../entities/market';
import { CandleStats } from './CandleStats';

describe('CandleStats', () => {
  it('renders real OHLCV fields from a candle', () => {
    const candle: Candle = [1_757_030_400_000, '100', '110', '90', '105', '1250000'];

    const markup = renderToStaticMarkup(<CandleStats candle={candle} />);

    expect(markup).toContain('ОТКР <strong>100</strong>');
    expect(markup).toContain('МАКС <strong>110</strong>');
    expect(markup).toContain('МИН <strong>90.000</strong>');
    expect(markup).toContain('ЗАКР <strong>105</strong>');
    expect(markup).toContain('Объём <strong>1M</strong>');
  });

  it('renders placeholders while the candle is unavailable', () => {
    const markup = renderToStaticMarkup(<CandleStats />);

    expect(markup.match(/—/g)).toHaveLength(5);
  });
});
