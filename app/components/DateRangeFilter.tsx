type DateRangeFilterProps = {
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (value: string) => void;
  onToDateChange?: (value: string) => void;
  className?: string;
};

/**
 * 概要: 日付範囲フィルターの入力フィールドを提供する共通コンポーネント。
 * Intent: fromDate と toDate の入力UIを統一。
 * Contract:
 *   - fromDate: 開始日の値（オプション）
 *   - toDate: 終了日の値（オプション）
 *   - onFromDateChange: 開始日変更時のコールバック（オプション）
 *   - onToDateChange: 終了日変更時のコールバック（オプション）
 *   - className: 追加のCSSクラス（オプション）
 * Environment: ブラウザ専用
 * Errors: なし
 */
export function DateRangeFilter({
  fromDate = '',
  toDate = '',
  onFromDateChange,
  onToDateChange,
  className = '',
}: DateRangeFilterProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex-1 flex flex-col">
        <label className="text-xs text-gray-500 dark:text-white mb-1">
          開始日
        </label>
        <input
          name="fromDate"
          value={fromDate}
          type="date"
          className="form-input w-full"
          aria-label="開始日"
          onChange={
            onFromDateChange ? e => onFromDateChange(e.target.value) : undefined
          }
        />
      </div>

      <div className="flex-1 flex flex-col">
        <label className="text-xs text-gray-500 dark:text-white mb-1">
          終了日
        </label>
        <input
          name="toDate"
          value={toDate}
          type="date"
          className="form-input w-full"
          aria-label="終了日"
          onChange={
            onToDateChange ? e => onToDateChange(e.target.value) : undefined
          }
        />
      </div>
    </div>
  );
}
