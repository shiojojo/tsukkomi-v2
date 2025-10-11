import { useCallback } from 'react';

/**
 * カスタムフック: 数値入力フィールドのインクリメント/デクリメント機能を提供
 * @param value 現在の値（文字列）
 * @param setValue 値を設定する関数
 * @param min 最小値（デフォルト: 0）
 * @returns increment, decrement 関数
 */
export function useNumericInput(
  value: string,
  setValue: (value: string) => void,
  min: number = 0
) {
  const increment = useCallback(() => {
    const n = Number(value || 0);
    setValue(String(n + 1));
  }, [value, setValue]);

  const decrement = useCallback(() => {
    const n = Math.max(min, Number(value || 0) - 1);
    setValue(String(n));
  }, [value, setValue, min]);

  return { increment, decrement };
}