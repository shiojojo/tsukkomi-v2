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
  useIdentityStore.getState().refresh();
  const apply = () => useIdentityStore.getState().refresh();
  window.addEventListener('storage', apply);
  window.addEventListener('identity-change', apply);
}