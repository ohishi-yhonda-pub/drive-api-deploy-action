import * as yaml from 'yaml'

export interface WorkflowInput {
  'github-token': string
  'public-repo-token': string
  'private-repo': string
  'public-repo': string
  'wrangler-port'?: string
}

export interface WorkflowStep {
  name: string
  id?: string
  shell?: 'bash' | 'powershell' | 'pwsh' | 'sh' | 'cmd'
  run?: string
  if?: string
}

export interface ActionConfig {
  name: string
  description: string
  author?: string
  inputs: Record<string, InputConfig>
  runs: {
    using: 'composite' | 'node12' | 'node16' | 'node20' | 'docker'
    steps: WorkflowStep[]
  }
}

export interface InputConfig {
  description: string
  required: boolean
  default?: string
}

export interface StepExecutionResult {
  success: boolean
  outputs?: Record<string, string>
  error?: string
}

export type CommandHandler = () => unknown
export type OutputKey = `steps.${string}.outputs.${string}`

export class WorkflowValidator {
  private actionConfig: ActionConfig

  constructor(actionYamlContent: string) {
    this.actionConfig = yaml.parse(actionYamlContent) as ActionConfig
  }

  validateInputs(inputs: Partial<WorkflowInput>): string[] {
    const errors: string[] = []
    const requiredInputs = Object.entries(this.actionConfig.inputs)
      .filter(([_, config]) => config.required)
      .map(([name]) => name)

    for (const requiredInput of requiredInputs) {
      if (!inputs[requiredInput as keyof WorkflowInput]) {
        errors.push(`Missing required input: ${requiredInput}`)
      }
    }

    return errors
  }

  getStepByName(stepName: string): WorkflowStep | undefined {
    return this.actionConfig.runs.steps.find((step: WorkflowStep) => step.name === stepName)
  }

  getStepById(stepId: string): WorkflowStep | undefined {
    return this.actionConfig.runs.steps.find((step: WorkflowStep) => step.id === stepId)
  }

  extractCommandsFromStep(step: WorkflowStep, _shell?: NonNullable<WorkflowStep['shell']>): string[] {
    if (!step.run) return []

    const commands: string[] = []
    const lines = step.run.split('\n')

    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        commands.push(trimmed)
      }
    })

    return commands
  }

  validateStepConditions(stepName: string, outputs: Record<string, string>): boolean {
    const step = this.getStepByName(stepName)
    if (!step || !step.if) return true

    const condition = step.if
    const conditionRegex = /steps\.(.+?)\.outputs\.(.+?)\s*==\s*'(.+?)'/
    const match = condition.match(conditionRegex)

    if (match) {
      const [_, stepId, outputName, expectedValue] = match
      const actualValue = outputs[`steps.${stepId}.outputs.${outputName}`]
      return actualValue === expectedValue
    }

    return true
  }
}

export class WorkflowMocker {
  private mockedCommands: Map<string, CommandHandler> = new Map()
  private outputs: Record<OutputKey, string> = {} as Record<OutputKey, string>

  mockCommand(command: string, handler: CommandHandler): void {
    this.mockedCommands.set(command, handler)
  }

  setOutput(key: OutputKey, value: string): void {
    this.outputs[key] = value
  }

  getOutput(key: OutputKey): string | undefined {
    return this.outputs[key]
  }

  executeCommand(command: string): unknown {
    for (const [pattern, handler] of this.mockedCommands) {
      if (command.includes(pattern)) {
        return handler()
      }
    }
    throw new Error(`No mock found for command: ${command}`)
  }

  reset(): void {
    this.mockedCommands.clear()
    this.outputs = {} as Record<OutputKey, string>
  }

  getOutputs(): Record<string, string> {
    return this.outputs as Record<string, string>
  }
}

export function simulateWorkflowStep(
  step: WorkflowStep,
  inputs: WorkflowInput,
  mocker: WorkflowMocker
): StepExecutionResult {
  try {
    if (!step.run) {
      return { success: true }
    }

    let processedRun = step.run
    Object.entries(inputs).forEach(([key, value]) => {
      const pattern = new RegExp(`\\$\\{\\{\\s*inputs\\.${key}\\s*\\}\\}`, 'g')
      processedRun = processedRun.replace(pattern, value)
    })

    const lines = processedRun.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) continue

      if (step.shell === 'powershell') {
        if (trimmedLine.includes('echo') && trimmedLine.includes('GITHUB_OUTPUT')) {
          const outputMatch = trimmedLine.match(/echo "(.+?)=(.+?)" >> \$env:GITHUB_OUTPUT/)
          if (outputMatch) {
            const [_, key, value] = outputMatch
            mocker.setOutput(`steps.${step.id}.outputs.${key}` as OutputKey, value)
          }
        } else if (trimmedLine.includes('try {')) {
          mocker.setOutput(`steps.${step.id}.outputs.bash_available` as OutputKey, 'true')
        } else if (trimmedLine.includes('} catch {')) {
          mocker.setOutput(`steps.${step.id}.outputs.bash_available` as OutputKey, 'false')
        }
      } else {
        if (trimmedLine.includes('echo') && trimmedLine.includes('GITHUB_OUTPUT')) {
          const outputMatch = trimmedLine.match(/echo "(.+?)=(.+?)" >> \$GITHUB_OUTPUT/)
          if (outputMatch) {
            const [_, key, value] = outputMatch
            mocker.setOutput(`steps.${step.id}.outputs.${key}` as OutputKey, value)
          }
        } else {
          mocker.executeCommand(trimmedLine)
        }
      }
    }

    return { 
      success: true, 
      outputs: Object.fromEntries(
        Object.entries(mocker.getOutputs())
          .filter(([k]) => k.startsWith(`steps.${step.id}`))
      )
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

export function validateActionStructure(actionConfig: Partial<ActionConfig>): string[] {
  const errors: string[] = []

  if (!actionConfig.name) errors.push('Missing action name')
  if (!actionConfig.description) errors.push('Missing action description')
  if (!actionConfig.runs) errors.push('Missing runs configuration')
  if (actionConfig.runs && actionConfig.runs.using !== 'composite') {
    errors.push('Action must use composite runner')
  }
  if (!actionConfig.inputs) errors.push('Missing inputs configuration')

  return errors
}

export function isValidShell(shell: string): shell is NonNullable<WorkflowStep['shell']> {
  return ['bash', 'powershell', 'pwsh', 'sh', 'cmd'].includes(shell)
}

export function assertWorkflowInput(input: unknown): asserts input is WorkflowInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid workflow input')
  }
  
  const obj = input as Record<string, unknown>
  const requiredFields = ['github-token', 'public-repo-token', 'private-repo', 'public-repo'] as const
  
  for (const field of requiredFields) {
    if (typeof obj[field] !== 'string') {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  if (obj['wrangler-port'] !== undefined && typeof obj['wrangler-port'] !== 'string') {
    throw new Error('wrangler-port must be a string')
  }
}