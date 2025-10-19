import { cn } from '~/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export function LoadingState({
  message = 'Loading...',
  className,
  fullScreen = true,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullScreen ? 'min-h-screen' : 'min-h-[200px]',
        className
      )}
    >
      <div className="text-lg">{message}</div>
    </div>
  );
}
