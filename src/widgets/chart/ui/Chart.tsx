import { useMemo, useState } from 'react';
import { Alert, Button, Dropdown, Segmented, Spin, Tooltip, theme } from 'antd';
import { AimOutlined, EllipsisOutlined } from '@ant-design/icons';
import { ResetChartObjects } from '../../../features/reset-chart-objects';
import {
  mergeCandlePages,
  useCandleHistoryQuery,
  useLiveCandleSubscription,
  useLatestCandlesQuery,
  useSecondCandlesQuery,
  type Candle,
  type MarketRow,
} from '../../../entities/market';
import { ChartCanvas } from './ChartCanvas';
import { CandleStats } from './CandleStats';
import type { ChartTool, ChartPalette } from '../model/types';
import { primaryDrawingTools, extraDrawingTools } from '../lib/drawing-tools';
import { timeframes, intervals } from '../lib/timeframes';
import { compactUsd as compact, percentage as rate } from '../../../shared/lib/format';
import styles from './Chart.module.scss';

const EMPTY_CANDLES: Candle[] = [];

export function Chart({ symbol, selected }: { symbol: string; selected?: MarketRow }) {
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
      token.colorTextSecondary,
      token.colorBorderSecondary,
      token.colorBorder,
      token.colorTextTertiary,
    ],
  );
  const [timeframe, setTimeframe] = useState('1м');
  const [drawingTool, setDrawingTool] = useState<ChartTool>(null);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [inspectedCandle, setInspectedCandle] = useState<{ dataKey: string; candle: Candle } | null>(null);
  const interval = intervals[timeframe];
  const secondsPerCandle = interval.endsWith('s') ? Number.parseInt(interval, 10) : null;
  const dataKey = `${symbol}:${interval}`;
  const lineToolsStorageScope = useMemo(
    () => ({ exchange: 'binance-usdm', symbol, interval }),
    [interval, symbol],
  );
  const candleHistory = useCandleHistoryQuery(symbol, secondsPerCandle ? '1m' : interval);
  const includesCurrentEnd = Boolean(candleHistory.data?.pages.some((page) => page.reachesNewerEnd));
  const latestCandles = useLatestCandlesQuery(symbol, secondsPerCandle ? '1m' : interval, includesCurrentEnd);
  useLiveCandleSubscription(symbol, interval, !secondsPerCandle && includesCurrentEnd);
  const secondCandles = useSecondCandlesQuery(symbol, secondsPerCandle);
  const candles = useMemo(() => mergeCandlePages(candleHistory.data?.pages), [candleHistory.data?.pages]);
  const displayedCandles = secondsPerCandle ? (secondCandles.data ?? EMPTY_CANDLES) : candles;
  const latestCandlesForCanvas =
    !secondsPerCandle && includesCurrentEnd ? (latestCandles.data ?? EMPTY_CANDLES) : EMPTY_CANDLES;
  const latestCandle = secondsPerCandle
    ? displayedCandles.at(-1)
    : (latestCandlesForCanvas.at(-1) ?? candles.at(-1));
  const displayedCandle = inspectedCandle?.dataKey === dataKey ? inspectedCandle.candle : latestCandle;
  const startDrawing = (tool: ChartTool) => {
    setDrawingTool(tool);
    setDrawingRequest((current) => current + 1);
  };

  return (
    <section className={styles['chart-pane']}>
      <div className={styles['chart-status']}>
        <b>
          {symbol} · {timeframe}
        </b>
        <CandleStats candle={displayedCandle} />
      </div>
      <div className={styles.timeframes}>
        <Segmented<string>
          aria-label="Таймфрейм"
          value={timeframe}
          onChange={setTimeframe}
          options={timeframes.map((tf) => ({
            value: tf,
            label: tf,
            tooltip: tf.endsWith('с')
              ? 'Агрегируется из последних Binance Futures aggTrade и live-потока'
              : undefined,
          }))}
        />
      </div>
      <aside
        className={styles['drawing-tools']}
        aria-label="Инструменты рисования"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Tooltip title="Курсор" placement="right">
          <Button
            type={drawingTool === null ? 'primary' : 'text'}
            onClick={() => setDrawingTool(null)}
            aria-label="Курсор"
            aria-pressed={drawingTool === null}
            icon={<AimOutlined />}
          />
        </Tooltip>
        {primaryDrawingTools.map(({ tool, icon, title }) => (
          <Tooltip key={tool} title={title} placement="right">
            <Button
              type={drawingTool === tool ? 'primary' : 'text'}
              onClick={() => startDrawing(tool)}
              aria-label={title}
              aria-pressed={drawingTool === tool}
            >
              {icon}
            </Button>
          </Tooltip>
        ))}
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          open={isToolsOpen}
          onOpenChange={setIsToolsOpen}
          destroyOnHidden
          menu={{
            items: extraDrawingTools.map(({ tool, title }) => ({ key: tool ?? '', label: title })),
            selectedKeys: drawingTool ? [drawingTool] : [],
            style: { maxHeight: 'min(490px, calc(100vh - 180px))', overflowY: 'auto' },
            onClick: ({ key }) => {
              const item = extraDrawingTools.find(({ tool }) => tool === key);
              if (item) startDrawing(item.tool);
              setIsToolsOpen(false);
            },
          }}
        >
          <Button
            type="text"
            icon={<EllipsisOutlined />}
            aria-label="Все инструменты"
            aria-expanded={isToolsOpen}
          />
        </Dropdown>
        <ResetChartObjects
          key={dataKey}
          onConfirm={() => {
            setDrawingTool(null);
            setResetRequest((current) => current + 1);
          }}
        />
      </aside>
      <div className={styles['asset-data']}>
        <b>Тех. данные о монете</b>
        <p>
          Объём (24ч): <strong>{selected ? compact(selected.volume) : '—'}$</strong>
        </p>
        <p>
          Изм цены (24ч):{' '}
          <strong className={selected && selected.change >= 0 ? styles.green : styles.red}>
            {selected ? rate(selected.change) : '—'}
          </strong>
        </p>
        <p>
          NATR (24ч): <strong>{selected ? `${selected.natr.toFixed(3)}%` : '—'}</strong>
        </p>
      </div>
      <div className={styles['main-chart']}>
        <ChartCanvas
          palette={palette}
          candles={displayedCandles}
          latestCandles={latestCandlesForCanvas}
          dataKey={dataKey}
          priceTickSize={selected?.priceTickSize}
          onCandleChange={(candle) => setInspectedCandle(candle ? { dataKey, candle } : null)}
          drawingRequest={drawingRequest}
          isDrawingMenuOpen={isToolsOpen}
          tool={drawingTool}
          canLoadNewer={Boolean(!secondsPerCandle && candleHistory.hasPreviousPage)}
          canLoadOlder={Boolean(!secondsPerCandle && candleHistory.hasNextPage)}
          isLoadingNewer={Boolean(!secondsPerCandle && candleHistory.isFetchingPreviousPage)}
          isLoadingOlder={Boolean(!secondsPerCandle && candleHistory.isFetchingNextPage)}
          onLoadNewer={() => {
            if (candleHistory.hasPreviousPage && !candleHistory.isFetching)
              void candleHistory.fetchPreviousPage({ cancelRefetch: false });
          }}
          onLoadOlder={() => {
            if (candleHistory.hasNextPage && !candleHistory.isFetching)
              void candleHistory.fetchNextPage({ cancelRefetch: false });
          }}
          onDrawingComplete={() => setDrawingTool(null)}
          lineToolsStorageScope={lineToolsStorageScope}
          resetRequest={resetRequest}
        />
        {!secondsPerCandle && candleHistory.isPending && (
          <div className={styles['query-status']} role="status">
            <Spin size="small" /> Загрузка свечей…
          </div>
        )}
        {!secondsPerCandle && (candleHistory.isFetchingNextPage || candleHistory.isFetchingPreviousPage) && (
          <div className={styles['query-status']} role="status">
            <Spin size="small" /> Загрузка истории…
          </div>
        )}
        {!secondsPerCandle &&
          (candleHistory.isError ||
            candleHistory.isFetchNextPageError ||
            candleHistory.isFetchPreviousPageError) && (
            <div className={styles['query-status']}>
              <Alert
                type="error"
                showIcon
                title="Не удалось загрузить свечи"
                action={
                  <Button
                    onClick={() => {
                      if (candleHistory.isFetchNextPageError)
                        void candleHistory.fetchNextPage({ cancelRefetch: false });
                      else if (candleHistory.isFetchPreviousPageError)
                        void candleHistory.fetchPreviousPage({ cancelRefetch: false });
                      else void candleHistory.refetch();
                    }}
                  >
                    Повторить
                  </Button>
                }
              />
            </div>
          )}
      </div>
    </section>
  );
}
