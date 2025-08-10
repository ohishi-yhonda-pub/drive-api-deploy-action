import { describe, it, expect, beforeEach } from 'vitest'
import { 
  WorkflowValidator,
  WorkflowMocker,
  simulateWorkflowStep,
  validateActionStructure,
  WorkflowInput,
  WorkflowStep
} from './workflow-helpers'
import * as yaml from 'yaml'

describe('Workflow Helpers Coverage Tests', () => {
  describe('WorkflowMocker', () => {
    let mocker: WorkflowMocker

    beforeEach(() => {
      mocker = new WorkflowMocker()
    })

    it('should reset mocked commands and outputs', () => {
      mocker.mockCommand('test-command', () => 'result')
      mocker.setOutput('steps.test.outputs.result' as const, 'value')
      
      mocker.reset()
      
      expect(() => mocker.executeCommand('test-command')).toThrow('No mock found for command')
      expect(mocker.getOutput('steps.test.outputs.result' as const)).toBeUndefined()
    })

    it('should execute mocked commands with partial match', () => {
      mocker.mockCommand('npm', () => ({ success: true }))
      
      const result = mocker.executeCommand('npm install --save-dev typescript')
      expect(result).toEqual({ success: true })
    })

    it('should get all outputs', () => {
      mocker.setOutput('steps.build.outputs.artifact' as const, 'build.zip')
      mocker.setOutput('steps.test.outputs.report' as const, 'coverage.html')
      
      const outputs = (mocker as any).getOutputs()
      expect(outputs['steps.build.outputs.artifact']).toBe('build.zip')
      expect(outputs['steps.test.outputs.report']).toBe('coverage.html')
    })
  })

  describe('simulateWorkflowStep', () => {
    let mocker: WorkflowMocker

    beforeEach(() => {
      mocker = new WorkflowMocker()
    })

    it('should handle step without run command', () => {
      const step: WorkflowStep = {
        name: 'Empty Step',
        id: 'empty'
      }
      
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(true)
      expect(result.outputs).toBeUndefined()
    })

    it('should process bash script outputs', () => {
      const step: WorkflowStep = {
        name: 'Bash Output Step',
        id: 'bash-output',
        shell: 'bash',
        run: `
          # This is a comment
          echo "result=success" >> $GITHUB_OUTPUT
          echo "version=1.0.0" >> $GITHUB_OUTPUT
        `
      }
      
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(true)
      expect(mocker.getOutput('steps.bash-output.outputs.result' as const)).toBe('success')
      expect(mocker.getOutput('steps.bash-output.outputs.version' as const)).toBe('1.0.0')
    })

    it('should process powershell script outputs', () => {
      const step: WorkflowStep = {
        name: 'PowerShell Output Step',
        id: 'ps-output',
        shell: 'powershell',
        run: `
          # PowerShell comment
          echo "status=ready" >> $env:GITHUB_OUTPUT
          echo "build=12345" >> $env:GITHUB_OUTPUT
        `
      }
      
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(true)
      expect(mocker.getOutput('steps.ps-output.outputs.status' as const)).toBe('ready')
      expect(mocker.getOutput('steps.ps-output.outputs.build' as const)).toBe('12345')
    })

    it('should handle powershell try-catch bash detection', () => {
      const stepWithTry: WorkflowStep = {
        name: 'Detect Bash Try',
        id: 'detect-try',
        shell: 'powershell',
        run: 'try {'
      }
      
      const result1 = simulateWorkflowStep(stepWithTry, {} as WorkflowInput, mocker)
      expect(result1.success).toBe(true)
      expect(mocker.getOutput('steps.detect-try.outputs.bash_available' as const)).toBe('true')
      
      // Test catch block
      const stepWithCatch: WorkflowStep = {
        name: 'Detect Bash Catch',
        id: 'detect-catch',
        shell: 'powershell',
        run: '} catch {'
      }
      
      mocker.reset()
      const result2 = simulateWorkflowStep(stepWithCatch, {} as WorkflowInput, mocker)
      expect(result2.success).toBe(true)
      expect(mocker.getOutput('steps.detect-catch.outputs.bash_available' as const)).toBe('false')
    })

    it('should handle powershell output without match', () => {
      const step: WorkflowStep = {
        name: 'PS No Match',
        id: 'no-match',
        shell: 'powershell',
        run: 'echo "Invalid output format"'
      }
      
      mocker.mockCommand('echo', () => true)
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(true)
    })

    it('should handle bash output without match', () => {
      const step: WorkflowStep = {
        name: 'Bash No Match',
        id: 'no-match',
        shell: 'bash',
        run: 'echo "Invalid output format"'
      }
      
      mocker.mockCommand('echo', () => true)
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(true)
    })

    it('should handle command execution errors', () => {
      const step: WorkflowStep = {
        name: 'Error Step',
        id: 'error',
        shell: 'bash',
        run: 'unknown-command --fail'
      }
      
      mocker.mockCommand('unknown-command', () => {
        throw new Error('Command not found')
      })
      
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Command not found')
    })

    it('should handle non-Error exceptions', () => {
      const step: WorkflowStep = {
        name: 'String Error Step',
        id: 'string-error',
        shell: 'bash',
        run: 'failing-command'
      }
      
      mocker.mockCommand('failing-command', () => {
        throw 'String error message'
      })
      
      const result = simulateWorkflowStep(step, {} as WorkflowInput, mocker)
      expect(result.success).toBe(false)
      expect(result.error).toBe('String error message')
    })

    it('should replace input variables in commands', () => {
      const step: WorkflowStep = {
        name: 'Input Step',
        id: 'input',
        shell: 'bash',
        run: 'git clone https://x-access-token:${{ inputs.github-token }}@github.com/${{ inputs.private-repo }}.git'
      }
      
      const inputs: WorkflowInput = {
        'github-token': 'test-token-123',
        'public-repo-token': 'token',
        'private-repo': 'owner/private',
        'public-repo': 'owner/public'
      }
      
      let executedCommand = ''
      mocker.mockCommand('git clone', () => {
        executedCommand = 'git clone executed'
        return true
      })
      
      const result = simulateWorkflowStep(step, inputs, mocker)
      expect(result.success).toBe(true)
      expect(executedCommand).toBe('git clone executed')
    })
  })

  describe('validateActionStructure', () => {
    it('should validate empty config', () => {
      const errors = validateActionStructure({})
      expect(errors).toContain('Missing action name')
      expect(errors).toContain('Missing action description')
      expect(errors).toContain('Missing runs configuration')
      expect(errors).toContain('Missing inputs configuration')
    })

    it('should validate incorrect runner type', () => {
      const config = {
        name: 'Test',
        description: 'Test',
        inputs: {},
        runs: {
          using: 'docker' as const,
          steps: []
        }
      }
      
      const errors = validateActionStructure(config)
      expect(errors).toContain('Action must use composite runner')
    })

    it('should pass valid structure', () => {
      const config = {
        name: 'Test',
        description: 'Test',
        inputs: {},
        runs: {
          using: 'composite' as const,
          steps: []
        }
      }
      
      const errors = validateActionStructure(config)
      expect(errors).toHaveLength(0)
    })
  })

  describe('WorkflowValidator edge cases', () => {
    it('should handle missing step', () => {
      const validator = new WorkflowValidator(yaml.stringify({
        name: 'Test',
        inputs: {},
        runs: { using: 'composite', steps: [] }
      }))
      
      expect(validator.getStepByName('Non-existent')).toBeUndefined()
      expect(validator.getStepById('non-existent')).toBeUndefined()
    })

    it('should handle extractCommandsFromStep with no run command', () => {
      const validator = new WorkflowValidator(yaml.stringify({
        name: 'Test',
        inputs: {},
        runs: {
          using: 'composite',
          steps: [{
            name: 'No Run Step',
            id: 'no-run'
          }]
        }
      }))
      
      const step = validator.getStepByName('No Run Step')
      const commands = validator.extractCommandsFromStep(step!, 'bash')
      expect(commands).toEqual([])
    })

    it('should validate step conditions without if clause', () => {
      const validator = new WorkflowValidator(yaml.stringify({
        name: 'Test',
        inputs: {},
        runs: {
          using: 'composite',
          steps: [{
            name: 'Always Run',
            run: 'echo "Always"'
          }]
        }
      }))
      
      expect(validator.validateStepConditions('Always Run', {})).toBe(true)
    })

    it('should handle complex condition validation', () => {
      const validator = new WorkflowValidator(yaml.stringify({
        name: 'Test',
        inputs: {},
        runs: {
          using: 'composite',
          steps: [{
            name: 'Conditional',
            if: 'steps.prev.outputs.status == \'success\'',
            run: 'echo "Conditional"'
          }]
        }
      }))
      
      const shouldRun = validator.validateStepConditions(
        'Conditional',
        { 'steps.prev.outputs.status': 'success' }
      )
      expect(shouldRun).toBe(true)
      
      const shouldNotRun = validator.validateStepConditions(
        'Conditional',
        { 'steps.prev.outputs.status': 'failure' }
      )
      expect(shouldNotRun).toBe(false)
    })

    it('should handle invalid condition format', () => {
      const validator = new WorkflowValidator(yaml.stringify({
        name: 'Test',
        inputs: {},
        runs: {
          using: 'composite',
          steps: [{
            name: 'Invalid Condition',
            if: 'invalid condition format',
            run: 'echo "Test"'
          }]
        }
      }))
      
      const result = validator.validateStepConditions('Invalid Condition', {})
      expect(result).toBe(true) // Falls back to true for unparseable conditions
    })
  })
})