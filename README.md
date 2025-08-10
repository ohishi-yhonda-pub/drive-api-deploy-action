# Drive API デプロイアクション

- このアクションは、プライベートリポジトリからパブリックリポジトリへのドキュメントとカバレッジのデプロイを自動化します。
- Drive APIのドキュメントとカバレッジレポートをGitHub PagesにデプロイするためのGitHub Actionです。
- Wrangler設定を持つCloudflare Workersプロジェクトが必要です。
- git-cryptを使用した機密ファイルの管理もサポートしています。
- 機密ファイルをpublicリポジトリから削除し、ドキュメントとカバレッジをGitHub Pagesにデプロイします。


## 機能

- プライベートリポジトリからパブリックリポジトリへの自動デプロイ
- OpenAPIドキュメントの自動生成（Wrangler使用時）
- テストカバレッジレポートの生成とGitHub Pagesへのデプロイ
- git-cryptで暗号化されたファイルの自動除外
- クロスプラットフォーム対応（Windows/Linux/macOS）

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

## 必要条件

このアクションには以下が必要です：
- ランナーにNode.jsとnpmがインストールされていること
- ランナーにGitがインストールされていること
- Wrangler設定を持つCloudflare Workersプロジェクト
- 機密ファイルを`filter=git-crypt`でマークする`.gitattributes`ファイル

## 説明

このアクションは、Drive APIプロジェクトのデプロイプロセスを自動化します：
- Wranglerを使用してOpenAPIドキュメントを生成
- テストを実行してカバレッジレポートを生成
- パブリックリポジトリから機密ファイルを削除
- ドキュメントとカバレッジをGitHub Pagesにデプロイ


## 入力パラメータ

| パラメータ | 説明 | 必須 | デフォルト |
|-----------|------|------|------------|
| `github-token` | プライベートリポジトリへのアクセス用GitHubトークン | はい | - |
| `public-repo-token` | パブリックリポジトリへのアクセス用GitHubトークン | はい | - |
| `private-repo` | プライベートリポジトリ (owner/repo) | はい | - |
| `public-repo` | パブリックリポジトリ (owner/repo) | はい | - |
| `wrangler-port` | github action で使用するWrangler開発サーバーのポート | いいえ | `8787` |

## Personal Access Token (PAT) の設定

### パブリックリポジトリ用のPAT作成

1. GitHubのSettings > Developer settings > Personal access tokensに移動
2. "Generate new token (classic)"をクリック
3. 以下の権限を付与：
   - `repo` - フルコントロール（プライベートリポジトリへのアクセス）
   - `workflow` - ワークフローの更新
4. トークンを生成し、安全に保管
5. リポジトリのSettings > Secrets and variablesで`PUBLIC_REPO_TOKEN`として追加

## ライセンス

MIT