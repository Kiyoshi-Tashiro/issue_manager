# APS Issue Manager

Autodesk Platform Services (APS) Viewer と連携し、BIMモデル上の3D空間に直接「指摘事項 (Issue)」をピン留めして管理するWebアプリケーションです。

## 前提条件

- **Node.js**: v18以上推奨
- **Docker & Docker Compose**: データベース (PostgreSQL) およびオブジェクトストレージ (MinIO) の起動に必要
- **APS Credentials**: Autodesk Platform Services の Client ID, Client Secret, および閲覧対象の Model URN

## 環境構築と起動手順

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd issue-manager
npm install
```

### 2. 環境変数の設定

プロジェクトルートにある `.env.example` をコピーして `.env` または `.env.local` を作成し、必要な値を設定してください。

```bash
cp .env.example .env.local
```

特に以下の項目は動作に必須です：
- **APS Credentials**: Viewerでのモデル表示に必要です。
- **MinIO Settings**: 写真のアップロード保存に必要です（Docker起動時のデフォルト値が `.env.example` に設定されています）。

### 3. バックエンドサービス (DB / Storage) の起動

Docker Compose を使用して、PostgreSQL と MinIO をバックグラウンドで起動します。

```bash
docker compose up -d
```

### 4. データベースとストレージの初期化

Prisma を使用してデータベースのスキーマを同期し、初期データを投入します。また、MinIO に必要なバケットを作成します。

```bash
# DBマイグレーションとシード（ユーザー情報等の投入）
npx prisma db push
npx prisma db seed

# ストレージ（MinIO）の初期化（バケット作成とポリシー設定）
npm run setup:storage
```

### 5. 開発サーバーの起動

Next.jsの開発サーバーを起動します。

```bash
npm run dev
```

起動後、ブラウザで [http://localhost:3000/projects](http://localhost:3000/projects) にアクセスしてください。

> [!TIP]
> 画面右上のユーザーセレクターを使用することで、Admin / Editor / Viewer の各ロールによる権限の違い（編集可否など）を簡単に確認できます。

---

## トラブルシューティング

### ビューアーがロードされない（"Loading WebGL Viewer..." のまま動かない）
- `.env.local` の `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_URN` が正しく設定されているか確認してください。
- インターネット接続を確認してください（AutodeskのライブラリをCDN経由で取得します）。

### ユーザー一覧が空、または「Loading users...」で止まる
- `npx prisma db seed` を実行したか確認してください。
- Dockerコンテナ (`aps-issue-db`) が正しく起動しているか確認してください。

---

## テストの実行

このプロジェクトは単体テスト(Vitest)およびE2Eテスト(Playwright)によって品質を保証しています。

**単体テスト (ロジック・コンポーネントのテスト):**
```bash
npm run test
```

**E2Eテスト (ブラウザ上での通しテスト):**
```bash
npm run test:e2e
```
*(※注意: E2Eテストは必ず開発サーバー `npm run dev` が起動している状態で実行してください)*

## 技術スタック
- **Frontend**: Next.js (App Router), React, TailwindCSS
- **3D Viewer**: Autodesk Platform Services (APS) Viewer, Three.js
- **Backend / DB**: Next.js API Routes, Prisma, PostgreSQL
- **Testing**: Vitest, Playwright
