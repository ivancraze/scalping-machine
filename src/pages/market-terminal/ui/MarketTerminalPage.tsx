import { useEffect, useRef, useState } from 'react';
import { Button, Menu, Space, Tag, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { ThemeSwitch } from '../../../features/theme-switch';
import {
  isBinanceTickerUpdate,
  marketQueryKeys,
  useMarketQuery,
  type BinanceTickerUpdate,
  type MarketRow,
} from '../../../entities/market';
import { binanceWebSocket } from '../../../shared/api/binance-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { Chart } from '../../../widgets/chart';
import { MarketList } from '../../../widgets/market-list';
import { loadSelectedSymbol, saveSelectedSymbol } from '../lib/selected-symbol-storage';
import styles from './MarketTerminalPage.module.scss';

const EMPTY_MARKET: MarketRow[] = [];

export default function MarketTerminalPage() {
  const [symbol, setSymbol] = useState(loadSelectedSymbol);
  const queryClient = useQueryClient();
  const tickerUpdatesRef = useRef(new Map<string, BinanceTickerUpdate>());
  const updateFrameRef = useRef<number | null>(null);
  const marketQuery = useMarketQuery();
  const market = marketQuery.data ?? EMPTY_MARKET;
  const selected = market.find((x) => x.symbol === symbol);

  useEffect(() => {
    saveSelectedSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    const flushMarketUpdates = () => {
      updateFrameRef.current = null;
      const updates = tickerUpdatesRef.current;
      tickerUpdatesRef.current = new Map();
      if (updates.size === 0) return;
      queryClient.setQueryData<MarketRow[]>(marketQueryKeys.ticker(), (previous) =>
        previous?.map((row) => {
          const ticker = updates.get(row.symbol);
          if (!ticker) return row;
          const price = Number(ticker.c);
          const high = Number(ticker.h);
          const low = Number(ticker.l);
          return {
            ...row,
            price,
            change: Number(ticker.P),
            range: (high / low) * 100 - 100,
            natr: ((high - low) / price) * 100,
            trades: ticker.n,
            volume: Number(ticker.q),
          };
        }),
      );
    };
    const updateMarket = (message: unknown) => {
      if (!Array.isArray(message)) return;
      for (const ticker of message.filter(isBinanceTickerUpdate))
        tickerUpdatesRef.current.set(ticker.s, ticker);
      if (tickerUpdatesRef.current.size > 0 && updateFrameRef.current === null)
        updateFrameRef.current = requestAnimationFrame(flushMarketUpdates);
    };
    const unsubscribe = binanceWebSocket.subscribe('!ticker@arr', updateMarket, () => {
      void queryClient.invalidateQueries({ queryKey: marketQueryKeys.ticker() });
    });
    return () => {
      unsubscribe();
      if (updateFrameRef.current !== null) cancelAnimationFrame(updateFrameRef.current);
      updateFrameRef.current = null;
      tickerUpdatesRef.current.clear();
    };
  }, [queryClient]);

  return (
    <div className={styles.terminal}>
      <nav className={styles['global-nav']}>
        <span className={styles.wordmark}>PULSE</span>
        <Menu
          className={styles.menu}
          mode="horizontal"
          selectedKeys={['watchlist']}
          items={[{ key: 'watchlist', label: 'Список наблюдения', icon: <TableOutlined /> }]}
        />
        <div className={styles['nav-actions']}>
          <ThemeSwitch />
        </div>
      </nav>
      <div className={styles['workspace-bar']}>
        <Tag color="purple">{symbol.replace('USDT', '')}.F</Tag>
        <span className={styles['market-label']}>Binance USD-M · USDT Perpetual</span>
        <Space className={styles['workspace-actions']}>
          <Tooltip title="Обновление рабочего пространства — пока недоступно">
            <Button disabled icon={<ReloadOutlined />} aria-label="Обновление рабочего пространства" />
          </Tooltip>
          <Tooltip title="Дополнительные графики — пока недоступно">
            <Button disabled icon={<LineChartOutlined />} aria-label="Дополнительные графики" />
          </Tooltip>
          <Tooltip title="Настройки — пока недоступны">
            <Button disabled icon={<SettingOutlined />} aria-label="Настройки" />
          </Tooltip>
          <Tooltip title="Сетка графиков — пока недоступна">
            <Button disabled icon={<AppstoreOutlined />} aria-label="Сетка графиков" />
          </Tooltip>
        </Space>
      </div>
      <div className={styles['terminal-body']}>
        <Chart symbol={symbol} selected={selected} />
        <MarketList market={market} selectedSymbol={symbol} onSymbolChange={setSymbol} />
      </div>
    </div>
  );
}
