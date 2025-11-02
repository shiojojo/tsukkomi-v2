import { useState, useEffect } from 'react';
import {
  MoonIcon as Moon,
  SunIcon as Sun,
  MonitorIcon as Monitor,
} from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { useThemeStore } from '~/lib/store';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
    }
  };

  // サーバー側では何もレンダリングしない
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="テーマを切り替え"
        disabled
      >
        <div className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-9 w-9"
      aria-label="テーマを切り替え"
    >
      <div
        key={theme}
        className="transition-all duration-150 ease-out opacity-100 rotate-0"
      >
        {getIcon()}
      </div>
    </Button>
  );
}
