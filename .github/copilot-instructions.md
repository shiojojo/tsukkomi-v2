# Copilot Instructions

このプロジェクトは **React Router v7 + Supabase + Vercel** をベースにしたモダンな Web アプリです。  
Copilot は以下の指示を守ってコードを提案してください。
開発環境はテストデータを作成し読めるようにすること。

.tsx を使用している。

---

## 技術スタック

- **React 19**
- **React Router v7** （Remix スタイルの data API を使う）
- **Supabase JS Client** を利用して DB / Auth / Storage と接続
- **Tailwind CSS** を UI スタイルのベースとする
- **shadcn/ui** をコンポーネントライブラリとして利用
- **TypeScript** を必ず使用
- **Vercel** にデプロイ可能な形にする（SSR も考慮）

---

## ディクレトリ構成（絶対遵守）

Remixと同様の構成を採用する。

## コーディング規約

- 関数はすべて **async/await** を使い、Promise チェーンは使わない
- 状態管理は **React Hooks (useState, useEffect, useLoaderData など)** を基本とする
- **TanStack Query** を利用してデータ取得を効率化
- グローバル状態管理が必要なら **Zustand** を利用
- データ取得は React Router の **loader/action** または **useLoaderData / useFetcher** を優先的に利用する
- API 呼び出しは **Supabase Client** を直接使う
- UI は基本的に **TailwindCSS** で整える。複雑な UI は **shadcn/ui** コンポーネントを活用
- ファイルベースルーティングを採用し、**@react-router/fs-routes** を利用する

## 推奨するライブラリ

- **date-fns** → 日付処理
- **zod** → バリデーション
- **react-hook-form** → フォーム管理
- **framer-motion** → アニメーション
- **lucide-react** → アイコンセット
