import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { useGridNatrsQuery, type MarketRow } from '../../../entities/market';
import {
  selectGridMarkets,
  useMarketGridControls,
  type MarketGridColumns,
  type MarketGridFilters,
  type MarketGridMode,
  type MarketGridPresetDraft,
  type MarketGridSettings,
  type MarketGridSortField,
  type MarketGridTechnicalDataMode,
  type MarketGridTimeframe,
  type MarketGridView,
} from '../../../features/market-grid-controls';
import { useMarketListControls } from '../../../features/market-list-controls';
import { MarketChartCard } from '../../../widgets/chart/grid';
import styles from './MarketGridPage.module.scss';

const TIMEFRAMES: MarketGridTimeframe[] = ['1м', '5м', '15м', '1ч', '4ч', '1д'];
const EXTRA_TIMEFRAMES: MarketGridTimeframe[] = ['3м', '30м'];
const ALL_TIMEFRAMES = [...TIMEFRAMES, ...EXTRA_TIMEFRAMES];
const GRID_ROW_HEIGHT = 368;
const GRID_OVERSCAN_ROWS = 1;
const EMPTY_NATRS: Record<string, number> = {};
const VIEW_OPTIONS: Array<{ label: string; value: MarketGridView }> = [
  { label: 'Все', value: 'all' },
  { label: 'Закладки', value: 'favorites' },
  { label: 'Рост', value: 'gainers' },
  { label: 'Падение', value: 'losers' },
  { label: 'Кол-во сделок', value: 'active' },
];
const SORT_OPTIONS: Array<{ label: string; value: MarketGridSortField }> = [
  { label: 'Оборот 24ч', value: 'volume' },
  { label: 'Изменение 24ч', value: 'change' },
  { label: 'Модуль изменения', value: 'absoluteChange' },
  { label: 'Диапазон 24ч', value: 'range' },
  { label: 'Количество сделок', value: 'trades' },
  { label: 'NATR 5м/14', value: 'natr' },
];

