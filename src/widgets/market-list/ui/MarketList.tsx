import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Tabs,
  Tooltip,
  type TableColumnsType,
  type TableRef,
} from 'antd';
import { FlagFilled, FlagOutlined, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useCorrelationsQuery, useNatrsQuery } from '../../../entities/market';
import {
  marketListSortMark,
  nextMarketListSortState,
  selectCorrelationSymbols,
  selectMarketRows,
  useMarketListControls,
  type MarketListSortKey,
} from '../../../features/market-list-controls';
import { compactUsd as compact, percentage as rate } from '../../../shared/lib/format';
import { MIN_CORRELATION_VOLUME } from '../model/constants';
import type { MarketListProps, MarketTableRow } from '../model/types';
import styles from './MarketList.module.scss';

const EMPTY_CORRELATIONS: Record<string, number> = {};

export function MarketList({ market, selectedSymbol, onSymbolChange }: MarketListProps) {
  const {
    query,
    setQuery,
    sorting,
    setSorting,
    sortDirection,
    setSortDirection,
    activeTab,
    setActiveTab,
    favoriteSymbols,
    toggleFavorite,
  } = useMarketListControls();
  const [viewport, setViewport] = useState({ width: 520, height: 400 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<TableRef>(null);

  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0 });
  }, [activeTab, favoriteSymbols, query, sorting, sortDirection]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    const header = tableRef.current?.nativeElement.querySelector('thead');
    const measure = () => {
      const width = container.clientWidth;
      const headerHeight = header?.getBoundingClientRect().height ?? 38;
      const height = Math.max(80, container.clientHeight - headerHeight - 12);
      setViewport((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (header) observer.observe(header);
    measure();
    return () => observer.disconnect();
  }, []);

  const visibleMarket = useMemo(
    () => (activeTab === 'favorites' ? market.filter((row) => favoriteSymbols.has(row.symbol)) : market),
    [activeTab, favoriteSymbols, market],
  );
  const correlationSymbols = useMemo(
    () => selectCorrelationSymbols(visibleMarket, MIN_CORRELATION_VOLUME),
    [visibleMarket],
  );
  const correlationsQuery = useCorrelationsQuery(correlationSymbols, correlationSymbols.length > 0);
  const correlations = correlationsQuery.data ?? EMPTY_CORRELATIONS;
  const natrsQuery = useNatrsQuery(correlationSymbols, correlationSymbols.length > 0);
  const natrs = natrsQuery.data ?? EMPTY_CORRELATIONS;
  const rows = useMemo(
    () =>
      selectMarketRows(visibleMarket, query, sorting, sortDirection, correlations, natrs, favoriteSymbols),
    [correlations, favoriteSymbols, natrs, query, sortDirection, sorting, visibleMarket],
  );
  const tableRows = useMemo<MarketTableRow[]>(() => {
    const eligible = new Set(correlationSymbols);
    return rows.map((row) => ({
      ...row,
      correlation: correlations[row.symbol],
      correlationLoading: correlationsQuery.isFetching && eligible.has(row.symbol),
      natr5m14: natrs[row.symbol],
      natr5m14Loading: natrsQuery.isFetching && eligible.has(row.symbol),
    }));
  }, [rows, correlations, correlationsQuery.isFetching, correlationSymbols, natrs, natrsQuery.isFetching]);

  const columns = useMemo<TableColumnsType<MarketTableRow>>(() => {
    const header = (key: MarketListSortKey, label: string) => ({
      key,
      title: (
        <Button
          type="text"
          className={styles['sort-button']}
          aria-label={`Сортировать: ${label}`}
          aria-describedby={key === 'correlation' ? 'correlation-limit' : undefined}
          onClick={() => {
            const next = nextMarketListSortState({ sorting, sortDirection }, key);
            setSorting(next.sorting);
            setSortDirection(next.sortDirection);
          }}
        >
          <span>{label}</span>
          {sorting === key && (
            <span className={styles['sort-mark']} aria-hidden="true">
              {marketListSortMark(key, sorting, sortDirection)}
            </span>
          )}
        </Button>
      ),
      onHeaderCell: () => ({
        'aria-sort':
          sorting === key
            ? sortDirection === 'asc'
              ? ('ascending' as const)
              : ('descending' as const)
            : ('none' as const),
      }),
    });
    return [
      {
        ...header('favorite', ' '),
        width: 44,
        align: 'center',
        render: (_, row) => {
          const isFavorite = favoriteSymbols.has(row.symbol);
          return (
            <Button
              type="text"
              className={styles['favorite-button']}
              icon={isFavorite ? <FlagFilled /> : <FlagOutlined />}
              aria-label={
                isFavorite ? `Убрать ${row.symbol} из закладок` : `Добавить ${row.symbol} в закладки`
              }
              aria-pressed={isFavorite}
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(row.symbol);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            />
          );
        },
      },
      {
        ...header('symbol', 'Монета'),
        width: 100,
        dataIndex: 'symbol',
        render: (symbol: string) => symbol.replace('USDT', ''),
      },
      {
        ...header('volume', 'Vol 24'),
        width: 56,
        align: 'right',
        render: (_, row) => <span className={styles.gold}>{compact(row.volume)}$</span>,
      },
      {
        ...header('change', 'Цена 24'),
        width: 70,
        align: 'right',
        render: (_, row) => (
          <span className={row.change >= 0 ? styles.green : styles.red}>{rate(row.change)}</span>
        ),
      },
      {
        ...header('natr', 'Вол. 24'),
        width: 60,
        align: 'right',
        render: (_, row) => `${row.natr.toFixed(2)}%`,
      },
      {
        ...header('natr5m14', 'NATR 5/14'),
        width: 60,
        align: 'right',
        render: (_, row) =>
          row.natr5m14 === undefined ? (
            row.natr5m14Loading ? (
              <Spin size="small" aria-label="Расчёт NATR 5м (14)" />
            ) : (
              '—'
            )
          ) : (
            `${row.natr5m14.toFixed(2)}%`
          ),
      },
      {
        ...header('correlation', 'Корр. BTC'),
        width: 58,
        align: 'right',
        render: (_, row) =>
          row.correlation === undefined ? (
            row.correlationLoading ? (
              <Spin size="small" aria-label="Расчёт корреляции" />
            ) : (
              '—'
            )
          ) : (
            <span className={row.correlation >= 0 ? styles.green : styles.red}>
              {(row.correlation * 100).toFixed(1)}%
            </span>
          ),
      },
    ];
  }, [favoriteSymbols, setSortDirection, setSorting, sortDirection, sorting, toggleFavorite]);

  const changeSymbol = (symbol: string) => {
    onSymbolChange(symbol);
    setQuery('');
  };

  return (
    <aside className={styles['market-pane']} aria-label="Список монет">
      <Tabs
        className={styles.tabs}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'futures' | 'favorites')}
        items={[
          { key: 'futures', label: 'Фьючерсы' },
          { key: 'favorites', label: `Закладки${favoriteSymbols.size ? ` (${favoriteSymbols.size})` : ''}` },
        ]}
      />
      <div className={styles['market-controls']}>
        <Tooltip title="Binance USD-M · бессрочные USDT-фьючерсы">
          <Tag color="gold">Binance Futures</Tag>
        </Tooltip>
        <Input
          aria-label="Поиск монеты"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск монеты"
          prefix={<SearchOutlined />}
          allowClear
        />
        <Space size={4}>
          <Tooltip title="Пресеты и фильтры — пока недоступны">
            <Button disabled icon={<FilterOutlined />} aria-label="Пресеты и фильтры" />
          </Tooltip>
          <Tooltip title="Ручное обновление — пока недоступно">
            <Button disabled icon={<ReloadOutlined />} aria-label="Обновить список" />
          </Tooltip>
        </Space>
      </div>
      <div className={styles['market-summary']}>
        <span role="status">
          Показано {rows.length} из {visibleMarket.length}
        </span>
        <span id="correlation-limit">Корреляция: пары с оборотом ≥ $50M за 24ч</span>
      </div>
      <div className={styles['table-viewport']} ref={viewportRef}>
        <Table<MarketTableRow>
          ref={tableRef}
          className={styles.table}
          columns={columns}
          dataSource={tableRows}
          rowKey="symbol"
          pagination={false}
          virtual
          size="small"
          scroll={{ x: viewport.width, y: viewport.height, scrollToFirstRowOnChange: false }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={query ? 'Монеты не найдены' : 'Нет данных о монетах'}
              />
            ),
          }}
          rowClassName={(row) => (row.symbol === selectedSymbol ? styles['selected-row'] : '')}
          onRow={(row) => ({
            role: 'row',
            tabIndex: 0,
            'aria-selected': row.symbol === selectedSymbol,
            onClick: () => changeSymbol(row.symbol),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                changeSymbol(row.symbol);
              }
            },
          })}
        />
      </div>
    </aside>
  );
}
