import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';

// useIdentity をモック
vi.mock('~/hooks/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

// useFetcher をモック
vi.mock('react-router', () => ({
  useFetcher: vi.fn(),
}));

import { useIdentity } from '~/hooks/useIdentity';
import { useFetcher } from 'react-router';

describe('useOptimisticAction', () => {
  const mockUseIdentity = vi.mocked(useIdentity);
  const mockUseFetcher = vi.mocked(useFetcher);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ログイン済みの場合、performAction で fetcher.submit が呼ばれる', () => {
    const mockFetcher = { submit: vi.fn() } as any;
    mockUseFetcher.mockReturnValue(mockFetcher);
    mockUseIdentity.mockReturnValue({
      effectiveId: 'user123',
    } as any);

    const { result } = renderHook(() =>
      useOptimisticAction('/test-action')
    );

    act(() => {
      result.current.performAction({ key: 'value', num: 42 });
    });

    expect(mockFetcher.submit).toHaveBeenCalledTimes(1);
    const [formData] = mockFetcher.submit.mock.calls[0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('key')).toBe('value');
    expect(formData.get('num')).toBe('42');
  });

  it('未ログインの場合、リダイレクトされる', () => {
    const mockFetcher = { submit: vi.fn() } as any;
    mockUseFetcher.mockReturnValue(mockFetcher);
    mockUseIdentity.mockReturnValue({
      effectiveId: null,
    } as any);

    const locationMock = { href: '' };
    vi.stubGlobal('location', locationMock);

    const { result } = renderHook(() =>
      useOptimisticAction('/test-action', '/login')
    );

    act(() => {
      result.current.performAction({ key: 'value' });
    });

    expect(mockFetcher.submit).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('/login');
  });
});