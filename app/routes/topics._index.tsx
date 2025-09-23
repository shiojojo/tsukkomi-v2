import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
// server-only import
import type { Topic } from '~/lib/schemas/topic';

export async function loader(_args: LoaderFunctionArgs) {
  const { getTopics } = await import('~/lib/db');
  const topics = await getTopics();
  return { topics };
}

export default function TopicsRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topics: Topic[] = data?.topics ?? [];
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter(t => {
      try {
        // title filter
        if (q && !String(t.title).toLowerCase().includes(q)) return false;

        // dateFrom
        if (dateFrom) {
          const from = new Date(dateFrom + 'T00:00:00');
          if (!t.created_at) return false;
          if (new Date(t.created_at) < from) return false;
        }

        // dateTo
        if (dateTo) {
          const to = new Date(dateTo + 'T23:59:59');
          if (!t.created_at) return false;
          if (new Date(t.created_at) > to) return false;
        }

        return true;
      } catch {
        return false;
      }
    });
  }, [topics, query, dateFrom, dateTo]);

  // Pagination (mobile-first): page numbers start at 1
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20; // reasonable mobile page size for large lists

  // reset page when query changes to keep user on first page of results
  useEffect(() => {
    setPage(1);
  }, [query, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // clamp page to valid range
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pagedTopics = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="p-4 pb-24 md:pb-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">お題一覧</h1>
      <div className="mb-4">
        <input
          type="search"
          placeholder="検索: お題タイトル"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="form-input w-full"
          aria-label="お題を検索"
        />

        <div className="mt-2 flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="form-input w-36"
            aria-label="開始日"
            placeholder="開始日"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="form-input w-36"
            aria-label="終了日"
            placeholder="終了日"
          />
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="text-sm text-gray-600 hover:underline ml-2"
          >
            クリア
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {pagedTopics.map(t => (
          <li key={t.id}>
            <Link
              to={`/topics/${t.id}`}
              className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`お題 ${t.title} の回答を見る`}
            >
              {t.image ? (
                // Image-only topic: show the entire photo (no cropping).
                <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                  <img
                    src={t.image}
                    alt={t.title}
                    className="w-full h-auto max-h-60 object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <h2 className="text-lg font-medium">{t.title}</h2>
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {/* Mobile pagination controls */}
      <div className="flex items-center justify-between mt-4 md:hidden">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="前のページ"
          className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          前へ
        </button>

        <div className="text-sm">{`ページ ${currentPage} / ${pageCount}`}</div>

        <button
          onClick={() => setPage(p => Math.min(pageCount, p + 1))}
          disabled={currentPage >= pageCount}
          aria-label="次のページ"
          className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          次へ
        </button>
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
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="前のページ"
                className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
              >
                前へ
              </button>

              <div className="flex items-center gap-1">
                {start > 1 && (
                  <>
                    <button
                      onClick={() => setPage(1)}
                      className="px-2 py-1 rounded-md border bg-white"
                    >
                      1
                    </button>
                    {start > 2 && <span className="px-2">…</span>}
                  </>
                )}

                {Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i
                ).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className={`px-3 py-2 rounded-md border ${p === currentPage ? 'bg-blue-600 text-white' : 'bg-white'}`}
                  >
                    {p}
                  </button>
                ))}

                {end < pageCount && (
                  <>
                    {end < pageCount - 1 && <span className="px-2">…</span>}
                    <button
                      onClick={() => setPage(pageCount)}
                      className="px-2 py-1 rounded-md border bg-white"
                    >
                      {pageCount}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                aria-label="次のページ"
                className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
              >
                次へ
              </button>
            </nav>
          );
        })()}
      </div>
    </div>
  );
}
