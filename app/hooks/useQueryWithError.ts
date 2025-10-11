import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { getUserFriendlyErrorMessage } from '~/lib/errors';
import { useToast } from '~/hooks/useToast';

export function useQueryWithError<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        // グローバルエラーハンドリング
        if (error instanceof Response) {
          if (error.status === 401) {
            // 認証エラー: ログインページへ（クライアントサイドのみ）
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            throw error;
          } else if (error.status >= 500) {
            // サーバーエラー: ErrorBoundary に委譲
            throw error;
          }
        }

        // クライアントエラーはトースト表示（クライアントサイドのみ）
        if (typeof window !== 'undefined') {
          const message = getUserFriendlyErrorMessage(error);
          toast({
            title: 'エラー',
            description: message,
            variant: 'destructive',
          });
        }

        throw error;
      }
    },
    ...options,
  });
}