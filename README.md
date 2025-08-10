# Drive API デプロイアクション

Drive APIのドキュメントとカバレッジレポートをデプロイするためのGitHub Actionです。

## 説明

このアクションは、Drive APIプロジェクトのデプロイプロセスを自動化します：
- Wranglerを使用してOpenAPIドキュメントを生成
- テストを実行してカバレッジレポートを生成
- パブリックリポジトリから機密ファイルを削除
- ドキュメントとカバレッジをGitHub Pagesにデプロイ

## 使用方法

```yaml
- name: Deploy Drive API
  uses: ohishi-yhonda-org/drive-api-deploy-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    public-repo-token: ${{ secrets.PUBLIC_REPO_TOKEN }}
    private-repo: ohishi-yhonda-org/drive-api
    public-repo: ohishi-yhonda-pub/drive-api
```

## 入力パラメータ

| パラメータ | 説明 | 必須 | デフォルト |
|-----------|------|------|------------|
| `github-token` | プライベートリポジトリへのアクセス用GitHubトークン | はい | - |
| `public-repo-token` | パブリックリポジトリへのアクセス用GitHubトークン | はい | - |
| `private-repo` | プライベートリポジトリ (owner/repo) | はい | - |
| `public-repo` | パブリックリポジトリ (owner/repo) | はい | - |
| `wrangler-port` | Wrangler開発サーバーのポート | いいえ | `8787` |

## 必要条件

このアクションには以下が必要です：
- ランナーにNode.jsとnpmがインストールされていること
- ランナーにGitがインストールされていること
- Wrangler設定を持つCloudflare Workersプロジェクト
- 機密ファイルを`filter=git-crypt`でマークする`.gitattributes`ファイル

## ライセンス

MIT