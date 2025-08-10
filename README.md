# Drive API Deploy Action

GitHub Action for deploying Drive API documentation and coverage reports.

## Description

This action automates the deployment process for Drive API projects by:
- Generating OpenAPI documentation using Wrangler
- Running tests and generating coverage reports
- Removing sensitive files from the public repository
- Deploying documentation and coverage to GitHub Pages

## Usage

```yaml
- name: Deploy Drive API
  uses: ohishi-yhonda-org/drive-api-deploy-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    public-repo-token: ${{ secrets.PUBLIC_REPO_TOKEN }}
    private-repo: ohishi-yhonda-org/drive-api
    public-repo: ohishi-yhonda-pub/drive-api
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for accessing private repository | Yes | - |
| `public-repo-token` | GitHub token for accessing public repository | Yes | - |
| `private-repo` | Private repository (owner/repo) | Yes | - |
| `public-repo` | Public repository (owner/repo) | Yes | - |
| `wrangler-port` | Port for Wrangler dev server | No | `8787` |

## Requirements

The action requires:
- Node.js and npm installed on the runner
- Git installed on the runner
- A Cloudflare Workers project with Wrangler configuration
- A `.gitattributes` file marking sensitive files with `filter=git-crypt`

## License

MIT