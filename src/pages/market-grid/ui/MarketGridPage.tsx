import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import type { MarketRow } from '../../../entities/market';
import {
  selectGridMarkets,
  useMarketGridControls,
  type MarketGridColumns,
  type MarketGridFilters,
  type MarketGridMode,
  type MarketGridTimeframe,
  type MarketGridView,
} from '../../../features/market-grid-controls';
import { useMarketListControls } from '../../../features/market-list-controls';
import { MarketChartCard } from '../../../widgets/chart/grid';
import styles from './MarketGridPage.module.scss';

const TIMEFRAMES: MarketGridTimeframe[] = ['1м', '5м', '15м', '1ч', '4ч', '1д'];
const GRID_ROW_HEIGHT = 368;
const GRID_OVERSCAN_ROWS = 1;
const VIEW_OPTIONS: Array<{ label: string; value: MarketGridView }> = [
  { label: 'Все', value: 'all' },
  { label: 'Закладки', value: 'favorites' },
  { label: 'Рост', value: 'gainers' },
  { label: 'Падение', value: 'losers' },
  { label: 'Активные', value: 'active' },
];

export default function MarketGridPage({
  market,
  onOpenMainChart,
}: {
  market: MarketRow[];
  onOpenMainChart: (symbol: string, timeframe: MarketGridTimeframe) => void;
}) {
  const { settings, updateSettings, setSymbolTimeframe } = useMarketGridControls();
  const { favoriteSymbols, toggleFavorite } = useMarketListControls();
  const latestMarketRef = useRef(market);
  const viewportRef = useRef<HTMLElement>(null);
  const [marketSnapshot, setMarketSnapshot] = useState(market);
  const [viewport, setViewport] = useState({ width: 1200, height: 720, scrollTop: 0 });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(settings.filters);

  useEffect(() => {
    latestMarketRef.current = market;
    if (marketSnapshot.length > 0 || market.length === 0) return;
    const timeout = window.setTimeout(() => setMarketSnapshot(market), 0);
    return () => window.clearTimeout(timeout);
  }, [market, marketSnapshot.length]);
  useEffect(() => {
    const interval = window.setInterval(() => setMarketSnapshot(latestMarketRef.current), 4_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewport((current) => ({
        ...current,
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(
    () => selectGridMarkets(marketSnapshot, query, settings.view, settings.filters, favoriteSymbols),
    [favoriteSymbols, marketSnapshot, query, settings.filters, settings.view],
  );
  const effectiveColumns = viewport.width < 1180 ? 2 : settings.columns;
  const pageSize = effectiveColumns * 2;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const totalGridRows = Math.ceil(rows.length / effectiveColumns);
  const firstVisibleRow = Math.max(0, Math.floor(viewport.scrollTop / GRID_ROW_HEIGHT) - GRID_OVERSCAN_ROWS);
  const visibleRowCount = Math.ceil(viewport.height / GRID_ROW_HEIGHT) + GRID_OVERSCAN_ROWS * 2;
  const lastVisibleRow = Math.min(totalGridRows, firstVisibleRow + visibleRowCount);
  const displayedRows =
    settings.mode === 'pages'
      ? rows.slice((safePage - 1) * pageSize, safePage * pageSize)
      : rows.slice(firstVisibleRow * effectiveColumns, lastVisibleRow * effectiveColumns);
  const expandedMarket = marketSnapshot.find(({ symbol }) => symbol === expandedSymbol);
  const resetPosition = () => {
    setPage(1);
    viewportRef.current?.scrollTo({ top: 0 });
  };
  const card = (row: MarketRow, forceActive = false) => {
    const timeframe = settings.symbolTimeframes[row.symbol] ?? settings.timeframe;
    return (
      <MarketChartCard
        key={row.symbol}
        market={row}
        timeframe={timeframe}
        favorite={favoriteSymbols.has(row.symbol)}
        volumeVisible={settings.volumeVisible}
        openInterestVisible={settings.openInterestVisible}
        forceActive={forceActive || settings.mode === 'pages'}
        onTimeframeChange={(next) => setSymbolTimeframe(row.symbol, next)}
        onFavoriteChange={() => toggleFavorite(row.symbol)}
        onExpand={forceActive ? undefined : () => setExpandedSymbol(row.symbol)}
        onOpenMain={() => onOpenMainChart(row.symbol, timeframe)}
      />
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.controls} aria-label="Настройки сетки">
        <Tag color="gold">Binance USD-M Futures</Tag>
        <Input
          className={styles.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPosition();
          }}
          prefix={<SearchOutlined />}
          placeholder="Поиск монеты"
          aria-label="Поиск монеты в сетке"
          allowClear
        />
        <Select<MarketGridView>
          value={settings.view}
          aria-label="Представление сетки"
          options={VIEW_OPTIONS}
          onChange={(view) => {
            updateSettings({ view });
            resetPosition();
          }}
        />
        <Segmented<MarketGridMode>
          value={settings.mode}
          options={[
            { label: 'Прокрутка', value: 'scroll' },
            { label: 'Страницы', value: 'pages' },
          ]}
          onChange={(mode) => {
            updateSettings({ mode });
            resetPosition();
          }}
        />
        <Segmented<MarketGridColumns>
          value={settings.columns}
          options={[2, 3, 4]}
          aria-label="Количество колонок"
          onChange={(columns) => {
            updateSettings({ columns });
            resetPosition();
          }}
        />
        <Segmented<MarketGridTimeframe>
          className={styles.timeframes}
          value={settings.timeframe}
          aria-label="Общий таймфрейм сетки"
          options={TIMEFRAMES.map((value) => ({ value, label: value }))}
          onChange={(timeframe) => updateSettings({ timeframe, symbolTimeframes: {} })}
        />
        <Space size={8} className={styles.indicators}>
          <Switch
            size="small"
            checked={settings.volumeVisible}
            onChange={(volumeVisible) => updateSettings({ volumeVisible })}
            aria-label="Показывать объём"
          />
          <span>Vol</span>
          <Switch
            size="small"
            checked={settings.openInterestVisible}
            onChange={(openInterestVisible) => updateSettings({ openInterestVisible })}
            aria-label="Показывать открытый интерес"
          />
          <span>OI</span>
        </Space>
        <Button
          icon={<FilterOutlined />}
          aria-label="Фильтры сетки"
          onClick={() => {
            setDraftFilters(settings.filters);
            setFiltersOpen(true);
          }}
        >
          Фильтры
        </Button>
      </section>

      <section
        ref={viewportRef}
        className={styles.viewport}
        onScroll={(event) => {
          const scrollTop = event.currentTarget.scrollTop;
          setViewport((current) => (current.scrollTop === scrollTop ? current : { ...current, scrollTop }));
        }}
      >
        {displayedRows.length === 0 ? (
          <Empty description="Монеты не найдены" />
        ) : settings.mode === 'scroll' ? (
          <div className={styles['virtual-space']} style={{ height: totalGridRows * GRID_ROW_HEIGHT }}>
            <div
              className={`${styles.grid} ${styles['virtual-grid']}`}
              style={
                {
                  '--grid-columns': effectiveColumns,
                  transform: `translateY(${firstVisibleRow * GRID_ROW_HEIGHT}px)`,
                } as CSSProperties
              }
              aria-live="polite"
            >
              {displayedRows.map((row) => card(row))}
            </div>
          </div>
        ) : (
          <div
            className={styles.grid}
            style={{ '--grid-columns': effectiveColumns } as CSSProperties}
            aria-live="polite"
          >
            {displayedRows.map((row) => card(row))}
          </div>
        )}
      </section>

      {settings.mode === 'pages' && rows.length > 0 && (
        <footer className={styles.pager}>
          <Pagination
            current={safePage}
            pageSize={pageSize}
            total={rows.length}
            showSizeChanger={false}
            onChange={setPage}
            showTotal={(total) => `${total} монет`}
          />
        </footer>
      )}

      <Modal
        title={expandedMarket ? `${expandedMarket.symbol.replace('USDT', '')}.F · Binance USD-M` : ''}
        open={Boolean(expandedMarket)}
        width="min(1400px, 96vw)"
        footer={null}
        destroyOnHidden
        onCancel={() => setExpandedSymbol(null)}
      >
        <div className={styles.expanded}>{expandedMarket && card(expandedMarket, true)}</div>
      </Modal>

      <Modal
        title="Фильтры сетки"
        open={filtersOpen}
        onCancel={() => setFiltersOpen(false)}
        onOk={() => {
          updateSettings({ filters: draftFilters });
          resetPosition();
          setFiltersOpen(false);
        }}
      >
        <div className={styles.filters}>
          <FilterField
            label="Минимальный объём 24ч, USDT"
            value={draftFilters.minVolume}
            field="minVolume"
            onChange={setDraftFilters}
          />
          <FilterField
            label="Минимум сделок 24ч"
            value={draftFilters.minTrades}
            field="minTrades"
            onChange={setDraftFilters}
          />
          <FilterField
            label="Изменение 24ч от, %"
            value={draftFilters.minChange}
            field="minChange"
            onChange={setDraftFilters}
          />
          <FilterField
            label="Изменение 24ч до, %"
            value={draftFilters.maxChange}
            field="maxChange"
            onChange={setDraftFilters}
          />
        </div>
      </Modal>
    </main>
  );
}

function FilterField({
  label,
  value,
  field,
  onChange,
}: {
  label: string;
  value: number | null;
  field: keyof MarketGridFilters;
  onChange: Dispatch<SetStateAction<MarketGridFilters>>;
}) {
  return (
    <label>
      <span>{label}</span>
      <InputNumber
        value={value}
        min={field === 'minVolume' || field === 'minTrades' ? 0 : undefined}
        onChange={(next) => onChange((current) => ({ ...current, [field]: next }))}
      />
    </label>
  );
}
