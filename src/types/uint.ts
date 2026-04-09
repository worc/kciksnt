export type Uint8 = number & { readonly __brand: unique symbol }
export type Uint16 = number & { readonly __brand: unique symbol }
export type Uint32 = number & { readonly __brand: unique symbol }

export function isUint8 (n: number): n is Uint8 {
  return n>= 0 && n <= 255 && Number.isInteger(n)
}

export function asUint8 (n: number): Uint8 {
  if (isUint8(n)) {
    return n
  } else {
    throw new Error(`Value ${n} out of range for Uint8`)
  }
}

export function isUint16 (n: number): n is Uint16 {
  return n>= 0 && n <= 65535 && Number.isInteger(n)
}

export function asUint16 (n: number): Uint16 {
  if (isUint16(n)) {
    return n
  } else {
    throw new Error(`Value ${n} out of range for Uint16`)
  }
}

export function isUint32 (n: number): n is Uint32 {
  return n>= 0 && n <= 4294967295 && Number.isInteger(n)
}

export function asUint32 (n: number): Uint32 {
  if (isUint32(n)) {
    return n
  } else {
    throw new Error(`Value ${n} out of range for Uint32`)
  }
}
