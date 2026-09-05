import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Switch, Tooltip } from 'antd';
import { useTheme } from '../../../shared/theme';

export function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  return (
    <Tooltip title={mode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
      <Switch
        aria-label="Тёмная тема"
        checked={mode === 'dark'}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        onChange={(dark) => setMode(dark ? 'dark' : 'light')}
      />
    </Tooltip>
  );
}
