import { PushpinOutlined, RadarChartOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, InputNumber, Popover, Select, Switch, Tooltip, Typography } from 'antd';
import type { AutoLevelSettings, DetectedAutoLevel } from '../../../entities/auto-level';
import styles from './AutoLevelsPanel.module.scss';

const intervalLabels: Record<AutoLevelSettings['interval'], string> = {
  '1m': '1 минута',
  '5m': '5 минут',
  '15m': '15 минут',
  '1h': '1 час',
  '4h': '4 часа',
  '1d': '1 день',
};

const levelKindName = (level: DetectedAutoLevel) => {
  if (level.kind === 'support') return 'горизонтальная поддержка';
  if (level.kind === 'resistance') return 'горизонтальное сопротивление';
  if (level.kind === 'trend-support') return 'трендовая поддержка';
  return 'трендовое сопротивление';
};

const breakoutDirectionName = (level: DetectedAutoLevel) =>
  level.breakoutDirection === 'up' ? 'вверх' : 'вниз';

const plural = (count: number, one: string, few: string, many: string) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

const levelTouchesName = (level: DetectedAutoLevel) => {
  if (level.kind === 'resistance')
    return `${level.touches} ${plural(level.touches, 'вершина', 'вершины', 'вершин')}`;
  if (level.kind === 'support')
    return `${level.touches} ${plural(level.touches, 'минимум', 'минимума', 'минимумов')}`;
  return `${level.touches} ${plural(level.touches, 'касание', 'касания', 'касаний')}`;
};

