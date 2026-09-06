// @vitest-environment jsdom
import { act, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHART_INDICATOR_SETTINGS, type ChartIndicatorSettings } from '../model/types';
import { ChartIndicators } from './ChartIndicators';

vi.mock('@ant-design/icons', () => ({ BarChartOutlined: () => null }));
vi.mock('antd', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Modal: ({ children, open, title }: { children: ReactNode; open: boolean; title: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={String(title)}>
        {children}
      </div>
    ) : null,
  Switch: ({
    checked,
    onChange,
    ...props
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    'aria-label': string;
  }) => (
    <input {...props} type="checkbox" checked={checked} onChange={({ target }) => onChange(target.checked)} />
  ),
  Typography: {
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Paragraph: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  },
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('ChartIndicators', () => {
  it('opens settings and exposes an honest OI period and enabled defaults', async () => {
    await act(() =>
      root.render(
        <ChartIndicators
          settings={DEFAULT_CHART_INDICATOR_SETTINGS}
          openInterestPeriod="5м"
          onChange={vi.fn()}
          onReset={vi.fn()}
        />,
      ),
    );

    const openButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Индикаторы',
    );
    await act(() => openButton?.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('Открытый интерес · 5м');
    expect(container.textContent).toContain('Binance USD-M');
    expect(
      (container.querySelector('[aria-label="Показывать открытый интерес"]') as HTMLInputElement).checked,
    ).toBe(true);
    expect((container.querySelector('[aria-label="Показывать объём"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('emits immutable visibility and color changes and resets settings', async () => {
    const onChange = vi.fn<(settings: ChartIndicatorSettings) => void>();
    const onReset = vi.fn();
    await act(() =>
      root.render(
        <ChartIndicators
          settings={DEFAULT_CHART_INDICATOR_SETTINGS}
          openInterestPeriod="15м"
          onChange={onChange}
          onReset={onReset}
        />,
      ),
    );
    await act(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Индикаторы')
        ?.click(),
    );

    const openInterestSwitch = container.querySelector(
      '[aria-label="Показывать открытый интерес"]',
    ) as HTMLInputElement;
    await act(() => openInterestSwitch.click());
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CHART_INDICATOR_SETTINGS,
      openInterest: { ...DEFAULT_CHART_INDICATOR_SETTINGS.openInterest, visible: false },
    });

    const volumeUpColor = container.querySelector(
      '[aria-label="Цвет объёма растущей свечи"]',
    ) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(volumeUpColor, '#112233');
    await act(() => volumeUpColor.dispatchEvent(new Event('input', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CHART_INDICATOR_SETTINGS,
      volume: { ...DEFAULT_CHART_INDICATOR_SETTINGS.volume, upColor: '#112233' },
    });

    await act(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'По умолчанию')
        ?.click(),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
