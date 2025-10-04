import { Link } from 'react-router';
import type { Topic } from '~/lib/schemas/topic';

interface TopicCardProps {
  topic: Topic;
  profileId?: string | null;
}

export function TopicCard({ topic, profileId }: TopicCardProps) {
  const href = profileId
    ? `/topics/${topic.id}?profileId=${profileId}`
    : `/topics/${topic.id}`;

  return (
    <Link
      to={href}
      className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0"
      aria-label={`お題 ${topic.title} の回答を見る`}
    >
      {topic.image ? (
        <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
          <img
            src={topic.image}
            alt={topic.title}
            className="w-full max-w-full h-auto max-h-60 object-contain"
            style={{ display: 'block' }}
          />
        </div>
      ) : (
        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 min-w-0">
          <h2 className="text-lg font-medium break-words">{topic.title}</h2>
        </div>
      )}
    </Link>
  );
}
