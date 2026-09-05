import { useMemo, useState } from 'react';
import {
  mergeCandlePages,
  useCandleHistoryQuery,
  useLatestCandlesQuery,
  type Candle,
  type MarketRow,
} from '../../../entities/market';
import { ChartCanvas } from './ChartCanvas';
import { CandleStats } from './CandleStats';
import type { ChartTool } from '../model/types';
import { primaryDrawingTools, extraDrawingTools } from '../lib/drawing-tools';
import { timeframes, intervals } from '../lib/timeframes';
import { compactUsd as compact, percentage as rate } from '../../../shared/lib/format';
import styles from './Chart.module.scss';

export function Chart({ symbol, selected }: { symbol: string; selected?: MarketRow }) {
  const [timeframe, setTimeframe] = useState('1м');
  const [drawingTool, setDrawingTool] = useState<ChartTool>(null);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [inspectedCandle, setInspectedCandle] = useState<{ dataKey: string; candle: Candle } | null>(null);
  const interval = intervals[timeframe];
  const dataKey = `${symbol}:${interval}`;
  const candleHistory = useCandleHistoryQuery(symbol, interval);
  const includesCurrentEnd = Boolean(candleHistory.data?.pages.some((page) => page.reachesNewerEnd));
  const latestCandles = useLatestCandlesQuery(symbol, interval, includesCurrentEnd);
  const candles = useMemo(() => mergeCandlePages(candleHistory.data?.pages), [candleHistory.data?.pages]);
  const latestCandle = latestCandles.data?.at(-1) ?? candles.at(-1);
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
        <div className={`${styles.timeframes} ${styles['chart-timeframes']}`}>
          {timeframes.map((tf) => (
            <button
              disabled={tf.endsWith('с')}
              title={tf.endsWith('с') ? 'Секундные свечи пока недоступны' : undefined}
              className={timeframe === tf ? styles.selected : ''}
              onClick={() => setTimeframe(tf)}
              key={tf}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <aside
        className={styles['drawing-tools']}
        aria-label="Инструменты рисования"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className={drawingTool === null ? styles['tool-active'] : ''}
          onClick={() => setDrawingTool(null)}
          title="Курсор"
        >
          ↖
        </button>
        {primaryDrawingTools.map(({ tool, icon, title }) => (
          <button
            className={drawingTool === tool ? styles['tool-active'] : ''}
            onClick={() => startDrawing(tool)}
            title={title}
            key={tool}
          >
            {icon}
          </button>
        ))}
        <button onClick={() => setIsToolsOpen((current) => !current)} title="Все инструменты">
          ⋯
        </button>
        {isToolsOpen && (
          <div className={styles['drawing-tools-menu']}>
            {extraDrawingTools.map(({ tool, title }) => (
              <button
                className={drawingTool === tool ? styles['tool-active'] : ''}
                key={tool}
                onClick={() => {
                  startDrawing(tool);
                  setIsToolsOpen(false);
                }}
              >
                {title}
              </button>
            ))}
          </div>
        )}
      </aside>
      <div className={styles['asset-data']}>
        <b>Тех. данные о монете</b>
        <button>⌄</button>
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
          candles={candles}
          latestCandles={includesCurrentEnd ? (latestCandles.data ?? []) : []}
          dataKey={dataKey}
          priceTickSize={selected?.priceTickSize}
          onCandleChange={(candle) => setInspectedCandle(candle ? { dataKey, candle } : null)}
          drawingRequest={drawingRequest}
          isDrawingMenuOpen={isToolsOpen}
          tool={drawingTool}
          canLoadNewer={Boolean(candleHistory.hasPreviousPage)}
          canLoadOlder={Boolean(candleHistory.hasNextPage)}
          isLoadingNewer={candleHistory.isFetchingPreviousPage}
          isLoadingOlder={candleHistory.isFetchingNextPage}
          onLoadNewer={() => {
            if (candleHistory.hasPreviousPage && !candleHistory.isFetching)
              void candleHistory.fetchPreviousPage({ cancelRefetch: false });
          }}
          onLoadOlder={() => {
            if (candleHistory.hasNextPage && !candleHistory.isFetching)
              void candleHistory.fetchNextPage({ cancelRefetch: false });
          }}
          onDrawingComplete={() => setDrawingTool(null)}
        />
        {candleHistory.isPending && <div className={styles['query-status']}>Загрузка свечей…</div>}
        {(candleHistory.isFetchingNextPage || candleHistory.isFetchingPreviousPage) && (
          <div className={styles['query-status']}>Загрузка истории…</div>
        )}
        {(candleHistory.isError ||
          candleHistory.isFetchNextPageError ||
          candleHistory.isFetchPreviousPageError) && (
          <div className={`${styles['query-status']} ${styles['query-error']}`}>
            Не удалось загрузить свечи
            <button
              onClick={() => {
                if (candleHistory.isFetchNextPageError)
                  void candleHistory.fetchNextPage({ cancelRefetch: false });
                else if (candleHistory.isFetchPreviousPageError)
                  void candleHistory.fetchPreviousPage({ cancelRefetch: false });
                else void candleHistory.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
