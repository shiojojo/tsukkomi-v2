import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import { Pagination } from '~/components/Pagination';
import { DateRangeFilter } from '~/components/DateRangeFilter';
import { SearchInput } from '~/components/SearchInput';
// server-only import
import type { Topic } from '~/lib/schemas/topic';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '10');
  const q = params.get('q') ?? undefined;
  const fromDate = params.get('fromDate') ?? undefined;
  const toDate = params.get('toDate') ?? undefined;

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
  const [q, setQ] = useState(qParam);
  const [fromDate, setFromDate] = useState(fromDateParam);
  const [toDate, setToDate] = useState(toDateParam);
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
    } catch {}
  }, [currentPage]);

  return (
    <StickyHeaderLayout
      header={
        <div className="z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="p-4">
            <h1 className="text-2xl font-semibold mb-4">お題一覧</h1>
            <div className="mb-0">
              <Form method="get" className="space-y-2">
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder="検索: お題タイトル"
                />

                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <DateRangeFilter
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={setFromDate}
                    onToDateChange={setToDate}
                  />
                  <button
                    type="submit"
                    className="text-sm px-2 py-1 border rounded-md"
                  >
                    絞込
                  </button>
                  <a
                    href="/topics"
                    className="text-sm text-gray-600 hover:underline ml-2"
                  >
                    クリア
                  </a>
                </div>
              </Form>
            </div>
          </div>
        </div>
      }
      contentRef={containerRef}
    >
      <div className="space-y-3 px-1">
        <ul className="space-y-3">
          {pagedTopics.map(t => (
            <li key={t.id}>
              <Link
                to={`/topics/${t.id}`}
                className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0"
                aria-label={`お題 ${t.title} の回答を見る`}
              >
                {t.image ? (
                  <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={t.image}
                      alt={t.title}
                      className="w-full max-w-full h-auto max-h-60 object-contain"
                      style={{ display: 'block' }}
                    />
                  </div>
                ) : (
                  <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 min-w-0">
                    <h2 className="text-lg font-medium break-words">
                      {t.title}
                    </h2>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <Pagination
          currentPage={currentPage}
          pageCount={pageCount}
          buildHref={p =>
            `?q=${encodeURIComponent(q)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&page=${p}&pageSize=${pageSize}`
          }
        />
      </div>
    </StickyHeaderLayout>
  );
}
