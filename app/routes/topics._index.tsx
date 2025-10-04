import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Form } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { Pagination } from '~/components/common/Pagination';
import { DateRangeFilter } from '~/components/forms/DateRangeFilter';
import { SearchInput } from '~/components/ui/SearchInput';
import { FilterForm } from '~/components/forms/FilterForm';
import { useFilters, type TopicsFilters } from '~/hooks/useFilters';
import { TopicCard } from '~/components/features/topics/TopicCard';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
// server-only import
import type { Topic } from '~/lib/schemas/topic';
import {
  parsePaginationParams,
  parseCommonFilterParams,
} from '~/lib/queryParser';

export async function loader({ request }: LoaderFunctionArgs) {
  const { page, pageSize } = parsePaginationParams(request);
  const { q, fromDate, toDate } = parseCommonFilterParams(request);

  const { getTopicsPaged } = await import('~/lib/db');
  const { topics, total } = await getTopicsPaged({
    page,
    pageSize,
    q,
    fromDate,
    toDate,
  });
  return { topics, total, page, pageSize, q, fromDate, toDate };
}

export default function TopicsRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topics: Topic[] = data?.topics ?? [];
  const total: number = (data as any)?.total ?? topics.length;
  const currentPage: number = (data as any)?.page ?? 1;
  const pageSize: number = (data as any)?.pageSize ?? 10;
  const qParam: string = (data as any)?.q ?? '';
  const fromDateParam: string = (data as any)?.fromDate ?? '';
  const toDateParam: string = (data as any)?.toDate ?? '';

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

  const { filters, updateFilter, resetFilters } = useFilters(
    initialFilters,
    urlKeys,
    false
  );

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
