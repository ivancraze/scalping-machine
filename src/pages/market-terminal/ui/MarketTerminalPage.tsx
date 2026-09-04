import { useEffect, useMemo, useState } from 'react';
import { getCandles, getMarket } from '../../../entities/market/api/binance';
import type { MarketRow } from '../../../entities/market/model/types';
import { ChartCanvas, type ChartTool } from '../../../widgets/chart-workspace';
import styles from './MarketTerminalPage.module.scss';

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : `${(n / 1e3).toFixed(0)}K`;
const rate = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const display = (n: number) =>
  n >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(5);
type SortKey = 'symbol' | 'change' | 'volume' | 'natr' | 'correlation';
const primaryDrawingTools: Array<{ tool: ChartTool; icon: string; title: string }> = [
  { tool: 'HorizontalLine', icon: '—', title: 'Горизонтальный уровень' },
  { tool: 'TrendLine', icon: '╱', title: 'Трендовая линия' },
  { tool: 'HorizontalRay', icon: '⇢', title: 'Горизонтальный луч' },
  { tool: 'Rectangle', icon: '□', title: 'Прямоугольник' },
];

const extraDrawingTools: Array<{ tool: ChartTool; title: string }> = [
  { tool: 'Ray', title: 'Луч' },
  { tool: 'Arrow', title: 'Стрелка' },
  { tool: 'ExtendedLine', title: 'Бесконечная линия' },
  { tool: 'VerticalLine', title: 'Вертикальная линия' },
  { tool: 'CrossLine', title: 'Крест' },
  { tool: 'Callout', title: 'Выноска' },
  { tool: 'Brush', title: 'Кисть' },
  { tool: 'Highlighter', title: 'Маркер' },
  { tool: 'Circle', title: 'Круг' },
  { tool: 'Triangle', title: 'Треугольник' },
  { tool: 'Path', title: 'Путь' },
  { tool: 'ParallelChannel', title: 'Параллельный канал' },
  { tool: 'FibRetracement', title: 'Фибо' },
  { tool: 'PriceRange', title: 'Ценовой диапазон' },
  { tool: 'LongShortPosition', title: 'Long / Short' },
  { tool: 'Text', title: 'Текст' },
  { tool: 'MarketDepth', title: 'Глубина рынка' },
];

function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  return leftVariance && rightVariance ? numerator / Math.sqrt(leftVariance * rightVariance) : null;
}

function returnsFrom(candles: Array<[number, string, string, string, string, string]>) {
  return candles.slice(1).map((candle, index) => Number(candle[4]) / Number(candles[index][4]) - 1);
}

