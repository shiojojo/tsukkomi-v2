import { Form } from 'react-router';
import { SearchInput } from '~/components/ui/SearchInput';
import { DateRangeFilter } from './DateRangeFilter';
import { Button } from '~/components/ui/Button';

interface TopicsFilterProps {
  query: string;
  setQuery: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
}

export function TopicsFilterForm(props: TopicsFilterProps) {
  const { query, setQuery, fromDate, setFromDate, toDate, setToDate } = props;

  return (
    <Form method="get" className="space-y-2">
      <SearchInput value={query} onChange={setQuery} />

      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" type="submit">
            検索
          </Button>
        </div>
      </div>
    </Form>
  );
}
