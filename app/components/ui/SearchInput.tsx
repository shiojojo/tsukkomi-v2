type SearchInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * 概要: 検索入力フィールドを提供する共通コンポーネント。
 * Intent: 検索クエリの入力UIを統一。
 * Contract:
 *   - name: inputのname属性（オプション）
 *   - value: 入力値（controlledの場合）
 *   - defaultValue: デフォルト値（uncontrolledの場合）
 *   - onChange: 値変更時のコールバック（オプション）
 *   - placeholder: プレースホルダーテキスト（オプション）
 *   - className: 追加のCSSクラス（オプション）
 * Environment: ブラウザ専用
 * Errors: なし
 */
export function SearchInput({
  name = 'q',
  value,
  defaultValue,
  onChange,
  placeholder = 'お題タイトルで検索',
  className = '',
}: SearchInputProps) {
  return (
    <input
      name={name}
      type="search"
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange ? e => onChange(e.target.value) : undefined}
      className={`form-input w-full text-sm ${className}`}
      aria-label={placeholder}
    />
  );
}
