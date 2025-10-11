import { describe, it, expect } from 'vitest';
import { cn } from '~/lib/utils';

describe('cn', () => {
  it('単一のクラスを返す', () => {
    expect(cn('class1')).toBe('class1');
  });

  it('複数のクラスを結合する', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('条件付きクラスを処理する', () => {
    expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2');
  });

  it('オブジェクト形式のクラスを処理する', () => {
    expect(cn({ 'class1': true, 'class2': false, 'class3': true })).toBe('class1 class3');
  });

  it('配列形式のクラスを処理する', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
  });

  it('Tailwindの競合を解決する', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('undefinedとnullを無視する', () => {
    expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
  });

  it('空の入力を処理する', () => {
    expect(cn()).toBe('');
  });
});