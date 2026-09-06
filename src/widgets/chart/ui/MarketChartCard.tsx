import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Select, Spin, Tag, Tooltip, theme } from 'antd';
import {
  ExpandOutlined,
  FlagFilled,
  FlagOutlined,
  FullscreenOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import {
  openInterestPeriodForInterval,
  openInterestPeriodMilliseconds,
  useGridCandlesQuery,
  useGridCandleSubscription,
  useGridOpenInterestQuery,
  useGridOpenInterestSnapshotQuery,
  type MarketRow,
} from '../../../entities/market';
import type { MarketGridTimeframe } from '../../../features/market-grid-controls';
import { compactUsd, percentage } from '../../../shared/lib/format';
import type { ChartPalette } from '../model/types';
import { GridChartCanvas } from './GridChartCanvas';
import styles from './MarketChartCard.module.scss';

const INTERVALS: Record<MarketGridTimeframe, string> = {
  '1м': '1m',
  '5м': '5m',
  '15м': '15m',
  '1ч': '1h',
  '4ч': '4h',
  '1д': '1d',
};
const TIMEFRAMES = Object.keys(INTERVALS) as MarketGridTimeframe[];

type MarketChartCardProps = {
  market: MarketRow;
  timeframe: MarketGridTimeframe;
  favorite: boolean;
  volumeVisible: boolean;
  openInterestVisible: boolean;
  forceActive?: boolean;
  onTimeframeChange: (timeframe: MarketGridTimeframe) => void;
  onFavoriteChange: () => void;
  onExpand?: () => void;
  onOpenMain: () => void;
};

export const MarketChartCard = memo(function MarketChartCard({
  market,
  timeframe,
  favorite,
  volumeVisible,
  openInterestVisible,
  forceActive = false,
  onTimeframeChange,
  onFavoriteChange,
  onExpand,
  onOpenMain,
}: MarketChartCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(forceActive);
  const { token } = theme.useToken();
  const palette = useMemo<ChartPalette>(
    () => ({
      background: token.colorBgContainer,
      text: token.colorTextSecondary,
      grid: token.colorBorderSecondary,
      border: token.colorBorder,
      crosshair: token.colorTextTertiary,
    }),
    [
      token.colorBgContainer,
      token.colorBorder,
      token.colorBorderSecondary,
      token.colorTextSecondary,
      token.colorTextTertiary,
    ],
  );
  useEffect(() => {
    if (forceActive) {
      setNearViewport(true);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      rootMargin: '420px 0px',
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [forceActive]);
  const interval = INTERVALS[timeframe];
  const candlesQuery = useGridCandlesQuery(market.symbol, interval, nearViewport);
  useGridCandleSubscription(market.symbol, interval, nearViewport && Boolean(candlesQuery.data));
  const openInterestPeriod = openInterestPeriodForInterval(interval);
  const openInterestQuery = useGridOpenInterestQuery(
    market.symbol,
    openInterestPeriod,
    nearViewport && openInterestVisible,
  );
  const currentOpenInterest = useGridOpenInterestSnapshotQuery(
    market.symbol,
    market.price,
    nearViewport && openInterestVisible,
  );
  const displayedOpenInterest = useMemo(
    () => [
      ...(openInterestQuery.data ?? []),
      ...(currentOpenInterest.data ? [currentOpenInterest.data] : []),
    ],
    [currentOpenInterest.data, openInterestQuery.data],
  );

  return (
    <article ref={cardRef} className={styles.card} aria-label={`График ${market.symbol}`}>
      <header className={styles.header}>
        <Tag color="purple">{market.symbol.replace('USDT', '')}.F</Tag>
        <Select<MarketGridTimeframe>
          size="small"
          aria-label={`Таймфрейм ${market.symbol}`}
          value={timeframe}
          options={TIMEFRAMES.map((value) => ({ value, label: value }))}
          popupMatchSelectWidth={72}
          virtual={false}
          onChange={onTimeframeChange}
        />
        <div className={styles.actions}>
          <Tooltip title={favorite ? 'Убрать из закладок' : 'Добавить в закладки'}>
            <Button
              size="small"
              type="text"
              aria-label={
                favorite ? `Убрать ${market.symbol} из закладок` : `Добавить ${market.symbol} в закладки`
              }
              aria-pressed={favorite}
              icon={favorite ? <FlagFilled /> : <FlagOutlined />}
              onClick={onFavoriteChange}
            />
          </Tooltip>
          {onExpand && (
            <Tooltip title="Развернуть">
              <Button
                size="small"
                type="text"
                aria-label={`Развернуть ${market.symbol}`}
                icon={<ExpandOutlined />}
                onClick={onExpand}
              />
            </Tooltip>
          )}
          <Tooltip title="На весь экран">
            <Button
              size="small"
              type="text"
              aria-label={`На весь экран ${market.symbol}`}
              icon={<FullscreenOutlined />}
              onClick={() => void cardRef.current?.requestFullscreen().catch(() => undefined)}
            />
          </Tooltip>
          <Tooltip title="Открыть большой график">
            <Button
              size="small"
              type="text"
              aria-label={`Открыть большой график ${market.symbol}`}
              icon={<LineChartOutlined />}
              onClick={onOpenMain}
            />
          </Tooltip>
        </div>
      </header>
      <div className={styles.metrics}>
        <span>{compactUsd(market.volume)}$</span>
        <span className={market.change >= 0 ? styles.green : styles.red}>{percentage(market.change)}</span>
        <span>{compactUsd(market.trades)} сделок</span>
        <span>NATR {market.natr.toFixed(2)}%</span>
        {openInterestVisible && (
          <span>
            OI {currentOpenInterest.data ? `≈${compactUsd(currentOpenInterest.data.valueUsd)}$` : '—'}
          </span>
        )}
      </div>
      <div className={styles.chart}>
        {nearViewport ? (
          <>
            <GridChartCanvas
              palette={palette}
              candles={candlesQuery.data ?? []}
              openInterest={displayedOpenInterest}
              dataKey={`${market.symbol}:${interval}`}
              volumeVisible={volumeVisible}
              openInterestVisible={openInterestVisible}
              openInterestPeriod={openInterestPeriod.replace('m', 'м').replace('h', 'ч').replace('d', 'д')}
              openInterestPeriodMs={openInterestPeriodMilliseconds(openInterestPeriod)}
              priceTickSize={market.priceTickSize}
              currentPrice={market.price}
            />
            {candlesQuery.isError && !candlesQuery.data ? (
              <Alert
                className={styles.overlay}
                type="warning"
                showIcon
                title="Свечи недоступны"
                action={<Button onClick={() => void candlesQuery.refetch()}>Повторить</Button>}
              />
            ) : candlesQuery.isPending ? (
              <Spin className={styles.overlay} aria-label={`Загрузка графика ${market.symbol}`} />
            ) : null}
          </>
        ) : (
          <span className={styles.paused}>График приостановлен вне области просмотра</span>
        )}
      </div>
    </article>
  );
}, areCardPropsEqual);

function areCardPropsEqual(previous: MarketChartCardProps, next: MarketChartCardProps) {
  return (
    previous.market === next.market &&
    previous.timeframe === next.timeframe &&
    previous.favorite === next.favorite &&
    previous.volumeVisible === next.volumeVisible &&
    previous.openInterestVisible === next.openInterestVisible &&
    previous.forceActive === next.forceActive &&
    Boolean(previous.onExpand) === Boolean(next.onExpand)
  );
}
