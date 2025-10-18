import { Form } from 'react-router';
import { useNumericInput } from '~/hooks/common/useNumericInput';
import { SearchInput } from '~/components/ui/SearchInput';
import { DateRangeFilter } from './DateRangeFilter';
import type { User } from '~/lib/schemas/user';
import { Button } from '~/components/ui/Button';

interface AnswersFilterProps {
  query: string;
  setQuery: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  users: User[];
  authorQuery: string;
  setAuthorQuery: (value: string) => void;
  sortBy: 'newest' | 'oldest' | 'scoreDesc';
  setSortBy: (value: 'newest' | 'oldest' | 'scoreDesc') => void;
  minScore: string;
  setMinScore: (value: string) => void;
  hasComments: boolean;
  setHasComments: (value: boolean) => void;
  showAdvancedFilters: boolean;
  toggleAdvancedFilters: () => void;
  onSubmit?: () => void;
  mode?: 'all' | 'topic' | 'favorites';
}

export function AnswersFilterForm(props: AnswersFilterProps) {
  const {
    query,
    setQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    users,
    authorQuery,
    setAuthorQuery,
    sortBy,
    setSortBy,
    minScore,
    setMinScore,
    hasComments,
    setHasComments,
    showAdvancedFilters,
    toggleAdvancedFilters,
    onSubmit,
    mode,
  } = props;

  const { increment: incrementMinScore, decrement: decrementMinScore } =
    useNumericInput(minScore, setMinScore, 0);

  return (
    <Form
      method="get"
      className="flex flex-wrap gap-2 items-start md:items-center"
      onSubmit={onSubmit}
    >
      {/* Group: author, sortBy, advanced toggle — keep single-line on small screens */}
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            name="author"
            value={authorQuery}
            onChange={e => {
              setAuthorQuery(e.target.value);
              // Trigger form submission for immediate filtering
              const form = e.target.form;
              if (form) form.requestSubmit();
            }}
            className="form-select w-full text-sm"
          >
            <option value="">{mode === 'favorites' ? '回答' : '全員'}</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0">
          <select
            name="sortBy"
            value={sortBy}
            onChange={e => {
              setSortBy(e.target.value as 'newest' | 'oldest' | 'scoreDesc');
              // Trigger form submission for immediate filtering
              const form = e.target.form;
              if (form) form.requestSubmit();
            }}
            className="form-select w-full text-sm"
          >
            <option value="newest">新着</option>
            <option value="oldest">古い順</option>
            <option value="scoreDesc">スコア順</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            type="button"
            onClick={toggleAdvancedFilters}
          >
            {showAdvancedFilters ? '詳細を閉じる' : '詳細フィルタ'}
          </Button>
        </div>
      </div>

      {/* Advanced filters: minScore, hasComments, date range */}
      {showAdvancedFilters && (
        <div className="w-full flex flex-wrap gap-2 items-center border-t border-border pt-2 mt-2">
          <div className="w-full">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm">最小スコア</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={decrementMinScore}
                className="px-2 py-1 border rounded"
              >
                -
              </button>
              <input
                name="minScore"
                type="text"
                value={minScore}
                onChange={e =>
                  setMinScore(e.target.value.replace(/[^0-9]/g, ''))
                }
                className="form-input w-12 text-sm text-center"
              />
              <button
                type="button"
                onClick={incrementMinScore}
                className="px-2 py-1 border rounded"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              name="hasComments"
              type="checkbox"
              checked={hasComments}
              onChange={e => setHasComments(e.target.checked)}
              value="1"
            />
            <span className="text-xs">has comments</span>
          </label>

          <div className="w-full">
            <DateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="secondary" type="submit">
          検索
        </Button>
      </div>
    </Form>
  );
}
