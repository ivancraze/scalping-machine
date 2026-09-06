import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Dropdown, Segmented, Spin, Tooltip, theme, Typography } from 'antd';
import { AimOutlined, EllipsisOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { ResetChartObjects } from '../../../features/reset-chart-objects';
import { AutoLevelsPanel, useAutoLevels } from '../../../features/auto-levels';
import {
  mergeCandlePages,
  useCandleHistoryQuery,
  useLiveCandleSubscription,
  useLatestCandlesQuery,
  useNatrQuery,
  useOpenInterestQuery,
  useSecondCandlesQuery,
  useCorrelationToBtcQuery,
  type Candle,
  type MarketRow,
} from '../../../entities/market';
import { ChartCanvas } from './ChartCanvas';
import type { ChartTool, ChartPalette } from '../model/types';
import { primaryDrawingTools, extraDrawingTools } from '../lib/drawing-tools';
import { loadChartTimeframe, saveChartTimeframe } from '../lib/timeframe-storage';
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
  const [timeframe, setTimeframe] = useState(loadChartTimeframe);
  const [drawingTool, setDrawingTool] = useState<ChartTool>(null);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAssetDataExpanded, setIsAssetDataExpanded] = useState(false);
  const [selectedAutoLevelId, setSelectedAutoLevelId] = useState<string | null>(null);
  const interval = intervals[timeframe];
  const secondsPerCandle = interval.endsWith('s') ? Number.parseInt(interval, 10) : null;
  const dataKey = `${symbol}:${interval}`;
  const lineToolsStorageScope = useMemo(() => ({ exchange: 'binance-usdm', symbol }), [symbol]);
  const candleHistory = useCandleHistoryQuery(symbol, secondsPerCandle ? '1m' : interval);
  const {
    fetchNextPage: fetchOlderCandles,
    hasNextPage: hasOlderCandles,
    isFetching: isFetchingCandles,
    isFetchNextPageError: hasOlderCandlesError,
  } = candleHistory;
  const includesCurrentEnd = Boolean(candleHistory.data?.pages.some((page) => page.reachesNewerEnd));
  const latestCandles = useLatestCandlesQuery(symbol, secondsPerCandle ? '1m' : interval, includesCurrentEnd);
  useLiveCandleSubscription(symbol, interval, !secondsPerCandle && includesCurrentEnd);
  const secondCandles = useSecondCandlesQuery(symbol, secondsPerCandle);
  const correlationQuery = useCorrelationToBtcQuery(symbol, Boolean(symbol));
  const natrQuery = useNatrQuery(symbol);
  const openInterestQuery = useOpenInterestQuery(symbol);
  const candles = useMemo(() => mergeCandlePages(candleHistory.data?.pages), [candleHistory.data?.pages]);
  const displayedCandles = secondsPerCandle ? (secondCandles.data ?? EMPTY_CANDLES) : candles;
  const latestCandlesForCanvas =
    !secondsPerCandle && includesCurrentEnd ? (latestCandles.data ?? EMPTY_CANDLES) : EMPTY_CANDLES;
  const autoLevels = useAutoLevels({
    symbol,
    displayedInterval: interval,
    displayedCandles,
    displayedLatestCandles: latestCandlesForCanvas,
    displayedIncludesCurrentEnd: includesCurrentEnd,
    displayedCanLoadOlder: Boolean(candleHistory.hasNextPage),
  });
  useEffect(() => {
    if (
      !autoLevels.settings.enabled ||
      autoLevels.settings.interval !== interval ||
      secondsPerCandle ||
      candles.length > autoLevels.analysisHistorySize ||
      !hasOlderCandles ||
      isFetchingCandles ||
      hasOlderCandlesError
    )
      return;
    void fetchOlderCandles({ cancelRefetch: false });
  }, [
    autoLevels.analysisHistorySize,
    autoLevels.settings.enabled,
    autoLevels.settings.interval,
    candles.length,
    fetchOlderCandles,
    hasOlderCandles,
    hasOlderCandlesError,
    interval,
    isFetchingCandles,
    secondsPerCandle,
  ]);
  const selectedAutoLevel = autoLevels.levels.find(({ id }) => id === selectedAutoLevelId) ?? null;
  const startDrawing = (tool: ChartTool) => {
    setDrawingTool(tool);
    setDrawingRequest((current) => current + 1);
  };

  return (
    <section className={styles['chart-pane']}>
      <div className={styles['chart-panel-timeframe']}>
        <Typography.Text strong className={styles['chart-panel-timeframe-title']}>
          {symbol} · {timeframe}
        </Typography.Text>

        <div className={styles.timeframes}>
          <Segmented<string>
            aria-label="Таймфрейм"
            value={timeframe}
            onChange={(nextTimeframe) => {
              setTimeframe(nextTimeframe);
              saveChartTimeframe(nextTimeframe);
            }}
            options={timeframes.map((tf) => ({
              value: tf,
              label: tf,
              tooltip: tf.endsWith('с')
                ? 'Агрегируется из последних Binance Futures aggTrade и live-потока'
                : undefined,
            }))}
          />
        </div>
      </div>

      <div className={styles['asset-data']}>
        <div className={styles['asset-data-values']}>
          <p>
            {isAssetDataExpanded && <span>Объём (24ч)</span>}
            {isAssetDataExpanded ? (
              <strong>{selected ? `${compact(selected.volume)}$` : '—'}</strong>
            ) : (
              <Tooltip title="Объём (24ч)">
                <strong>{selected ? `${compact(selected.volume)}$` : '—'}</strong>
              </Tooltip>
            )}
          </p>
          <p>
            {isAssetDataExpanded && <span>Изменение (24ч)</span>}
            {isAssetDataExpanded ? (
              <strong className={selected && selected.change >= 0 ? styles.green : styles.red}>
                {selected ? rate(selected.change) : '—'}
              </strong>
            ) : (
              <Tooltip title="Изменение (24ч)">
                <strong className={selected && selected.change >= 0 ? styles.green : styles.red}>
                  {selected ? rate(selected.change) : '—'}
                </strong>
              </Tooltip>
            )}
          </p>
          <p>
            {isAssetDataExpanded && <span>Сделки (24ч)</span>}
            {isAssetDataExpanded ? (
              <strong>{selected ? compact(selected.trades) : '—'}</strong>
            ) : (
              <Tooltip title="Сделки (24ч)">
                <strong>{selected ? compact(selected.trades) : '—'}</strong>
              </Tooltip>
            )}
          </p>
          <p>
            {isAssetDataExpanded && <span>Корреляция BTC</span>}
            {isAssetDataExpanded ? (
              <strong
                className={
                  correlationQuery.data === null || correlationQuery.data === undefined
                    ? undefined
                    : correlationQuery.data >= 0
                      ? styles.green
                      : styles.red
                }
              >
                {correlationQuery.data === null || correlationQuery.data === undefined
                  ? '—'
                  : rate(correlationQuery.data * 100)}
              </strong>
            ) : (
              <Tooltip title="Корреляция BTC">
                <strong
                  className={
                    correlationQuery.data === null || correlationQuery.data === undefined
                      ? undefined
                      : correlationQuery.data >= 0
                        ? styles.green
                        : styles.red
                  }
                >
                  {correlationQuery.data === null || correlationQuery.data === undefined
                    ? '—'
                    : rate(correlationQuery.data * 100)}
                </strong>
              </Tooltip>
            )}
          </p>
          <p>
            {isAssetDataExpanded && <span>NATR 5м (14)</span>}
            {isAssetDataExpanded ? (
              <strong>
                {natrQuery.data === null || natrQuery.data === undefined
                  ? '—'
                  : `${natrQuery.data.toFixed(3)}%`}
              </strong>
            ) : (
              <Tooltip title="NATR 5м (14)">
                <strong>
                  {natrQuery.data === null || natrQuery.data === undefined
                    ? '—'
                    : `${natrQuery.data.toFixed(3)}%`}
                </strong>
              </Tooltip>
            )}
          </p>
          <p>
            {isAssetDataExpanded && <span>Открытый интерес (≈ USD)</span>}
            {isAssetDataExpanded ? (
              <strong>
                {openInterestQuery.data === undefined || !selected
                  ? '—'
                  : `≈${compact(openInterestQuery.data * selected.price)}$`}
              </strong>
            ) : (
              <Tooltip title="Открытый интерес">
                <strong>
                  {openInterestQuery.data === undefined || !selected
                    ? '—'
                    : `≈${compact(openInterestQuery.data * selected.price)}$`}
                </strong>
              </Tooltip>
            )}
          </p>
        </div>
        <Button
          type="text"
          className={styles['asset-data-toggle']}
          aria-label={isAssetDataExpanded ? 'Скрыть описания метрик' : 'Показать описания метрик'}
          aria-pressed={isAssetDataExpanded}
          icon={isAssetDataExpanded ? <LeftOutlined /> : <RightOutlined />}
          onClick={() => setIsAssetDataExpanded((current) => !current)}
        />
      </div>
      <div className={styles['main-chart']}>
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
          <AutoLevelsPanel
            settings={autoLevels.settings}
            levels={autoLevels.levels}
            selectedLevel={selectedAutoLevel}
            isCalculating={autoLevels.isCalculating}
            error={autoLevels.error}
            analysisUsesDisplayedInterval={autoLevels.analysisUsesDisplayedInterval}
            onSettingsChange={autoLevels.updateSettings}
            onToggleFrozen={autoLevels.toggleFrozen}
          />
          <ResetChartObjects
            key={dataKey}
            onConfirm={() => {
              setDrawingTool(null);
              setResetRequest((current) => current + 1);
            }}
          />
        </aside>
        <ChartCanvas
          palette={palette}
          candles={displayedCandles}
          latestCandles={latestCandlesForCanvas}
          dataKey={dataKey}
          priceTickSize={selected?.priceTickSize}
          onCandleChange={() => undefined}
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
          autoLevels={autoLevels.levels}
          autoLevelSettings={autoLevels.settings}
          onAutoLevelSelected={setSelectedAutoLevelId}
          onAutoLevelEdited={autoLevels.editLevel}
          onAutoLevelDeleted={autoLevels.deleteLevel}
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
