import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form, useFetcher } from 'react-router';
import { consumeToken } from '~/lib/rateLimiter';
import { useState, useEffect, useRef } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import {
  useAnswerUserData,
  useCurrentUserId,
  useInvalidateAnswerUserData,
} from '~/hooks/useAnswerUserData';
// server-only imports are dynamically loaded inside loader/action
import type { Comment } from '~/lib/schemas/comment';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';
import { logger } from '~/lib/logger';

// Shared button styles (mobile-first)
const CONTROL_BTN_BASE =
  'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border';
const CONTROL_BTN_ACTIVE = 'bg-blue-600 text-white border-blue-600';
const CONTROL_BTN_INACTIVE =
  'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;
  // allow optional profileId in query to indicate which user's favorites to prefetch
  // e.g. /topics/123?profileId=<uuid>
  // (in normal use the client may not include this; it's used for server-driven initial state)
  // params passed into loader are only from route params; we can use request to read query params above
  if (!id) {
    throw new Response('Invalid topic id', { status: 400 });
  }
  // Only fetch the topic and answer summaries here.
  // Comments and any user-detail enrichment are intentionally loaded lazily on the client
  // to avoid N+1 and large joins on initial page render.
  const { getTopic, getAnswersByTopic } = await import('~/lib/db');
  const [topic, answers] = await Promise.all([
    getTopic(id),
    getAnswersByTopic(id, profileId),
  ]);

  if (!topic) {
    throw new Response('Not Found', { status: 404 });
  }

  // Enrich answers with displayName when possible so UI shows human names instead of raw ids
  try {
    const { getProfilesByIds } = await import('~/lib/db');
    const profileIds = (answers || [])
      .map(a => (a as any).profileId)
      .filter(Boolean);
    if (profileIds.length) {
      const names = await getProfilesByIds(profileIds);
      const enriched = (answers || []).map(a => ({
        ...(a as any),
        displayName: names[String((a as any).profileId)],
      }));
      // if caller provided a profileId, fetch that profile's favorites for these answers
      if (profileId) {
        try {
          const { getFavoritesForProfile } = await import('~/lib/db');
          const favs = await getFavoritesForProfile(
            profileId,
            enriched.map((a: any) => a.id)
          );
          const favSet = new Set((favs || []).map(v => Number(v)));
          for (const e of enriched)
            (e as any).favorited = favSet.has(Number(e.id));
        } catch {}
      }
      return { topic, answers: enriched } as const;
    }
  } catch {
    // ignore enrichment errors and return base data
  }

  return { topic, answers };
}

