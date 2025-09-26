このプロジェクトは React Router v7（@react-router/fs-routes によるファイルベースルーティング + Remix 由来の loader / action パターン）と Supabase を組み合わせたモダンな React 19 + TypeScript アプリです。Copilot は下記ガイドラインを厳守して提案してください。曖昧表現を避け、すべて「行動可能 (actionable)」であること。

⸻

## ✅ 技術スタック（使用前提）

• React 19 + TypeScript (strict)  
• React Router v7 + @react-router/fs-routes（Remix スタイル: loader / action / useLoaderData / useFetcher / defer）  
• Supabase JS Client（DB / Auth / Storage）※本番のみ  
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

## � 環境切替ポリシー（最重要）

| 環境 | 判定     | データソース | I/O                                    | 外部通信     |
| ---- | -------- | ------------ | -------------------------------------- | ------------ |
| 本番 | それ以外 | Supabase     | 失敗 = 例外を補足し 500 相当レスポンス | Supabase API |

強制ルール:

1. Supabase 直接利用禁止 (例: `supabase.from(...)`) → 例外: `app/lib/supabase.ts` 内部のみ。
2. ルート / フック / コンポーネント は `import { getPosts } from "~/lib/db";` のみ。
3. 新しい DB 操作を追加する際は: (a) zod スキーマ → (b) db.ts に関数 → (c) 本番 Supabase 実装。
4. モックは「最小に追従」：スキーマ追加時はフィールド欠落を放置しない。
5. 機密値は `.env` に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。`supabase.ts` で参照。

⸻

## 🧱 `lib/db.ts` 実装ガイド

関数シグネチャ指針:

```ts
export type Post = { id: number; content: string; created_at: string };
export async function getPosts(): Promise<Post[]> {
  /* 環境分岐 */
}
export async function addPost(input: {
  content: string;
}): Promise<{ success: true }>;
```

必須:
• 先頭で `const isDev = import.meta.env.DEV;`
• 分岐は return 形を一致させる（型差異禁止）
• 例外はそのまま throw（呼び出し側 loader が捕捉する）
• 入力は zod で検証し、出力スキーマも定義可（必要に応じ `schemas/post.ts`）

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

## 🧪 テスト / 型品質（将来拡張用 方針）

現時点で必須: zod による I/O 形保証。将来: Vitest 導入 → `lib/` 単体テスト / ルート loader のモックテスト追加予定。

⸻

## 🧩 コンポーネント規約

• `components/` = ロジック最小。データ取得フックを直接呼ばず、親から props。
• 状態はできるだけ局所化。グローバルは (a) 認証ユーザー (b) テーマ (c) トーストなど UI フラグ に限定。
• アニメーションは `framer-motion`。過度な wrapper 生成禁止。

⸻

## 🎨 UI / スタイル

• 標準: Tailwind ユーティリティ。複雑なコンポーネントは shadcn/ui をラップし再利用。  
• カラー/タイポはデザイントークン（Tailwind 設定）から参照。  
• 一貫性確保のため spacing は 2 / 4 / 6 / 8 / 12 / 16 を中心に。

⸻

## � モバイルファースト方針（優先度: スマホ > PC）

本プロダクトの主要利用環境は「スマホ（狭幅ビューポート）」であり、PC は次点。Copilot は以下を必須前提として提案すること。

### 基本原則

1. モバイル幅 (例: ~375–430px) で最初にレイアウト / 情報密度 / 操作フローを確定し、その後で md 以上の拡張（横並び / 余白拡張 / 補助パネル）を加える。
2. コンポーネントの最小インタラクション領域は 44x44px 相当（タップ余白確保）。
3. 横スクロールを前提にしない。テーブル等は縦スタック → md 以上で表形式に昇格。
4. Hover 依存 UI（ツールチップのみ表示など）禁止。必須情報は常時表示 or タップ/フォーカスで到達可能に。
5. ファーストビュー内（初期ロード 1 画面）に主要 CTA が収まることを優先し、Hero 的過剰余白は避ける。

### Tailwind / ブレークポイント運用

- ベースはモバイル: クラスはまず非接頭辞で記述し、PC 拡張のみ `md:` / `lg:` を追加する。
- 余白 / グリッド列追加は `md:` 以降で段階的に。モバイルで不要な装飾 (shadow, large gap) は初期適用しない。

### レイアウト指針

- ナビゲーション: モバイルではトップバー / ボトムバー のどちらか一方（状況に応じ選択）。両方常設は避ける。
- サイドバーは `md:` 以上で初めて表示（モバイルではドロワー or オーバーレイ）。
- モーダル多用よりもフルスクリーンダイアログを優先（モバイルで操作領域確保）。