export function AutoLevelsPanel({
  settings,
  levels,
  selectedLevel,
  isCalculating,
  error,
  analysisUsesDisplayedInterval,
  onSettingsChange,
  onToggleFrozen,
}: {
  settings: AutoLevelSettings;
  levels: DetectedAutoLevel[];
  selectedLevel: DetectedAutoLevel | null;
  isCalculating: boolean;
  error: string | null;
  analysisUsesDisplayedInterval: boolean;
  onSettingsChange: (patch: Partial<AutoLevelSettings>) => void;
  onToggleFrozen: (id: string) => void;
}) {
  const breakoutCount = levels.filter(({ detector }) => detector === 'breakout').length;
  const extremumCount = levels.filter(({ detector }) => detector === 'extremum').length;
  const content = (
    <div className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.header}>
        <Typography.Text strong>Автоуровни</Typography.Text>
        <Switch
          aria-label="Включить автоуровни"
          checked={settings.enabled}
          onChange={(enabled) => onSettingsChange({ enabled })}
        />
      </div>
      <Typography.Paragraph className={styles.explanation} type="secondary">
        «Пробойные» требуют повторных вершин или минимумов теней и ищут кандидатов рядом с ценой. «EX»
        показывает отдельные значимые swing-экстремумы — даже с одним касанием. Луч начинается с первой
        вершины или минимума; ×N означает несколько экстремумов в одной зоне.
      </Typography.Paragraph>
      <div className={styles.legend}>
        <span>
          <i className={styles.support} /> Поддержка — цена удерживалась сверху
        </span>
        <span>
          <i className={styles.resistance} /> Сопротивление — цена удерживалась снизу
        </span>
        <Typography.Text type="secondary">
          Пробойных: {breakoutCount} · EX: {extremumCount} · пунктир — пробойный, сплошная — EX
        </Typography.Text>
      </div>
      <fieldset className={styles.settings} disabled={!settings.enabled}>
        <label>
          <span>Таймфрейм анализа</span>
          <Typography.Text>
            {intervalLabels[settings.interval]} ·{' '}
            {analysisUsesDisplayedInterval ? 'как на графике' : 'для секундного графика'}
          </Typography.Text>
        </label>
        <label>
          <span>История пробойных</span>
          <Select
            value={settings.historySize}
            options={[300, 600, 1000].map((value) => ({ value, label: value }))}
            onChange={(historySize) => onSettingsChange({ historySize })}
          />
        </label>
        <Typography.Text className={styles.sectionHeading} strong>
          Детекторы
        </Typography.Text>
        <div className={styles.types}>
          <Checkbox
            checked={settings.enabledDetectors.breakout}
            onChange={({ target }) =>
              onSettingsChange({
                enabledDetectors: { ...settings.enabledDetectors, breakout: target.checked },
              })
            }
          >
            Пробойные · повторные касания
          </Checkbox>
          <Checkbox
            checked={settings.enabledDetectors.extremum}
            onChange={({ target }) =>
              onSettingsChange({
                enabledDetectors: { ...settings.enabledDetectors, extremum: target.checked },
              })
            }
          >
            EX · swing-экстремумы
          </Checkbox>
        </div>
        <Typography.Text className={styles.sectionHeading} strong>
          Пробойные уровни
        </Typography.Text>
        <label>
          <span>Касаний от</span>
          <InputNumber
            min={2}
            max={6}
            value={settings.minTouches}
            onChange={(minTouches) => minTouches && onSettingsChange({ minTouches })}
          />
        </label>
        <label>
          <span>Зона, ±%</span>
          <InputNumber
            min={0.05}
            max={2}
            step={0.05}
            value={settings.deviationPercent}
            onChange={(deviationPercent) => deviationPercent && onSettingsChange({ deviationPercent })}
          />
        </label>
        <Checkbox
          checked={settings.nearPriceOnly}
          onChange={({ target }) => onSettingsChange({ nearPriceOnly: target.checked })}
        >
          Только уровни возле цены
        </Checkbox>
        <label>
          <span>До уровня, не более %</span>
          <InputNumber
            min={0.1}
            max={5}
            step={0.1}
            value={settings.maxDistancePercent}
            onChange={(maxDistancePercent) => maxDistancePercent && onSettingsChange({ maxDistancePercent })}
          />
        </label>
        <Typography.Text className={styles.sectionHeading} strong>
          EX · swing-экстремумы
        </Typography.Text>
        <Typography.Text type="secondary">
          Сила — сколько соседних свечей перебивает экстремум. Зона касания рассчитывается по волатильности:
          0,5–2%.
        </Typography.Text>
        <label>
          <span>Глубина поиска</span>
          <Select
            value={settings.extremumHistorySize}
            options={[200, 500, 1500].map((value) => ({ value, label: `${value} свечей` }))}
            onChange={(extremumHistorySize) => onSettingsChange({ extremumHistorySize })}
          />
        </label>
        <label>
          <span>Подтверждение</span>
          <Select
            value={settings.extremumMinTouches}
            options={[
              { value: 1, label: 'Все уровни' },
              { value: 2, label: 'От 2 касаний' },
              { value: 3, label: 'От 3 касаний' },
            ]}
            onChange={(extremumMinTouches) => onSettingsChange({ extremumMinTouches })}
          />
        </label>
        <label>
          <span>Сила уровня</span>
          <Select
            value={settings.extremumStrength}
            options={[
              { value: 'strong', label: 'Только крупные' },
              { value: 'medium', label: 'Средние' },
              { value: 'weak', label: 'Включая мелкие' },
            ]}
            onChange={(extremumStrength) => onSettingsChange({ extremumStrength })}
          />
        </label>
        <label>
          <span>Показывать</span>
          <Select
            value={settings.extremumLimit}
            options={[3, 5, 7, 10].map((value) => ({ value, label: `${value} уровней` }))}
            onChange={(extremumLimit) => onSettingsChange({ extremumLimit })}
          />
        </label>
        <Checkbox
          checked={settings.showBrokenExtremums}
          onChange={({ target }) => onSettingsChange({ showBrokenExtremums: target.checked })}
        >
          Показывать пробитые фитилём
        </Checkbox>
        <label>
          <span>Цвет EX</span>
          <input
            className={styles.color}
            type="color"
            aria-label="Цвет EX"
            value={settings.extremumColor}
            onChange={({ target }) => onSettingsChange({ extremumColor: target.value })}
          />
        </label>
        <Typography.Text className={styles.sectionHeading} strong>
          Общие настройки
        </Typography.Text>
        <div className={styles.types}>
          <Checkbox
            checked={settings.enabledTypes.support}
            onChange={({ target }) =>
              onSettingsChange({
                enabledTypes: { ...settings.enabledTypes, support: target.checked },
              })
            }
          >
            Поддержка
          </Checkbox>
          <Checkbox
            checked={settings.enabledTypes.resistance}
            onChange={({ target }) =>
              onSettingsChange({
                enabledTypes: { ...settings.enabledTypes, resistance: target.checked },
              })
            }
          >
            Сопротивление
          </Checkbox>
          <Checkbox
            checked={settings.enabledTypes.trend}
            onChange={({ target }) =>
              onSettingsChange({ enabledTypes: { ...settings.enabledTypes, trend: target.checked } })
            }
          >
            Дополнительно: трендовые
          </Checkbox>
        </div>
        <label>
          <span>Цвет поддержки</span>
          <input
            className={styles.color}
            type="color"
            aria-label="Цвет поддержки"
            value={settings.colors.support}
            onChange={({ target }) =>
              onSettingsChange({ colors: { ...settings.colors, support: target.value } })
            }
          />
        </label>
        <label>
          <span>Цвет сопротивления</span>
          <input
            className={styles.color}
            type="color"
            aria-label="Цвет сопротивления"
            value={settings.colors.resistance}
            onChange={({ target }) =>
              onSettingsChange({ colors: { ...settings.colors, resistance: target.value } })
            }
          />
        </label>
        <label>
          <span>Толщина</span>
          <Select
            value={settings.lineWidth}
            options={[1, 2, 3, 4].map((value) => ({ value, label: `${value}px` }))}
            onChange={(lineWidth) => onSettingsChange({ lineWidth })}
          />
        </label>
        <Checkbox
          checked={settings.showLabels}
          onChange={({ target }) => onSettingsChange({ showLabels: target.checked })}
        >
          Показывать подписи
        </Checkbox>
        <Checkbox
          checked={settings.hideWeak}
          onChange={({ target }) => onSettingsChange({ hideWeak: target.checked })}
        >
          Скрыть слабые
        </Checkbox>
      </fieldset>
      {settings.enabled && isCalculating && (
        <Typography.Text type="secondary">Расчёт уровней…</Typography.Text>
      )}
      {selectedLevel && (
        <div className={styles.selected}>
          <Typography.Text strong>Выбран уровень</Typography.Text>
          <Typography.Text>
            {selectedLevel.detector === 'extremum' ? 'EX' : 'Пробойный'} · {levelKindName(selectedLevel)},{' '}
            {levelTouchesName(selectedLevel)}, оценка {selectedLevel.score}/100
            {selectedLevel.weak ? ' · слабый' : ''}
            {selectedLevel.broken ? ' · пробит фитилём' : ''}
          </Typography.Text>
          {selectedLevel.zonePercent !== undefined && (
            <Typography.Text>
              Автоматическая зона касания: {selectedLevel.zonePercent.toFixed(2)}%
            </Typography.Text>
          )}
          {selectedLevel.breakoutDirection && selectedLevel.distancePercent !== undefined && (
            <Typography.Text>
              Возможный пробой {breakoutDirectionName(selectedLevel)} · до уровня{' '}
              {selectedLevel.distancePercent.toFixed(2)}%
              {selectedLevel.compression ? ' · есть поджатие' : ' · поджатия нет'}
            </Typography.Text>
          )}
          <Typography.Text type="secondary">
            Перемещение закрепит линию; кнопка с булавкой вернёт её к автоматическому пересчёту.
          </Typography.Text>
        </div>
      )}
      {error && <Alert type="warning" showIcon title={error} />}
    </div>
  );

  return (
    <>
      <Tooltip title="Автоуровни" placement="right">
        <Popover content={content} trigger="click" placement="rightTop" destroyOnHidden>
          <Button
            type={settings.enabled ? 'primary' : 'text'}
            icon={<RadarChartOutlined />}
            aria-label="Настройки автоуровней"
            aria-pressed={settings.enabled}
          />
        </Popover>
      </Tooltip>
      <Tooltip
        title={
          selectedLevel
            ? selectedLevel.frozen
              ? 'Разморозить автоуровень'
              : 'Заморозить автоуровень'
            : 'Выберите автоуровень'
        }
        placement="right"
      >
        <Button
          type={selectedLevel?.frozen ? 'primary' : 'text'}
          disabled={!settings.enabled || !selectedLevel}
          icon={<PushpinOutlined />}
          aria-label={selectedLevel?.frozen ? 'Разморозить автоуровень' : 'Заморозить автоуровень'}
          aria-pressed={selectedLevel?.frozen ?? false}
          onClick={() => selectedLevel && onToggleFrozen(selectedLevel.id)}
        />
      </Tooltip>
    </>
  );
}