export default function MarketGridPage({
  market,
  onOpenMainChart,
}: {
  market: MarketRow[];
  onOpenMainChart: (symbol: string, timeframe: MarketGridTimeframe) => void;
}) {
  const { settings, updateSettings, setSymbolTimeframe, selectPreset, savePreset, deleteActivePreset } =
    useMarketGridControls();
  const { favoriteSymbols, toggleFavorite } = useMarketListControls();
  const latestMarketRef = useRef(market);
  const viewportRef = useRef<HTMLElement>(null);
  const [marketSnapshot, setMarketSnapshot] = useState(market);
  const [viewport, setViewport] = useState({ width: 1200, height: 720, scrollTop: 0 });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<MarketGridPresetDraft>(() => draftFromSettings(settings));

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

  const settingsNeedNatr =
    settings.sortField === 'natr' || settings.filters.minNatr !== null || settings.filters.maxNatr !== null;
  const draftNeedsNatr =
    filtersOpen &&
    (draftPreset.sortField === 'natr' ||
      draftPreset.filters.minNatr !== null ||
      draftPreset.filters.maxNatr !== null);
  const needsNatr = settingsNeedNatr || draftNeedsNatr;
  const natrSymbols = useMemo(() => {
    const appliedSymbols = selectGridMarkets(
      marketSnapshot,
      '',
      settings.view,
      { ...settings.filters, minNatr: null, maxNatr: null },
      favoriteSymbols,
      {
        sortField: settingsNeedNatr ? 'volume' : settings.sortField,
        sortDirection: settingsNeedNatr ? 'desc' : settings.sortDirection,
        limit: settingsNeedNatr ? 100 : settings.limit,
        blacklist: settings.blacklist,
      },
    ).map(({ symbol }) => symbol);
    if (!draftNeedsNatr) return appliedSymbols;

    const draftSymbols = selectGridMarkets(
      marketSnapshot,
      '',
      draftPreset.view,
      { ...draftPreset.filters, minNatr: null, maxNatr: null },
      favoriteSymbols,
      {
        sortField: 'volume',
        sortDirection: 'desc',
        limit: 100,
        blacklist: draftPreset.blacklist,
      },
    ).map(({ symbol }) => symbol);
    return [...new Set([...appliedSymbols, ...draftSymbols])];
  }, [draftNeedsNatr, draftPreset, favoriteSymbols, marketSnapshot, settings, settingsNeedNatr]);
  const natrsQuery = useGridNatrsQuery(natrSymbols, natrSymbols.length > 0);
  const natrs = natrsQuery.data ?? EMPTY_NATRS;
  const rows = useMemo(
    () =>
      selectGridMarkets(marketSnapshot, query, settings.view, settings.filters, favoriteSymbols, {
        sortField: settings.sortField,
        sortDirection: settings.sortDirection,
        limit: settings.limit,
        blacklist: settings.blacklist,
        natrs,
      }),
    [
      favoriteSymbols,
      marketSnapshot,
      natrs,
      query,
      settings.blacklist,
      settings.filters,
      settings.limit,
      settings.sortDirection,
      settings.sortField,
      settings.view,
    ],
  );
  const previewMatches = useMemo(
    () =>
      selectGridMarkets(marketSnapshot, '', draftPreset.view, draftPreset.filters, favoriteSymbols, {
        sortField: draftPreset.sortField,
        sortDirection: draftPreset.sortDirection,
        limit: 1_000,
        blacklist: draftPreset.blacklist,
        natrs,
      }),
    [draftPreset, favoriteSymbols, marketSnapshot, natrs],
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
  const activePresetIndex = settings.presets.findIndex(({ id }) => id === settings.activePresetId);
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
        scaleLabelsVisible={settings.scaleLabelsVisible}
        technicalDataMode={settings.technicalDataMode}
        natr={natrs[row.symbol]}
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
        <Button
          aria-label="Предыдущий сохранённый фильтр"
          disabled={activePresetIndex <= 0}
          onClick={() => {
            selectPreset(settings.presets[activePresetIndex - 1].id);
            resetPosition();
          }}
        >
          ‹
        </Button>
        <Select
          className={styles.presets}
          value={settings.activePresetId ?? undefined}
          placeholder="Сохранённые фильтры"
          aria-label="Сохранённый фильтр"
          options={settings.presets.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={(id) => {
            selectPreset(id);
            resetPosition();
          }}
        />
        <Button
          aria-label="Следующий сохранённый фильтр"
          disabled={activePresetIndex < 0 || activePresetIndex >= settings.presets.length - 1}
          onClick={() => {
            selectPreset(settings.presets[activePresetIndex + 1].id);
            resetPosition();
          }}
        >
          ›
        </Button>
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
          className={styles['view-select']}
          value={settings.view}
          aria-label="Представление сетки"
          options={VIEW_OPTIONS}
          popupMatchSelectWidth={200}
          virtual={false}
          onChange={(view) => {
            updateSettings({
              view,
              sortField:
                view === 'active' ? 'trades' : view === 'gainers' || view === 'losers' ? 'change' : 'volume',
              sortDirection: view === 'losers' ? 'asc' : 'desc',
            });
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
        <Select<MarketGridTimeframe>
          className={styles['extra-timeframes']}
          value={EXTRA_TIMEFRAMES.includes(settings.timeframe) ? settings.timeframe : undefined}
          placeholder="Ещё"
          aria-label="Дополнительный общий таймфрейм"
          options={EXTRA_TIMEFRAMES.map((value) => ({ value, label: value }))}
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
          <Switch
            size="small"
            checked={settings.scaleLabelsVisible}
            onChange={(scaleLabelsVisible) => updateSettings({ scaleLabelsVisible })}
            aria-label="Показывать подписи шкал"
          />
          <span>Шкалы</span>
        </Space>
        <Segmented<MarketGridTechnicalDataMode>
          value={settings.technicalDataMode}
          aria-label="Режим технических данных"
          options={[
            { label: 'Кратко', value: 'compact' },
            { label: 'Подробно', value: 'detailed' },
          ]}
          onChange={(technicalDataMode) => updateSettings({ technicalDataMode })}
        />
        <Button
          icon={<FilterOutlined />}
          aria-label="Фильтры сетки"
          onClick={() => {
            setDraftPreset(draftFromSettings(settings));
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
          const scrollRow = Math.floor(scrollTop / GRID_ROW_HEIGHT);
          setViewport((current) =>
            Math.floor(current.scrollTop / GRID_ROW_HEIGHT) === scrollRow
              ? current
              : { ...current, scrollTop: scrollRow * GRID_ROW_HEIGHT },
          );
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
        width={720}
        footer={[
          settings.activePresetId && (
            <Button
              key="delete"
              danger
              onClick={() => {
                deleteActivePreset();
                setFiltersOpen(false);
              }}
            >
              Удалить пресет
            </Button>
          ),
          <Button key="cancel" onClick={() => setFiltersOpen(false)}>
            Отмена
          </Button>,
          <Button
            key="apply"
            onClick={() => {
              applyDraft(updateSettings, draftPreset);
              resetPosition();
              setFiltersOpen(false);
            }}
          >
            Применить без сохранения
          </Button>,
          <Button
            key="save"
            type="primary"
            disabled={!draftPreset.name.trim()}
            onClick={() => {
              savePreset({ ...draftPreset, name: draftPreset.name.trim() });
              resetPosition();
              setFiltersOpen(false);
            }}
          >
            Сохранить пресет
          </Button>,
        ]}
      >
        <div className={styles.filters}>
          <label>
            <span>Название пресета</span>
            <Input
              value={draftPreset.name}
              maxLength={40}
              placeholder="Например, Импульсные"
              onChange={(event) => setDraftPreset((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>Представление</span>
            <Select<MarketGridView>
              value={draftPreset.view}
              options={VIEW_OPTIONS}
              onChange={(view) => setDraftPreset((current) => ({ ...current, view }))}
            />
          </label>
          <label>
            <span>Сортировка</span>
            <div className={styles['sort-control']}>
              <Select<MarketGridSortField>
                className={styles['sort-field']}
                value={draftPreset.sortField}
                options={SORT_OPTIONS}
                onChange={(sortField) => setDraftPreset((current) => ({ ...current, sortField }))}
              />
              <Button
                className={styles['sort-direction']}
                type={draftPreset.sortDirection === 'desc' ? 'primary' : 'default'}
                aria-label="По убыванию"
                onClick={() => setDraftPreset((current) => ({ ...current, sortDirection: 'desc' }))}
              >
                ↓
              </Button>
              <Button
                className={styles['sort-direction']}
                type={draftPreset.sortDirection === 'asc' ? 'primary' : 'default'}
                aria-label="По возрастанию"
                onClick={() => setDraftPreset((current) => ({ ...current, sortDirection: 'asc' }))}
              >
                ↑
              </Button>
            </div>
          </label>
          <label>
            <span>Лимит карточек</span>
            <InputNumber
              min={1}
              max={100}
              value={draftPreset.limit}
              onChange={(limit) =>
                setDraftPreset((current) => ({ ...current, limit: limit ?? current.limit }))
              }
            />
          </label>
          <label>
            <span>Стартовый таймфрейм</span>
            <Select<MarketGridTimeframe>
              value={draftPreset.timeframe}
              options={ALL_TIMEFRAMES.map((value) => ({ value, label: value }))}
              onChange={(timeframe) => setDraftPreset((current) => ({ ...current, timeframe }))}
            />
          </label>
          <FilterField
            label="Минимальный объём 24ч, USDT"
            filters={draftPreset.filters}
            value={draftPreset.filters.minVolume}
            field="minVolume"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Максимальный объём 24ч, USDT"
            filters={draftPreset.filters}
            value={draftPreset.filters.maxVolume}
            field="maxVolume"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Минимум сделок 24ч"
            filters={draftPreset.filters}
            value={draftPreset.filters.minTrades}
            field="minTrades"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Максимум сделок 24ч"
            filters={draftPreset.filters}
            value={draftPreset.filters.maxTrades}
            field="maxTrades"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Изменение 24ч от, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.minChange}
            field="minChange"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Изменение 24ч до, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.maxChange}
            field="maxChange"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Диапазон 24ч от, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.minRange}
            field="minRange"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="Диапазон 24ч до, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.maxRange}
            field="maxRange"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="NATR 5м/14 от, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.minNatr}
            field="minNatr"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <FilterField
            label="NATR 5м/14 до, %"
            filters={draftPreset.filters}
            value={draftPreset.filters.maxNatr}
            field="maxNatr"
            onChange={(filters) => setDraftPreset((current) => ({ ...current, filters }))}
          />
          <label>
            <span>Чёрный список, тикеры через запятую</span>
            <Input.TextArea
              rows={2}
              value={draftPreset.blacklist.join(', ')}
              onChange={(event) =>
                setDraftPreset((current) => ({
                  ...current,
                  blacklist: parseBlacklist(event.target.value),
                }))
              }
            />
          </label>
          <div className={styles.preview}>
            <strong>{previewMatches.length} монет</strong>
            <span>
              {previewMatches
                .slice(0, Math.min(draftPreset.limit, 8))
                .map(({ symbol }) => symbol.replace('USDT', ''))
                .join(' · ') || 'Нет подходящих карточек'}
            </span>
            {needsNatr && <small>NATR рассчитывается для 100 крупнейших контрактов по обороту.</small>}
          </div>
        </div>
      </Modal>
    </main>
  );
}

function FilterField({
  label,
  filters,
  value,
  field,
  onChange,
}: {
  label: string;
  filters: MarketGridFilters;
  value: number | null;
  field: keyof MarketGridFilters;
  onChange: (filters: MarketGridFilters) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <InputNumber
        value={value}
        min={
          field.includes('Volume') ||
          field.includes('Trades') ||
          field.includes('Range') ||
          field.includes('Natr')
            ? 0
            : undefined
        }
        onChange={(next) => onChange({ ...filters, [field]: next })}
      />
    </label>
  );
}

function draftFromSettings(settings: MarketGridSettings): MarketGridPresetDraft {
  return {
    name: settings.presets.find(({ id }) => id === settings.activePresetId)?.name ?? '',
    view: settings.view,
    filters: settings.filters,
    sortField: settings.sortField,
    sortDirection: settings.sortDirection,
    limit: settings.limit,
    timeframe: settings.timeframe,
    blacklist: settings.blacklist,
  };
}

function applyDraft(
  updateSettings: (patch: Partial<MarketGridSettings>) => void,
  draft: MarketGridPresetDraft,
) {
  updateSettings({
    view: draft.view,
    filters: draft.filters,
    sortField: draft.sortField,
    sortDirection: draft.sortDirection,
    limit: draft.limit,
    timeframe: draft.timeframe,
    blacklist: draft.blacklist,
    activePresetId: null,
    symbolTimeframes: {},
  });
}

function parseBlacklist(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .map((item) => (item.endsWith('USDT') ? item : `${item}USDT`)),
    ),
  ];
}
