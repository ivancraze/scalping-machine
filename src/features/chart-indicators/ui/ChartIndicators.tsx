import { useState } from 'react';
import { BarChartOutlined } from '@ant-design/icons';
import { Button, Modal, Switch, Typography } from 'antd';
import type { ChartIndicatorSettings } from '../model/types';
import styles from './ChartIndicators.module.scss';

export function ChartIndicators({
  settings,
  openInterestPeriod,
  onChange,
  onReset,
}: {
  settings: ChartIndicatorSettings;
  openInterestPeriod: string;
  onChange: (settings: ChartIndicatorSettings) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon={<BarChartOutlined />} onClick={() => setOpen(true)}>
        Индикаторы
      </Button>
      <Modal title="Индикаторы" open={open} footer={null} onCancel={() => setOpen(false)} destroyOnHidden>
        <div className={styles.content}>
          <section className={styles.indicator}>
            <div className={styles.header}>
              <div>
                <Typography.Text strong>Открытый интерес · {openInterestPeriod}</Typography.Text>
                <Typography.Paragraph type="secondary" className={styles.description}>
                  Стоимость открытых позиций Binance USD-M в отдельной панели под свечами.
                </Typography.Paragraph>
              </div>
              <Switch
                aria-label="Показывать открытый интерес"
                checked={settings.openInterest.visible}
                onChange={(visible) =>
                  onChange({ ...settings, openInterest: { ...settings.openInterest, visible } })
                }
              />
            </div>
            <div className={styles.colors}>
              <label className={styles.color}>
                Цвет линии
                <input
                  type="color"
                  aria-label="Цвет открытого интереса"
                  value={settings.openInterest.color}
                  onChange={({ target }) =>
                    onChange({
                      ...settings,
                      openInterest: { ...settings.openInterest, color: target.value },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className={styles.indicator}>
            <div className={styles.header}>
              <div>
                <Typography.Text strong>Объём</Typography.Text>
                <Typography.Paragraph type="secondary" className={styles.description}>
                  Объём базового актива по свечам Binance USD-M.
                </Typography.Paragraph>
              </div>
              <Switch
                aria-label="Показывать объём"
                checked={settings.volume.visible}
                onChange={(visible) => onChange({ ...settings, volume: { ...settings.volume, visible } })}
              />
            </div>
            <div className={styles.colors}>
              <label className={styles.color}>
                Рост
                <input
                  type="color"
                  aria-label="Цвет объёма растущей свечи"
                  value={settings.volume.upColor}
                  onChange={({ target }) =>
                    onChange({ ...settings, volume: { ...settings.volume, upColor: target.value } })
                  }
                />
              </label>
              <label className={styles.color}>
                Падение
                <input
                  type="color"
                  aria-label="Цвет объёма падающей свечи"
                  value={settings.volume.downColor}
                  onChange={({ target }) =>
                    onChange({ ...settings, volume: { ...settings.volume, downColor: target.value } })
                  }
                />
              </label>
            </div>
          </section>

          <div className={styles.footer}>
            <Button onClick={onReset}>По умолчанию</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
