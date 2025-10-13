import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdentity } from '~/hooks/common/useIdentity';

// Mock identityStorage
vi.mock('~/lib/identityStorage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  available: vi.fn(),
}));

const mockedIdentityStorage = vi.mocked(await import('~/lib/identityStorage'));

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.addEventListener etc.
    Object.defineProperty(window, 'addEventListener', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, 'removeEventListener', {
      writable: true,
      value: vi.fn(),
    });
  });

  it('should load identity from storage on mount', () => {
    mockedIdentityStorage.getItem.mockImplementation((key: string) => {
      switch (key) {
        case 'currentUserId': return 'user-1';
        case 'currentUserName': return 'User One';
        default: return null;
      }
    });

    const { result } = renderHook(() => useIdentity());

    act(() => {
      result.current.refresh();
    });

    expect(mockedIdentityStorage.getItem).toHaveBeenCalledWith('currentUserId');
    expect(mockedIdentityStorage.getItem).toHaveBeenCalledWith('currentUserName');
  });
});