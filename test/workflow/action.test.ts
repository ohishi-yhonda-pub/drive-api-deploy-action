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
      const powershellStep = actionConfig.runs.steps.find((step: any) => 
        step.name === 'Process and Deploy (PowerShell)'
      )

      expect(bashStep).toBeDefined()
      expect(powershellStep).toBeDefined()
      
      expect(bashStep.shell).toBe('bash')
      expect(powershellStep.shell).toBe('powershell')
    })

    it('should have conditional execution based on bash availability', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.if).toBe("steps.check-bash.outputs.bash_available == 'true'")
      expect(powershellStep.if).toBe("steps.check-bash.outputs.bash_available == 'false'")
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
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/x-access-token:\$\{\{ inputs\.github-token \}\}/)
      expect(powershellStep.run).toMatch(/x-access-token:\$\{\{ inputs\.public-repo-token \}\}/)
    })

    it('should clean up temporary files and directories', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/rm -rf "\$tempDir"/)
      expect(powershellStep.run).toMatch(/Remove-Item -Recurse -Force \$tempDir/)
    })
  })

  describe('Workflow Logic Validation', () => {
    it('should handle .dev.vars template file correctly', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/if \[ -f \.dev\.vars\.template \]; then/)
      expect(bashStep.run).toMatch(/cp \.dev\.vars\.template \.dev\.vars/)
      
      expect(powershellStep.run).toMatch(/if \(Test-Path \.dev\.vars\.template\)/)
      expect(powershellStep.run).toMatch(/Copy-Item \.dev\.vars\.template \.dev\.vars/)
    })

    it('should wait for wrangler server with timeout', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/maxAttempts=30/)
      expect(powershellStep.run).toMatch(/\$maxAttempts = 30/)
    })

    it('should generate OpenAPI specification', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/curl -s http:\/\/localhost:\$\{\{ inputs\.wrangler-port \}\}\/specification > docs\/openapi\.json/)
      expect(powershellStep.run).toMatch(/Invoke-WebRequest -Uri "http:\/\/localhost:\$\{\{ inputs\.wrangler-port \}\}\/specification"/)
    })

    it('should run test coverage', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/npm run test:coverage/)
      expect(powershellStep.run).toMatch(/npm run test:coverage/)
    })

    it('should handle git-crypt files removal', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/filter=git-crypt/)
      expect(powershellStep.run).toMatch(/filter=git-crypt/)
    })

    it('should push to main branch after removing sensitive files', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      // Check that sensitive files are removed before pushing to main
      expect(bashStep.run).toMatch(/# Remove sensitive files[\s\S]*git push public temp-deploy:main --force/)
      expect(powershellStep.run).toMatch(/# Remove sensitive files[\s\S]*git push public temp-deploy:main --force/)
      
      // Check that orphan branch is created to avoid action history
      expect(bashStep.run).toMatch(/git checkout --orphan temp-deploy/)
      expect(powershellStep.run).toMatch(/git checkout --orphan temp-deploy/)
      
      // Check that original commit message is preserved
      expect(bashStep.run).toMatch(/git commit -m "\$ORIGINAL_MSG"/)
      expect(powershellStep.run).toMatch(/git commit -m \$originalMsg/)
    })

    it('should deploy to GitHub Pages', () => {
      const bashStep = actionConfig.runs.steps[1]
      const powershellStep = actionConfig.runs.steps[2]

      expect(bashStep.run).toMatch(/git checkout gh-pages/)
      expect(bashStep.run).toMatch(/git push origin gh-pages --force/)
      
      expect(powershellStep.run).toMatch(/git checkout gh-pages/)
      expect(powershellStep.run).toMatch(/git push origin gh-pages --force/)
    })
  })
})