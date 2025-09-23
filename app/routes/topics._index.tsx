import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form } from 'react-router';
import { useEffect, useRef } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
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
                <input
                  name="q"
                  defaultValue={qParam}
                  type="search"
                  placeholder="検索: お題タイトル"
                  className="form-input w-full"
                  aria-label="お題を検索"
                />

                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <input
                    name="fromDate"
                    defaultValue={fromDateParam}
                    type="date"
                    className="form-input w-28 sm:w-36 min-w-0"
                    aria-label="開始日"
                    placeholder="開始日"
                  />
                  <input
                    name="toDate"
                    defaultValue={toDateParam}
                    type="date"
                    className="form-input w-28 sm:w-36 min-w-0"
                    aria-label="終了日"
                    placeholder="終了日"
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

        {/* Mobile pagination controls */}
        <div className="flex items-center justify-between mt-4 md:hidden">
          <Link
            to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${Math.max(1, currentPage - 1)}&pageSize=${pageSize}`}
            aria-label="前のページ"
            className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
          >
            前へ
          </Link>

          <div className="text-sm">{`ページ ${currentPage} / ${pageCount}`}</div>

          <Link
            to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${Math.min(pageCount, currentPage + 1)}&pageSize=${pageSize}`}
            aria-label="次のページ"
            className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
          >
            次へ
          </Link>
        </div>

        {/* Desktop pagination controls (visible on md+) */}
        <div className="hidden md:flex items-center justify-center mt-4 gap-2">
          {(() => {
            const windowSize = 3;
            const start = Math.max(1, currentPage - windowSize);
            const end = Math.min(pageCount, currentPage + windowSize);

            return (
              <nav
                aria-label="ページネーション"
                className="flex items-center gap-2"
              >
                <Link
                  to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${Math.max(1, currentPage - 1)}&pageSize=${pageSize}`}
                  aria-label="前のページ"
                  className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
                >
                  前へ
                </Link>

                <div className="flex items-center gap-1">
                  {start > 1 && (
                    <>
                      <Link
                        to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=1&pageSize=${pageSize}`}
                        className="px-2 py-1 rounded-md border bg-white"
                      >
                        1
                      </Link>
                      {start > 2 && <span className="px-2">…</span>}
                    </>
                  )}

                  {Array.from(
                    { length: end - start + 1 },
                    (_, i) => start + i
                  ).map(p => (
                    <Link
                      key={p}
                      to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${p}&pageSize=${pageSize}`}
                      aria-current={p === currentPage ? 'page' : undefined}
                      className={`px-3 py-2 rounded-md border ${p === currentPage ? 'bg-blue-600 text-white' : 'bg-white'}`}
                    >
                      {p}
                    </Link>
                  ))}

                  {end < pageCount && (
                    <>
                      {end < pageCount - 1 && <span className="px-2">…</span>}
                      <Link
                        to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${pageCount}&pageSize=${pageSize}`}
                        className="px-2 py-1 rounded-md border bg-white"
                      >
                        {pageCount}
                      </Link>
                    </>
                  )}
                </div>

                <Link
                  to={`?q=${encodeURIComponent(qParam)}&fromDate=${encodeURIComponent(fromDateParam)}&toDate=${encodeURIComponent(toDateParam)}&page=${Math.min(pageCount, currentPage + 1)}&pageSize=${pageSize}`}
                  aria-label="次のページ"
                  className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
                >
                  次へ
                </Link>
              </nav>
            );
          })()}
        </div>
      </div>
    </StickyHeaderLayout>
  );
}
