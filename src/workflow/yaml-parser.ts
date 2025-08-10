import * as yaml from 'yaml'
import * as fs from 'fs'
import * as path from 'path'

export interface ActionConfig {
  name: string
  description: string
  author: string
  inputs: Record<string, {
    description: string
    required: boolean
    default?: string
  }>
  runs: {
    using: string
    steps: Array<{
      name: string
      id?: string
      shell?: string
      run?: string
      uses?: string
      if?: string
      with?: Record<string, string>
    }>
  }
}

export interface WorkflowConfig {
  name: string
  on: {
    pull_request?: {
      branches?: string[]
    }
    push?: {
      branches?: string[]
      'branches-ignore'?: string[]
    }
    workflow_dispatch?: any
  }
  permissions?: Record<string, string>
  jobs: Record<string, {
    'runs-on': string
    strategy?: {
      matrix?: Record<string, any[]>
    }
    steps: Array<{
      name: string
      uses?: string
      run?: string
      with?: Record<string, string>
      if?: string
    }>
  }>
}

export class YamlParser {
  private cache: Map<string, any> = new Map()

  parseActionYaml(filePath?: string): ActionConfig {
    const actualPath = filePath || path.join(process.cwd(), 'action.yml')
    
    if (this.cache.has(actualPath)) {
      return this.cache.get(actualPath)
    }

    const content = fs.readFileSync(actualPath, 'utf-8')
    const parsed = yaml.parse(content) as ActionConfig
    
    this.validateActionConfig(parsed)
    this.cache.set(actualPath, parsed)
    
    return parsed
  }

  parseWorkflowYaml(filePath?: string): WorkflowConfig {
    const actualPath = filePath || path.join(process.cwd(), '.github', 'workflows', 'test.yml')
    
    if (this.cache.has(actualPath)) {
      return this.cache.get(actualPath)
    }

    const content = fs.readFileSync(actualPath, 'utf-8')
    const parsed = yaml.parse(content) as WorkflowConfig
    
    this.validateWorkflowConfig(parsed)
    this.cache.set(actualPath, parsed)
    
    return parsed
  }

  private validateActionConfig(config: ActionConfig): void {
    if (!config.name) {
      throw new Error('Action must have a name')
    }
    
    if (!config.description) {
      throw new Error('Action must have a description')
    }
    
    if (!config.runs || config.runs.using !== 'composite') {
      throw new Error('Action must use composite runs')
    }
    
    if (!config.runs.steps || config.runs.steps.length === 0) {
      throw new Error('Action must have at least one step')
    }
  }

  private validateWorkflowConfig(config: WorkflowConfig): void {
    if (!config.name) {
      throw new Error('Workflow must have a name')
    }
    
    if (!config.on) {
      throw new Error('Workflow must have triggers')
    }
    
    if (!config.jobs || Object.keys(config.jobs).length === 0) {
      throw new Error('Workflow must have at least one job')
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  getCacheSize(): number {
    return this.cache.size
  }

  analyzeActionSecurity(config?: ActionConfig): {
    hasHardcodedSecrets: boolean
    usesSecureTokens: boolean
    cleansUpResources: boolean
  } {
    const actionConfig = config || this.parseActionYaml()
    const steps = actionConfig.runs.steps
    
    let hasHardcodedSecrets = false
    let usesSecureTokens = false
    let cleansUpResources = false
    
    steps.forEach(step => {
      if (step.run) {
        // Check for hardcoded secrets
        if (/ghp_[a-zA-Z0-9]{36}/.test(step.run) || 
            /github_pat_[a-zA-Z0-9_]+/.test(step.run)) {
          hasHardcodedSecrets = true
        }
        
        // Check for secure token usage
        if (/x-access-token:\$\{\{/.test(step.run)) {
          usesSecureTokens = true
        }
        
        // Check for cleanup
        if (/rm -rf|Remove-Item -Recurse -Force/.test(step.run)) {
          cleansUpResources = true
        }
      }
    })
    
    return {
      hasHardcodedSecrets,
      usesSecureTokens,
      cleansUpResources
    }
  }

  analyzeWorkflowMatrix(config?: WorkflowConfig): {
    operatingSystems: string[]
    nodeVersions: string[]
    totalCombinations: number
  } {
    const workflowConfig = config || this.parseWorkflowYaml()
    const testJob = workflowConfig.jobs.test
    
    if (!testJob || !testJob.strategy || !testJob.strategy.matrix) {
      return {
        operatingSystems: [],
        nodeVersions: [],
        totalCombinations: 0
      }
    }
    
    const matrix = testJob.strategy.matrix
    const operatingSystems = matrix.os || []
    const nodeVersions = matrix['node-version'] || []
    
    return {
      operatingSystems,
      nodeVersions,
      totalCombinations: operatingSystems.length * nodeVersions.length
    }
  }

  extractActionInputs(config?: ActionConfig): string[] {
    const actionConfig = config || this.parseActionYaml()
    return Object.keys(actionConfig.inputs || {})
  }

  extractWorkflowSteps(config?: WorkflowConfig): string[] {
    const workflowConfig = config || this.parseWorkflowYaml()
    const steps: string[] = []
    
    Object.values(workflowConfig.jobs).forEach(job => {
      job.steps.forEach(step => {
        steps.push(step.name)
      })
    })
    
    return steps
  }

  checkWranglerConfiguration(config?: ActionConfig): {
    checksForWrangler: boolean
    skipsIfNotFound: boolean
    createsDocsDirectory: boolean
  } {
    const actionConfig = config || this.parseActionYaml()
    const steps = actionConfig.runs.steps
    
    let checksForWrangler = false
    let skipsIfNotFound = false
    let createsDocsDirectory = false
    
    steps.forEach(step => {
      if (step.run) {
        if (/if \[ -f wrangler\.toml \]|Test-Path wrangler\.toml/.test(step.run)) {
          checksForWrangler = true
        }
        
        if (/No wrangler\.toml found, skipping/.test(step.run)) {
          skipsIfNotFound = true
        }
        
        if (/mkdir -p docs|New-Item -ItemType Directory -Path docs/.test(step.run)) {
          createsDocsDirectory = true
        }
      }
    })
    
    return {
      checksForWrangler,
      skipsIfNotFound,
      createsDocsDirectory
    }
  }
}