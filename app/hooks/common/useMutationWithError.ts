import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { getUserFriendlyErrorMessage } from '~/lib/errors';
import { useToast } from '~/hooks/common/useToast';

export function useMutationWithError<TData = unknown, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables, TContext>
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (variables) => {
      try {
        return await mutationFn(variables);
      } catch (error) {
        // グローバルエラーハンドリング
        if (error instanceof Response) {
          if (error.status === 401) {
            // 認証エラー: ログインページへ
            window.location.href = '/login';
            throw error;
          } else if (error.status >= 500) {
            // サーバーエラー: ErrorBoundary に委譲
            throw error;
          }
        }

        // クライアントエラーはトースト表示
        const message = getUserFriendlyErrorMessage(error);
        toast({
          title: 'エラー',
          description: message,
          variant: 'destructive',
        });

        throw error;
      }
    },
    ...options,
    onSuccess: (data, variables, context, mutation) => {
      // 成功メッセージを表示
      toast({
        title: '成功',
        description: '操作が完了しました',
        variant: 'success',
      });

      // ユーザーが指定した onSuccess を呼び出し
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context, mutation);
      }
    },
  });
}