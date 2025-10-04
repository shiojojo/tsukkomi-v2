import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useEffect, useRef } from 'react';
import { Pagination } from '~/components/common/Pagination';
import { FilterForm } from '~/components/forms/FilterForm';
import { useFilters, type TopicsFilters } from '~/hooks/useFilters';
import { TopicCard } from '~/components/features/topics/TopicCard';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
// server-only import
import type { Topic } from '~/lib/schemas/topic';
import { createListLoader } from '~/lib/loaders';

export async function loader({ request }: LoaderFunctionArgs) {
  return createListLoader('topics', request);
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
  const data = useLoaderData() as LoaderData;
  const topics: Topic[] = data?.topics ?? [];
  const total: number = data?.total ?? topics.length;
  const currentPage: number = data?.page ?? 1;
  const pageSize: number = data?.pageSize ?? 10;
  const qParam: string = data?.q ?? '';
  const fromDateParam: string = data?.fromDate ?? '';
  const toDateParam: string = data?.toDate ?? '';

  const initialFilters: TopicsFilters = {
    q: qParam,
    fromDate: fromDateParam,
    toDate: toDateParam,
  };

  const urlKeys: Record<keyof TopicsFilters, string> = {
    q: 'q',
    fromDate: 'fromDate',
    toDate: 'toDate',
  };

  const { filters, updateFilter } = useFilters(initialFilters, urlKeys, false);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pagedTopics = topics;
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      // Ensure the scrollable content area starts at the top when paging.
      // Directly set scrollTop on the inner container to avoid jumping the
      // outer document. Use a typed local variable to satisfy TypeScript.
      const el = containerRef.current as HTMLDivElement | null;
      if (el) {
        // set scrollTop and also try scrollTo (modern API)
        el.scrollTop = 0;
        try {
          el.scrollTo?.({ top: 0, behavior: 'auto' } as any);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch {}
  }, [currentPage]);

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
            {pagedTopics.map(t => (
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
          buildHref={p =>
            `?q=${encodeURIComponent(filters.q)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}&page=${p}&pageSize=${pageSize}`
          }
        />
      }
      contentRef={containerRef}
    />
  );
}
