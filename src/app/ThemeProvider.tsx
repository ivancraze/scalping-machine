import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { loadTheme, saveTheme, ThemeContext, themeConfig, type ThemeMode } from '../shared/theme';

function ThemeSurface({ children, mode }: { children: ReactNode; mode: ThemeMode }) {
  const { token } = theme.useToken();
  const variables = {
    '--surface': token.colorBgContainer,
    '--surface-raised': token.colorBgElevated,
    '--page-background': token.colorBgLayout,
    '--border': token.colorBorder,
    '--border-subtle': token.colorBorderSecondary,
    '--text': token.colorText,
    '--text-secondary': token.colorTextSecondary,
    '--positive': token.colorSuccess,
    '--negative': token.colorError,
    '--accent': token.colorPrimary,
    '--selected': token.colorPrimaryBg,
    '--volume': token.colorWarningText,
    colorScheme: mode,
  } as CSSProperties;

  return (
    <AntApp className="theme-root" style={variables}>
      {children}
    </AntApp>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setThemeMode] = useState(loadTheme);
  const value = useMemo(
    () => ({
      mode,
      setMode: (next: ThemeMode) => {
        saveTheme(next);
        setThemeMode(next);
      },
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig[mode]} locale={ruRU} componentSize="small">
        <ThemeSurface mode={mode}>{children}</ThemeSurface>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
