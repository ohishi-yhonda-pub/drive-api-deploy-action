import { describe, it, expect, beforeEach } from 'vitest'
import { YamlParser } from '../../src/workflow/yaml-parser'

describe('YamlParser', () => {
  let parser: YamlParser

  beforeEach(() => {
    parser = new YamlParser()
  })

  describe('Action YAML Parsing', () => {
    it('should parse action.yml successfully', () => {
      const config = parser.parseActionYaml()
      
      expect(config.name).toBe('Drive API Deploy Action')
      expect(config.description).toContain('Deploy Drive API')
      expect(config.author).toBe('ohishi-yhonda-org')
    })

    it('should extract all inputs', () => {
      const inputs = parser.extractActionInputs()
      
      expect(inputs).toContain('github-token')
      expect(inputs).toContain('public-repo-token')
      expect(inputs).toContain('private-repo')
      expect(inputs).toContain('public-repo')
      expect(inputs).toContain('wrangler-port')
      expect(inputs).toHaveLength(5)
    })

    it('should validate action structure', () => {
      const config = parser.parseActionYaml()
      
      expect(config.runs.using).toBe('composite')
      expect(config.runs.steps.length).toBeGreaterThan(0)
      expect(config.runs.steps[0].name).toBe('Check bash availability')
    })

    it('should analyze action security', () => {
      const security = parser.analyzeActionSecurity()
      
      expect(security.hasHardcodedSecrets).toBe(false)
      expect(security.usesSecureTokens).toBe(true)
      expect(security.cleansUpResources).toBe(true)
    })

    it('should check Wrangler configuration handling', () => {
      const wranglerCheck = parser.checkWranglerConfiguration()
      
      expect(wranglerCheck.checksForWrangler).toBe(true)
      expect(wranglerCheck.skipsIfNotFound).toBe(true)
      expect(wranglerCheck.createsDocsDirectory).toBe(true)
    })
  })

  describe('Workflow YAML Parsing', () => {
    it('should parse workflow yaml successfully', () => {
      const config = parser.parseWorkflowYaml()
      
      expect(config.name).toBe('テスト')
      expect(config.on.pull_request).toBeDefined()
      expect(config.on.push).toBeDefined()
    })

    it('should extract workflow steps', () => {
      const steps = parser.extractWorkflowSteps()
      
      expect(steps).toContain('チェックアウト')
      expect(steps).toContain('Node.js ${{ matrix.node-version }} のセットアップ')
      expect(steps).toContain('依存関係のインストール')
      expect(steps).toContain('型チェック')
      expect(steps).toContain('テストの実行')
      expect(steps).toContain('カバレッジレポートの生成')
    })

    it('should analyze workflow matrix', () => {
      const matrix = parser.analyzeWorkflowMatrix()
      
      expect(matrix.operatingSystems).toEqual(['ubuntu-latest', 'windows-latest', 'macos-latest'])
      expect(matrix.nodeVersions).toEqual(['20.x'])
      expect(matrix.totalCombinations).toBe(3)
    })

    it('should validate workflow permissions', () => {
      const config = parser.parseWorkflowYaml()
      
      expect(config.permissions).toBeDefined()
      expect(config.permissions!.contents).toBe('write')
      expect(config.permissions!.pages).toBe('write')
      expect(config.permissions!['id-token']).toBe('write')
    })
  })

  describe('Cache Management', () => {
    it('should cache parsed files', () => {
      expect(parser.getCacheSize()).toBe(0)
      
      parser.parseActionYaml()
      expect(parser.getCacheSize()).toBe(1)
      
      parser.parseWorkflowYaml()
      expect(parser.getCacheSize()).toBe(2)
    })

    it('should return cached results on subsequent calls', () => {
      const firstCall = parser.parseActionYaml()
      const secondCall = parser.parseActionYaml()
      
      expect(firstCall).toBe(secondCall) // Same reference
      expect(parser.getCacheSize()).toBe(1)
    })

    it('should return cached workflow results', () => {
      const firstCall = parser.parseWorkflowYaml()
      const secondCall = parser.parseWorkflowYaml()
      
      expect(firstCall).toBe(secondCall) // Same reference
      expect(parser.getCacheSize()).toBe(1)
    })

    it('should clear cache', () => {
      parser.parseActionYaml()
      parser.parseWorkflowYaml()
      expect(parser.getCacheSize()).toBe(2)
      
      parser.clearCache()
      expect(parser.getCacheSize()).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should validate required action fields', () => {
      const invalidConfig = {
        name: '',
        description: 'Test',
        runs: { using: 'composite', steps: [] }
      }
      
      expect(() => {
        parser['validateActionConfig'](invalidConfig as any)
      }).toThrow('Action must have a name')
    })

    it('should validate action description', () => {
      const invalidConfig = {
        name: 'Test',
        description: '',
        runs: { using: 'composite', steps: [] }
      }
      
      expect(() => {
        parser['validateActionConfig'](invalidConfig as any)
      }).toThrow('Action must have a description')
    })

    it('should validate action runs type', () => {
      const invalidConfig = {
        name: 'Test',
        description: 'Test',
        runs: { using: 'docker' }
      }
      
      expect(() => {
        parser['validateActionConfig'](invalidConfig as any)
      }).toThrow('Action must use composite runs')
    })

    it('should validate action steps', () => {
      const invalidConfig = {
        name: 'Test',
        description: 'Test',
        runs: { using: 'composite', steps: [] }
      }
      
      expect(() => {
        parser['validateActionConfig'](invalidConfig as any)
      }).toThrow('Action must have at least one step')
    })

    it('should validate required workflow fields', () => {
      const invalidConfig = {
        name: '',
        on: {},
        jobs: {}
      }
      
      expect(() => {
        parser['validateWorkflowConfig'](invalidConfig as any)
      }).toThrow('Workflow must have a name')
    })

    it('should validate workflow triggers', () => {
      const invalidConfig = {
        name: 'Test',
        on: null,
        jobs: {}
      }
      
      expect(() => {
        parser['validateWorkflowConfig'](invalidConfig as any)
      }).toThrow('Workflow must have triggers')
    })

    it('should validate workflow jobs', () => {
      const invalidConfig = {
        name: 'Test',
        on: { push: {} },
        jobs: {}
      }
      
      expect(() => {
        parser['validateWorkflowConfig'](invalidConfig as any)
      }).toThrow('Workflow must have at least one job')
    })
  })

  describe('Edge Cases', () => {
    it('should handle workflows without matrix strategy', () => {
      const config = {
        name: 'Test',
        on: { push: {} },
        jobs: {
          test: {
            'runs-on': 'ubuntu-latest',
            steps: []
          }
        }
      }
      
      const matrix = parser.analyzeWorkflowMatrix(config as any)
      expect(matrix.operatingSystems).toEqual([])
      expect(matrix.nodeVersions).toEqual([])
      expect(matrix.totalCombinations).toBe(0)
    })

    it('should detect hardcoded secrets in action', () => {
      const config = {
        name: 'Test',
        description: 'Test',
        runs: {
          using: 'composite',
          steps: [{
            name: 'Bad step',
            shell: 'bash',
            run: 'echo ghp_abcdefghijklmnopqrstuvwxyz1234567890'
          }]
        }
      }
      
      const security = parser.analyzeActionSecurity(config as any)
      expect(security.hasHardcodedSecrets).toBe(true)
    })

    it('should detect GitHub PAT tokens', () => {
      const config = {
        name: 'Test',
        description: 'Test',
        runs: {
          using: 'composite',
          steps: [{
            name: 'Bad step',
            shell: 'bash',
            run: 'echo github_pat_11BCDEFGHIJKLMNOPQRS23_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRS'
          }]
        }
      }
      
      const security = parser.analyzeActionSecurity(config as any)
      expect(security.hasHardcodedSecrets).toBe(true)
    })
  })

  describe('Advanced Analysis', () => {
    it('should detect all bash and powershell steps', () => {
      const config = parser.parseActionYaml()
      const bashSteps = config.runs.steps.filter(step => step.shell === 'bash')
      const powershellSteps = config.runs.steps.filter(step => step.shell === 'powershell')
      
      expect(bashSteps.length).toBeGreaterThan(0)
      expect(powershellSteps.length).toBeGreaterThan(0)
    })

    it('should verify git configuration in action', () => {
      const config = parser.parseActionYaml()
      const gitConfigSteps = config.runs.steps.filter(step => 
        step.run && step.run.includes('git config')
      )
      
      expect(gitConfigSteps.length).toBeGreaterThan(0)
      gitConfigSteps.forEach(step => {
        expect(step.run).toMatch(/github-actions\[bot\]/)
      })
    })

    it('should check deployment conditions', () => {
      const config = parser.parseWorkflowYaml()
      const deployStep = config.jobs.test.steps.find(step => 
        step.name && step.name.includes('デプロイ')
      )
      
      expect(deployStep).toBeDefined()
      expect(deployStep!.if).toContain('windows-latest')
      expect(deployStep!.if).toContain('push')
    })
  })
})