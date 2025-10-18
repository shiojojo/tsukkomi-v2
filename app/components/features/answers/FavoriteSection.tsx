import { useMemo } from 'react';
import FavoriteButton from '~/components/common/FavoriteButton';
import type { Answer } from '~/lib/schemas/answer';

interface FavoriteSectionProps {
  answer: Answer & { favCount: number };
}

export function FavoriteSection({ answer }: FavoriteSectionProps) {
  const initialFavorited = answer.favorited ?? false; // Use loader data instead of fetching

  const initialCount = useMemo(() => {
    return answer.favCount ?? 0;
  }, [answer]);

  return (
    <FavoriteButton
      answerId={answer.id}
      initialFavorited={initialFavorited}
      initialCount={initialCount}
      useQuery={false} // Use loader data only, no client-side query
    />
  );
}
