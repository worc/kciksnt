export function encodeLifxString(s: string): Uint8Array {
  const bytes = new Uint8Array(32)
  const encoded = new TextEncoder().encode(s)
  bytes.set(encoded.slice(0, 32))

  return bytes
}

export function decodeLifxString(buf: Uint8Array): string {
  const nullIndex = buf.indexOf(0)
  const slice = nullIndex === -1 ? buf : buf.slice(0, nullIndex)

  return new TextDecoder().decode(slice)
}
