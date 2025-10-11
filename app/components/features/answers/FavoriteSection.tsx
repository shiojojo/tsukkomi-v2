import { useMemo } from 'react';
import FavoriteButton from '~/components/common/FavoriteButton';
import type { Answer } from '~/lib/schemas/answer';

interface FavoriteSectionProps {
  answer: Answer;
  userAnswerData: { favorites: Set<number> };
  onFavoriteUpdate?: (answerId: number, favorited: boolean) => void;
}

export function FavoriteSection({
  answer,
  userAnswerData,
  onFavoriteUpdate,
}: FavoriteSectionProps) {
  const initialFavorited = useMemo(() => {
    if (userAnswerData.favorites.has(answer.id)) return true;
    return Boolean(answer.favorited);
  }, [answer, userAnswerData.favorites]);

  return (
    <FavoriteButton
      answerId={answer.id}
      initialFavorited={initialFavorited}
      onServerFavorited={onFavoriteUpdate}
    />
  );
}
