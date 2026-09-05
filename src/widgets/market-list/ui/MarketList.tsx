import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
  type TableRef,
} from 'antd';
import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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
import type { MarketListProps, MarketTableRow } from '../model/types';
import styles from './MarketList.module.scss';

const EMPTY_CORRELATIONS: Record<string, number> = {};

export function MarketList({ market, selectedSymbol, onSymbolChange }: MarketListProps) {
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewport, setViewport] = useState({ width: 520, height: 400 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<TableRef>(null);

  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0 });
  }, [query, sorting, sortDirection]);

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

  const correlationSymbols = useMemo(
    () => selectCorrelationSymbols(market, MIN_CORRELATION_VOLUME),
    [market],
  );
  const correlationsQuery = useCorrelationsQuery(correlationSymbols, correlationSymbols.length > 0);
  const correlations = correlationsQuery.data ?? EMPTY_CORRELATIONS;
  const rows = useMemo(
    () => selectMarketRows(market, query, sorting, sortDirection, correlations),
    [correlations, market, query, sortDirection, sorting],
  );
  const tableRows = useMemo<MarketTableRow[]>(() => {
    const eligible = new Set(correlationSymbols);
    return rows.map((row) => ({
      ...row,
      correlation: correlations[row.symbol],
      correlationLoading: correlationsQuery.isFetching && eligible.has(row.symbol),
    }));
  }, [rows, correlations, correlationsQuery.isFetching, correlationSymbols]);

  const columns = useMemo<TableColumnsType<MarketTableRow>>(() => {
    const header = (key: SortKey, label: string) => ({
      key,
      title: (
        <Button
          type="text"
          className={styles['sort-button']}
          aria-label={`Сортировать: ${label}`}
          aria-describedby={key === 'correlation' ? 'correlation-limit' : undefined}
          onClick={() => {
            const next = nextSortState({ sorting, sortDirection }, key);
            setSorting(next.sorting);
            setSortDirection(next.sortDirection);
          }}
        >
          {label}
          {sortMark(key, sorting, sortDirection)}
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
        ...header('symbol', 'Монета'),
        width: 104,
        dataIndex: 'symbol',
        render: (symbol: string) => symbol.replace('USDT', ''),
      },
      {
        ...header('volume', 'Объём 24ч'),
        width: 116,
        align: 'right',
        render: (_, row) => <span className={styles.gold}>{compact(row.volume)}$</span>,
      },
      {
        ...header('change', 'Цена 24ч'),
        width: 100,
        align: 'right',
        render: (_, row) => (
          <span className={row.change >= 0 ? styles.green : styles.red}>{rate(row.change)}</span>
        ),
      },
      {
        ...header('natr', 'Вол 24ч'),
        width: 94,
        align: 'right',
        render: (_, row) => `${row.natr.toFixed(2)}%`,
      },
      {
        ...header('correlation', 'Корр 24ч'),
        width: 106,
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
  }, [sorting, sortDirection]);

  const changeSymbol = (symbol: string) => {
    onSymbolChange(symbol);
    setQuery('');
  };

  return (
    <aside className={styles['market-pane']} aria-label="Список монет">
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
          Показано {rows.length} из {market.length}
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
          scroll={{ x: Math.max(520, viewport.width), y: viewport.height, scrollToFirstRowOnChange: false }}
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
