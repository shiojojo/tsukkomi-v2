import { useNumericVoteButtons } from '~/hooks/features/answers/useNumericVoteButtons';
import { Button } from '~/components/ui/Button';

export type NumericVoteButtonsProps =
  | {
      answerId: number;
      initialVotes: { level1: number; level2: number; level3: number };
      votesBy?: Record<string, number>;
      actionPath?: string;
      loginRedirectPath?: string;
      onSelectionChange?: (level: number | null) => void;
    }
  | {
      selection: number | null;
      counts: { level1: number; level2: number; level3: number };
      onVote: (level: 1 | 2 | 3) => void;
    };

export function NumericVoteButtons(props: NumericVoteButtonsProps) {
  let selection: number | null;
  let counts: { level1: number; level2: number; level3: number };
  let handleVote: (level: 1 | 2 | 3) => void;

  if ('selection' in props) {
    // Controlled mode
    ({ selection, counts, onVote: handleVote } = props);
  } else {
    // Hook mode
    const hookResult = useNumericVoteButtons({
      answerId: props.answerId,
      initialVotes: props.initialVotes,
      votesBy: props.votesBy,
      actionPath: props.actionPath,
      loginRedirectPath: props.loginRedirectPath,
      onSelectionChange: props.onSelectionChange,
    });
    ({ selection, counts, handleVote } = hookResult);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="control"
        active={selection === 1}
        className="gap-2 px-3"
        onClick={() => handleVote(1)}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </Button>

      <Button
        variant="control"
        active={selection === 2}
        className="gap-2 px-3"
        onClick={() => handleVote(2)}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </Button>

      <Button
        variant="control"
        active={selection === 3}
        className="gap-2 px-3"
        onClick={() => handleVote(3)}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </Button>
    </div>
  );
}

export default NumericVoteButtons;
