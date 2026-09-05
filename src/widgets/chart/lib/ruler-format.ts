export function formatRulerDuration(durationSeconds: number) {
  const totalSeconds = Math.max(0, Math.round(Math.abs(durationSeconds)));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return hours > 0 ? `${days}д ${hours}ч` : `${days}д`;
  if (hours > 0) return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`;
  if (minutes > 0) return seconds > 0 ? `${minutes}м ${seconds}с` : `${minutes}м`;
  return `${seconds}с`;
}

export function formatRulerLabel(
  startPrice: number,
  endPrice: number,
  startTimestamp: number,
  endTimestamp: number,
  formatPrice: (price: number) => string,
) {
  const priceDelta = endPrice - startPrice;
  const sign = priceDelta > 0 ? '+' : priceDelta < 0 ? '−' : '';
  const percentage = startPrice === 0 ? null : (priceDelta / startPrice) * 100;
  const percentageSign =
    percentage !== null && percentage > 0 ? '+' : percentage !== null && percentage < 0 ? '−' : '';
  const formattedPercentage =
    percentage === null ? '—' : `${percentageSign}${Math.abs(percentage).toFixed(2)}%`;

  return `${sign}${formatPrice(Math.abs(priceDelta))} · ${formattedPercentage} · ${formatRulerDuration(
    endTimestamp - startTimestamp,
  )}`;
}
