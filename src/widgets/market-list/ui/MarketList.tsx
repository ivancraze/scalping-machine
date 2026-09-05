import { useEffect, useMemo, useRef, useState } from 'react';
import { useCorrelationsQuery } from '../../../entities/market';
import { compactUsd as compact, percentage as rate } from '../../../shared/lib/format';
import {
  nextSortState,
  selectCorrelationSymbols,
  selectMarketRows,
  sortMark,
  type SortKey,
} from '../lib/market-list';
import { MIN_CORRELATION_VOLUME } from '../model/constants';
import type { MarketListProps } from '../model/types';
import styles from './MarketList.module.scss';

const EMPTY_CORRELATIONS: Record<string, number> = {};
const ROW_HEIGHT = 34;
const ROW_OVERSCAN = 5;
const DEFAULT_VIEWPORT_HEIGHT = 680;

export function MarketList({ market, selectedSymbol, onSymbolChange }: MarketListProps) {
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const marketListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (marketListRef.current) {
      marketListRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [query, sorting, sortDirection]);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(marketListRef.current?.clientHeight ?? 0);
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  const correlationSymbols = useMemo(
    () => selectCorrelationSymbols(market, MIN_CORRELATION_VOLUME),
    [market],
  );
  const correlationsQuery = useCorrelationsQuery(correlationSymbols, correlationSymbols.length > 0);
  const correlations = correlationsQuery.data ?? EMPTY_CORRELATIONS;
  const isCorrelationLoading = correlationsQuery.isFetching;
  const rows = useMemo(
    () => selectMarketRows(market, query, sorting, sortDirection, correlations),
    [correlations, market, query, sortDirection, sorting],
  );
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_OVERSCAN);
  const lastVisibleRow = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + ROW_OVERSCAN,
  );
  const visibleRows = rows.slice(firstVisibleRow, lastVisibleRow);
  const toggleSort = (key: SortKey) => {
    const nextState = nextSortState({ sorting, sortDirection }, key);
    setSorting(nextState.sorting);
    setSortDirection(nextState.sortDirection);
  };
  const changeSymbol = (symbol: string) => {
    onSymbolChange(symbol);
    setQuery('');
  };

  return (
    <aside className={styles['market-pane']}>
      <div className={styles['market-controls']}>
        <button className={styles.exchange} title="Binance USD-M · бессрочные USDT-фьючерсы">
          ● Binance Futures⌄
        </button>
        <button>Пресеты⌄</button>
        <label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск монеты"
          />
          ⌄
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
        <button onClick={() => toggleSort('natr')}>Вол 24ч{sortMark('natr', sorting, sortDirection)}</button>
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
        <span id="correlation-limit" title="Рассчитывается сразу после загрузки списка">
          Корреляция: пары с оборотом ≥ $50M за 24ч
        </span>
      </div>
      <div
        className={styles['market-list']}
        ref={marketListRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {query && rows.length === 0 && <p className={styles['empty-list']}>Монеты не найдены</p>}
        <div style={{ height: firstVisibleRow * ROW_HEIGHT }} />
        {visibleRows.map((row) => (
          <button
            className={`${styles.row} ${row.symbol === selectedSymbol ? styles['selected-row'] : ''}`}
            onClick={() => changeSymbol(row.symbol)}
            key={row.symbol}
          >
            <span>{row.symbol.replace('USDT', '')}</span>
            <b className={styles.gold}>{compact(row.volume)}$</b>
            <strong className={row.change >= 0 ? styles.green : styles.red}>{rate(row.change)}</strong>
            <i>{row.natr.toFixed(2)}%</i>
            <em className={(correlations[row.symbol] ?? 0) >= 0 ? styles.green : styles.red}>
              {correlations[row.symbol] === undefined ? (
                isCorrelationLoading && correlationSymbols.includes(row.symbol) ? (
                  <span className={styles['correlation-loader']} aria-label="Расчёт корреляции" />
                ) : (
                  '—'
                )
              ) : (
                `${(correlations[row.symbol] * 100).toFixed(1)}%`
              )}
            </em>
          </button>
        ))}
        <div style={{ height: (rows.length - lastVisibleRow) * ROW_HEIGHT }} />
      </div>
    </aside>
  );
}
