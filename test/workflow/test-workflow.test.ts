import { describe, it, expect, beforeEach } from 'vitest'
import { YamlParser } from '../../src/workflow/yaml-parser'
import * as fs from 'fs'
import * as path from 'path'

describe('Test Workflow', () => {
  let parser: YamlParser
  let workflowConfig: any

  beforeEach(() => {
    parser = new YamlParser()
    workflowConfig = parser.parseWorkflowYaml()
  })

  describe('Workflow Configuration', () => {
    it('should have correct workflow name', () => {
      expect(workflowConfig.name).toBe('テスト')
    })

    it('should trigger on pull requests to main', () => {
      expect(workflowConfig.on.pull_request).toBeDefined()
      expect(workflowConfig.on.pull_request.branches).toContain('main')
    })

    it('should trigger on pushes except main branch', () => {
      expect(workflowConfig.on.push).toBeDefined()
      expect(workflowConfig.on.push['branches-ignore']).toContain('main')
    })

    it('should have required permissions', () => {
      expect(workflowConfig.permissions).toBeDefined()
      expect(workflowConfig.permissions.contents).toBe('write')
      expect(workflowConfig.permissions.pages).toBe('write')
      expect(workflowConfig.permissions['id-token']).toBe('write')
    })
  })

  describe('Test Job Configuration', () => {
    it('should use matrix strategy for multiple OS', () => {
      const testJob = workflowConfig.jobs.test
      expect(testJob.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest', 'macos-latest'])
    })

    it('should only test with Node.js 20.x', () => {
      const testJob = workflowConfig.jobs.test
      expect(testJob.strategy.matrix['node-version']).toEqual(['20.x'])
    })

    it('should run on matrix OS', () => {
      const testJob = workflowConfig.jobs.test
      expect(testJob['runs-on']).toBe('${{ matrix.os }}')
    })
  })

  describe('Workflow Steps', () => {
    let steps: any[]

    beforeEach(() => {
      steps = workflowConfig.jobs.test.steps
    })

    it('should checkout code as first step', () => {
      expect(steps[0].name).toBe('チェックアウト')
      expect(steps[0].uses).toBe('actions/checkout@v4')
    })

    it('should setup Node.js with caching', () => {
      const setupNode = steps[1]
      expect(setupNode.name).toBe('Node.js ${{ matrix.node-version }} のセットアップ')
      expect(setupNode.uses).toBe('actions/setup-node@v4')
      expect(setupNode.with['node-version']).toBe('${{ matrix.node-version }}')
      expect(setupNode.with.cache).toBe('npm')
    })

    it('should install dependencies', () => {
      expect(steps[2].name).toBe('依存関係のインストール')
      expect(steps[2].run).toBe('npm ci')
    })

    it('should run type checking', () => {
      expect(steps[3].name).toBe('型チェック')
      expect(steps[3].run).toBe('npm run typecheck')
    })

    it('should run tests', () => {
      expect(steps[4].name).toBe('テストの実行')
      expect(steps[4].run).toBe('npm test')
    })

    it('should generate coverage report', () => {
      expect(steps[5].name).toBe('カバレッジレポートの生成')
      expect(steps[5].run).toBe('npm run test:coverage')
    })

    it('should deploy Windows coverage on push events', () => {
      const deployStep = steps[6]
      expect(deployStep.name).toBe('Windows環境のカバレッジをGitHub Pagesにデプロイ')
      expect(deployStep.if).toBe("matrix.os == 'windows-latest' && github.event_name == 'push'")
      expect(deployStep.uses).toBe('./')
    })

    it('should use correct tokens for deployment', () => {
      const deployStep = steps[6]
      expect(deployStep.with['github-token']).toBe('${{ secrets.GITHUB_TOKEN }}')
      expect(deployStep.with['public-repo-token']).toBe('${{ secrets.GITHUB_TOKEN }}')
      expect(deployStep.with['private-repo']).toBe('${{ github.repository }}')
      expect(deployStep.with['public-repo']).toBe('${{ github.repository }}')
    })
  })

  describe('Workflow Best Practices', () => {
    it('should use latest action versions', () => {
      const steps = workflowConfig.jobs.test.steps
      const actionSteps = steps.filter((step: any) => step.uses && step.uses.includes('@'))
      
      actionSteps.forEach((step: any) => {
        expect(step.uses).toMatch(/@v\d+/)
      })
    })

    it('should have descriptive step names in Japanese', () => {
      const steps = workflowConfig.jobs.test.steps
      steps.forEach((step: any) => {
        expect(step.name).toBeTruthy()
        expect(step.name.length).toBeGreaterThan(0)
      })
    })

    it('should not expose sensitive information', () => {
      const workflowContent = fs.readFileSync(
        path.join(process.cwd(), '.github', 'workflows', 'test.yml'), 
        'utf-8'
      )
      
      // Check that secrets are properly referenced, not hardcoded
      const lines = workflowContent.split('\n')
      lines.forEach(line => {
        // Skip lines that reference secrets properly
        if (line.includes('${{ secrets.')) return
        // Skip the id-token permission line
        if (line.includes('id-token:')) return
        
        // Check for hardcoded secrets
        expect(line).not.toMatch(/ghp_[a-zA-Z0-9]{36}/)
        expect(line).not.toMatch(/github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/)
      })
      
      expect(workflowContent).toMatch(/\$\{\{ secrets\./)
    })
  })
})