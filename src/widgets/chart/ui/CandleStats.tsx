import type { Candle } from '../../../entities/market';
import { compactUsd, displayPrice } from '../../../shared/lib/format';

const displayCandlePrice = (value: string | undefined) =>
  value === undefined ? '—' : displayPrice(Number(value));

export function CandleStats({ candle }: { candle?: Candle }) {
  const [, open, high, low, close, volume] = candle ?? [];

  return (
    <>
      <span>
        ОТКР <strong>{displayCandlePrice(open)}</strong>
      </span>
      <span>
        МАКС <strong>{displayCandlePrice(high)}</strong>
      </span>
      <span>
        МИН <strong>{displayCandlePrice(low)}</strong>
      </span>
      <span>
        ЗАКР <strong>{displayCandlePrice(close)}</strong>
      </span>
      <span>
        Объём <strong>{volume === undefined ? '—' : compactUsd(Number(volume))}</strong>
      </span>
    </>
  );
}
