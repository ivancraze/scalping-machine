import { Button, Menu, Space, Tag, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { ThemeSwitch } from '../../../features/theme-switch';
import { useSelectedMarketSymbol } from '../../../features/select-market-symbol';
import { useMarketQuery, type MarketRow } from '../../../entities/market';
import { Chart } from '../../../widgets/chart';
import { MarketList } from '../../../widgets/market-list';
import styles from './MarketTerminalPage.module.scss';

const EMPTY_MARKET: MarketRow[] = [];

export default function MarketTerminalPage() {
  const { symbol, setSymbol } = useSelectedMarketSymbol();
  const marketQuery = useMarketQuery();
  const market = marketQuery.data ?? EMPTY_MARKET;
  const selected = market.find((x) => x.symbol === symbol);

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
