import type { ChartTool } from '../model/types';

export const primaryDrawingTools: Array<{ tool: ChartTool; icon: string; title: string }> = [
  { tool: 'HorizontalLine', icon: '—', title: 'Горизонтальный уровень' },
  { tool: 'TrendLine', icon: '╱', title: 'Трендовая линия' },
  { tool: 'HorizontalRay', icon: '⇢', title: 'Горизонтальный луч' },
  { tool: 'Rectangle', icon: '□', title: 'Прямоугольник' },
  { tool: 'Ruler', icon: '↗', title: 'Линейка' },
];

export const extraDrawingTools: Array<{ tool: ChartTool; title: string }> = [
  { tool: 'Ray', title: 'Луч' },
  { tool: 'Arrow', title: 'Стрелка' },
  { tool: 'ExtendedLine', title: 'Бесконечная линия' },
  { tool: 'VerticalLine', title: 'Вертикальная линия' },
  { tool: 'CrossLine', title: 'Крест' },
  { tool: 'Callout', title: 'Выноска' },
  { tool: 'Brush', title: 'Кисть' },
  { tool: 'Highlighter', title: 'Маркер' },
  { tool: 'Circle', title: 'Круг' },
  { tool: 'Triangle', title: 'Треугольник' },
  { tool: 'Path', title: 'Путь' },
  { tool: 'ParallelChannel', title: 'Параллельный канал' },
  { tool: 'FibRetracement', title: 'Фибо' },
  { tool: 'PriceRange', title: 'Ценовой диапазон' },
  { tool: 'LongShortPosition', title: 'Long / Short' },
  { tool: 'Text', title: 'Текст' },
  { tool: 'MarketDepth', title: 'Глубина рынка' },
];
