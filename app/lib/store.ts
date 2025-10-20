import { create } from 'zustand';
import * as identityStorage from './identityStorage';

interface IdentityState {
  mainId: string | null;
  mainName: string | null;
  subId: string | null;
  subName: string | null;
  effectiveId: string | null;
  effectiveName: string | null;
  refresh: () => void;
}

const empty = () => ({
  mainId: null,
  mainName: null,
  subId: null,
  subName: null,
  effectiveId: null,
  effectiveName: null,
});

const read = () => {
  try {
    const mainId = identityStorage.getItem('currentUserId');
    const mainName = identityStorage.getItem('currentUserName');
    const subId = identityStorage.getItem('currentSubUserId');
    const subName = identityStorage.getItem('currentSubUserName');
    const effectiveId = subId || mainId;
    const effectiveName = subName || mainName;
    return { mainId, mainName, subId, subName, effectiveId, effectiveName };
  } catch {
    return empty();
  }
};

export const useIdentityStore = create<IdentityState>((set) => ({
  ...empty(),
  refresh: () => set(read()),
}));

// 初期化とイベントリスナー
if (typeof window !== 'undefined') {
  // 初期化を非同期で遅延実行
  setTimeout(() => {
    useIdentityStore.getState().refresh();
    const apply = () => useIdentityStore.getState().refresh();
    window.addEventListener('storage', apply);
    window.addEventListener('identity-change', apply);
  }, 0);
}

// テーマ管理ストア
type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem('theme') as Theme;
    return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

const applyTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system: prefers-color-schemeに従う
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mediaQuery.matches);
    }
  }
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getStoredTheme(),
  setTheme: (theme: Theme) => {
    set({ theme });
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // localStorageが利用できない場合
    }
    applyTheme(theme);
  },
}));

// 初期テーマ適用
if (typeof window !== 'undefined') {
  // 初期化を非同期で遅延実行
  setTimeout(() => {
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);

    // systemテーマの場合、システム設定の変更を監視
    if (initialTheme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
    }
  }, 0);
}