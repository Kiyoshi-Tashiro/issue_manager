# プレゼンテーション層詳細設計書

本ドキュメントでは、Issue Manager アプリケーションにおけるプレゼンテーション層（UI/UX および API エンドポイント）の責務、構成要素、および外部とのインターフェースについて実装事実に基づいて記述します。

## 1. 概要
プレゼンテーション層は、ユーザーインターフェース（Next.js/React）と、フロントエンドからの要求をアプリケーション層へ橋渡しする API Route（BFF: Backend For Frontend）によって構成されます。3D モデル上での指摘事項の可視化と、直感的な編集操作を提供することを目的とします。

## 2. 責務
- **ユーザーインターフェースの提供**: React コンポーネントによる動的で応答性の高い UI を提供します。
- **3D 可視化と操作**: Autodesk Platform Services (APS) Viewer を統合し、指摘事項を 3D 空間上のピン（Marker）として表示・操作可能にします。
- **入力データの受付と変換**: フォームデータや写真バイナリを受け取り、アプリケーション層の Command 形式へ変換します。
- **表示用データの最適化**: ユースケースから返されたデータを UI コンポーネントに適した形式で管理・表示します。
- **表示権限の制御**: `UserContext` 等を利用し、ユーザーロールに応じたボタンの表示/非表示や編集可否をフロントエンド側でも制御します。

## 3. 主要な構成要素 (UI Components)

### 3.1 ApsViewer (`components/viewer/ApsViewer.tsx`)
Autodesk Viewer のライフサイクルを管理する中心的なコンポーネントです。
- **トークン管理**: `/api/aps/token` から取得したアクセス・トークンを使用して Viewer を初期化します。
- **拡張のロード**: `IssueExtension` 等のカスタム拡張を Viewer に登録・ロードします。
- **状態同期**: 選択された階数（Floor）に応じてモデルの表示/非表示（Ghosting 等）を切り替えます。

### 3.2 IssueExtension (`components/viewer/extensions/IssueExtension.ts`)
Viewer の機能を拡張し、指摘事項固有の表示・操作を実現します。
- **ピン（Marker）表示**: 3D XYZ 座標に基づき、錐体（Cone）形状のマーカーを生成・表示します。
- **インタラクション**: マーカーのクリックを検知し、React 側の詳細表示関数（`onMarkerClick`）を呼び出します。
- **座標計算**: 3D モデル上の任意の位置をクリックした際の XYZ 座標を取得し、新規作成フローへ渡します。

### 3.3 Side Panels & Modals
- **IssueList (`components/IssueList.tsx`)**: 選択中のフロアに属する指摘事項を一覧表示し、クリックで Viewer 内のカメラを該当箇所へ移動（FitToView）させます。
- **IssueDetailModal (`components/IssueDetailModal.tsx`)**: 指摘の新規作成および編集用ダイアログです。写真（複数選択）のプレビュー、ステータス変更、バリデーションを提供します。
- **UserSelector (`components/UserSelector.tsx`)**: テストやデモ用途でユーザーロール（Admin/Editor/Viewer）を切り替えるためのグローバルセレクターです。

## 4. API Routes (BFF)
Next.js の `/api` ディレクトリ下に定義され、クライアントからのリクエストをユースケースに委譲します。

| エンドポイント | メソッド | 対応するユースケース | 説明 |
| :--- | :--- | :--- | :--- |
| `/api/issues` | `GET` | `GetIssuesByFloorQuery` | フロア指定または全件の指摘を取得。 |
| `/api/issues` | `POST` | `CreateIssueUseCase` | `Multipart/form-data` 形式で入力と写真を受信。 |
| `/api/issues/[id]` | `PATCH` | `UpdateIssueUseCase` | 指定 ID の属性更新・写真追加。 |
| `/api/issues/[id]` | `DELETE` | (Repository 直接呼出) | 指摘の物理削除（Admin限定）。 |
| `/api/floors` | `GET` | (Prisma 経由) | アプリケーションで使用可能なフロア一覧の取得。 |

## 5. 状態管理と通信
- **React Context**: `UserContext` により、ログイン中のユーザー情報やロールを全コンポーネントで共有します。
- **Fetch API**: 標準の `fetch` を使用して BFF と通信します。
- **formData**: 写真アップロードを含むリクエストでは `formData` オブジェクトを使用してバイナリデータを送信します。

## 6. エラーハンドリング
- **PageErrorBoundary (`components/PageErrorBoundary.tsx`)**: 予期せぬ実行時エラーが発生した際に、ユーザーフレンドリーなエラー画面を表示し、自動再読み込みボタンを提供します。
- **ErrorSuppressor**: ブラウザコンソールに出力される APS Viewer 特有の定型的な警告や無害なエラー（CORS関連等）をフィルタリングして秘匿し、DX（開発者体験）を向上させます。
