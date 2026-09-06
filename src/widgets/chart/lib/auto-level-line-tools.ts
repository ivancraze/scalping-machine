import { LineStyle } from 'lightweight-charts';
import type { ILineToolsPlugin, LineToolPartialOptionsMap } from 'lightweight-charts-line-tools-core';
import {
  AUTO_LEVEL_ID_PREFIX,
  AUTO_LEVEL_OWNER_SOURCE_ID,
  type AutoLevelSettings,
  type DetectedAutoLevel,
} from '../../../entities/auto-level';

type AutoLevelLineTools = Pick<
  ILineToolsPlugin,
  'createOrUpdateLineTool' | 'getLineToolsByIdRegex' | 'removeLineToolsById'
>;

const intervalLabels: Record<AutoLevelSettings['interval'], string> = {
  '1m': '1м',
  '5m': '5м',
  '15m': '15м',
  '1h': '1ч',
  '4h': '4ч',
  '1d': '1д',
};

const kindLabel = (level: DetectedAutoLevel) => {
  if (level.kind === 'support') return 'поддержка';
  if (level.kind === 'resistance') return 'сопротивление';
  if (level.kind === 'trend-support') return 'тренд-поддержка';
  return 'тренд-сопротивление';
};

const levelColor = (level: DetectedAutoLevel, settings: AutoLevelSettings) => {
  if (level.detector === 'extremum') return settings.extremumColor;
  return level.kind === 'support' || level.kind === 'trend-support'
    ? settings.colors.support
    : settings.colors.resistance;
};

const breakoutLabel = (level: DetectedAutoLevel) => {
  if (!level.breakoutDirection || level.distancePercent === undefined) return kindLabel(level);
  const arrow = level.breakoutDirection === 'up' ? '↑' : '↓';
  return `${arrow} пробой · ${kindLabel(level)} · ${level.distancePercent.toFixed(2)}%${level.compression ? ' · поджатие' : ''}`;
};

const touchLabel = (level: DetectedAutoLevel) => {
  if (level.kind === 'resistance') return `${level.touches} верш.`;
  if (level.kind === 'support') return `${level.touches} мин.`;
  return `${level.touches} кас.`;
};

function readAutoLevelIds(lineTools: AutoLevelLineTools) {
  try {
    const exported: unknown = JSON.parse(
      lineTools.getLineToolsByIdRegex(new RegExp(`^${AUTO_LEVEL_ID_PREFIX}`)),
    );
    if (!Array.isArray(exported)) return [];
    return exported.flatMap((item) =>
      typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
        ? [item.id]
        : [],
    );
  } catch {
    return [];
  }
}

export function syncAutoLevelLineTools(
  lineTools: AutoLevelLineTools,
  levels: DetectedAutoLevel[],
  settings: AutoLevelSettings,
) {
  const desiredIds = new Set(levels.map(({ id }) => id));
  const obsoleteIds = readAutoLevelIds(lineTools).filter((id) => !desiredIds.has(id));
  if (obsoleteIds.length > 0) lineTools.removeLineToolsById(obsoleteIds);
  for (const level of levels) {
    const color = levelColor(level, settings);
    const label =
      settings.showLabels && level.detector === 'breakout'
        ? `AUTO · ${intervalLabels[level.analysisInterval]} · ${breakoutLabel(level)} · ${touchLabel(level)} · ${level.score}/100${level.frozen ? ' · закреплён' : ''}`
        : '';
    const commonOptions = {
      visible: true,
      editable: true,
      ownerSourceId: AUTO_LEVEL_OWNER_SOURCE_ID,
      showPriceAxisLabels: true,
      showTimeAxisLabels: false,
      priceAxisLabelAlwaysVisible: true,
      line: {
        color,
        width: settings.lineWidth,
        style: level.frozen
          ? LineStyle.LargeDashed
          : level.detector === 'extremum'
            ? LineStyle.Solid
            : LineStyle.Dashed,
      },
      text: {
        value: label,
        font: { color, size: 11, bold: level.frozen },
        box: { alignment: { horizontal: level.detector === 'extremum' ? 'left' : 'right' } },
      },
    };
    if (level.kind === 'support' || level.kind === 'resistance') {
      // The package's DeepPartial mishandles the common string index signature. Keep the
      // compatibility cast at this adapter boundary; the runtime shape follows its public API.
      const options = {
        ...commonOptions,
        line: { ...commonOptions.line, extend: { left: false, right: true } },
      } as unknown as LineToolPartialOptionsMap['HorizontalRay'];
      lineTools.createOrUpdateLineTool('HorizontalRay', level.points, options, level.id);
    } else {
      const options = {
        ...commonOptions,
        line: { ...commonOptions.line, extend: { left: false, right: true } },
      } as unknown as LineToolPartialOptionsMap['TrendLine'];
      lineTools.createOrUpdateLineTool('TrendLine', level.points, options, level.id);
    }
  }
}