### パフォーマンス / ネットワーク

- 主要インタラクティブ領域 (LCP ターゲット) 画像は遅延読込せず最適化 (width 最小 + modern format)。
- 不要なライブラリ（チャート等）は遅延 import。初期 JS バンドルを抑制。

### フォーム / 入力

- オートコンプリート属性 / 適切な input type (email, number, tel) を設定しソフトキーボード最適化。
- 1 画面 = 1 主要アクション原則。複雑ウィザードはステップ化。

### スクロール / ジェスチャ

- 無限スクロール導入時は Pull-to-refresh 相当（将来対応可）を考慮し、現時点ではページネーション or 'もっと見る' ボタンで明示的制御。
- Sticky ヘッダー使用は 1 層まで。多重 sticky は視界を圧迫。

### アクセシビリティ（モバイル文脈）

- フォーカスリング強制除去禁止。視認性確保（Tailwind `focus-visible:` でカスタマイズ）。
- タップフィードバック（`active:` スタイル or 微小 scale アニメーション）を 150ms 以内で応答。

### 提案時チェック（Copilot 用）

[] 非モバイル前提のレイアウト（横 3 カラム等）を初期状態にしていないか
[] Hover 前提情報が存在しないか
[] 主要操作ボタンが初期ビュー内にあるか
[] コンポーネント幅が可変で 320px でも崩れないか
[] 画像 / SVG の不要な固定ピクセル幅を避けたか（`max-w-full h-auto`）

違反例 (NG): `className="hidden md:block"` でモバイルから主要操作要素を完全に隠し代替手段がない。

許容例 (OK): モバイルでは単一カラム、`md:` でサマリーパネルを右側に追加。

将来拡張: PWA / オフラインキャッシュ戦略導入時にモバイル初期表示速度計測 (TTI / INP) を指標化予定。

---

⸻

## �🛡️ エラーハンドリング

• db.ts: 外部エラー → そのまま throw。  
• loader/action: try/catch で把握したい場合は `return json({ error: message }, { status: 400 })`。  
• UI: クリティカルでなければトースト表示（後日 toast 実装予定）。

⸻

## 🚫 具体的禁止例

NG: `const { data } = await supabase.from('posts').select('*')`（ルートファイル内）  
NG: `any` の戻り値  
NG: `Promise.then(...).catch(...)`  
NG: `useEffect` で初期データ fetch（loader で取得すべき）  
NG: モックと本番で戻り値型が不一致

⸻

## ✅ 追加時チェックリスト（開発者向け）

1. 新規エンティティ: `schemas/xxx.ts` に zod スキーマ & 型 export
2. ルートファイル: `loader` で取得 / `action` で mutate
3. 必要なら `useQuery` を補助的に追加（キー命名: `['entity', id]`）
4. UI コンポーネントは props 経由
5. ESLint / TypeScript エラー 0 を確認

⸻

## 🧪 将来拡張案（記述のみ / まだ実装しない）

• 認証: `authLoader` ヘルパーでリダイレクトガード  
• エラーバウンダリ: ルートごとの `ErrorBoundary` コンポーネント  
• アクセスロギング: loader/action wrapper

⸻

## 🚀 最重要 4 原則（再掲）

1. Supabase 直呼び禁止 → 100% `lib/db.ts` 経由
2. 開発環境はモック利用 → ネットワーク不要で動作
3. 初期データは loader / mutate は action → クライアント副作用 fetch 不要
4. ルールに従わない提案は受け入れない（Copilot は本ファイルを優先参照）

⸻

このファイルがリポジトリに存在する限り、Copilot は上記「モダンな標準形」を提案すべき。差分が必要になったらまずここを更新すること。

⸻

## 📝 ドキュメンテーション / コメント規約（学習目的強化）

目的: 各関数や処理の「意図 / 契約 / 失敗条件 / 環境差異」をコードを読むだけで把握できるようにする。冗長な逐語説明は避け、設計判断の背景を明確化。

### 基本方針

1. 「何を」「なぜ」「前提」「失敗時」「副作用」「利用例」を最小十分セットで記述。
2. 実装から自明な行コメント（例: // increment counter）は禁止。
3. 変更時はコメントを必ず同期（差異が出たらコード優先 -> コメント更新）。
4. 型情報により明らかな項目（引数の型説明が重複するだけ）の説明は省略し、制約やビジネスルールに焦点。
5. 日本語 + 用語は英単語（CamelCase 名称）をそのまま混在可（翻訳より可読性優先）。

