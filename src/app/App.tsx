import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppstoreOutlined, TableOutlined } from '@ant-design/icons';
import { Menu, Spin } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useMarketQuery, type MarketRow } from '../entities/market';
import { useSelectedMarketSymbol } from '../features/select-market-symbol';
import { ThemeSwitch } from '../features/theme-switch';
import { saveChartTimeframe } from '../widgets/chart/timeframe';
import type { MarketGridTimeframe } from '../features/market-grid-controls';
import { queryClient } from './query-client';
import { ThemeProvider } from './ThemeProvider';
import styles from './App.module.scss';

const EMPTY_MARKET: MarketRow[] = [];
const MarketTerminalPage = lazy(() =>
  import('../pages/market-terminal').then(({ MarketTerminalPage: Page }) => ({ default: Page })),
);
const MarketGridPage = lazy(() =>
  import('../pages/market-grid').then(({ MarketGridPage: Page }) => ({ default: Page })),
);
type AppView = 'watchlist' | 'grid';

const pathForView = (view: AppView) => (view === 'grid' ? '/grid' : '/watchlist');

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const view: AppView = location.pathname === '/grid' ? 'grid' : 'watchlist';
  const { symbol, setSymbol } = useSelectedMarketSymbol();
  const market = useMarketQuery().data ?? EMPTY_MARKET;
  const openMainChart = (nextSymbol: string, timeframe: MarketGridTimeframe) => {
    setSymbol(nextSymbol);
    saveChartTimeframe(timeframe);
    void navigate('/watchlist');
  };

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>PULSE</span>
        <Menu
          className={styles.menu}
          mode="horizontal"
          selectedKeys={[view]}
          onClick={({ key }) => void navigate(pathForView(key as AppView))}
          items={[
            { key: 'watchlist', label: 'Список наблюдения', icon: <TableOutlined /> },
            { key: 'grid', label: 'Сетка', icon: <AppstoreOutlined /> },
          ]}
        />
        <ThemeSwitch />
      </nav>
      <Suspense
        fallback={
          <div className={styles.loading}>
            <Spin />
          </div>
        }
      >
        <Routes>
          <Route
            path="/watchlist"
            element={
              <MarketTerminalPage
                market={market}
                symbol={symbol}
                onSymbolChange={setSymbol}
                onOpenGrid={() => void navigate('/grid')}
              />
            }
          />
          <Route path="/grid" element={<MarketGridPage market={market} onOpenMainChart={openMainChart} />} />
          <Route path="*" element={<Navigate to="/watchlist" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
