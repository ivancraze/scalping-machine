import { useEffect, useMemo, useRef, useState } from 'react';
import { useCorrelationsQuery, useMarketQuery, type MarketRow } from '../../../entities/market';
import { compactUsd as compact, percentage as rate } from '../../../shared/lib/format';
import { selectMarketRows, sortMark, type SortKey } from '../lib/market-list';
import { Chart } from '../../../widgets/chart';
import styles from './MarketTerminalPage.module.scss';

const EMPTY_MARKET: MarketRow[] = [];
const EMPTY_CORRELATIONS: Record<string, number> = {};

export default function MarketTerminalPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortKey>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const marketListRef = useRef<HTMLDivElement>(null);
  const marketQuery = useMarketQuery();
  const market = marketQuery.data ?? EMPTY_MARKET;
  const selected = market.find((x) => x.symbol === symbol);

  useEffect(() => {
    if (marketListRef.current) marketListRef.current.scrollTop = 0;
  }, [query, sorting, sortDirection]);

  const correlationSymbols = useMemo(
    () =>
      market
        .filter((row) => row.symbol.includes(query.toUpperCase()))
        .slice(0, 30)
        .map((row) => row.symbol),
    [market, query],
  );
  const correlationsQuery = useCorrelationsQuery(
    correlationSymbols,
    sorting === 'correlation' && correlationSymbols.length > 0,
  );
  const correlations = correlationsQuery.data ?? EMPTY_CORRELATIONS;
  const rows = useMemo(
    () => selectMarketRows(market, query, sorting, sortDirection, correlations),
    [correlations, market, query, sortDirection, sorting],
  );
  const toggleSort = (key: SortKey) => {
    if (sorting === key) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSorting(key);
      setSortDirection(key === 'symbol' ? 'asc' : 'desc');
    }
  };
  const changeSymbol = (next: string) => {
    setSymbol(next);
    setQuery('');
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
        <Chart symbol={symbol} selected={selected} />
        <aside className={styles['market-pane']}>
          <div className={styles['market-controls']}>
            <button className={styles.exchange} title="Binance USD-M · бессрочные USDT-фьючерсы">
              ● Binance Futures⌄
            </button>
            <button>Пресеты⌄</button>
            <label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск монеты" />⌄
            </label>
            <button>☷</button>
            <button>⟳</button>
          </div>
          <div className={styles['market-head']}>
            <button onClick={() => toggleSort('symbol')}>
              ♧ ⌑ Монета{sortMark('symbol', sorting, sortDirection)}
            </button>
            <button onClick={() => toggleSort('volume')}>
              Объём 24ч{sortMark('volume', sorting, sortDirection)}
            </button>
            <button onClick={() => toggleSort('change')}>
              Цена 24ч{sortMark('change', sorting, sortDirection)}
            </button>
            <button onClick={() => toggleSort('natr')}>
              Вол 24ч{sortMark('natr', sorting, sortDirection)}
            </button>
            <button
              onClick={() => toggleSort('correlation')}
              title="Сортировка использует только рассчитанные значения; остальные монеты в конце списка"
              aria-describedby="correlation-limit"
            >
              Корр 24ч{sortMark('correlation', sorting, sortDirection)}
            </button>
          </div>
          <div className={styles['market-summary']}>
            <span role="status">
              Показано {rows.length} из {market.length}
            </span>
            <span id="correlation-limit" title="Сортировка использует только рассчитанные значения">
              Корреляция: расчёт ограничен 30 монетами
            </span>
          </div>
          <div className={styles['market-list']} ref={marketListRef}>
            {query && rows.length === 0 && <p className={styles['empty-list']}>Монеты не найдены</p>}
            {rows.map((row) => (
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
                    ? '—'
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
