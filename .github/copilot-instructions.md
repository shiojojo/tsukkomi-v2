このプロジェクトは React Router v7（@react-router/fs-routes によるファイルベースルーティング + Remix 由来の loader / action パターン）と Supabase を組み合わせたモダンな React 19 + TypeScript アプリです。Copilot は下記ガイドラインを厳守して提案してください。曖昧表現を避け、すべて「行動可能 (actionable)」であること。

⸻

## ✅ 技術スタック（使用前提）

• React 19 + TypeScript (strict)  
• React Router v7 + @react-router/fs-routes（Remix スタイル: loader / action / useLoaderData / useFetcher / defer）  
• Supabase JS Client（DB / Auth / Storage）  
• Tailwind CSS + shadcn/ui  
• Zustand（グローバル状態）  
• TanStack Query（クライアントサイドのデータ取得/キャッシュ/同期）  
• date-fns（日付フォーマット/計算）  
• zod（スキーマ & バリデーション）  
• react-hook-form（複雑フォーム。単純送信は <Form> と action）  
• framer-motion（インタラクション / アニメーション）  
• lucide-react（アイコン）  
• @radix-ui/react-toast（トースト通知）

⸻

## 📂 ディレクトリ / 命名規約（必須）

```
app/
	routes/               ← @react-router/fs-routes が読む。ファイル = ルート。
		_index.tsx          ← ルート / のトップ（Remix 同等）
		posts._index.tsx    ← /posts （一覧）
		posts.$id.tsx       ← /posts/:id （動的セグメント = $）
		posts.new.tsx       ← /posts/new
	components/           ← 再利用 UI（ビジネスロジック含めない）
		ui/                 ← 基本的な汎用 UI コンポーネント（Button, SearchInput など）
		layout/             ← レイアウト関連（StickyHeaderLayout, ListPageLayout, ResponsiveNav など）
		features/           ← 機能固有コンポーネント
			answers/        ← 回答関連（AnswersList, AnswerActionCard など）
			topics/         ← トピック関連（TopicCard など）
		forms/              ← フォーム関連（FilterForm, DateRangeFilter など）
		common/             ← 共通再利用コンポーネント（Pagination, NumericVoteButtons, FavoriteButton など）
		icons/              ← アイコンコンポーネント（将来的に使用）
	lib/
		supabase.ts         ← Supabase クライアント生成（本番専用 init）
		db/              		← データアクセス統合ポイント
		schemas/            ← zod スキーマ（I/O 変換 & 型出力）
	hooks/                ← 再利用カスタムフック
	app.css              ← スタイルの一元管理ポイント。CSS 変数と @layer components を使用
tests/                  ← 統合テスト
e2e/                    ← E2Eテスト
```

禁止: `routes/` 直下にロジック（DB 直接 / fetch）を書くこと。必ず `lib/db.ts` 経由。

⸻

## 🛣️ ファイルベースルーティング ルール

1. 拡張子は `.tsx`（JS 禁止）
2. ルート要素は named export ではなく default export の React コンポーネント。
3. `loader` / `action` を同じファイルに export（Remix 互換シグネチャ）。
4. 動的パラメータは `$param`。インデックスは `_index.tsx`。
5. 共通 UI ラッパ（Layout）は親ルートファイルで `<Outlet />` を使用。
6. メタデータ/タイトルなどはコンポーネント内で `document.title` または独自フック。

⸻

## 🧱 データアクセス & アーキテクチャ

### lib/db.ts 実装ガイド

関数シグネチャ指針:

```ts
export type Post = { id: number; content: string; created_at: string };
export async function getPosts(): Promise<Post[]> {
  /* implementation */
}
export async function addPost(input: {
  content: string;
}): Promise<{ success: true }>;
```

必須: 例外はそのまま throw。入力は zod で検証。

### loader / action の標準パターン

```ts
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useFetcher } from "react-router";
import { getPosts, addPost } from "~/lib/db";

export async function loader(_args: LoaderFunctionArgs) {
	const posts = await getPosts();
	return json({ posts });
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	await addPost({ content: String(formData.get("content") || "") });
	return json({ ok: true });
}

export default function Route() {
	const { posts } = useLoaderData<typeof loader>();
	return (
		<div className="p-4 space-y-4">
			<Form method="post" className="flex gap-2">
				<input name="content" className="border p-2 rounded w-full" placeholder="Write..." />
				<button className="bg-blue-500 text-white px-4 py-2 rounded">Post</button>
			</Form>
			<ul className="divide-y">
				{posts.map(p => (
					<li key={p.id} className="py-2 text-sm">{p.content}</li>
				))}
			</ul>
		</div>
	);
}
```

禁止事項: loader/action 内で Supabase 直利用、any 型乱用、then チェーン、バリデーション省略。

### データ取得・更新アーキテクチャ

- **Loader**: 初回/SSRデータ取得（`useLoaderData` でコンポーネントに渡す）
- **TanStack Query**: クライアント更新/キャッシュ（初期データとして Loader データを活用、`useMutation` で Action をトリガー）
- **Action**: 書き込み処理（サーバーサイドでのバリデーションと永続化）
- **useQueryWithError / useMutationWithError**: エラーハンドリング付きの Query/Mutation フック

