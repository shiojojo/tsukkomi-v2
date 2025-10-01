このプロジェクトは React Router v7（@react-router/fs-routes によるファイルベースルーティング + Remix 由来の loader / action パターン）と Supabase を組み合わせたモダンな React 19 + TypeScript アプリです。Copilot は下記ガイドラインを厳守して提案してください。曖昧表現を避け、すべて「行動可能 (actionable)」であること。

⸻

## ✅ 技術スタック（使用前提）

• React 19 + TypeScript (strict)  
• React Router v7 + @react-router/fs-routes（Remix スタイル: loader / action / useLoaderData / useFetcher / defer）  
• Supabase JS Client（DB / Auth / Storage）  
• Tailwind CSS + shadcn/ui  
• TanStack Query（ユーザー操作後の再取得 / 増分更新 / キャッシュ）  
• Zustand（必要最小限のグローバル状態。安易に追加しない）  
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
	lib/
		supabase.ts         ← Supabase クライアント生成（本番専用 init）
		db.ts               ← すべてのデータアクセス統合ポイント
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
4. 動的パラメータは `$param`。キャッチオールは `$param._index.tsx` or `$param.$.tsx` ではなく React Router 7 仕様に合わせ `$` プレフィクス。（必要になった時点で追加）
5. インデックスは `_index.tsx`。旧 `index.tsx` は使用しない。
6. 共通 UI ラッパ（Layout）は親ルートファイルで `<Outlet />` を使用。
7. メタデータ/タイトルなどはコンポーネント内で `document.title` または独自フック。後から head 管理を導入する余地を残す。

⸻

## 🧱 `lib/db.ts` 実装ガイド

関数シグネチャ指針:

```ts
export type Post = { id: number; content: string; created_at: string };
export async function getPosts(): Promise<Post[]> {
  // implementation
}
export async function addPost(input: {
  content: string;
}): Promise<{ success: true }>;
```

必須:
• 例外はそのまま throw（呼び出し側 loader が捕捉する）
• 入力は zod で検証し、出力スキーマも定義可（必要に応じ `schemas/post.ts`）

⸻

## 🧪 loader / action の標準パターン

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

禁止事項:
• loader/action 内で Supabase 直利用  
• any 型乱用  
• then チェーン  
• バリデーション省略（入力がある action）

⸻

## � TanStack Query 利用ガイド

利用目的: ユーザー操作後の「部分的リフレッシュ」やポーリング。初期表示は必ず loader。
基本フロー:

1. loader で初期データ `prefetch` 代替（サーバー同期状態）
2. クライアントで `useQuery(['posts'], getPosts)` など再取得トリガー（ユーザー操作後）
3. 変更操作成功後 `queryClient.invalidateQueries(['posts'])`
   禁止: 初期ロード専用に Query だけを使い loader を欠落させること。

⸻

## コンポーネント / UI 規約

• `components/` = ロジック最小。データ取得フックを直接呼ばず、親から props。
• 状態はできるだけ局所化。グローバルは (a) 認証ユーザー (b) テーマ (c) トーストなど UI フラグ に限定。
• アニメーションは `framer-motion`。過度な wrapper 生成禁止。
• 標準: Tailwind ユーティリティ。複雑なコンポーネントは shadcn/ui をラップし再利用。  
• カラー/タイポはデザイントークン（Tailwind 設定）から参照。  
• 一貫性確保のため spacing は 2 / 4 / 6 / 8 / 12 / 16 を中心に。
• モバイルファースト: モバイル幅 (例: ~375–430px) で最初にレイアウト確定。Hover 依存 UI 禁止。ファーストビュー内に主要 CTA を収める。

⸻

## �🛡️ エラーハンドリング

• db.ts: 外部エラー → そのまま throw。  
• loader/action: try/catch で把握したい場合は `return json({ error: message }, { status: 400 })`。  
• UI: クリティカルでなければトースト表示（後日 toast 実装予定）。

⸻

## ✅ 追加時チェックリスト（開発者向け）

1. 新規エンティティ: `schemas/xxx.ts` に zod スキーマ & 型 export
2. ルートファイル: `loader` で取得 / `action` で mutate
3. 必要なら `useQuery` を補助的に追加（キー命名: `['entity', id]`）
4. UI コンポーネントは props 経由
5. ESLint / TypeScript エラー 0 を確認

⸻

## 🧪 将来拡張案（記述のみ / まだ実装しない）

• テスト / 型品質: zod による I/O 形保証。将来: Vitest 導入 → `lib/` 単体テスト / ルート loader のモックテスト追加予定。
• 認証: `authLoader` ヘルパーでリダイレクトガード  
• エラーバウンダリ: ルートごとの `ErrorBoundary` コンポーネント  
• アクセスロギング: loader/action wrapper
• ドキュメンテーション / コメント: 各関数に概要 / Contract / Environment / Errors をブロックコメントで記述。テンプレート例: `/** 概要: ... Contract: - Input: ... - Output: ... Environment: - dev: ... - prod: ... Errors: ... */`
• セキュリティ: Supabase RLS 有効化 / APIキー管理（.env）。レートリミッター（lib/rateLimiter.ts）。
• コード品質: ESLint（eslint-config-react-app + カスタム） / Prettier（デフォルト + Tailwindソート）。TypeScript strictモード（noImplicitAny, strictNullChecks）。

⸻

## 🚀 最重要 3 原則

1. Supabase 直呼び禁止 → 100% `lib/db.ts` 経由
2. 初期データは loader / mutate は action → クライアント副作用 fetch 不要
3. ルールに従わない提案は受け入れない（Copilot は本ファイルを優先参照）

⸻

このファイルがリポジトリに存在する限り、Copilot は上記「モダンな標準形」を提案すべき。差分が必要になったらまずここを更新すること。
