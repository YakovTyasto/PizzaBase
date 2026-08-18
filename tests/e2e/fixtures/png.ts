import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

/**
 * Real PNG files, generated rather than checked in.
 *
 * The image pipeline sniffs magic bytes and decodes through the browser, so a
 * stub file would be rejected exactly as it should be -- the fixtures have to
 * be genuine images for the tests to exercise anything.
 */

const DIR = mkdtempSync(path.join(tmpdir(), 'impasto-fixtures-'))

const CRC_TABLE = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc(body))
  return Buffer.concat([length, body, checksum])
}

export function pngBuffer(size = 64): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour

  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x += 1) {
      raw[row + 1 + x * 3] = (x * 4) % 256
      raw[row + 2 + x * 3] = (y * 4) % 256
      raw[row + 3 + x * 3] = 128
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Writes a PNG to a temp file and returns its path. */
export function pngFixture(name: string, size = 64): string {
  const file = path.join(DIR, name)
  writeFileSync(file, pngBuffer(size))
  return file
}

export function textFixture(name: string, contents: string): string {
  const file = path.join(DIR, name)
  writeFileSync(file, contents)
  return file
}
