# ブランチ保護ルールの設定

このドキュメントでは、mainブランチへの直接プッシュを禁止し、プルリクエスト経由でのみ変更を許可する設定方法を説明します。

## GitHubでの設定手順

1. **リポジトリの設定ページへ移動**
   - リポジトリのメインページで「Settings」タブをクリック

2. **ブランチ保護ルールの追加**
   - 左サイドバーの「Code and automation」セクションで「Branches」をクリック
   - 「Add branch protection rule」ボタンをクリック

3. **保護するブランチの指定**
   - 「Branch name pattern」に `main` を入力

4. **保護ルールの設定**
   以下のオプションを有効にします：

   ### 必須設定
   - ✅ **Require a pull request before merging**
     - ✅ **Require approvals** (最低1人のレビュー承認を必須に)
     - ✅ **Dismiss stale pull request approvals when new commits are pushed**
     - ✅ **Require review from CODEOWNERS** (CODEOWNERSファイルがある場合)

   - ✅ **Require status checks to pass before merging**
     - ✅ **Require branches to be up to date before merging**
     - 以下のステータスチェックを必須に設定：
       - `test (18.x)`
       - `test (20.x)`
       - `action-test (ubuntu-latest)`
       - `action-test (windows-latest)`
       - `action-test (macos-latest)`

   - ✅ **Require conversation resolution before merging**
     - すべてのPRコメントが解決されるまでマージを禁止

   ### 追加の保護設定
   - ✅ **Include administrators**
     - 管理者も保護ルールに従う必要があります
   
   - ✅ **Restrict who can push to matching branches**
     - 直接プッシュを完全に禁止（緊急時のみ管理者が解除可能）

5. **ルールの保存**
   - 「Create」ボタンをクリックして保護ルールを作成

## ローカルでの作業フロー

ブランチ保護が有効になった後の推奨ワークフロー：

```bash
# 1. 新しいブランチを作成
git checkout -b feature/new-feature

# 2. 変更を加えてコミット
git add .
git commit -m "機能: 新機能を追加"

# 3. リモートにプッシュ
git push origin feature/new-feature

# 4. GitHubでプルリクエストを作成
# ブラウザで表示されるURLを開くか、GitHub CLIを使用：
gh pr create --base main --title "新機能の追加" --body "詳細な説明"
```

## 緊急時の対応

緊急のホットフィックスが必要な場合：

1. 一時的に保護ルールを無効化（管理者権限が必要）
2. 修正を直接mainにプッシュ
3. 即座に保護ルールを再有効化
4. 事後にプルリクエストを作成して記録を残す

## CI/CDパイプラインとの統合

GitHub Actionsワークフロー（`.github/workflows/test.yml`）が自動的に：
- すべてのプルリクエストでテストを実行
- Node.js 18.xと20.xの両方でテスト
- Ubuntu、Windows、macOSでアクションをテスト
- カバレッジレポートを生成

これにより、品質の高いコードのみがmainブランチにマージされることが保証されます。