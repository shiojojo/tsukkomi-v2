import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form, useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { getAnswers, getTopics } from '~/lib/db';
import { getCommentsByAnswer, addComment } from '~/lib/db';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';

export async function loader({ request }: LoaderFunctionArgs) {
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  const answers = await getAnswers();
  // collect comments per-answer in dev
  const commentsByAnswer: Record<string, Comment[]> = {};
  for (const a of answers) {
    const comments = await getCommentsByAnswer(a.id);
    commentsByAnswer[String(a.id)] = comments;
  }

  return { answers, topicsById, commentsByAnswer };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const answerId = form.get('answerId');
  const text = String(form.get('text') || '');
  const authorId = form.get('authorId')
    ? String(form.get('authorId'))
    : undefined;
  const authorName = form.get('authorName')
    ? String(form.get('authorName'))
    : undefined;
  if (!answerId || !text) {
    return { ok: false };
  }
  await addComment({
    answerId: String(answerId),
    text,
    author: authorName,
    authorId,
  });
  return { ok: true };
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};
  const commentsByAnswer: Record<string, Comment[]> =
    (data as any)?.commentsByAnswer ?? {};
  // No pinned topic handling: topics are shown per-answer and topic-specific pages live under /topics/:id

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCurrentUserId(localStorage.getItem('currentUserId'));
      setCurrentUserName(localStorage.getItem('currentUserName'));
    } catch {
      setCurrentUserId(null);
      setCurrentUserName(null);
    }
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col">
      <div className="sticky top-0 md:top-16 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile: show Home button (visible on small screens, hidden on md+) */}
              <Link
                to="/"
                className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 md:hidden"
                aria-label="ホームへ戻る"
              >
                ホーム
              </Link>
              <h1 className="text-2xl font-semibold">大喜利 - 回答一覧</h1>
            </div>
            <Link to="/topics" className="text-sm text-blue-600">
              お題一覧へ
            </Link>
          </div>
        </div>
      </div>

      {/* Scrollable answers container.
          - On small screens we subtract space for the header + bottom nav (~56px each => 112px).
          - On md+ we subtract the top nav (approx 64px). These are reasonable assumptions based on the app's nav sizes.
        */}
      <div className="overflow-auto px-0 py-4 space-y-4 w-full max-h-[calc(100vh-112px)] md:max-h-[calc(100vh-64px)]">
        {answers.length === 0 ? (
          <p className="text-gray-600 px-4">まだ回答が投稿されていません。</p>
        ) : (
          <ul className="space-y-4 px-4">
            {answers.map(a => (
              <li
                key={a.id}
                className="p-4 border rounded-md bg-white/80 dark:bg-gray-950/80"
              >
                <p className="text-sm text-gray-600">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-lg">{a.text}</p>
                {a.topicId ? (
                  <p className="mt-2 text-xs text-gray-500">
                    お題:{' '}
                    {topicsById[String(a.topicId)] ? (
                      <Link
                        to={`/topics/${a.topicId}`}
                        className="text-blue-600"
                      >
                        {topicsById[String(a.topicId)].title}
                      </Link>
                    ) : (
                      String(a.topicId)
                    )}
                  </p>
                ) : null}
                {a.author ? (
                  <p className="mt-2 text-xs text-gray-500">— {a.author}</p>
                ) : null}
                {/* comments list */}
                <div className="mt-3">
                  <h4 className="text-sm font-medium">コメント</h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    {(commentsByAnswer[String(a.id)] || []).map(c => (
                      <li key={c.id} className="text-gray-700">
                        {c.text}{' '}
                        <span className="text-xs text-gray-400">
                          — {c.author || '名無し'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* comment form */}
                <div className="mt-3">
                  <div className="text-muted mb-2">
                    コメントとして: {currentUserName ?? '名無し'}
                  </div>
                  <Form method="post" className="flex gap-2" replace>
                    <input type="hidden" name="answerId" value={String(a.id)} />
                    <input
                      type="hidden"
                      name="authorId"
                      value={currentUserId ?? ''}
                    />
                    <input
                      type="hidden"
                      name="authorName"
                      value={currentUserName ?? ''}
                    />
                    <input
                      name="text"
                      className="form-input flex-1"
                      placeholder="コメントを追加"
                      aria-label="コメント入力"
                    />
                    <button className="btn-inline" aria-label="コメントを送信">
                      送信
                    </button>
                  </Form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
