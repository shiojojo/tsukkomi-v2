import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';

export function useQueryClientConfig() {
  // QueryClient per app instance (client-side). Keep it lazy so SSR doesn't create one.
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // 認証エラーはリトライしない
              if (error instanceof Response && error.status === 401)
                return false;
              // サーバーエラーは3回までリトライ
              return failureCount < 3;
            },
            staleTime: 5 * 60 * 1000, // 5分
          },
          mutations: {
            onError: error => {
              // グローバルエラーハンドリング
              console.error('Mutation error:', error);
              // トースト表示（後述）
            },
          },
        },
      })
  );

  return qc;
}