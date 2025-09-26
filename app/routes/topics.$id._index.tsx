import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  if (!id) throw new Response('Invalid topic id', { status: 400 });
  const { getTopic } = await import('~/lib/db');
  const topic = await getTopic(id);
  if (!topic) throw new Response('Not Found', { status: 404 });
  // defer first page so shell (topic header) streams quickly
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;
  const { getAnswersPageByTopic } = await import('~/lib/db');
  const firstPage = await getAnswersPageByTopic({
    topicId: id,
    cursor: null,
    profileId,
  });
  // enrich answers with displayName when possible to avoid exposing raw profile ids
  try {
    const { getProfilesByIds } = await import('~/lib/db');
    const profileIds = (firstPage.answers || [])
      .map(a => (a as any).profileId)
      .filter(Boolean);
    if (profileIds.length) {
      const names = await getProfilesByIds(profileIds);
      const enriched = {
        ...firstPage,
        answers: (firstPage.answers || []).map(a => ({
          ...(a as any),
          displayName: names[String((a as any).profileId)],
        })),
      };
      return { topic, firstPage: enriched } as const;
    }
  } catch {
    // ignore enrichment errors; return base data
  }
  return { topic, firstPage } as const;
}

/** 単一回答カード (コメントは開閉時に取得) */
function AnswerCard({ answer }: { answer: Answer }) {
  const [open, setOpen] = useState(false);
  // コメントは開いた時だけ取得しキャッシュ（再オープン高速化）
  const { data: comments = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['answerComments', answer.id],
    queryFn: async () => {
      const res = await fetch(`comments/${answer.id}`);
      if (!res.ok) throw new Error('comment fetch failed');
      return (await res.json()).comments || [];
    },
    enabled: open, // 開いた時のみ fetch
    staleTime: 30_000,
  });

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
            {(answer as any).displayName || answer.profileId ? (
              <p className="mt-1 text-xs text-gray-400 dark:text-white">
                — {(answer as any).displayName ?? answer.profileId}
              </p>
            ) : null}
            <div className="mt-3">
              <h4 className="font-medium">コメント</h4>
              {loading ? (
                <div className="text-gray-500">読み込み中…</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(comments || []).map(c => (
                    <li key={c.id} className="text-gray-700 text-xs">
                      <div className="whitespace-pre-wrap">{c.text}</div>{' '}
                      <span className="text-[10px] text-gray-400 dark:text-white">
                        —{' '}
                        {(c as any).displayName ??
                          (c as any).profileId ??
                          '名無し'}
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

  // React Query による無限ロード（初期ページは loader 経由で既に取得済み）
  type AnswersPage = { answers: Answer[]; nextCursor: string | null };
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery<
      AnswersPage,
      Error,
      AnswersPage,
      [string, string | number]
    >({
      queryKey: ['topicAnswers', String(topic.id)],
      queryFn: async ({ pageParam }) => {
        const cursorParam = pageParam
          ? `?cursor=${encodeURIComponent(String(pageParam))}`
          : '';
        const res = await fetch(`/topics/${topic.id}/answers${cursorParam}`);
        if (!res.ok) throw new Error('failed to fetch answers');
        return (await res.json()) as AnswersPage;
      },
      initialPageParam: null,
      getNextPageParam: last => last.nextCursor,
      initialData: {
        pages: [firstPage as AnswersPage],
        pageParams: [null],
      },
      staleTime: 10_000,
    });

  const flatAnswers: Answer[] = Array.isArray((data as any)?.pages)
    ? (data as any).pages.flatMap((p: AnswersPage) => p.answers)
    : [];

  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // IntersectionObserver で自動追加読み込み（モバイル親和性）
  useEffect(() => {
    if (!hasNextPage) return;
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
  }, [hasNextPage, loadMore]);

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
        {flatAnswers.length === 0 ? (
          <p className="text-gray-600">まだ回答が投稿されていません。</p>
        ) : (
          <ul className="space-y-4">
            {flatAnswers.map(a => (
              <AnswerCard key={a.id} answer={a} />
            ))}
          </ul>
        )}
        {hasNextPage && (
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
                disabled={isFetchingNextPage}
                className="px-4 py-2 rounded-md border bg-white disabled:opacity-50 mb-4"
                aria-label="もっと見る"
              >
                {isFetchingNextPage ? '読み込み中…' : 'もっと見る'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