export default function MarketTerminalPage() {
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [candles, setCandles] = useState<Array<[number, string, string, string, string, string]>>([]);
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortKey>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [correlations, setCorrelations] = useState<Record<string, number>>({});
  const [drawingTool, setDrawingTool] = useState<ChartTool>(null);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const selected = market.find((x) => x.symbol === symbol);

  useEffect(() => {
    const load = () =>
      getMarket()
        .then(setMarket)
        .catch(() => setMarket([]));
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const interval = (
      {
        '1с': '1m',
        '5с': '1m',
        '15с': '1m',
        '1м': '1m',
        '5м': '5m',
        '15м': '15m',
        '1ч': '1h',
        '4ч': '4h',
        '1д': '1d',
      } as Record<string, string>
    )[timeframe];
    getCandles(symbol, interval)
      .then(setCandles)
      .catch(() => setCandles([]));
  }, [symbol, timeframe]);
  useEffect(() => {
    if (sorting !== 'correlation' || !market.length) return;
    let cancelled = false;
    const symbols = market
      .filter((row) => row.symbol.includes(query.toUpperCase()))
      .slice(0, 30)
      .map((row) => row.symbol);
    const missing = symbols.filter((item) => item !== 'BTCUSDT' && correlations[item] === undefined);
    if (!missing.length) return;
    const load = async () => {
      const bitcoin = await getCandles('BTCUSDT', '1h');
      const btcReturns = returnsFrom(bitcoin);
      const items = await Promise.all(
        missing.map(async (item) => {
          const history = await getCandles(item, '1h');
          return [item, pearson(returnsFrom(history), btcReturns)] as const;
        }),
      );
      if (!cancelled)
        setCorrelations((current) => ({
          ...current,
          BTCUSDT: 1,
          ...Object.fromEntries(items.filter(([, value]) => value !== null)),
        }));
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [correlations, market, query, sorting]);
  const rows = useMemo(
    () =>
      market
        .filter((x) => x.symbol.includes(query.toUpperCase()))
        .sort((left, right) => {
          const modifier = sortDirection === 'asc' ? 1 : -1;
          if (sorting === 'symbol') return modifier * left.symbol.localeCompare(right.symbol);
          const leftValue =
            sorting === 'correlation'
              ? (correlations[left.symbol] ?? Number.NEGATIVE_INFINITY)
              : left[sorting];
          const rightValue =
            sorting === 'correlation'
              ? (correlations[right.symbol] ?? Number.NEGATIVE_INFINITY)
              : right[sorting];
          return modifier * (leftValue - rightValue);
        }),
    [correlations, market, query, sortDirection, sorting],
  );
  const toggleSort = (key: SortKey) => {
    if (sorting === key) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSorting(key);
      setSortDirection(key === 'symbol' ? 'asc' : 'desc');
    }
  };
  const sortMark = (key: SortKey) => (sorting === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');
  const changeSymbol = (next: string) => {
    setSymbol(next);
    setQuery('');
  };
  const startDrawing = (tool: ChartTool) => {
    setDrawingTool(tool);
    setDrawingRequest((current) => current + 1);
  };

  return (
    <div className={styles.terminal}>
      <nav className={styles['global-nav']}>
        <a className={styles.wordmark}>
          <i>◉</i> PULSE
        </a>
        <div className={styles.menu}>
          <button className={styles['menu-active']}>СПИСОК НАБЛЮДЕНИЯ</button>
        </div>
        <div className={styles['nav-actions']}>
          <button>◌</button>
          <button>▦</button>
          <button className={styles.notification}>●</button>
          <button>◉</button>
          <button>Ru⌄</button>
        </div>
      </nav>
      <div className={styles['workspace-bar']}>
        <div className={styles['pair-chip']}>
          <span>₿</span>
          <b>{symbol.replace('USDT', '')}.F</b>
          <em>✓</em>
        </div>
        <button>⟳</button>
        <button>⌁</button>
        <button>□</button>
        <div className={styles['workspace-actions']}>
          <button>▮</button>
          <button>▤</button>
          <button>▧</button>
          <button>⚙</button>
          <button>▦</button>
        </div>
      </div>
      <div className={styles['terminal-body']}>
        <section className={styles['chart-pane']}>
          <div className={styles['chart-status']}>
            <b>
              {symbol} · {timeframe}
            </b>
            <span>
              ОТКР <strong>{selected ? display(selected.price * 0.998) : '—'}</strong>
            </span>
            <span>
              МАКС <strong>{selected ? display(selected.price * 1.003) : '—'}</strong>
            </span>
            <span>
              МИН <strong>{selected ? display(selected.price * 0.994) : '—'}</strong>
            </span>
            <span>
              ЗАКР <strong>{selected ? display(selected.price) : '—'}</strong>
            </span>
            <span>
              Объём <strong>{selected ? compact(selected.volume) : '—'}</strong>
            </span>
            <div className={`${styles.timeframes} ${styles['chart-timeframes']}`}>
              {['1с', '5с', '15с', '1м', '5м', '15м', '1ч', '4ч', '1д'].map((tf) => (
                <button
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
              drawingRequest={drawingRequest}
              isDrawingMenuOpen={isToolsOpen}
              tool={drawingTool}
              onDrawingComplete={() => setDrawingTool(null)}
            />
          </div>
        </section>
        <aside className={styles['market-pane']}>
          <div className={styles['market-controls']}>
            <button className={styles.exchange}>● Binance Futures⌄</button>
            <button>Пресеты⌄</button>
            <label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск монеты" />⌄
            </label>
            <button>☷</button>
            <button>⟳</button>
          </div>
          <div className={styles['market-head']}>
            <button onClick={() => toggleSort('symbol')}>♧ ⌑ Монета{sortMark('symbol')}</button>
            <button onClick={() => toggleSort('volume')}>Объём 24ч{sortMark('volume')}</button>
            <button onClick={() => toggleSort('change')}>Цена 24ч{sortMark('change')}</button>
            <button onClick={() => toggleSort('natr')}>Вол 24ч{sortMark('natr')}</button>
            <button onClick={() => toggleSort('correlation')}>Корр 24ч{sortMark('correlation')}</button>
          </div>
          <div className={styles['market-list']}>
            {rows.slice(0, 30).map((row) => (
              <button
                className={`${styles.row} ${row.symbol === symbol ? styles['selected-row'] : ''}`}
                onClick={() => changeSymbol(row.symbol)}
                key={row.symbol}
              >
                <span>{row.symbol.replace('USDT', '')}</span>
                <b className={styles.gold}>{compact(row.volume)}$</b>
                <strong className={row.change >= 0 ? styles.green : styles.red}>{rate(row.change)}</strong>
                <i>{row.natr.toFixed(2)}%</i>
                <em className={(correlations[row.symbol] ?? 0) >= 0 ? styles.green : styles.red}>
                  {correlations[row.symbol] === undefined
                    ? '…'
                    : `${(correlations[row.symbol] * 100).toFixed(1)}%`}
                </em>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
