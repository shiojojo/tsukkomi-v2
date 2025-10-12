import { useFavoriteButton } from '~/hooks/useFavoriteButton';
import { Button } from '~/components/ui/Button';

export type FavoriteButtonProps =
  | {
      answerId: number;
      initialFavorited: boolean;
      initialCount: number;
      actionPath?: string;
      loginRedirectPath?: string;
      onFavoritedChange?: (favorited: boolean) => void;
    }
  | {
      favorited: boolean;
      count: number;
      onToggle: () => void;
    };

export function FavoriteButton(props: FavoriteButtonProps) {
  let favorited: boolean;
  let count: number;
  let handleToggle: () => void;

  if ('favorited' in props) {
    // Controlled mode
    ({ favorited, count, onToggle: handleToggle } = props);
  } else {
    // Hook mode
    const hookResult = useFavoriteButton({
      answerId: props.answerId,
      initialFavorited: props.initialFavorited,
      initialCount: props.initialCount,
      actionPath: props.actionPath,
      loginRedirectPath: props.loginRedirectPath,
      onFavoritedChange: props.onFavoritedChange,
    });
    ({ favorited, count, handleToggle } = hookResult);
  }

  return (
    <Button
      variant="icon"
      active={favorited}
      type="button"
      aria-pressed={favorited}
      onClick={handleToggle}
      title={favorited ? `お気に入り解除 (${count})` : `お気に入り (${count})`}
    >
      {favorited ? (
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
    </Button>
  );
}

export default FavoriteButton;
