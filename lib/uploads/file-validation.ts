const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime] ?? null
}

export function hasExpectedSignature(bytes: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  if (mime === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mime === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))
  if (mime === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  if (mime === 'application/pdf') return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'application/msword') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  return false
}
