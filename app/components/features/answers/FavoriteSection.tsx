import FavoriteButton from '~/components/common/FavoriteButton';
import type { Answer } from '~/lib/schemas/answer';

interface FavoriteSectionProps {
  answer: Answer;
}

export function FavoriteSection({ answer }: FavoriteSectionProps) {
  const initialFavorited = answer.favorited ?? false; // Use loader data instead of fetching

  return (
    <FavoriteButton
      answerId={answer.id}
      initialFavorited={initialFavorited}
      useQuery={false} // Use loader data only, no client-side query
    />
  );
}
