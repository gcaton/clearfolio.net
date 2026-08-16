/**
 * Money is always integer cents. The brand prevents a bare `number` from
 * being assigned where a monetary value is expected.
 */
export type Cents = number & { readonly __brand: 'Cents' }

/** Rounds half-up. JS `Math.round` already does this for positives; negatives
 *  need care, since `Math.round(-2.5)` is -2 and we want -3 for symmetry. */
function halfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

export function cents(n: number): Cents {
  if (!Number.isFinite(n)) throw new Error(`Cents must be finite, got ${n}`)
  if (!Number.isInteger(n)) throw new Error(`Cents must be an integer, got ${n}`)
  return n as Cents
}

export function roundToCents(value: number): Cents {
  if (!Number.isFinite(value)) throw new Error(`Cannot round ${value} to cents`)
  return halfUp(value) as Cents
}

export function fromDollars(dollars: number): Cents {
  return roundToCents(dollars * 100)
}

export function toDollars(c: Cents): number {
  return c / 100
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce<number>((sum, v) => sum + v, 0) as Cents
}

export function subCents(a: Cents, b: Cents): Cents {
  return (a - b) as Cents
}

export function scaleCents(c: Cents, factor: number): Cents {
  return roundToCents(c * factor)
}

export function formatCents(c: Cents, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(toDollars(c))
}
