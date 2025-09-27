import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import AnswerActionCard from '~/components/AnswerActionCard';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';
import { logger } from '~/lib/logger';
import { consumeToken } from '~/lib/rateLimiter';

const _recentPostGuard = new Map<string, number>();

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  const base = {
    answers: [] as Answer[],
    topicsById: {} as Record<string, Topic>,
    commentsByAnswer: {} as Record<string, Comment[]>,
    users: [] as User[],
    requiresProfileId: true,
    profileId: profileId ?? null,
  };

  if (!profileId) {
    return base;
  }

  const {
    getFavoriteAnswersForProfile,
    getTopics,
    getCommentsForAnswers,
    getUsers,
  } = await import('~/lib/db');

  const answers = await getFavoriteAnswersForProfile(profileId);
  const answerIds = answers.map(a => a.id);
  const commentsByAnswer = answerIds.length
    ? await getCommentsForAnswers(answerIds)
    : {};
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  const users = await getUsers({ limit: 500 });

  return {
    answers,
    topicsById,
    commentsByAnswer,
    users,
    requiresProfileId: false,
    profileId,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const op = form.get('op') ? String(form.get('op')) : undefined;

  // rate limiting keyed by profile or IP
  try {
    const profileIdCandidate = form.get('profileId')
      ? String(form.get('profileId'))
      : form.get('userId')
        ? String(form.get('userId'))
        : undefined;
    let rateKey = 'anon';
    if (profileIdCandidate) rateKey = `p:${profileIdCandidate}`;
    else {
      try {
        const hdr =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip');
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

  if (op === 'toggle') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    try {
      const key = `toggle:${String(profileId)}:${String(answerId)}`;
      const now = Date.now();
      const prev = _recentPostGuard.get(key) ?? 0;
      if (now - prev < 800) {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      _recentPostGuard.set(key, now);
    } catch {}
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
    } catch (error: any) {
      logger.error('toggleFavorite failed', error);
      return new Response(
        JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

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
    } catch (error: any) {
      return new Response(
        JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const levelRaw = form.get('level');
  if (levelRaw != null) {
    const answerId = Number(form.get('answerId'));
    const userId = form.get('userId') ? String(form.get('userId')) : undefined;
    const previousLevel = form.get('previousLevel')
      ? Number(form.get('previousLevel'))
      : undefined;
    const levelParsed = Number(levelRaw);
    const level = levelParsed === 0 ? 0 : (levelParsed as 1 | 2 | 3);
    if (!answerId || !userId || level == null) {
      return new Response('Invalid vote', { status: 400 });
    }
    const { voteAnswer } = await import('~/lib/db');
    const updated = await voteAnswer({
      answerId,
      level,
      previousLevel,
      userId,
    });
    return new Response(JSON.stringify({ answer: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const answerId = form.get('answerId');
  const text = String(form.get('text') || '');
  const profileId = form.get('profileId')
    ? String(form.get('profileId'))
    : undefined;
  if (!answerId || !text) {
    return new Response('Invalid', { status: 400 });
  }
  if (!profileId) {
    return new Response('Missing profileId', { status: 400 });
  }
  const { addComment } = await import('~/lib/db');
  try {
    await addComment({
      answerId: String(answerId),
      text,
      profileId,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('addComment failed', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default function FavoriteAnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers = data.answers ?? [];
  const topicsById = data.topicsById ?? {};
  const commentsByAnswer = data.commentsByAnswer ?? {};
  const users: User[] = data.users ?? [];
  const requiresProfileId = data.requiresProfileId;
  const profileIdFromLoader = data.profileId ?? null;

  const usersById = useMemo(
    () => Object.fromEntries(users.map(u => [String(u.id), u])),
    [users]
  );

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
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

  useEffect(() => {
    if (!requiresProfileId) return;
    if (!currentUserId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('profileId', currentUserId);
      navigate(`${url.pathname}${url.search}`, { replace: true });
    } catch {}
  }, [requiresProfileId, currentUserId, navigate]);

  const answerIds = answers.map(a => a.id);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(
    answerIds,
    Boolean(currentUserId)
  );
  const [visibleAnswers, setVisibleAnswers] = useState<Answer[]>(answers);

  useEffect(() => {
    setVisibleAnswers(answers);
  }, [answers]);

  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    const found = usersById[String(pid)];
    return found ? found.name : undefined;
  };

  const headerNode = (
    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">お気に入り</h1>
          <Form method="get" action="/answers" className="hidden md:block">
            <button className="text-sm text-blue-600 hover:underline">
              回答一覧へ
            </button>
          </Form>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">
          保存した回答をまとめて採点・コメントできます。
        </p>
      </div>
    </div>
  );

  if (requiresProfileId && !currentUserId) {
    return (
      <StickyHeaderLayout header={headerNode}>
        <div className="px-4 py-8 space-y-4">
          <p className="text-sm text-gray-600">
            お気に入り一覧を表示するには、まずログインしてユーザーを選択してください。
          </p>
          <Form method="get" action="/login" className="inline">
            <button className="btn-inline">ログインへ</button>
          </Form>
        </div>
      </StickyHeaderLayout>
    );
  }

  if (!answers.length) {
    return (
      <StickyHeaderLayout header={headerNode}>
        <div className="px-4 py-8 space-y-3">
          <h2 className="text-lg font-semibold">お気に入りはまだありません</h2>
          <p className="text-sm text-gray-600">
            /answers
            から気になる回答をお気に入り登録しておくと、ここでまとめて採点やコメントができます。
          </p>
          <Form method="get" action="/answers" className="inline">
            <button className="btn-inline">回答一覧へ戻る</button>
          </Form>
        </div>
      </StickyHeaderLayout>
    );
  }

  return (
    <StickyHeaderLayout header={headerNode}>
      <div className="px-4 pb-20">
        <h2 className="text-lg font-semibold mb-4">お気に入りの回答</h2>
        <p className="text-sm text-gray-600 mb-6">
          保存した回答に対して、採点とコメントができます。採点は 1〜3 の 3
          段階です。
        </p>
        {visibleAnswers.length === 0 ? (
          <div className="py-10 text-sm text-gray-500">
            すべてのお気に入りが解除されました。新しいお気に入りを追加するとここに表示されます。
          </div>
        ) : (
          <ul className="space-y-4">
            {visibleAnswers.map(answer => (
              <AnswerActionCard
                key={answer.id}
                answer={answer}
                topic={
                  topicsById[String((answer as any).topicId ?? '')] ?? null
                }
                comments={commentsByAnswer[String(answer.id)] ?? []}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                getNameByProfileId={getNameByProfileId}
                userAnswerData={userAnswerData}
                onFavoriteUpdate={(id, favorited) => {
                  markFavorite(id, favorited);
                  if (!favorited) {
                    setVisibleAnswers(prev => prev.filter(a => a.id !== id));
                  }
                }}
                actionPath="/answers/favorites"
                profileIdForVotes={profileIdFromLoader ?? currentUserId}
              />
            ))}
          </ul>
        )}
      </div>
    </StickyHeaderLayout>
  );
}
