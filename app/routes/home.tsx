import type { Route } from './+types/home';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { TopicCard } from '~/components/features/topics/TopicCard';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
// server-only import
import type { Topic } from '~/lib/schemas/topic';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export async function loader(_args: LoaderFunctionArgs) {
  const { getLatestTopic } = await import('~/lib/db');
  const latest = await getLatestTopic();
  return Response.json({ latest });
}

export default function Home() {
  const data = useLoaderData() as { latest: Topic | null };
  const latest: Topic | null = data?.latest ?? null;

  const content = latest ? (
    <section className="bg-card border border-border shadow-sm rounded-lg p-6">
      <div>
        <TopicCard topic={latest} />
      </div>
    </section>
  ) : (
    <div className="text-center text-muted-foreground">
      お題がまだありません。
    </div>
  );

  return (
    <ListPageLayout
      headerTitle="Tsukkomi — 今日のお題"
      filters={null}
      list={content}
    />
  );
}