localStorage は最小限に使用。サーバー同期が必要なデータ（投票、いいねなど）は loader/Action と TanStack Query で管理。

### Favorite / Vote / Comment の設計パターン

#### 🎯 共通アーキテクチャ原則

- **Loader**: 初回データ取得（SSR対応）
- **TanStack Query**: クライアント側データ管理・キャッシュ・同期
- **useOptimisticAction**: 楽観的更新 + Action実行
- **useMutationWithError**: エラーハンドリング付きミューテーション
- **Query Key**: `['entity-type', entityId, userId]` の命名規則

#### ⭐ Favorite 機能設計

**意図**: ユーザーのお気に入り状態とカウントをリアルタイム管理。トグル操作で即時反映。

**動作フロー**:

1. **Loader**: 初期お気に入り状態とカウントを取得
2. **Query**: ユーザーのお気に入り状態を管理 (`['user-favorite', answerId, userId]`)
3. **Query**: お気に入りカウントを管理 (`['favorite-count', answerId]`)
4. **Mutation**: トグル操作で楽観的更新（即時UI反映）
5. **Action**: サーバーサイドで永続化
6. **Error**: 失敗時はロールバック + 再フェッチ

**実装パターン**:

```ts
// Hook: useFavoriteButton
const favoriteQuery = useQuery(['user-favorite', answerId, userId], ...)
const countQuery = useQuery(['favorite-count', answerId], ...)
const toggleMutation = useMutationWithError(..., {
  onMutate: () => { /* 楽観的更新 */ },
  onError: () => { /* ロールバック */ }
})
```

#### 🗳️ Vote 機能設計

**意図**: 3段階投票システム。ユーザーの投票状態と各レベルの集計カウントを正確に管理。

**動作フロー**:

1. **Loader**: 初期投票状態とカウントを取得
2. **Query**: ユーザーの投票状態を管理 (`['user-vote', answerId, userId]`)
3. **Query**: 投票カウントを管理 (`['vote-counts', answerId]`)
4. **Mutation**: 投票操作で楽観的更新（カウント増減計算）
5. **Action**: サーバーサイドで永続化
6. **Error**: 失敗時は再フェッチ

**実装パターン**:

```ts
// Hook: useNumericVoteButtons
const userVoteQuery = useQuery(['user-vote', answerId, userId], ...)
const voteCountsQuery = useQuery(['vote-counts', answerId], ...)
const voteMutation = useMutationWithError(..., {
  onMutate: ({ level }) => {
    // カウント増減計算: 前の投票を減らし、新しい投票を加算
  },
  onError: () => { /* 再フェッチ */ }
})
```

#### 💬 Comment 機能設計

**意図**: コメント一覧の取得・追加・同期。DB遅延を考慮した読み込み状態表示。

**動作フロー**:

1. **Loader**: 初期コメント一覧を取得
2. **Query**: コメント一覧を管理 (`['comments', answerId]`)
3. **Mutation**: コメント追加（楽観的更新なし、DB同期を待つ）
4. **Action**: サーバーサイドで永続化
5. **Error**: 失敗時はフォーム内容復元 + 再フェッチ
6. **Loading**: DB同期中のスピナー表示

**実装パターン**:

```ts
// Hook: useCommentSection
const commentsQuery = useQuery(['comments', answerId], ...)
const addCommentMutation = useMutationWithError(..., {
  onSuccess: () => {
    // DB遅延を考慮し、500ms待ってから同期
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['comments', answerId] });
    }, 500);
  },
  onError: (error, variables) => { /* フォーム復元 */ }
})
// 戻り値: isLoadingComments, isRefetchingComments
```

**DB同期の考慮**: Comment追加成功時は、DB反映完了を待ってからinvalidateQueriesを実行。目安として500msの待機時間を推奨（DBレイテンシによる調整が必要）。

#### ⚡ 楽観的更新 vs DB同期

- **Favorite/Vote**: 即時反映のため楽観的更新を使用
- **Comment**: DB遅延を考慮し、成功後に同期（`invalidateQueries`）
- **Error Handling**: 失敗時は適切なロールバック/再フェッチ

⸻

## コンポーネント / UI 規約

• `components/` = ロジック最小。データ取得フックを直接呼ばず、親から props。
• 状態はできるだけ局所化。グローバルは認証ユーザー、テーマ、トーストなどに限定。
• **スタイル適用**: CSS クラス（例: `className="error-page-container"`）を使用。TypeScript 定数は廃止。
• アニメーションは `framer-motion`。Tailwind ユーティリティを使用。モバイルファースト。

### スタイル定義規約

