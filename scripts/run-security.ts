#!/usr/bin/env tsx
/**
 * G2 Security Gate — osv-scanner (dependency CVE) + gitleaks (secrets)
 *
 * Pre-push hook runs this. Exits non-zero on any failure so push is blocked.
 * No Cargo.lock probe (rooster has no Rust component).
 */

import { spawnSync } from 'node:child_process'

interface Result {
  tool: string
  ok: boolean
}

interface Run {
  code: number
  stdout: string
  stderr: string
}

function run(cmd: string, args: string[]): Run {
  const r = spawnSync(cmd, args, { encoding: 'utf-8' })
  return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr }
}

const results: Result[] = []

console.info('→ G2: osv-scanner (bun.lock)')
{
  const r = run('osv-scanner', ['--config=osv-scanner.toml', '--lockfile=bun.lock'])
  if (r.code === 0) {
    console.info('  ✔ osv-scanner: no vulnerabilities found')
    results.push({ tool: 'osv-scanner', ok: true })
  } else {
    console.error('  ✘ osv-scanner: vulnerabilities detected')
    console.error(r.stdout + r.stderr)
    results.push({ tool: 'osv-scanner', ok: false })
  }
}

console.info('→ G2: gitleaks (secrets leak detection)')
{
  const upstream = run('git', ['rev-parse', '--abbrev-ref', '@{u}'])
  let logOpts: string
  if (upstream.code === 0) {
    logOpts = `${upstream.stdout.trim()}..HEAD`
  } else {
    console.info('  ⚠ gitleaks: no upstream branch, scanning recent 20 commits')
    logOpts = '-20'
  }
  const r = run('gitleaks', ['git', `--log-opts=${logOpts}`, '--no-banner'])
  if (r.code === 0) {
    console.info('  ✔ gitleaks: no leaks detected')
    results.push({ tool: 'gitleaks', ok: true })
  } else {
    console.error('  ✘ gitleaks: potential secrets detected')
    console.error(r.stdout + r.stderr)
    results.push({ tool: 'gitleaks', ok: false })
  }
}

const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.error(`\n✘ G2 Security gate FAILED (${failed.map((f) => f.tool).join(', ')})`)
  process.exit(1)
}

console.info('\n✔ G2 Security gate PASSED')