### 推奨ブロックコメントテンプレート（JSDoc 風 + 拡張）

```ts
/**
 * 概要: 1〜2 行で機能説明。
 * Intent: この関数が存在する設計上の理由（他の層との境界 / 集約など）。
 * Contract:
 *   - Input: 主要引数と必須条件 / バリデーション要点
 *   - Output: 返却の不変条件（例: created_at desc ソート済み）
 * Environment:
 *   - dev: モック配列をソートして返却（ミューテーションあり / 参照返し禁止 => コピー）
 *   - prod: Supabase `posts` テーブル SELECT + ORDER (created_at desc)
 * Errors: Supabase エラー / zod 失敗はそのまま throw（呼び出し側で捕捉）
 * SideEffects: dev では in-memory 配列を mutate（先頭 unshift）
 * Performance: O(n log n) ソート（要件上 n << 1e4 想定）
 * Example:
 *   const posts = await getPosts(); // 常に desc
 */
```

### カテゴリ別ガイド

| 対象                    | 必須項目                                             | 任意項目                               |
| ----------------------- | ---------------------------------------------------- | -------------------------------------- |
| db.ts 関数              | 概要 / Contract / Environment / Errors / SideEffects | Performance / Caching                  |
| loader/action           | 概要 / 入出力 shape / 例外方針                       | キャッシュ戦略 / ストリーミング(defer) |
| zod スキーマ            | モデル意図 / 非自明な制約理由                        | マイグレーションメモ                   |
| カスタムフック          | 役割 / 依存する store / メモ化戦略                   | 競合回避策                             |
| UI コンポーネント(複雑) | 目的 / 状態責務境界                                  | アクセシビリティ考慮                   |

### 具体例: db.ts

```ts
/**
 * 概要: 投稿一覧を新しい順で取得するクエリ集約層。
 * Intent: ルートやフックからデータソース差異 (supabase) を隠蔽。
 * Contract:
 *   - Output: created_at 降順 / 全件 / フィールド固定(id, content, created_at)
 * Environment:
 *   - prod: Supabase posts SELECT + ORDER desc(created_at)
 * Errors: Supabase error そのまま throw。
 */
export async function getPosts(): Promise<Post[]> {
  /* ... */
}
```

### 具体例: action（入力バリデーション付き）

```ts
/**
 * 概要: 新規投稿作成。失敗時 400 (zod) / 500 (DB) を呼び出し側が判別可能に。
 * Contract: 成功時 { ok: true } JSON。
 * Validation: content 1..500 chars。
 */
export async function action({ request }: ActionFunctionArgs) {
  /* ... */
}
```

### 具体例: zod スキーマ

```ts
/** PostInsert: 投稿作成入力。最大長 500 は UI デザイン要件 (1 カード最大高さ) に合わせ固定 */
export const PostInsertSchema = z.object({
  content: z.string().min(1).max(500),
});
```

### 行コメントの推奨用途（必要最低限）

| シナリオ                 | 可否 | 例                                              |
| ------------------------ | ---- | ----------------------------------------------- |
| アルゴリズム上のトリック | ✅   | // 二分探索: O(log n) で挿入位置検索            |
| 一時的ワークアラウンド   | ✅   | // FIXME: Supabase 側 index 追加後に削除        |
| 層境界を越える注意       | ✅   | // 注意: 下層で throw -> 上位 loader が JSON 化 |
| 型で自明な繰り返し       | ❌   | // posts array を返す (冗長)                    |

### 禁止事項

1. コピペで肥大化したテンプレート（空 Example 等）。
2. 実装と不整合な記述を放置。
3. 翻訳だけで内容がない説明（"取得する関数" のみ 等）。
4. PR でコメント削除や変更をしたのに型 / 実装だけ更新。

### 最低品質チェック（セルフレビュー）

```
[] 何を / なぜ が 3 行以内で読める
[] Input 制約が書かれている（バリデーションが別スキーマなら参照）
[] 返却 shape の不変条件が明文化
[] エラー伝播方針 (throw / 包装) が一行で明確
[] 環境差異 (dev/prod) がある場合は記述
```

### 導入ステップ（既存コードへの適用）

1. 変更頻度高い `db.ts` / 主要 loader から優先。
2. PR 単位で「触れた関数のみ」へ段階的追加（フルリライト禁止）。
3. 既存コメントの陳腐化検出: 実装 diff 時にコメント中のフィールド名/制約と差異がないかレビュー。

### Copilot への指示（生成時）

プロンプトに: 「上記コメントテンプレ準拠で関数意図 / Contract / Environment / Errors を先頭ブロックコメントに含めて」 と明示する。

---
