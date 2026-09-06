import { Button, Space, Tag, Tooltip } from 'antd';
import { AppstoreOutlined, LineChartOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import type { MarketRow } from '../../../entities/market';
import { Chart } from '../../../widgets/chart';
import { MarketList } from '../../../widgets/market-list';
import styles from './MarketTerminalPage.module.scss';

export default function MarketTerminalPage({
  market,
  symbol,
  onSymbolChange,
  onOpenGrid,
}: {
  market: MarketRow[];
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  onOpenGrid: () => void;
}) {
  const selected = market.find((x) => x.symbol === symbol);

  return (
    <div className={styles.page}>
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
          <Tooltip title="Открыть сетку графиков">
            <Button icon={<AppstoreOutlined />} aria-label="Сетка графиков" onClick={onOpenGrid} />
          </Tooltip>
        </Space>
      </div>
      <div className={styles['terminal-body']}>
        <Chart symbol={symbol} selected={selected} />
        <MarketList market={market} selectedSymbol={symbol} onSymbolChange={onSymbolChange} />
      </div>
    </div>
  );
}
