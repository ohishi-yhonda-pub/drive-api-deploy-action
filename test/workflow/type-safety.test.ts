import { describe, it, expect } from 'vitest'
import { 
  WorkflowInput,
  WorkflowStep,
  ActionConfig,
  InputConfig,
  StepExecutionResult,
  OutputKey,
  isValidShell,
  assertWorkflowInput
} from './workflow-helpers'

describe('Type Safety Tests', () => {
  describe('WorkflowInput Type', () => {
    it('should enforce required properties', () => {
      const validInput: WorkflowInput = {
        'github-token': 'token1',
        'public-repo-token': 'token2',
        'private-repo': 'owner/private',
        'public-repo': 'owner/public'
      }

      expect(validInput['github-token']).toBe('token1')
      expect(validInput['wrangler-port']).toBeUndefined()
    })

    it('should allow optional wrangler-port', () => {
      const inputWithPort: WorkflowInput = {
        'github-token': 'token1',
        'public-repo-token': 'token2',
        'private-repo': 'owner/private',
        'public-repo': 'owner/public',
        'wrangler-port': '8080'
      }

      expect(inputWithPort['wrangler-port']).toBe('8080')
    })
  })

  describe('WorkflowStep Type', () => {
    it('should enforce valid shell types', () => {
      const validSteps: WorkflowStep[] = [
        { name: 'Step 1', shell: 'bash' },
        { name: 'Step 2', shell: 'powershell' },
        { name: 'Step 3', shell: 'pwsh' },
        { name: 'Step 4', shell: 'sh' },
        { name: 'Step 5', shell: 'cmd' }
      ]

      validSteps.forEach(step => {
        expect(step.shell).toBeDefined()
        if (step.shell) {
          expect(isValidShell(step.shell)).toBe(true)
        }
      })
    })
  })

  describe('ActionConfig Type', () => {
    it('should enforce correct structure', () => {
      const config: ActionConfig = {
        name: 'Test Action',
        description: 'Test description',
        author: 'Test Author',
        inputs: {
          'test-input': {
            description: 'Test input',
            required: true,
            default: 'default-value'
          }
        },
        runs: {
          using: 'composite',
          steps: [
            { name: 'Test Step', run: 'echo test' }
          ]
        }
      }

      expect(config.name).toBe('Test Action')
      expect(config.runs.using).toBe('composite')
    })
  })

  describe('OutputKey Type', () => {
    it('should match expected pattern', () => {
      const validKeys: OutputKey[] = [
        'steps.check-bash.outputs.bash_available',
        'steps.build.outputs.artifact_path',
        'steps.test.outputs.coverage_report'
      ]

      validKeys.forEach(key => {
        expect(key).toMatch(/^steps\..+\.outputs\..+$/)
      })
    })
  })

  describe('Type Guards', () => {
    it('should validate shell types', () => {
      expect(isValidShell('bash')).toBe(true)
      expect(isValidShell('powershell')).toBe(true)
      expect(isValidShell('invalid')).toBe(false)
    })

    it('should assert valid workflow input', () => {
      const validInput = {
        'github-token': 'token1',
        'public-repo-token': 'token2',
        'private-repo': 'owner/private',
        'public-repo': 'owner/public'
      }

      expect(() => assertWorkflowInput(validInput)).not.toThrow()
    })

    it('should throw for invalid workflow input', () => {
      const invalidInputs = [
        null,
        undefined,
        'string',
        123,
        { 'github-token': 'token' }, // missing required fields
        {
          'github-token': 123, // wrong type
          'public-repo-token': 'token2',
          'private-repo': 'owner/private',
          'public-repo': 'owner/public'
        },
        {
          'github-token': 'token1',
          'public-repo-token': 'token2',
          'private-repo': 'owner/private',
          'public-repo': 'owner/public',
          'wrangler-port': 123 // wrong type for optional field
        }
      ]

      invalidInputs.forEach(input => {
        expect(() => assertWorkflowInput(input)).toThrow()
      })
    })
  })

  describe('StepExecutionResult Type', () => {
    it('should handle success result', () => {
      const successResult: StepExecutionResult = {
        success: true,
        outputs: {
          'key1': 'value1',
          'key2': 'value2'
        }
      }

      expect(successResult.success).toBe(true)
      expect(successResult.outputs).toBeDefined()
      expect(successResult.error).toBeUndefined()
    })

    it('should handle error result', () => {
      const errorResult: StepExecutionResult = {
        success: false,
        error: 'Something went wrong'
      }

      expect(errorResult.success).toBe(false)
      expect(errorResult.error).toBe('Something went wrong')
      expect(errorResult.outputs).toBeUndefined()
    })
  })

  describe('InputConfig Type', () => {
    it('should enforce required properties', () => {
      const requiredInput: InputConfig = {
        description: 'Required input',
        required: true
      }

      const optionalInput: InputConfig = {
        description: 'Optional input',
        required: false,
        default: 'default-value'
      }

      expect(requiredInput.required).toBe(true)
      expect(requiredInput.default).toBeUndefined()
      expect(optionalInput.required).toBe(false)
      expect(optionalInput.default).toBe('default-value')
    })
  })
})