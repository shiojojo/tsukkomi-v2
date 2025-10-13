import { AnswersFilterForm } from './AnswersFilterForm';
import { TopicsFilterForm } from './TopicsFilterForm';
import type { User } from '~/lib/schemas/user';

interface BaseFilterProps {
  query: string;
  setQuery: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
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
  onSubmit?: () => void;
  mode?: 'all' | 'topic' | 'favorites';
}

interface TopicsFilterProps extends BaseFilterProps {
  type: 'topics';
}

type FilterFormProps = AnswersFilterProps | TopicsFilterProps;

export function FilterForm(props: FilterFormProps) {
  if (props.type === 'answers') {
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
      onSubmit,
      ...baseProps
    } = props;
    return (
      <AnswersFilterForm
        {...baseProps}
        users={users}
        authorQuery={authorQuery}
        setAuthorQuery={setAuthorQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        minScore={minScore}
        setMinScore={setMinScore}
        hasComments={hasComments}
        setHasComments={setHasComments}
        showAdvancedFilters={showAdvancedFilters}
        toggleAdvancedFilters={toggleAdvancedFilters}
        onSubmit={onSubmit}
        mode={props.mode}
      />
    );
  } else {
    const { ...baseProps } = props;
    return <TopicsFilterForm {...baseProps} />;
  }
}
