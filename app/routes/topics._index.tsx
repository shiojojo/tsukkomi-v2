import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { getTopics } from '~/lib/db';
import type { Topic } from '~/lib/schemas/topic';

export async function loader(_args: LoaderFunctionArgs) {
  const topics = await getTopics();
  return { topics };
}

export default function TopicsRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topics: Topic[] = data?.topics ?? [];
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(t => String(t.title).toLowerCase().includes(q));
  }, [topics, query]);

  // Pagination (mobile-first): page numbers start at 1
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20; // reasonable mobile page size for large lists

  // reset page when query changes to keep user on first page of results
  useEffect(() => {
    setPage(1);
  }, [query]);

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
    </div>
  );
}