function FavoriteButton({
  answerId,
  initialFavorited,
}: {
  answerId: number;
  initialFavorited?: boolean;
}) {
  // Server-backed favorite button: optimistic toggle, server is source-of-truth.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fetcher = useFetcher();
  const [fav, setFav] = useState<boolean>(initialFavorited ?? false);
  const invalidateUserData = useInvalidateAnswerUserData();

  // Update favorite state when initialFavorited prop changes (from user data sync)
  useEffect(() => {
    logger.log(
      `[FavoriteButton ${answerId}] initialFavorited changed:`,
      initialFavorited
    );
    setFav(initialFavorited ?? false);
  }, [initialFavorited, answerId]);

  // Only read identity from localStorage so we can prompt login when necessary.
  // Avoid issuing an automatic POST-per-answer to request favorite status on mount
  // since rendering many answers caused a flood of POST /topics/:id (or /answers)
  // requests. If needed implement a batched status endpoint instead.
  useEffect(() => {
    try {
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      setCurrentUserId(uid);
    } catch {
      setCurrentUserId(null);
    }
  }, [answerId]);

  // Reconcile server response when available (toggle returns { favorited: boolean }).
  useEffect(() => {
    if (!fetcher.data) return;
    try {
      const d =
        typeof fetcher.data === 'string'
          ? JSON.parse(fetcher.data)
          : fetcher.data;
      if (d && typeof d.favorited === 'boolean') {
        logger.log(
          `[FavoriteButton ${answerId}] Server response:`,
          d.favorited
        );
        setFav(Boolean(d.favorited));
        // Invalidate user data cache to ensure fresh data on next fetch
        invalidateUserData([answerId]);
      }
    } catch {}
  }, [fetcher.data, answerId, invalidateUserData]);

  const handleClick = () => {
    if (!currentUserId) {
      try {
        window.location.href = '/login';
      } catch {}
      return;
    }
    // optimistic toggle
    logger.log(`[FavoriteButton ${answerId}] Optimistic toggle: ${!fav}`);
    setFav(s => !s);
    const fd = new FormData();
    fd.set('op', 'toggle');
    fd.set('answerId', String(answerId));
    fd.set('profileId', String(currentUserId));
    fetcher.submit(fd, { method: 'post' });
  };

  return (
    <button
      type="button"
      aria-pressed={fav}
      onClick={handleClick}
      className={`p-2 rounded-md ${fav ? 'text-red-500' : 'text-gray-400 dark:text-white'} hover:opacity-90`}
      title={
        !currentUserId
          ? 'ログインしてお気に入り登録'
          : fav
            ? 'お気に入り解除'
            : 'お気に入り'
      }
    >
      {fav ? (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24z" />
        </svg>
      )}
    </button>
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  // rate-limit lightweight: prefer profileId then ip
  try {
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    let rateKey = 'anon';
    if (profileId) rateKey = `p:${profileId}`;
    else {
      try {
        const hdr =
          request.headers && request.headers.get
            ? request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip')
            : null;
        if (hdr) rateKey = `ip:${String(hdr).split(',')[0].trim()}`;
      } catch {}
    }
    if (!consumeToken(rateKey, 1)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Too Many Requests' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch {}
  // support favorite toggle ops
  const op = form.get('op') ? String(form.get('op')) : undefined;
  if (op === 'toggle') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { toggleFavorite } = await import('~/lib/db');
    try {
      const res = await toggleFavorite({
        answerId: Number(answerId),
        profileId,
      });
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(
        JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  // support favorite status query (non-mutating) for client to ask whether a profile favorited an answer
  if (op === 'status') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { getFavoritesForProfile } = await import('~/lib/db');
    try {
      const list = await getFavoritesForProfile(profileId, [Number(answerId)]);
      const favorited = (list || []).map(Number).includes(Number(answerId));
      return new Response(JSON.stringify({ favorited }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(
        JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  // comment submission (no auth required in this scaffold)
  const commentText = form.get('commentText');
  if (commentText) {
    const answerIdRaw = form.get('answerId');
    // profileId must be supplied by the client; legacy author fields removed
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    if (!answerIdRaw) return new Response('Invalid', { status: 400 });
    if (!profileId) return new Response('Missing profileId', { status: 400 });
    const { addComment, voteAnswer } = await import('~/lib/db');
    try {
      await addComment({
        answerId: String(answerIdRaw),
        text: String(commentText),
        profileId,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      // Log form values and error to aid debugging in server logs
      try {
        const entries: Record<string, any> = {};
        for (const [k, v] of form.entries()) entries[k] = String(v);
        // eslint-disable-next-line no-console
        console.error('addComment failed', {
          entries,
          err: String(e?.message ?? e),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          'addComment failed (failed to serialize form)',
          String(e?.message ?? e)
        );
      }
      return new Response(
        JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  const answerId = Number(form.get('answerId'));
  const levelRaw = Number(form.get('level'));
  const level = levelRaw as 0 | 1 | 2 | 3; // 0 means remove vote
  const previousLevel = form.get('previousLevel')
    ? Number(form.get('previousLevel'))
    : undefined;
  const userId = form.get('userId') ? String(form.get('userId')) : null;
  if (!answerId || ![0, 1, 2, 3].includes(level))
    return new Response('Invalid vote', { status: 400 });
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { voteAnswer } = await import('~/lib/db');
  const updated = await voteAnswer({ answerId, level, previousLevel, userId });
  return { ok: true, answer: updated };
}

export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topic: Topic = data.topic;
  // answers may be annotated with `voters: { id, name, level }[]`
  const answers: any[] = data.answers ?? [];

  // Get current user ID and fetch user-specific data
  const currentUserId = useCurrentUserId();
  const answerIds = answers.map(a => Number(a.id)).filter(Boolean);
  const { data: userData, isLoading: userDataLoading } =
    useAnswerUserData(answerIds);

  // Debug: Check if server-side favorited data exists (client-side only)
  useEffect(() => {
    logger.log(
      '[TopicDetailRoute] Server answers favorited status:',
      answers.slice(0, 3).map(a => ({ id: a.id, favorited: a.favorited }))
    );
    logger.log('[TopicDetailRoute] Current user ID:', currentUserId);
    logger.log('[TopicDetailRoute] User data:', userData);
  }, [answers, currentUserId, userData]);

  // Merge server data with user-specific data
  const enrichedAnswers = answers.map(answer => {
    const favorited = userData
      ? userData.favorites.has(answer.id)
      : answer.favorited;
    return {
      ...answer,
      votesBy: userData?.votes[answer.id]
        ? { [currentUserId!]: userData.votes[answer.id] }
        : answer.votesBy || {},
      favorited,
    };
  });

  // Debug enriched answers (client-side only)
  useEffect(() => {
    enrichedAnswers.slice(0, 3).forEach(answer => {
      logger.log(
        `[TopicDetailRoute] Answer ${answer.id}: server=${answers.find(a => a.id === answer.id)?.favorited}, client=${userData?.favorites.has(answer.id)}, final=${answer.favorited}`
      );
    });
  }, [enrichedAnswers, userData, answers]);

  // votes are handled locally for now; no server roundtrip on click.

  return (
    <StickyHeaderLayout
      header={
        <div
          className={`z-30 ${
            topic.image
              ? 'bg-transparent pt-0 pb-0'
              : 'bg-white dark:bg-gray-950 pt-4 pb-2'
          }`}
        >
          <div className="mb-4">
            <div className="w-full">
              {topic.image ? (
                <div className="block p-0 border rounded-md overflow-hidden">
                  <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <img
                      src={topic.image}
                      alt={topic.title}
                      className="w-full h-auto max-h-60 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <h1 className="text-2xl md:text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">
                  {topic.title}
                </h1>
              )}
            </div>
          </div>
        </div>
      }
    >
      {userDataLoading && currentUserId ? (
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-gray-500">ユーザーデータを同期中...</div>
        </div>
      ) : null}
      {enrichedAnswers.length === 0 ? (
        <p className="text-gray-600">まだ回答が投稿されていません。</p>
      ) : (
        <ProgressiveAnswersList
          answers={enrichedAnswers}
          topicId={String(topic.id)}
        />
      )}
    </StickyHeaderLayout>
  );
}

function ProgressiveAnswersList({
  answers,
  topicId,
}: {
  answers: any[];
  topicId: string;
}) {
  const PAGE = 10;
  const [count, setCount] = useState(Math.min(PAGE, answers.length));
  const visible = answers.slice(0, count);
  return (
    <div>
      <ul className="space-y-5 px-1">
        {visible.map((a: any) => (
          <AnswerCard key={a.id} answer={a} topicId={topicId} />
        ))}
      </ul>
      {count < answers.length ? (
        // add safe-area bottom padding so the button is reachable on devices with home indicator / footers
        <div
          className="mt-4 flex justify-center"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
          }}
        >
          <div className="w-full max-w-xs flex justify-center">
            <button
              className="px-4 py-2 rounded-md border bg-white dark:bg-gray-800 mb-4"
              onClick={() => setCount(c => Math.min(answers.length, c + PAGE))}
              aria-label={`もっと見る (${answers.length - count} 件)`}
            >
              もっと見る ({answers.length - count} 件)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumericVoteButtons({
  answerId,
  initialVotes,
  votesBy,
}: {
  answerId: number;
  initialVotes: { level1: number; level2: number; level3: number };
  votesBy?: Record<string, number>;
}) {
  // local state for counts and selection. This intentionally keeps votes client-side only for now.
  const key = `vote:answer:${answerId}`;
  const readStored = () => {
    try {
      // prefer selected sub-user id so votes are attributed to sub-accounts
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      if (!uid) return null;

      // First check if we have server-side votesBy data
      if (votesBy && uid in votesBy) {
        return votesBy[uid] as 1 | 2 | 3;
      }

      // Fallback to localStorage
      const k = `vote:answer:${answerId}:user:${uid}`;
      const v = localStorage.getItem(k);
      return v ? (Number(v) as 1 | 2 | 3) : null;
    } catch {
      return null;
    }
  };

  const [selection, setSelection] = useState<1 | 2 | 3 | null>(
    typeof window !== 'undefined' ? readStored() : null
  );

  // Update selection when votesBy prop changes (from user data sync)
  useEffect(() => {
    const newSelection = readStored();
    setSelection(newSelection);
  }, [votesBy]);

  // counts are intentionally not shown in the UI; keep local state for potential future use
  const [counts, setCounts] = useState(() => ({ ...initialVotes }));

  const handleVote = (level: 1 | 2 | 3) => {
    const prev = selection;
    const isToggleOff = prev === level; // user clicked the same level -> remove vote

    // update counts locally first (optimistic)
    setCounts(c => {
      const next = { ...c };
      if (prev === 1) next.level1 = Math.max(0, next.level1 - 1);
      if (prev === 2) next.level2 = Math.max(0, next.level2 - 1);
      if (prev === 3) next.level3 = Math.max(0, next.level3 - 1);
      if (!isToggleOff) {
        if (level === 1) next.level1 = (next.level1 || 0) + 1;
        if (level === 2) next.level2 = (next.level2 || 0) + 1;
        if (level === 3) next.level3 = (next.level3 || 0) + 1;
      }
      return next;
    });

    try {
      const uid =
        localStorage.getItem('currentSubUserId') ||
        localStorage.getItem('currentUserId');
      if (!uid) {
        try {
          window.location.href = '/login';
        } catch {}
        return;
      }
      const k = `vote:answer:${answerId}:user:${uid}`;
      if (isToggleOff) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, String(level));
      }
    } catch {}
    setSelection(isToggleOff ? null : level);

    // send vote (or removal) to server action so DB is updated
    (async () => {
      try {
        const form = new FormData();
        form.append('answerId', String(answerId));
        form.append('level', String(isToggleOff ? 0 : level)); // 0 means remove
        if (typeof prev === 'number')
          form.append('previousLevel', String(prev));
        const uid =
          localStorage.getItem('currentSubUserId') ||
          localStorage.getItem('currentUserId') ||
          '';
        form.append('userId', String(uid));

        const res = await fetch(window.location.pathname, {
          method: 'POST',
          body: form,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          // eslint-disable-next-line no-console
          console.error('vote submit failed', res.status, text);
          return;
        }

        const json = await res.json().catch(() => null);
        if (json && json.answer && json.answer.votes) {
          try {
            setCounts({
              level1: Number(json.answer.votes.level1 ?? 0),
              level2: Number(json.answer.votes.level2 ?? 0),
              level3: Number(json.answer.votes.level3 ?? 0),
            });
          } catch {}
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('vote submit error', e);
      }
    })();
  };

  const btnBase = CONTROL_BTN_BASE + ' gap-2 px-3';
  const active = CONTROL_BTN_ACTIVE;
  const inactive = CONTROL_BTN_INACTIVE;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        className={`${btnBase} ${selection === 1 ? active : inactive}`}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </button>

      <button
        onClick={() => handleVote(2)}
        className={`${btnBase} ${selection === 2 ? active : inactive}`}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </button>

      <button
        onClick={() => handleVote(3)}
        className={`${btnBase} ${selection === 3 ? active : inactive}`}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </button>
    </div>
  );
}

// in-memory client cache for comments to avoid repeat fetches while the user navigates
const clientCommentsCache = new Map<string, any[]>();
// track in-flight comment fetches so parallel renders or re-entrancy reuse the same promise
const clientCommentsInFlight = new Map<string, Promise<any[]>>();

function AnswerCard({
  answer,
  comments,
  topicId,
}: {
  answer: any;
  comments?: Comment[];
  topicId?: string;
}) {
  const a = answer;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // prefer sub-user selection when present
      setCurrentUserId(
        localStorage.getItem('currentSubUserId') ??
          localStorage.getItem('currentUserId')
      );
      setCurrentUserName(
        localStorage.getItem('currentSubUserName') ??
          localStorage.getItem('currentUserName')
      );
    } catch {
      setCurrentUserId(null);
      setCurrentUserName(null);
    }
  }, []);
  const votes = a.votes ?? { level1: 0, level2: 0, level3: 0 };
  const [open, setOpen] = useState(false);
  const detailsId = `answer-details-${a.id}`;
  const [loadingComments, setLoadingComments] = useState(false);
  const [fetchedComments, setFetchedComments] = useState<Comment[] | null>(
    comments ?? null
  );
  // fetcher & refs for comment submission (useFetcher must be at component top-level)
  const fetcher = useFetcher();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastSubmittedText = useRef<string | null>(null);
  const lastTmpId = useRef<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // watch for submission result and handle success / failure (replace or rollback)
  useEffect(() => {
    if (!fetcher) return;
    if (fetcher.state === 'idle' && fetcher.data !== undefined) {
      const data = fetcher.data as any;
      const key = String(a.id);
      const tmpId = lastTmpId.current;

      if (data && data.ok) {
        // success: if server returned full comment, replace tmp; otherwise mark pending false
        try {
          if (tmpId) {
            if (data.comment) {
              setFetchedComments(prev =>
                prev
                  ? prev.map(c =>
                      String(c.id) === String(tmpId) ? data.comment : c
                    )
                  : [data.comment]
              );
              // update cache: replace tmp in cached array
              const cached = clientCommentsCache.get(key) || [];
              clientCommentsCache.set(
                key,
                cached.map((c: any) =>
                  String(c.id) === String(tmpId) ? data.comment : c
                )
              );
            } else {
              // no comment returned: mark pending false
              setFetchedComments(prev =>
                prev
                  ? prev.map(c =>
                      String(c.id) === String(tmpId)
                        ? { ...c, pending: false }
                        : c
                    )
                  : prev
              );
              const cached = clientCommentsCache.get(key) || [];
              clientCommentsCache.set(
                key,
                cached.map((c: any) =>
                  String(c.id) === String(tmpId) ? { ...c, pending: false } : c
                )
              );
            }
          }
        } catch {}
        // clear input
        try {
          if (inputRef.current) inputRef.current.value = '';
        } catch {}
      } else {
        // failure: remove tmp comment and notify
        try {
          if (tmpId) {
            setFetchedComments(prev =>
              prev ? prev.filter(c => String(c.id) !== String(tmpId)) : prev
            );
            const cached = clientCommentsCache.get(key) || [];
            clientCommentsCache.set(
              key,
              cached.filter((c: any) => String(c.id) !== String(tmpId))
            );
          }
        } catch {}
        setToast((data && data.message) || 'コメントの保存に失敗しました');
      }

      lastTmpId.current = null;
      lastSubmittedText.current = null;
    }
  }, [fetcher.state, fetcher.data]);
  // fetch function that deduplicates in-flight fetches and uses client cache
  const fetchCommentsOnce = async () => {
    const key = String(a.id);

    // prefer cache presence check (handles empty arrays too)
    if (clientCommentsCache.has(key)) {
      setFetchedComments(clientCommentsCache.get(key) ?? []);
      return;
    }

    // if another fetch is already running for this key, await it
    if (clientCommentsInFlight.has(key)) {
      try {
        const p = clientCommentsInFlight.get(key)!;
        const cs = await p;
        setFetchedComments(cs);
      } catch {
        setFetchedComments([]);
      }
      return;
    }

    let cancelled = false;
    setLoadingComments(true);

    const promise = (async () => {
      try {
        const res = await fetch(`/topics/${topicId}/comments/${a.id}`, {
          cache: 'no-cache',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return [] as Comment[];

        // Read as text first to avoid "body already read" when json() fails.
        let text: string | null = null;
        try {
          text = await res.text();
        } catch {
          text = null;
        }

        if (!text) return [] as Comment[];

        try {
          const parsed = JSON.parse(text);
          return (parsed && parsed.comments) || [];
        } catch {
          return [] as Comment[];
        }
      } catch {
        return [] as Comment[];
      }
    })();

    clientCommentsInFlight.set(key, promise);
    try {
      const cs = await promise;
      clientCommentsCache.set(key, cs);
      if (!cancelled) setFetchedComments(cs);
    } finally {
      clientCommentsInFlight.delete(key);
      if (!cancelled) setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    // trigger fetch when opened (deduplicated by fetchCommentsOnce)
    fetchCommentsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <li className="p-4 md:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md shadow-sm">
        <div className="flex flex-col gap-3">
          <p className="mt-0 text-2xl md:text-4xl leading-relaxed text-gray-800 dark:text-gray-100">
            {a.text}
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setOpen(s => !s)}
                className={`w-full md:w-auto ${CONTROL_BTN_BASE} text-blue-600 bg-transparent hover:bg-blue-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                aria-expanded={open}
                aria-controls={detailsId}
              >
                {open ? '詳細を閉じる' : '詳細を見る'}
              </button>
            </div>

            <div className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <FavoriteButton
                  answerId={a.id}
                  initialFavorited={(a as any).favorited}
                />
                <NumericVoteButtons
                  answerId={a.id}
                  initialVotes={votes}
                  votesBy={(a as any).votesBy}
                />
              </div>
            </div>
          </div>

          {open ? (
            <div id={detailsId} className="mt-3">
              <p className="text-xs text-gray-500 dark:text-white">
                {new Date(a.created_at).toLocaleString()}
              </p>
              {(a as any).displayName || a.profileId ? (
                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-white">
                  — {(a as any).displayName ?? a.profileId}
                </p>
              ) : null}
              {/* comments: lazy-load only when user opens details */}
              <div className="mt-4">
                <h4 className="text-sm font-medium">コメント</h4>
                {loadingComments ? (
                  <div className="text-sm text-gray-500 dark:text-white">
                    読み込み中…
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {(fetchedComments || []).map(c => (
                      <li key={c.id} className="text-gray-700 dark:text-white">
                        <div className="whitespace-pre-wrap">{c.text}</div>
                        <span className="text-xs text-gray-400 dark:text-white">
                          —{' '}
                          {(c as any).displayName ??
                            (c as any).profileId ??
                            '名無し'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3">
                  <div className="text-muted mb-2">
                    コメントとして: {currentUserName ?? '名無し'}
                  </div>
                  {/* useFetcher to submit without redirect and provide immediate UI feedback */}
                  <fetcher.Form
                    method="post"
                    ref={formRef}
                    className="flex gap-2"
                    onSubmit={() => {
                      // perform the same optimistic add used by keyboard shortcut
                      try {
                        const text = inputRef.current?.value ?? '';
                        lastSubmittedText.current = text;
                        const tmpId = `tmp-${Date.now()}`;
                        lastTmpId.current = tmpId;
                        const newComment = {
                          id: tmpId,
                          text,
                          profileId: currentUserId ?? undefined,
                          displayName: currentUserName ?? undefined,
                          created_at: new Date().toISOString(),
                          pending: true,
                        } as any;
                        setFetchedComments(prev =>
                          prev ? [newComment, ...prev] : [newComment]
                        );
                        const key = String(a.id);
                        const cached = clientCommentsCache.get(key) || [];
                        clientCommentsCache.set(key, [newComment, ...cached]);
                        // clear input immediately so UI feels responsive
                        try {
                          if (inputRef.current) inputRef.current.value = '';
                        } catch {}
                      } catch {}
                    }}
                  >
                    <input type="hidden" name="answerId" value={String(a.id)} />
                    <input
                      type="hidden"
                      name="profileId"
                      value={currentUserId ?? ''}
                    />
                    {/* authorName removed: profileId is authoritative identity for comments */}
                    <textarea
                      name="commentText"
                      ref={inputRef}
                      className={`form-input flex-1 min-h-[44px] resize-y p-2 rounded-md ${fetcher.state === 'submitting' ? 'opacity-60' : ''}`}
                      placeholder="コメントを追加"
                      aria-label="コメント入力"
                      rows={3}
                      disabled={fetcher.state === 'submitting'}
                      onKeyDown={e => {
                        const isEnter = e.key === 'Enter';
                        const isMeta = e.metaKey || e.ctrlKey;
                        if (isEnter && isMeta) {
                          e.preventDefault();
                          try {
                            // perform optimistic add first so UI updates immediately
                            const text = inputRef.current?.value ?? '';
                            lastSubmittedText.current = text;
                            const tmpId = `tmp-${Date.now()}`;
                            lastTmpId.current = tmpId;
                            const newComment = {
                              id: tmpId,
                              text,
                              displayName: currentUserName ?? undefined,
                              created_at: new Date().toISOString(),
                              pending: true,
                            } as any;
                            setFetchedComments(prev =>
                              prev ? [newComment, ...prev] : [newComment]
                            );
                            const key = String(a.id);
                            const cached = clientCommentsCache.get(key) || [];
                            clientCommentsCache.set(key, [
                              newComment,
                              ...cached,
                            ]);

                            // then programmatic submit using fetcher so action runs
                            if (formRef.current) {
                              const fd = new FormData(formRef.current);
                              fetcher.submit(fd, { method: 'post' });
                              // clear input immediately after submitting
                              try {
                                if (inputRef.current)
                                  inputRef.current.value = '';
                              } catch {}
                            }
                          } catch {}
                        }
                      }}
                    />
                    <button
                      className={`btn-inline ${fetcher.state === 'submitting' ? 'opacity-60 pointer-events-none' : ''} flex items-center gap-2`}
                      aria-label="コメントを送信"
                      aria-busy={fetcher.state === 'submitting'}
                      disabled={fetcher.state === 'submitting'}
                    >
                      {fetcher.state === 'submitting' ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          送信中…
                        </>
                      ) : (
                        '送信'
                      )}
                    </button>
                  </fetcher.Form>
                </div>
              </div>

              {a.voters && a.voters.length > 0 ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  投票者:{' '}
                  {a.voters.map((v: any, i: number) => (
                    <span key={v.id} className="mr-3">
                      {v.name} ({v.level}){i < a.voters.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </li>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className="bg-red-600 text-white px-4 py-2 rounded-md shadow-lg"
            role="status"
            aria-live="polite"
          >
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );
}
