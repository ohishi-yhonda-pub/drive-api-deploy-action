# GitHub Actions ワークフローテスト

このディレクトリには、GitHub Actionsワークフロー（`action.yml`）のテストが含まれています。

## テストの構成

### 1. `action.test.ts`
action.ymlの基本的な構造とメタデータを検証します：
- アクション名、説明、著者の確認
- 必須入力パラメータの検証
- Compositeアクションタイプの確認
- セキュリティベストプラクティスのチェック

### 2. `workflow-simulation.test.ts`
ワークフローの動作をシミュレートして検証します：
- 入力パラメータの検証
- 条件付きステップの実行
- エラーハンドリング
- クリーンアップ処理

### 3. `workflow-helpers.ts`
テスト用のヘルパー関数とクラス：
- `WorkflowValidator`: YAMLの解析と検証
- `WorkflowMocker`: コマンドのモック化
- `simulateWorkflowStep`: ステップの実行シミュレーション

## テストの実行

```bash
# すべてのテストを実行
npm test

# カバレッジレポート付きでテスト実行
npm run test:coverage

# ウォッチモードでテスト実行
npm run test:watch
```

## テストの追加方法

新しいワークフローの動作をテストする場合：

1. `workflow-simulation.test.ts`に新しいテストケースを追加
2. 必要に応じて`WorkflowMocker`でコマンドをモック化
3. `simulateWorkflowStep`でステップの実行をシミュレート

例：
```typescript
it('should handle new feature', () => {
  const step = validator.getStepByName('New Step')
  mocker.mockCommand('new-command', () => ({ success: true }))
  
  const result = simulateWorkflowStep(step!, inputs, mocker)
  expect(result.success).toBe(true)
})
```

## ワークフローの変更時

action.ymlを変更した場合、以下のテストを更新してください：

1. 新しい入力パラメータ → `Input Validation`テスト
2. 新しいステップ → `Workflow Steps`テスト
3. 新しいエラーハンドリング → `Error Handling`テスト

これにより、ワークフローの変更が意図通りに動作することを確認できます。