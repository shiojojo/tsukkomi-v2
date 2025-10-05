import type { Topic } from '~/lib/schemas/topic';

/**
 * 概要: お題ヘッダー情報 (タイトル / 画像 / 回答数) をカード表示する。
 * Intent: 回答カードでは繰り返さないトピック文脈を 1 箇所にまとめ、モバイルでも視認性を確保する。
 * Contract:
 *   - topic.title / topic.created_at / topic.image をそのまま利用。
 *   - answerCount は 0 以上の整数。
 */
export function TopicOverviewCard({
  topic,
  answerCount,
}: {
  topic: Topic;
  answerCount: number;
}) {
  let createdAtLabel: string | null = null;
  try {
    const created = new Date(topic.created_at);
    if (!Number.isNaN(created.getTime())) {
      createdAtLabel = created.toLocaleString();
    }
  } catch {
    createdAtLabel = null;
  }

  return (
    <section className="px-4 pt-4">
      <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 shadow-sm">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 font-semibold text-[11px] text-gray-600 dark:text-gray-200">
              お題
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              回答 {answerCount} 件
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
            {topic.title}
          </h2>
          {topic.image ? (
            <div className="block p-0 border rounded-md overflow-hidden">
              <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <img
                  src={topic.image}
                  alt={topic.title}
                  className="w-full h-auto max-h-40 object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          ) : null}
          {createdAtLabel ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              作成: {createdAtLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
