import { describe, it, expect, beforeEach } from 'vitest'
import { YamlParser } from '../../src/workflow/yaml-parser'
import * as fs from 'fs'
import * as path from 'path'

describe('GitHub Action Workflow', () => {
  let parser: YamlParser
  let actionConfig: any

  beforeEach(() => {
    parser = new YamlParser()
    actionConfig = parser.parseActionYaml()
  })

  describe('Action Configuration', () => {
    it('should have correct action metadata', () => {
      expect(actionConfig.name).toBe('Drive API Deploy Action')
      expect(actionConfig.description).toBeTruthy()
      expect(actionConfig.author).toBe('ohishi-yhonda-org')
    })

    it('should have all required inputs', () => {
      const requiredInputs = ['github-token', 'public-repo-token', 'private-repo', 'public-repo']
      
      requiredInputs.forEach(input => {
        expect(actionConfig.inputs[input]).toBeDefined()
        expect(actionConfig.inputs[input].required).toBe(true)
        expect(actionConfig.inputs[input].description).toBeTruthy()
      })
    })

    it('should have optional wrangler-port input with default value', () => {
      expect(actionConfig.inputs['wrangler-port']).toBeDefined()
      expect(actionConfig.inputs['wrangler-port'].required).toBe(false)
      expect(actionConfig.inputs['wrangler-port'].default).toBe('8787')
    })

    it('should use composite action type', () => {
      expect(actionConfig.runs.using).toBe('composite')
    })
  })

  describe('Workflow Steps', () => {
    it('should have bash availability check as first step', () => {
      const firstStep = actionConfig.runs.steps[0]
      expect(firstStep.name).toBe('Check bash availability')
      expect(firstStep.shell).toBe('powershell')
      expect(firstStep.id).toBe('check-bash')
    })

    it('should have both bash and powershell deployment steps', () => {
      const bashStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Process and Deploy (Bash)'
      )
      const powershellSetupStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Setup PowerShell Environment'
      )

      expect(bashStep).toBeDefined()
      expect(powershellSetupStep).toBeDefined()
      
      expect(bashStep.shell).toBe('bash')
      expect(powershellSetupStep.shell).toBe('powershell')
    })

    it('should have conditional execution based on bash availability', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellSetupStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Setup PowerShell Environment'
      )

      expect(bashStep.if).toBe("steps.check-bash.outputs.bash_available == 'true'")
      expect(powershellSetupStep.if).toBe("steps.check-bash.outputs.bash_available == 'false'")
    })
  })

  describe('Security and Best Practices', () => {
    it('should not contain hardcoded secrets', () => {
      const actionContent = fs.readFileSync(path.join(process.cwd(), 'action.yml'), 'utf-8')
      
      const secretPatterns = [
        /ghp_[a-zA-Z0-9]{36}/,
        /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
        /[a-f0-9]{40}/
      ]

      secretPatterns.forEach(pattern => {
        expect(actionContent).not.toMatch(pattern)
      })
    })

    it('should use secure token passing with x-access-token', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellPRStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )

      expect(bashStep.run).toMatch(/x-access-token:\$\{\{ inputs\.github-token \}\}/)
      // PowerShell uses variable substitution pattern
      expect(powershellPRStep).toBeDefined()
      expect(powershellPRStep.run).toMatch(/x-access-token:\${publicToken}/)
    })

    it('should clean up temporary files and directories', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellPRStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )

      expect(bashStep.run).toMatch(/rm -rf "\$tempDir"/)
      expect(powershellPRStep).toBeDefined()
      expect(powershellPRStep.run).toMatch(/Remove-Item -Recurse -Force \$env:TEMP_DEPLOY_DIR/)
    })
  })

  describe('PowerShell URL Construction', () => {
    it('should use Trim() to remove whitespace from tokens and repos', () => {
      const cloneStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Clone and Setup Private Repository' && step.shell === 'powershell'
      )
      const prStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )
      
      // Check for Trim() usage in Clone step
      expect(cloneStep).toBeDefined()
      expect(cloneStep.run).toMatch(/\$token = "\$\{\{ inputs\.github-token \}\}"\.Trim\(\)/)
      expect(cloneStep.run).toMatch(/\$repo = "\$\{\{ inputs\.private-repo \}\}"\.Trim\(\)/)
      
      // Check for Trim() usage in PR step
      expect(prStep).toBeDefined()
      expect(prStep.run).toMatch(/\$publicToken = "\$\{\{ inputs\.public-repo-token \}\}"\.Trim\(\)/)
      expect(prStep.run).toMatch(/\$publicRepo = "\$\{\{ inputs\.public-repo \}\}"\.Trim\(\)/)
    })

    it('should construct URLs using PowerShell string interpolation', () => {
      const cloneStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Clone and Setup Private Repository' && step.shell === 'powershell'
      )
      const prStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )
      
      // Check URL construction pattern
      expect(cloneStep).toBeDefined()
      expect(cloneStep.run).toMatch(/\$privateRepoUrl = "https:\/\/x-access-token:\$\{token\}@github\.com\/\$\{repo\}\.git"/)
      
      expect(prStep).toBeDefined()
      expect(prStep.run).toMatch(/\$publicRepoUrl = "https:\/\/x-access-token:\$\{publicToken\}@github\.com\/\$\{publicRepo\}\.git"/)
    })

    it('should use variable references in git clone commands', () => {
      const cloneStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Clone and Setup Private Repository' && step.shell === 'powershell'
      )
      const prStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )
      
      // Check git clone uses variables
      expect(cloneStep).toBeDefined()
      expect(cloneStep.run).toMatch(/git clone \$privateRepoUrl private/)
      
      expect(prStep).toBeDefined()
      expect(prStep.run).toMatch(/git clone \$publicRepoUrl public-temp/)
    })
  })

  describe('Workflow Logic Validation', () => {
    it('should handle .dev.vars template file correctly', () => {
      const bashStep = actionConfig.runs.steps[1]
      const openAPIStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Generate OpenAPI Specification (PowerShell)'
      )

      expect(bashStep.run).toMatch(/if \[ -f \.dev\.vars\.template \]; then/)
      expect(bashStep.run).toMatch(/cp \.dev\.vars\.template \.dev\.vars/)
      
      expect(openAPIStep).toBeDefined()
      expect(openAPIStep.run).toMatch(/if \(Test-Path \.dev\.vars\.template\)/)
      expect(openAPIStep.run).toMatch(/Copy-Item \.dev\.vars\.template \.dev\.vars/)
    })

    it('should wait for wrangler server with timeout', () => {
      const bashStep = actionConfig.runs.steps[1]
      const openAPIStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Generate OpenAPI Specification (PowerShell)'
      )

      expect(bashStep.run).toMatch(/maxAttempts=30/)
      expect(openAPIStep).toBeDefined()
      expect(openAPIStep.run).toMatch(/\$maxAttempts = 30/)
    })

    it('should generate OpenAPI specification', () => {
      const bashStep = actionConfig.runs.steps[1]
      
      // Find the PowerShell OpenAPI generation step
      const powershellOpenAPIStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Generate OpenAPI Specification (PowerShell)'
      )

      expect(bashStep.run).toMatch(/curl -w "%{http_code}" -o docs\/openapi\.json -s http:\/\/localhost:\$actualPort\/specification/)
      expect(powershellOpenAPIStep).toBeDefined()
      expect(powershellOpenAPIStep.run).toMatch(/curl\.exe/)
    })

    it('should run test coverage', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellTestStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Run Tests and Deploy (PowerShell)'
      )

      expect(bashStep.run).toMatch(/npm run test:coverage/)
      expect(powershellTestStep).toBeDefined()
      expect(powershellTestStep.run).toMatch(/npm run test:coverage/)
    })

    it('should handle git-crypt files removal', () => {
      const bashStep = actionConfig.runs.steps[1]
      const testStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Run Tests and Deploy (PowerShell)'
      )

      expect(bashStep.run).toMatch(/filter=git-crypt/)
      expect(testStep).toBeDefined()
      expect(testStep.run).toMatch(/filter=git-crypt/)
    })

    it('should create PR instead of pushing to main branch after removing sensitive files', () => {
      const bashStep = actionConfig.runs.steps[1]
      const testStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Run Tests and Deploy (PowerShell)'
      )
      const prStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )

      // Check that sensitive files are removed
      expect(bashStep.run).toMatch(/# Remove sensitive files/)
      expect(testStep).toBeDefined()
      expect(testStep.run).toMatch(/# Remove sensitive files/)
      
      // Check that it creates a branch with common history (not orphan)
      expect(bashStep.run).toMatch(/# Create a new branch from main/)
      expect(bashStep.run).toMatch(/git checkout -b \$BRANCH_NAME/)
      expect(prStep).toBeDefined()
      expect(prStep.run).toMatch(/# Create a new branch from main/)
      expect(prStep.run).toMatch(/git checkout -b \$branchName/)
      
      // Check that it pushes to origin (not the old pattern)
      expect(bashStep.run).toMatch(/git push origin \$BRANCH_NAME/)
      expect(prStep.run).toMatch(/git push origin \$branchName/)
      
      // Check that PR is created
      expect(bashStep.run).toMatch(/gh pr create --repo/)
      expect(prStep.run).toMatch(/Invoke-RestMethod -Uri .* -Method Post/)
      
      // Check that PR is auto-merged
      expect(bashStep.run).toMatch(/gh pr merge/)
      expect(prStep.run).toMatch(/Invoke-RestMethod -Uri .* -Method Put/)
      
      // Check that original commit message is preserved
      expect(bashStep.run).toMatch(/git commit -m "\$ORIGINAL_MSG"/)
      expect(prStep.run).toMatch(/git commit -m "\$env:ORIGINAL_MSG"/)
    })

    it('should deploy to GitHub Pages', () => {
      const bashStep = actionConfig.runs.steps[1]
      const prStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Create PR and Deploy to GitHub Pages (PowerShell)'
      )

      expect(bashStep.run).toMatch(/git checkout gh-pages/)
      expect(bashStep.run).toMatch(/git push origin gh-pages --force/)
      
      expect(prStep).toBeDefined()
      expect(prStep.run).toMatch(/git checkout gh-pages/)
      expect(prStep.run).toMatch(/git push origin gh-pages --force/)
    })
  })
})