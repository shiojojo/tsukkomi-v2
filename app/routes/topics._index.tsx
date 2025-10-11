import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { Pagination } from '~/components/common/Pagination';
import { FilterForm } from '~/components/forms/FilterForm';
import { TopicCard } from '~/components/features/topics/TopicCard';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
import { useListPage } from '~/hooks/useListPage';
// server-only import
import type { Topic } from '~/lib/schemas/topic';
import { createListLoader } from '~/lib/loaders';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    return createListLoader('topics', request);
  } catch (error) {
    console.error('Failed to load topics:', error);
    // Return a safe fallback response
    return Response.json({
      topics: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: '',
      fromDate: '',
      toDate: '',
    });
  }
}

export default function TopicsRoute() {
  type LoaderData = {
    topics: Topic[];
    total: number;
    page: number;
    pageSize: number;
    q?: string;
    fromDate?: string;
    toDate?: string;
  };
  const data = useLoaderData() as {
    topics: Topic[];
    total: number;
    page: number;
    pageSize: number;
    q?: string;
    fromDate?: string;
    toDate?: string;
  };

  const urlKeys: Record<string, string> = {
    q: 'q',
    fromDate: 'fromDate',
    toDate: 'toDate',
  };

  const {
    filters,
    updateFilter,
    pageCount,
    currentPage,
    pageSize,
    listData: topics,
    containerRef,
  } = useListPage(data, 'topics', urlKeys, 'topics');

  return (
    <ListPageLayout
      headerTitle="お題一覧"
      filters={
        <div className="mb-0">
          <FilterForm
            type="topics"
            query={filters.q}
            setQuery={(value: string) => updateFilter('q', value)}
            fromDate={filters.fromDate}
            setFromDate={(value: string) => updateFilter('fromDate', value)}
            toDate={filters.toDate}
            setToDate={(value: string) => updateFilter('toDate', value)}
          />
        </div>
      }
      list={
        <div className="space-y-3 px-1">
          <ul className="space-y-3">
            {topics.map((t: Topic) => (
              <li key={t.id}>
                <TopicCard topic={t} />
              </li>
            ))}
          </ul>
        </div>
      }
      pagination={
        <Pagination
          currentPage={currentPage}
          pageCount={pageCount}
          buildHref={(p: number) =>
            `?q=${encodeURIComponent(filters.q)}&fromDate=${encodeURIComponent(
              filters.fromDate
            )}&toDate=${encodeURIComponent(filters.toDate)}&page=${p}&pageSize=${pageSize}`
          }
        />
      }
      contentRef={containerRef}
    />
  );
}
