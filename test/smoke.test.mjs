import { describe, it } from 'node:test'
import { execSync } from 'node:child_process'
import assert from 'node:assert'

describe('kguard CLI', () => {
  it('scan exits without crashing', () => {
    const out = execSync('node dist/index.js scan --no-color', {
      encoding: 'utf8',
      cwd: process.cwd(),
    })
    assert.ok(out.includes('KeyGuard'), 'should print KeyGuard header')
  })

  it('--version prints version', () => {
    const out = execSync('node dist/index.js --version', {
      encoding: 'utf8',
    })
    assert.match(out, /\d+\.\d+\.\d+/)
  })

  it('--help prints usage', () => {
    const out = execSync('node dist/index.js --help', {
      encoding: 'utf8',
    })
    assert.ok(out.includes('scan') || out.includes('usage') || out.includes('Usage'),
      'should show usage info')
  })
})