• **一元管理**: すべての共通スタイルは `app/app.css` に統合。TypeScript 定数（例: `commonStyles.ts`）は使用せず、CSS クラスとして定義。
• **CSS 変数**: テーマ変数（ライト/ダークモード対応）を拡張。shadcn/ui 互換のカラーパレット（`--success`, `--warning`, `--info`）を追加。
• **@layer components**: コンポーネント固有のスタイルを `@layer components` で定義。アニメーション、ホバー効果、アクセシビリティ（`focus-visible`）を標準化。
• **モダン化**: インタラクション（`transition`, `scale`）、アニメーション（`keyframes`）、レスポンシブ対応を優先。Tailwind CSS を活用しつつ、CSS 変数でテーマ切り替えを可能に。

⸻

## 🛡️ エラーハンドリング

### エラーの伝播原則

- **DB 層**: エラーを常に `throw`（握りつぶさない）
- **Loader/Action**: エラーを `throw new Response()` または `throw new Error()` で伝播
- **UI 層**: `ErrorBoundary` でキャッチし、適切に表示

### エラータイプの分類

- **予期せぬエラー (500)**: DB 接続失敗、サーバーエラー → `ErrorBoundary` で表示
- **クライアントエラー (400)**: バリデーションエラー、無効なリクエスト → トーストで表示
- **404**: ページが見つからない → 専用ページ
- **認証エラー (401/403)**: ログインが必要 → リダイレクト

### 実装コンポーネント

#### 強化されたルート ErrorBoundary

```tsx
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 500) {
      return <ServerErrorPage />;
    }
    return (
      <GenericErrorPage status={error.status} message={error.statusText} />
    );
  }
  return (
    <GenericErrorPage status={500} message="予期せぬエラーが発生しました" />
  );
}
```

#### 専用エラーページ

- `routes/404.tsx`: 404 エラー専用
- `routes/500.tsx`: 500 エラー専用

#### エラークラス (`lib/errors.ts`)

```ts
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class AuthError extends AppError {
  constructor(message: string = '認証が必要です') {
    super(401, message, 'AUTH_ERROR');
  }
}
```

#### TanStack Query エラーハンドリング

**QueryClient 設定:**

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof Response && error.status === 401) return false;
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      onError: error => {
        console.error('Mutation error:', error);
      },
    },
  },
});
```

**useQueryWithError フック:**

```ts
const { data, error, isLoading } = useQueryWithError(
  ['answers', topicId],
  () => getAnswers(topicId),
  { enabled: !!topicId }
);
```

**useMutationWithError フック:**

```ts
const voteMutation = useMutationWithError(
  (variables: { answerId: number; level: number }) =>
    voteAnswer(variables.answerId, variables.level)
);
```

### エラーレスポンスの標準化

```ts
export function createErrorResponse(
  status: number,
  message: string,
  code?: string
) {
  throw new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### エラーハンドリングの流れ

1. **DB 層**: エラーが発生したら `throw`
2. **Loader/Action**: try-catch なしでエラーを伝播
3. **Query/Mutation**: `useQueryWithError` / `useMutationWithError` で自動処理
4. **UI**: ErrorBoundary でキャッチ、トーストで通知

**原則: エラーを握りつぶさず、適切に伝播・解決する。エラーの抑制ではなく根本原因を修正。早期検出と明確なメッセージ**

禁止: try-catch でエラーを無視、空配列/デフォルト値を返す、console.error だけのエラーハンドリング。

⸻

## ✅ 追加時チェックリスト（開発者向け）

1. 新規エンティティ: `schemas/xxx.ts` に zod スキーマ & 型 export
2. ルートファイル: `loader` で取得 / `action` で mutate
3. 必要なら `useQueryWithError` を補助的に追加（キー命名: `['entity', id]`）
4. UI コンポーネントは props 経由
5. TanStack Query: loaderデータから初期状態を取得し、`useQueryWithError`/`useMutationWithError`を使用
6. エラーハンドリング: `lib/errors.ts` のクラスを使用し、適切なエラーレスポンスを throw
7. ESLint / TypeScript エラー 0 を確認

⸻

## 🔧 コード品質の基準

- DRY原則：重複を避け、単一の信頼できる情報源を維持
- 意味のある変数名・関数名で意図を明確に伝える
- プロジェクト全体で一貫したコーディングスタイルを維持
- 小さな問題も放置せず、発見次第修正
- コメントは「なぜ」を説明し、「何を」はコードで表現
- **デバッグログ**: 開発時の動作確認目的でconsole.logを使用可。本番デプロイ前に必ず削除。ログは`[DEBUG]`プレフィックスを使用し、重要な状態遷移を記録

⸻

## 🚀 最重要原則

1. Supabase 直呼び禁止 → 100% `lib/db/` ディレクトリ経由
2. **Loader**: 初回/SSRデータ取得 / **TanStack Query**: クライアント更新/キャッシュ / **Action**: 書き込み処理
3. TanStack Query: loaderデータから初期状態を取得し、`useQueryWithError`/`useMutationWithError`を使用
4. エラーハンドリング: `lib/errors.ts` のクラスを使用し、エラーを握りつぶさず適切に伝播
5. ルールに従わない提案は受け入れない（Copilot は本ファイルを優先参照）

⸻

このファイルがリポジトリに存在する限り、Copilot は上記「モダンな標準形」を提案すべき。差分が必要になったらまずここを更新すること。
