import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNameByProfileId } from '~/hooks/common/useNameByProfileId';
import type { User } from '~/lib/schemas/user';

describe('useNameByProfileId', () => {
  it('should return empty map for empty users array', () => {
    const { result } = renderHook(() => useNameByProfileId([]));

    expect(result.current.nameByProfileId).toEqual({});
    expect(result.current.getNameByProfileId('any')).toBeUndefined();
  });

  it('should map user names by id', () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob', subUsers: [{ id: '2a', name: 'Bob Jr.' }] },
    ];

    const { result } = renderHook(() => useNameByProfileId(users));

    expect(result.current.nameByProfileId).toEqual({
      '1': 'Alice',
      '2': 'Bob',
      '2a': 'Bob Jr.',
    });
  });

  it('should return correct name for existing id', () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
    ];

    const { result } = renderHook(() => useNameByProfileId(users));

    expect(result.current.getNameByProfileId('1')).toBe('Alice');
  });

  it('should return undefined for non-existing id', () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
    ];

    const { result } = renderHook(() => useNameByProfileId(users));

    expect(result.current.getNameByProfileId('2')).toBeUndefined();
  });

  it('should return undefined for null or undefined pid', () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
    ];

    const { result } = renderHook(() => useNameByProfileId(users));

    expect(result.current.getNameByProfileId(null)).toBeUndefined();
    expect(result.current.getNameByProfileId(undefined)).toBeUndefined();
  });

  it('should handle users without subUsers', () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    const { result } = renderHook(() => useNameByProfileId(users));

    expect(result.current.nameByProfileId).toEqual({
      '1': 'Alice',
      '2': 'Bob',
    });
  });
});