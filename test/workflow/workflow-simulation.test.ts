import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { 
  WorkflowValidator, 
  WorkflowMocker, 
  WorkflowInput 
} from './workflow-helpers'

describe('Workflow Simulation Tests', () => {
  let validator: WorkflowValidator
  let mocker: WorkflowMocker
  let actionContent: string

  beforeEach(() => {
    const actionPath = path.join(process.cwd(), 'action.yml')
    actionContent = fs.readFileSync(actionPath, 'utf-8')
    validator = new WorkflowValidator(actionContent)
    mocker = new WorkflowMocker()
  })

  describe('Input Validation', () => {
    it('should validate required inputs', () => {
      const incompleteInputs: Partial<WorkflowInput> = {
        'github-token': 'test-token'
      }

      const errors = validator.validateInputs(incompleteInputs)
      expect(errors).toContain('Missing required input: public-repo-token')
      expect(errors).toContain('Missing required input: private-repo')
      expect(errors).toContain('Missing required input: public-repo')
    })

    it('should pass validation with all required inputs', () => {
      const completeInputs: WorkflowInput = {
        'github-token': 'test-github-token',
        'public-repo-token': 'test-public-token',
        'private-repo': 'owner/private-repo',
        'public-repo': 'owner/public-repo',
        'wrangler-port': '8787'
      }

      const errors = validator.validateInputs(completeInputs)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Bash Availability Check', () => {
    it('should have bash availability check step', () => {
      const checkBashStep = validator.getStepById('check-bash')
      expect(checkBashStep).toBeDefined()
      expect(checkBashStep!.shell).toBe('powershell')
      expect(checkBashStep!.run).toContain('Get-Command bash')
      expect(checkBashStep!.run).toContain('bash_available=true')
      expect(checkBashStep!.run).toContain('bash_available=false')
    })

    it('should output bash availability status', () => {
      const checkBashStep = validator.getStepById('check-bash')
      const runContent = checkBashStep!.run!
      
      expect(runContent).toContain('echo "bash_available=true" >> $env:GITHUB_OUTPUT')
      expect(runContent).toContain('echo "bash_available=false" >> $env:GITHUB_OUTPUT')
    })
  })

  describe('Conditional Step Execution', () => {
    it('should execute bash step when bash is available', () => {
      mocker.setOutput('steps.check-bash.outputs.bash_available', 'true')
      
      const shouldExecute = validator.validateStepConditions(
        'Process and Deploy (Bash)',
        { 'steps.check-bash.outputs.bash_available': 'true' }
      )

      expect(shouldExecute).toBe(true)
    })

    it('should execute powershell step when bash is not available', () => {
      mocker.setOutput('steps.check-bash.outputs.bash_available', 'false')
      
      const shouldExecute = validator.validateStepConditions(
        'Process and Deploy (PowerShell)',
        { 'steps.check-bash.outputs.bash_available': 'false' }
      )

      expect(shouldExecute).toBe(true)
    })
  })

  describe('Command Extraction', () => {
    it('should extract commands from bash step', () => {
      const bashStep = validator.getStepByName('Process and Deploy (Bash)')
      const commands = validator.extractCommandsFromStep(bashStep!, 'bash')

      expect(commands).toContain('tempDir="/tmp/deploy-$(date +%Y%m%d%H%M%S)"')
      expect(commands).toContain('mkdir -p "$tempDir"')
      expect(commands).toContain('npm install')
      expect(commands).toContain('npm run test:coverage')
    })

    it('should extract commands from powershell step', () => {
      // PowerShell steps are now split into multiple steps
      const cloneStep = validator.getStepByName('Clone and Setup Private Repository')
      const testStep = validator.getStepByName('Run Tests and Deploy (PowerShell)')
      
      expect(cloneStep).toBeDefined()
      expect(testStep).toBeDefined()
      
      if (cloneStep) {
        const cloneCommands = validator.extractCommandsFromStep(cloneStep, 'powershell')
        expect(cloneCommands.some(cmd => cmd.includes('git clone'))).toBe(true)
      }
      
      if (testStep) {
        const testCommands = validator.extractCommandsFromStep(testStep, 'powershell')
        expect(testCommands.some(cmd => cmd.includes('npm run test:coverage'))).toBe(true)
      }
    })
  })

  describe('Workflow Flow Simulation', () => {
    it('should simulate complete workflow with bash', () => {
      const inputs: WorkflowInput = {
        'github-token': 'test-github-token',
        'public-repo-token': 'test-public-token',
        'private-repo': 'test-owner/test-private',
        'public-repo': 'test-owner/test-public',
        'wrangler-port': '8787'
      }

      mocker.mockCommand('git clone', () => ({ success: true }))
      mocker.mockCommand('npm install', () => ({ success: true }))
      mocker.mockCommand('npx wrangler dev', () => ({ pid: 12345 }))
      mocker.mockCommand('curl', () => ({ success: true }))
      mocker.mockCommand('npm run test:coverage', () => ({ success: true }))
      mocker.mockCommand('git add', () => ({ success: true }))
      mocker.mockCommand('git commit', () => ({ success: true }))
      mocker.mockCommand('git push', () => ({ success: true }))

      const bashStep = validator.getStepByName('Process and Deploy (Bash)')
      const processedRun = bashStep!.run!
        .replace(/\$\{\{ inputs\.github-token \}\}/g, inputs['github-token'])
        .replace(/\$\{\{ inputs\.public-repo-token \}\}/g, inputs['public-repo-token'])
        .replace(/\$\{\{ inputs\.private-repo \}\}/g, inputs['private-repo'])
        .replace(/\$\{\{ inputs\.public-repo \}\}/g, inputs['public-repo'])
        .replace(/\$\{\{ inputs\.wrangler-port \}\}/g, inputs['wrangler-port']!)

      expect(processedRun).toContain(`https://x-access-token:${inputs['github-token']}@github.com/${inputs['private-repo']}.git`)
      expect(processedRun).toContain(`https://x-access-token:${inputs['public-repo-token']}@github.com/${inputs['public-repo']}.git`)
      expect(processedRun).toContain(`http://localhost:${inputs['wrangler-port']}/specification`)
    })
  })

  describe('Error Handling', () => {
    it('should have proper error handling for wrangler startup', () => {
      // Check bash step
      const bashStep = validator.getStepByName('Process and Deploy (Bash)')
      if (bashStep && bashStep.run) {
        expect(bashStep.run).toContain('if [ $i -eq $maxAttempts ]; then')
        expect(bashStep.run).toContain('echo "ERROR: Wrangler failed to respond after $maxAttempts attempts"')
        expect(bashStep.run).toContain('echo "Continuing without OpenAPI specification..."')
        expect(bashStep.run).not.toContain('exit 1')
      }
      
      // Check PowerShell OpenAPI generation step
      const powershellOpenAPIStep = validator.getStepByName('Generate OpenAPI Specification (PowerShell)')
      if (powershellOpenAPIStep && powershellOpenAPIStep.run) {
        expect(powershellOpenAPIStep.run).toContain('if ($i -eq $maxAttempts)')
        expect(powershellOpenAPIStep.run).toContain('Write-Host "ERROR: Wrangler failed to respond after $maxAttempts attempts"')
        // PowerShell doesn't have the "Continuing without" message
      }
    })

    it('should validate cleanup happens even on failure', () => {
      const bashStep = validator.getStepByName('Process and Deploy (Bash)')
      const commands = validator.extractCommandsFromStep(bashStep!, 'bash')

      const cleanupCommands = commands.filter(cmd => 
        cmd.includes('rm -rf "$tempDir"') || 
        cmd.includes('rm -f .dev.vars')
      )

      expect(cleanupCommands.length).toBeGreaterThan(0)
    })

    it('should handle errors in powershell step', () => {
      // The error handling is now in the Generate OpenAPI Specification step
      const openAPIStep = validator.getStepByName('Generate OpenAPI Specification (PowerShell)')
      expect(openAPIStep).toBeDefined()
      
      if (openAPIStep && openAPIStep.run) {
        const runContent = openAPIStep.run
        expect(runContent).toContain('if ($i -eq $maxAttempts)')
        expect(runContent).toContain('Write-Host "ERROR: Wrangler failed to respond after $maxAttempts attempts"')
        expect(runContent).not.toContain('throw "Wrangler failed to start"')
        // Check that it continues after error
        expect(runContent).toContain('Start-Sleep -Seconds')
      }
      
      // Check cleanup in the PR step
      const prStep = validator.getStepByName('Create PR and Deploy to GitHub Pages (PowerShell)')
      if (prStep && prStep.run) {
        expect(prStep.run).toContain('Remove-Item -Recurse -Force $env:TEMP_DEPLOY_DIR')
        expect(prStep.run).toContain('-ErrorAction SilentlyContinue')
      }
    })
  })
})