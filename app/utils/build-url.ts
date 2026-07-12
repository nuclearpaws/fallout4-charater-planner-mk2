import { normalizeBuild } from './build-validation'
import type { Build } from './planner'

const hashPrefix = 'build='

export function encodeBuildHash(build: Build) {
  const json = JSON.stringify(build)
  return `${hashPrefix}${toBase64Url(new TextEncoder().encode(json))}`
}

export function decodeBuildHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const encoded = params.get('build')
  if (!encoded) return null
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    return normalizeBuild(JSON.parse(json))
  } catch {
    return null
  }
}

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  const base64 = typeof btoa === 'function' ? btoa(binary) : nodeBuffer().from(binary, 'binary').toString('base64')
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = typeof atob === 'function' ? atob(base64) : nodeBuffer().from(base64, 'base64').toString('binary')
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function nodeBuffer() {
  return (globalThis as typeof globalThis & { Buffer: { from(value: string, encoding: string): { toString(encoding: string): string } } }).Buffer
}
