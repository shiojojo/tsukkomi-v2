import { Form } from 'react-router';
import { useState } from 'react';
import { SearchInput } from './SearchInput';
import { DateRangeFilter } from './DateRangeFilter';
import type { User } from '~/lib/schemas/user';

interface BaseFilterProps {
  query: string;
  setQuery: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  onClear?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
}

interface AnswersFilterProps extends BaseFilterProps {
  type: 'answers';
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
}

interface TopicsFilterProps extends BaseFilterProps {
  type: 'topics';
}

type FilterFormProps = AnswersFilterProps | TopicsFilterProps;

export function FilterForm(props: FilterFormProps) {
  const {
    type,
    query,
    setQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    onClear,
    onSubmit,
  } = props;

  const incrementMinScore = () => {
    if (type === 'answers') {
      const n = Number(props.minScore || 0);
      props.setMinScore(String(n + 1));
    }
  };

  const decrementMinScore = () => {
    if (type === 'answers') {
      const n = Math.max(0, Number(props.minScore || 0) - 1);
      props.setMinScore(String(n));
    }
  };

  const SubmitAndClearButtons = () => (
    <div className="flex items-center gap-2">
      <button
        type="submit"
        className="text-xs px-2 py-1 border rounded-md bg-blue-600 text-white"
      >
        検索
      </button>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs px-2 py-1 border rounded-md text-gray-600 dark:text-white"
        >
          クリア
        </button>
      )}
    </div>
  );

  if (type === 'topics') {
    return (
      <Form method="get" className="space-y-2" onSubmit={onSubmit}>
        <SearchInput value={query} onChange={setQuery} />

        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
          <SubmitAndClearButtons />
        </div>
      </Form>
    );
  }

  // type === 'answers'
  const {
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
  } = props;

  return (
    <Form
      method="get"
      className="flex flex-wrap gap-2 items-start md:items-center"
      onSubmit={onSubmit}
    >
      {/* Group: author, sortBy, advanced toggle — keep single-line on small screens */}
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div>
            <select
              id="authorName"
              name="authorName"
              value={authorQuery}
              onChange={e => setAuthorQuery(e.target.value)}
              className="form-select w-full text-sm"
            >
              <option value="">全員</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-shrink-0">
          <select
            name="sortBy"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="form-select w-full text-sm"
          >
            <option value="newest">新着</option>
            <option value="oldest">古い順</option>
            <option value="scoreDesc">スコア順</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="text-xs px-2 py-1 border rounded-md"
            onClick={toggleAdvancedFilters}
          >
            {showAdvancedFilters ? '詳細を閉じる' : '詳細フィルタ'}
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="flex flex-col gap-3 w-full mt-2">
          <div className="w-full">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <div className="flex flex-nowrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs">最小スコア: </label>
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  placeholder=""
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
                className="w-4 h-4"
              />
              <span className="text-xs">has comments</span>
            </label>
          </div>

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

      <SubmitAndClearButtons />
    </Form>
  );
}
