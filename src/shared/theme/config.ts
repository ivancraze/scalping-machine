import { theme, type ThemeConfig } from 'antd';
import type { ThemeMode } from './model/types';

export const themeConfig: Record<ThemeMode, ThemeConfig> = {
  dark: {
    algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
    token: {
      colorPrimary: '#a78bfa',
      colorBgBase: '#0c0d14',
      colorSuccess: '#0ac18b',
      colorError: '#e63c64',
      borderRadius: 6,
      fontSize: 13,
    },
    components: { Table: { cellPaddingBlockSM: 7, cellPaddingInlineSM: 8 } },
  },
  light: {
    algorithm: [theme.defaultAlgorithm, theme.compactAlgorithm],
    token: {
      colorPrimary: '#7047c6',
      colorSuccess: '#07845e',
      colorError: '#c82e51',
      colorWarning: '#946000',
      borderRadius: 6,
      fontSize: 13,
    },
    components: { Table: { cellPaddingBlockSM: 7, cellPaddingInlineSM: 8 } },
  },
};
