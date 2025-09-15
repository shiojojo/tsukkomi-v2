import { useSearchParams } from 'react-router';

export default function AnswersSearchRoute() {
  const [params] = useSearchParams();
  // Minimal placeholder route so typegen sees a module. Full implementation lives elsewhere.
  const q = params.get('q') ?? '';
  return <div className="p-4">検索: {q}</div>;
}
