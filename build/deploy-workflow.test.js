import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

describe('deployment promotion gate', () => {
  it('builds immutable images and promotes only after all image jobs pass', () => {
    expect(workflow).toContain('group: deploy-main')
    expect(workflow).toContain("git fetch origin --tags '+refs/heads/main:refs/remotes/origin/main'")
    expect(workflow).toContain('RELEASE_SHA="$GITHUB_SHA"')
    expect(workflow).toContain('RELEASE_TAG=$(git describe --tags --abbrev=0 origin/main')
    expect(workflow).toContain('TAG_SHA=$(git rev-list -n 1 "$RELEASE_TAG")')
    expect(workflow).toContain('git merge-base --is-ancestor "$GITHUB_SHA" "$TAG_SHA"')
    expect(workflow).toContain('RELEASE_SHA="$TAG_SHA"')
    expect(workflow).not.toContain('steps.state-before.outputs.tag')
    expect(workflow).not.toContain('git checkout --detach origin/main')
    expect(workflow).toContain('tags: ghcr.io/timunrau/rum1n8-app:${{ needs.release.outputs.sha }}')
    expect(workflow).toContain('tags: ghcr.io/timunrau/rum1n8-site:${{ needs.release.outputs.sha }}')
    expect(workflow).toContain('tags: ghcr.io/timunrau/rum1n8-proxy:${{ needs.release.outputs.sha }}')
    expect(workflow).toContain('needs: [release, build-app, build-site, build-proxy]')
    expect(workflow).toContain('docker buildx imagetools create')
  })

  it('checks both health endpoints before exercising the containers', () => {
    expect(workflow).toMatch(/curl -fsS http:\/\/127\.0\.0\.1:18080\/health[^\n]*\\\n\s+&& curl -fsS http:\/\/127\.0\.0\.1:18081\/health/)
    expect(workflow).not.toContain('/dev/null +')
    expect(workflow).toContain("http_code}' http://127.0.0.1:18080/app/)\" = \"200\"")
    expect(workflow).toContain("http_code}' http://127.0.0.1:18080/app/deep-link)\" = \"200\"")
    expect(workflow).toContain("http://127.0.0.1:18080/app/index.html?view=stats")
    expect(workflow).toContain("http://127.0.0.1:18080/?view=stats&mode=master")
  })

  it('checks the static 404 boundary and query-preserving legacy redirect', () => {
    expect(workflow).toContain('http://127.0.0.1:18081/not-a-real-page')
    expect(workflow).toContain('http://127.0.0.1:18081/privacy.html?from=old')
    expect(workflow).toContain("X-Forwarded-Proto: https")
    expect(workflow).toContain('/marketing/screenshot-empty.png')
    expect(workflow).toContain('http://127.0.0.1:18080/privacy?from=old')
    expect(workflow).toContain('${MARKETING_URL}privacy/?from=old')
  })
})
