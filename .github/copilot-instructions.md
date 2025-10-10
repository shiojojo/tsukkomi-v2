このプロジェクトは React Router v7（@react-router/fs-routes によるファイルベースルーティング + Remix 由来の loader / action パターン）と Supabase を組み合わせたモダンな React 19 + TypeScript アプリです。Copilot は下記ガイドラインを厳守して提案してください。曖昧表現を避け、すべて「行動可能 (actionable)」であること。

⸻

## ✅ 技術スタック（使用前提）

• React 19 + TypeScript (strict)  
• React Router v7 + @react-router/fs-routes（Remix スタイル: loader / action / useLoaderData / useFetcher / defer）  
• Supabase JS Client（DB / Auth / Storage）  
• Tailwind CSS + shadcn/ui  
• Zustand（グローバル状態）  
• date-fns（日付フォーマット/計算）  
• zod（スキーマ & バリデーション）  
• react-hook-form（複雑フォーム。単純送信は <Form> と action）  
• framer-motion（インタラクション / アニメーション）  
• lucide-react（アイコン）

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
	styles/               ← Tailwind / グローバル CSS
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

localStorage は最小限に使用。サーバー同期が必要なデータ（投票、いいねなど）は loader/Action と TanStack Query で管理。

⸻

## コンポーネント / UI 規約

• `components/` = ロジック最小。データ取得フックを直接呼ばず、親から props。
• 状態はできるだけ局所化。グローバルは認証ユーザー、テーマ、トーストなどに限定。
• アニメーションは `framer-motion`。Tailwind ユーティリティを使用。モバイルファースト。

⸻

## 🛡️ エラーハンドリング

• db.ts: 外部エラー → そのまま throw。  
• loader/action: `return json({ error: message }, { status: 400 })`。  
• UI: クリティカルでなければトースト表示。

原則: エラーの抑制ではなく根本原因を修正。早期検出と明確なメッセージ。テストでカバー。

⸻

## ✅ 追加時チェックリスト（開発者向け）

1. 新規エンティティ: `schemas/xxx.ts` に zod スキーマ & 型 export
2. ルートファイル: `loader` で取得 / `action` で mutate
3. 必要なら `useQuery` を補助的に追加（キー命名: `['entity', id]`）
4. UI コンポーネントは props 経由
5. TanStack Query: loaderデータから初期状態を取得し、useQuery/useMutationを使用
6. ESLint / TypeScript エラー 0 を確認

⸻

## 🔧 コード品質の基準

- DRY原則：重複を避け、単一の信頼できる情報源を維持
- 意味のある変数名・関数名で意図を明確に伝える
- プロジェクト全体で一貫したコーディングスタイルを維持
- 小さな問題も放置せず、発見次第修正
- コメントは「なぜ」を説明し、「何を」はコードで表現

⸻

## 🚀 最重要原則

1. Supabase 直呼び禁止 → 100% `lib/db.ts` 経由
2. **Loader**: 初回/SSRデータ取得 / **TanStack Query**: クライアント更新/キャッシュ / **Action**: 書き込み処理
3. TanStack Query: loaderデータから初期状態を取得し、useQuery/useMutationを使用
4. ルールに従わない提案は受け入れない（Copilot は本ファイルを優先参照）

⸻

このファイルがリポジトリに存在する限り、Copilot は上記「モダンな標準形」を提案すべき。差分が必要になったらまずここを更新すること。
