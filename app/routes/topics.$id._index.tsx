import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';

/**
 * 概要: トピック詳細ページ（/topics/:id）。初期ロードを最小化し TTFB / LCP を改善。
 * Intent: 初期表示は Topic と最初の回答ページのみ取得し、残りはユーザー操作時 / スクロールで段階取得。
 * Contract:
 *   - loader: returns { topic, firstPage: Promise<{ answers: Answer[]; nextCursor: string | null }> }
 *   - answers は created_at desc。ページサイズ固定 PAGE_SIZE。
 * Environment:
 *   - dev: mock 経由
 *   - prod: Supabase クエリ with limit/lt(created_at)
 * Errors: loader 内例外は 4xx/5xx Response として伝播。
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  if (!id) throw new Response('Invalid topic id', { status: 400 });
  const { getTopic } = await import('~/lib/db');
  const topic = await getTopic(id);
  if (!topic) throw new Response('Not Found', { status: 404 });
  // defer first page so shell (topic header) streams quickly
  const { getAnswersPageByTopic } = await import('~/lib/db');
  const firstPage = await getAnswersPageByTopic({ topicId: id, cursor: null });
  return { topic, firstPage } as const;
}

/** 単一回答カード (コメントは開閉時に取得) */
function AnswerCard({ answer }: { answer: Answer }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  // loader data already includes topic id via parent

  useEffect(() => {
    if (!open || comments) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`comments/${answer.id}`);
        if (!res.ok) throw new Error('comment fetch failed');
        const json = await res.json();
        if (!cancelled) setComments(json.comments || []);
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, comments, answer.id]);

  return (
    <li className="p-4 border rounded-md bg-white/80 dark:bg-gray-900/80">
      <div className="flex flex-col gap-2">
        <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
          {answer.text}
        </p>
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="text-sm text-blue-600 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-gray-800"
            aria-expanded={open}
          >
            {open ? '閉じる' : '詳細'}
          </button>
        </div>
        {open && (
          <div className="mt-2 text-sm">
            <p className="text-xs text-gray-500">
              {new Date(answer.created_at).toLocaleString()}
            </p>
            {answer.author && (
              <p className="mt-1 text-xs text-gray-400 dark:text-white">
                — {answer.author}
              </p>
            )}
            <div className="mt-3">
              <h4 className="font-medium">コメント</h4>
              {loading ? (
                <div className="text-gray-500">読み込み中…</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(comments || []).map(c => (
                    <li key={c.id} className="text-gray-700 text-xs">
                      {c.text}{' '}
                      <span className="text-[10px] text-gray-400 dark:text-white">
                        — {c.author || '名無し'}
                      </span>
                    </li>
                  ))}
                  {comments && comments.length === 0 && (
                    <li className="text-gray-400 text-xs dark:text-white">
                      コメントはまだありません。
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function TopicRoute() {
  const { topic, firstPage } = useLoaderData() as {
    topic: Topic;
    firstPage: { answers: Answer[]; nextCursor: string | null };
  };

  const [pages, setPages] = useState<Answer[][]>([firstPage.answers]);
  const [cursor, setCursor] = useState<string | null>(firstPage.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);

  // after first page resolves, push into pages state
  // first page already in state

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/topics/${topic.id}/answers?cursor=${encodeURIComponent(cursor)}`
      );
      if (res.ok) {
        const json = await res.json();
        setPages(prev => [...prev, json.answers]);
        setCursor(json.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, topic.id]);

  // intersection observer for auto-load on scroll (mobile friendly)
  useEffect(() => {
    if (!cursor) return; // nothing more
    const btn = loadMoreRef.current;
    if (!btn) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) loadMore();
        });
      },
      { rootMargin: '200px' }
    );
    io.observe(btn);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <div
      style={{ paddingTop: 'var(--app-header-height, 0px)' }}
      className="p-4 max-w-3xl mx-auto"
    >
      <header className="mb-4">
        <h1 className="text-2xl font-bold leading-tight break-words">
          {topic.title}
        </h1>
      </header>
      <div>
        {pages.flat().length === 0 ? (
          <p className="text-gray-600">まだ回答が投稿されていません。</p>
        ) : (
          <ul className="space-y-4">
            {pages.flat().map(a => (
              <AnswerCard key={a.id} answer={a} />
            ))}
          </ul>
        )}
        {cursor && (
          // Ensure the load-more control is not hidden behind mobile footers / safe-area insets.
          <div
            className="mt-6 flex justify-center"
            // add extra padding for devices with safe-area inset (iPhone home indicator / app footer)
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
            }}
          >
            <div className="w-full max-w-xs flex justify-center">
              <button
                ref={loadMoreRef}
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-md border bg-white disabled:opacity-50 mb-4"
                aria-label="もっと見る"
              >
                {loadingMore ? '読み込み中…' : 'もっと見る'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
