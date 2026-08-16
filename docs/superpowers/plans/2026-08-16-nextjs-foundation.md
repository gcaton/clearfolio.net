# Next.js Rewrite — Slice 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js foundation for Clearfolio — complete database schema, pure domain layer with ported test suites, passphrase authentication, setup wizard, and container packaging — producing a running, authenticated, empty app shell.

**Architecture:** A pure `src/domain/` layer with zero I/O holds all business logic (money, periods, ownership, frequency, projections) and carries the entire unit-test surface. `src/db/` owns Drizzle schema and migrations against SQLite via `better-sqlite3`. `src/server/` composes the two. The `app/` tree uses React Server Components for reads and server actions for mutations; only five route handlers exist, for genuinely-HTTP concerns.

**Tech Stack:** Next.js 16.3 (App Router), React 19.2, TypeScript 7.0, Drizzle ORM 0.45 + Drizzle Kit, better-sqlite3 13, Tailwind CSS 4.3, shadcn/ui, Zod 4, Pino, Vitest, Playwright, Node 24.

**Spec:** `docs/superpowers/specs/2026-08-16-nextjs-foundation-design.md`

## Global Constraints

- **Money is integer cents.** Column suffix `_cents`, TypeScript branded type `Cents`. A bare `number` must not be assignable.
- **Rates and ratios are REAL** — return rate, volatility, interest rate, inflation are not money.
- **`price_per_unit` is REAL, deliberately not cents** — sub-dollar ASX and crypto prices need sub-cent precision.
- **Ownership shares are integer basis points** summing to 10000. Enforced in application code and tests; SQLite cannot express a cross-row sum check.
- **Timestamps are integer unix seconds.** Calendar dates (`contribution_end_date`, `repayment_end_date`) stay ISO `YYYY-MM-DD` text.
- **Soft delete is preserved** (`is_active`); entities are never hard-deleted outside import/replace.
- **`src/domain/` imports nothing from `src/db/` or `src/server/`.** Every value it needs is passed in.
- **No auth `middleware.ts` at all.** Auth is resolved in the authenticated layout via `resolveAuthState`. Cookie-presence middleware is not a weaker version of this — it is wrong, because the passphrase-disabled default has no cookie.
- **IDs are UUID strings.**
- **`src/api` and `src/app` are not modified and not deleted** in this slice. They remain as porting reference. They simply stop being built.
- **Branch:** all work lands on `nextjs-rewrite`. Nothing merges to `main` in this slice.
- Environment variables retained verbatim: `DB_PATH`, `CLEARFOLIO_SESSION_DAYS` (default 30), `CLEARFOLIO_RESET_PASSPHRASE`.

---

### Task 1: Scaffold the Next application and test harness

**Files:**
- Create: `src/web/package.json`
- Create: `src/web/tsconfig.json`
- Create: `src/web/next.config.ts`
- Create: `src/web/vitest.config.ts`
- Create: `src/web/app/layout.tsx`
- Create: `src/web/app/page.tsx`
- Test: `src/web/src/domain/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` (Vitest) and `npm run dev` (Next) inside `src/web`

- [ ] **Step 1: Create the project directory and package.json**

```bash
mkdir -p src/web/app src/web/src/domain src/web/public
touch src/web/public/.gitkeep
```

`public/` must exist and be committed — the Dockerfile in Task 16 copies it, and `COPY` fails on a missing source.

`src/web/package.json`:

```json
{
  "name": "clearfolio-web",
  "version": "0.0.0",
  "private": true,
  "packageManager": "npm@11.6.2",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^16.3.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^7.0.2",
    "vitest": "^3.0.0"
  }
}
```

> **Compatibility note:** TypeScript 7.0 is the native-port compiler. If `npm run build` or `npm run typecheck` fails with a Next.js plugin incompatibility at this step, downgrade to `"typescript": "^5.9.2"` and record that in the commit message. Verify before proceeding — do not carry a broken toolchain into Task 2.

- [ ] **Step 2: Create tsconfig.json**

`src/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@app/*": ["./app/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts and vitest.config.ts**

`src/web/next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
```

`src/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Write the smoke test**

`src/web/src/domain/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Create minimal app shell so `next build` succeeds**

`src/web/app/layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`src/web/app/page.tsx`:

```tsx
export default function Home() {
  return <main>Clearfolio</main>
}
```

- [ ] **Step 6: Install and verify both toolchains**

Run:

```bash
cd src/web && npm install && npm test && npm run build
```

Expected: Vitest reports 1 passing test; `next build` completes and reports a `standalone` output.

- [ ] **Step 7: Update .gitignore**

Append to `.gitignore`:

```
src/web/node_modules/
src/web/.next/
src/web/next-env.d.ts
src/web/test-results/
src/web/playwright-report/
```

- [ ] **Step 8: Commit**

```bash
git add -f src/web/public/.gitkeep
git add src/web .gitignore
git commit -m "feat: scaffold Next.js app with Vitest harness"
```

---

### Task 2: Money domain — branded Cents type

**Files:**
- Create: `src/web/src/domain/money.ts`
- Test: `src/web/src/domain/money.test.ts`
- Delete: `src/web/src/domain/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Cents = number & { readonly __brand: 'Cents' }`
  - `cents(n: number): Cents` — throws on non-integer
  - `fromDollars(dollars: number): Cents`
  - `toDollars(c: Cents): number`
  - `addCents(...values: Cents[]): Cents`
  - `subCents(a: Cents, b: Cents): Cents`
  - `scaleCents(c: Cents, factor: number): Cents` — rounds half-up
  - `roundToCents(value: number): Cents` — rounds half-up, for float→Cents at output boundaries
  - `formatCents(c: Cents, locale: string, currency: string): string`

- [ ] **Step 1: Write the failing test**

`src/web/src/domain/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  cents, fromDollars, toDollars, addCents, subCents,
  scaleCents, roundToCents, formatCents,
} from './money'

describe('cents', () => {
  it('accepts integers', () => {
    expect(cents(1234)).toBe(1234)
  })

  it('rejects non-integers', () => {
    expect(() => cents(12.5)).toThrow(/integer/i)
  })

  it('rejects non-finite values', () => {
    expect(() => cents(NaN)).toThrow()
    expect(() => cents(Infinity)).toThrow()
  })
})

describe('dollar conversion', () => {
  it('converts dollars to cents', () => {
    expect(fromDollars(100)).toBe(10_000)
    expect(fromDollars(1.99)).toBe(199)
  })

  it('rounds fractional cents half-up', () => {
    expect(fromDollars(0.005)).toBe(1)
  })

  it('converts cents back to dollars', () => {
    expect(toDollars(cents(10_000))).toBe(100)
    expect(toDollars(cents(199))).toBe(1.99)
  })
})

describe('arithmetic', () => {
  it('adds', () => {
    expect(addCents(cents(100), cents(250), cents(1))).toBe(351)
  })

  it('adds nothing to zero', () => {
    expect(addCents()).toBe(0)
  })

  it('subtracts, allowing negatives', () => {
    expect(subCents(cents(100), cents(250))).toBe(-150)
  })

  it('scales and rounds half-up', () => {
    expect(scaleCents(cents(10_000), 0.5)).toBe(5_000)
    expect(scaleCents(cents(101), 0.5)).toBe(51)
  })
})

describe('roundToCents', () => {
  it('rounds a float to whole cents', () => {
    expect(roundToCents(9_708_737.86)).toBe(9_708_738)
  })

  it('rounds halves up, not to even', () => {
    expect(roundToCents(2.5)).toBe(3)
    expect(roundToCents(3.5)).toBe(4)
  })
})

describe('formatCents', () => {
  it('formats AUD in en-AU', () => {
    expect(formatCents(cents(123_456), 'en-AU', 'AUD')).toBe('$1,234.56')
  })

  it('formats negatives', () => {
    expect(formatCents(cents(-5_000), 'en-AU', 'AUD')).toBe('-$50.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/domain/money.test.ts`
Expected: FAIL — `Failed to resolve import "./money"`

- [ ] **Step 3: Write the implementation**

`src/web/src/domain/money.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/domain/money.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Remove the smoke test and commit**

```bash
rm src/web/src/domain/smoke.test.ts
git add src/web/src/domain
git commit -m "feat: add Cents branded money type"
```

---

### Task 3: Period domain — port PeriodHelperTests

Ports `src/api/Clearfolio.Tests/PeriodHelperTests.cs` (130 lines). `DateOnly` becomes an ISO `YYYY-MM-DD` string, which is directly comparable and needs no date library.

**Files:**
- Create: `src/web/src/domain/period.ts`
- Test: `src/web/src/domain/period.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type PeriodConvention = 'FY' | 'CY'`
  - `periodStart(period: string): string` — ISO date, throws on invalid format
  - `currentPeriod(convention: PeriodConvention, today?: Date): string`
  - `previousPeriod(period: string): string`
  - `nextPeriod(period: string): string`
  - `sameQuarterPriorYear(period: string): string`
  - `previousPeriods(period: string, count: number): string[]` — oldest first

- [ ] **Step 1: Write the failing test**

`src/web/src/domain/period.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  periodStart, currentPeriod, previousPeriod, nextPeriod,
  sameQuarterPriorYear, previousPeriods,
} from './period'

describe('periodStart — CY', () => {
  it.each([
    ['CY2025-Q1', '2025-01-01'],
    ['CY2025-Q2', '2025-04-01'],
    ['CY2025-Q3', '2025-07-01'],
    ['CY2025-Q4', '2025-10-01'],
  ])('%s starts %s', (period, expected) => {
    expect(periodStart(period)).toBe(expected)
  })

  it('full CY starts 1 January', () => {
    expect(periodStart('CY2025')).toBe('2025-01-01')
  })
})

describe('periodStart — FY', () => {
  it.each([
    ['FY2025-Q1', '2024-07-01'],
    ['FY2025-Q2', '2024-10-01'],
    ['FY2025-Q3', '2025-01-01'],
    ['FY2025-Q4', '2025-04-01'],
  ])('%s starts %s', (period, expected) => {
    expect(periodStart(period)).toBe(expected)
  })

  it('full FY starts 1 July of the prior year', () => {
    expect(periodStart('FY2025')).toBe('2024-07-01')
  })
})

describe('periodStart — validation', () => {
  it('throws on an invalid format', () => {
    expect(() => periodStart('invalid')).toThrow(/invalid period/i)
  })

  it('throws on an out-of-range quarter', () => {
    expect(() => periodStart('CY2025-Q5')).toThrow(/invalid period/i)
  })
})

describe('previousPeriod', () => {
  it.each([
    ['CY2025-Q2', 'CY2025-Q1'],
    ['CY2025-Q1', 'CY2024-Q4'],
    ['FY2025-Q1', 'FY2024-Q4'],
    ['FY2025-Q3', 'FY2025-Q2'],
  ])('%s → %s', (input, expected) => {
    expect(previousPeriod(input)).toBe(expected)
  })

  it('decreases the year for full-year periods', () => {
    expect(previousPeriod('CY2025')).toBe('CY2024')
    expect(previousPeriod('FY2025')).toBe('FY2024')
  })
})

describe('nextPeriod', () => {
  it.each([
    ['CY2025-Q1', 'CY2025-Q2'],
    ['CY2025-Q4', 'CY2026-Q1'],
    ['FY2025-Q4', 'FY2026-Q1'],
    ['FY2025-Q2', 'FY2025-Q3'],
  ])('%s → %s', (input, expected) => {
    expect(nextPeriod(input)).toBe(expected)
  })
})

describe('sameQuarterPriorYear', () => {
  it.each([
    ['CY2025-Q3', 'CY2024-Q3'],
    ['FY2025-Q1', 'FY2024-Q1'],
    ['CY2025', 'CY2024'],
  ])('%s → %s', (input, expected) => {
    expect(sameQuarterPriorYear(input)).toBe(expected)
  })
})

describe('previousPeriods', () => {
  it('returns the chain oldest-first', () => {
    expect(previousPeriods('CY2025-Q3', 4)).toEqual([
      'CY2024-Q4', 'CY2025-Q1', 'CY2025-Q2', 'CY2025-Q3',
    ])
  })

  it('crosses the FY year boundary', () => {
    expect(previousPeriods('FY2025-Q2', 3)).toEqual([
      'FY2024-Q4', 'FY2025-Q1', 'FY2025-Q2',
    ])
  })
})

describe('roundtrip', () => {
  it.each(['CY2025-Q1', 'CY2025-Q4', 'FY2025-Q1', 'FY2025-Q4'])(
    'next then previous returns %s',
    (period) => {
      expect(previousPeriod(nextPeriod(period))).toBe(period)
    },
  )
})

describe('currentPeriod', () => {
  it.each([
    [new Date(Date.UTC(2025, 7, 15)), 'FY2026-Q1'],  // August → FY starts in July
    [new Date(Date.UTC(2025, 10, 15)), 'FY2026-Q2'], // November
    [new Date(Date.UTC(2025, 1, 15)), 'FY2025-Q3'],  // February
    [new Date(Date.UTC(2025, 4, 15)), 'FY2025-Q4'],  // May
  ])('FY for %s', (today, expected) => {
    expect(currentPeriod('FY', today)).toBe(expected)
  })

  it.each([
    [new Date(Date.UTC(2025, 1, 15)), 'CY2025-Q1'],
    [new Date(Date.UTC(2025, 4, 15)), 'CY2025-Q2'],
    [new Date(Date.UTC(2025, 7, 15)), 'CY2025-Q3'],
    [new Date(Date.UTC(2025, 10, 15)), 'CY2025-Q4'],
  ])('CY for %s', (today, expected) => {
    expect(currentPeriod('CY', today)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/domain/period.test.ts`
Expected: FAIL — `Failed to resolve import "./period"`

- [ ] **Step 3: Write the implementation**

`src/web/src/domain/period.ts`:

```ts
export type PeriodConvention = 'FY' | 'CY'
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

const PERIOD_PATTERN = /^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/

interface ParsedPeriod {
  convention: PeriodConvention
  year: number
  quarter: Quarter | null
}

function parse(period: string): ParsedPeriod {
  const match = PERIOD_PATTERN.exec(period)
  if (!match) throw new Error(`Invalid period format: ${period}`)
  return {
    convention: match[1] as PeriodConvention,
    year: Number(match[2]),
    quarter: (match[3] as Quarter | undefined) ?? null,
  }
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** First day of the given period, as an ISO YYYY-MM-DD date. */
export function periodStart(period: string): string {
  const { convention, year, quarter } = parse(period)

  if (convention === 'FY') {
    switch (quarter) {
      case 'Q1': return isoDate(year - 1, 7, 1)
      case 'Q2': return isoDate(year - 1, 10, 1)
      case 'Q3': return isoDate(year, 1, 1)
      case 'Q4': return isoDate(year, 4, 1)
      default: return isoDate(year - 1, 7, 1) // full FY starts July, prior year
    }
  }

  switch (quarter) {
    case 'Q1': return isoDate(year, 1, 1)
    case 'Q2': return isoDate(year, 4, 1)
    case 'Q3': return isoDate(year, 7, 1)
    case 'Q4': return isoDate(year, 10, 1)
    default: return isoDate(year, 1, 1)
  }
}

/** `today` is injectable so callers and tests are deterministic. */
export function currentPeriod(
  convention: PeriodConvention,
  today: Date = new Date(),
): string {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1 // 1-12

  if (convention === 'FY') {
    const fyYear = month >= 7 ? year + 1 : year
    const quarter =
      month >= 7 && month <= 9 ? 'Q1' :
      month >= 10 ? 'Q2' :
      month <= 3 ? 'Q3' : 'Q4'
    return `FY${fyYear}-${quarter}`
  }

  const quarter =
    month <= 3 ? 'Q1' :
    month <= 6 ? 'Q2' :
    month <= 9 ? 'Q3' : 'Q4'
  return `CY${year}-${quarter}`
}

export function previousPeriod(period: string): string {
  const { convention, year, quarter } = parse(period)
  if (quarter === null) return `${convention}${year - 1}`

  switch (quarter) {
    case 'Q1': return `${convention}${year - 1}-Q4`
    case 'Q2': return `${convention}${year}-Q1`
    case 'Q3': return `${convention}${year}-Q2`
    case 'Q4': return `${convention}${year}-Q3`
  }
}

export function nextPeriod(period: string): string {
  const { convention, year, quarter } = parse(period)
  if (quarter === null) return `${convention}${year + 1}`

  switch (quarter) {
    case 'Q1': return `${convention}${year}-Q2`
    case 'Q2': return `${convention}${year}-Q3`
    case 'Q3': return `${convention}${year}-Q4`
    case 'Q4': return `${convention}${year + 1}-Q1`
  }
}

export function sameQuarterPriorYear(period: string): string {
  const { convention, year, quarter } = parse(period)
  return `${convention}${year - 1}${quarter ? `-${quarter}` : ''}`
}

/** `count` periods ending at `period`, oldest first. */
export function previousPeriods(period: string, count: number): string[] {
  const periods: string[] = []
  let current = period
  for (let i = 0; i < count; i++) {
    periods.push(current)
    current = previousPeriod(current)
  }
  return periods.reverse()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/domain/period.test.ts`
Expected: PASS, 31 tests

- [ ] **Step 5: Commit**

```bash
git add src/web/src/domain/period.ts src/web/src/domain/period.test.ts
git commit -m "feat: port period arithmetic from PeriodHelper with test suite"
```

---

### Task 4: Frequency domain

Ports the `NormaliseContribution` tests from `ProjectionEngineTests.cs`. Amounts are `Cents`.

**Files:**
- Create: `src/web/src/domain/frequency.ts`
- Test: `src/web/src/domain/frequency.test.ts`

**Interfaces:**
- Consumes: `Cents`, `cents` from `./money`
- Produces:
  - `type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'`
  - `FREQUENCY_MULTIPLIERS: Record<Frequency, number>`
  - `annualise(amount: Cents, frequency: string | null): Cents`
  - `normaliseContribution(amount: Cents | null | undefined, frequency: string | null | undefined): Cents`

- [ ] **Step 1: Write the failing test**

`src/web/src/domain/frequency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cents } from './money'
import { annualise, normaliseContribution } from './frequency'

describe('normaliseContribution', () => {
  it.each([
    ['weekly', 52],
    ['fortnightly', 26],
    ['monthly', 12],
    ['quarterly', 4],
    ['yearly', 1],
  ])('%s multiplies by %i', (frequency, multiplier) => {
    expect(normaliseContribution(cents(10_000), frequency)).toBe(10_000 * multiplier)
  })

  it('returns zero for a null amount', () => {
    expect(normaliseContribution(null, 'monthly')).toBe(0)
  })

  it('returns zero for a zero amount', () => {
    expect(normaliseContribution(cents(0), 'monthly')).toBe(0)
  })

  it('returns zero for a negative amount', () => {
    expect(normaliseContribution(cents(-10_000), 'monthly')).toBe(0)
  })

  it('returns zero for a null frequency', () => {
    expect(normaliseContribution(cents(10_000), null)).toBe(0)
  })

  it('returns zero for an unknown frequency', () => {
    expect(normaliseContribution(cents(10_000), 'biannually')).toBe(0)
  })

  // `constructor` and `__proto__` are the inherited keys that survive
  // .toLowerCase() intact, so they are the ones that actually reach the
  // lookup. Under `in` they resolve to Object.prototype members and
  // multiply money by a function/object, yielding NaN.
  it.each(['constructor', '__proto__', 'toString', 'valueOf'])(
    'returns zero for the inherited key %s',
    (key) => {
      expect(normaliseContribution(cents(10_000), key)).toBe(0)
    },
  )

  it('matches frequency case-insensitively', () => {
    expect(normaliseContribution(cents(10_000), 'Monthly')).toBe(120_000)
  })
})

describe('annualise', () => {
  it('multiplies by the frequency', () => {
    expect(annualise(cents(50_000), 'quarterly')).toBe(200_000)
  })

  it('returns zero for an unknown frequency', () => {
    expect(annualise(cents(50_000), 'never')).toBe(0)
  })

  it('annualises negative amounts, unlike normaliseContribution', () => {
    expect(annualise(cents(-1_000), 'yearly')).toBe(-1_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/domain/frequency.test.ts`
Expected: FAIL — `Failed to resolve import "./frequency"`

- [ ] **Step 3: Write the implementation**

`src/web/src/domain/frequency.ts`:

```ts
import type { Cents } from './money'

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'

export const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

function multiplierFor(frequency: string | null | undefined): number | null {
  if (!frequency) return null
  const key = frequency.toLowerCase() as Frequency
  // Object.hasOwn, not `in` — `in` walks the prototype chain, so 'toString'
  // and friends would resolve to a function and poison the arithmetic with
  // NaN. The C# original uses TryGetValue, which returns 0 for these.
  return Object.hasOwn(FREQUENCY_MULTIPLIERS, key) ? FREQUENCY_MULTIPLIERS[key] : null
}

/** Annual equivalent of a recurring amount. Unknown frequency yields zero. */
export function annualise(amount: Cents, frequency: string | null | undefined): Cents {
  const multiplier = multiplierFor(frequency)
  return (multiplier === null ? 0 : amount * multiplier) as Cents
}

/**
 * Annual contribution, treating missing, zero and negative amounts as none.
 * Mirrors FrequencyHelper.NormaliseContribution.
 */
export function normaliseContribution(
  amount: Cents | null | undefined,
  frequency: string | null | undefined,
): Cents {
  if (amount === null || amount === undefined || amount <= 0) return 0 as Cents
  return annualise(amount, frequency)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/domain/frequency.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add src/web/src/domain/frequency.ts src/web/src/domain/frequency.test.ts
git commit -m "feat: port frequency annualisation with test suite"
```

---

### Task 5: Ownership domain — replaces the p1/p2 model

New behaviour, so new tests. This replaces `OwnershipHelper.ApplyViewFilter`, which hardcoded the member tags `p1` and `p2`.

**Files:**
- Create: `src/web/src/domain/ownership.ts`
- Test: `src/web/src/domain/ownership.test.ts`

**Interfaces:**
- Consumes: `Cents`, `scaleCents` from `./money`
- Produces:
  - `TOTAL_BP = 10000`
  - `interface OwnershipShare { memberId: string; shareBp: number }`
  - `type View = { kind: 'household' } | { kind: 'member'; memberId: string }`
  - `soleOwnership(memberId: string): OwnershipShare[]`
  - `jointOwnership(firstMemberId: string, secondMemberId: string, firstShareBp: number): OwnershipShare[]`
  - `assertSharesValid(shares: OwnershipShare[]): void` — throws
  - `shareBpForMember(shares: OwnershipShare[], memberId: string): number`
  - `applyViewFilter(value: Cents, shares: OwnershipShare[], view: View): Cents`
  - `normaliseShares(shares: OwnershipShare[]): OwnershipShare[]`

- [ ] **Step 1: Write the failing test**

`src/web/src/domain/ownership.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cents } from './money'
import {
  TOTAL_BP, soleOwnership, jointOwnership, assertSharesValid,
  shareBpForMember, applyViewFilter, normaliseShares,
} from './ownership'

const ALICE = 'alice-id'
const BOB = 'bob-id'
const CAROL = 'carol-id'

describe('constructors', () => {
  it('sole ownership is a single full share', () => {
    expect(soleOwnership(ALICE)).toEqual([{ memberId: ALICE, shareBp: TOTAL_BP }])
  })

  it('joint ownership splits between two members', () => {
    expect(jointOwnership(ALICE, BOB, 6_000)).toEqual([
      { memberId: ALICE, shareBp: 6_000 },
      { memberId: BOB, shareBp: 4_000 },
    ])
  })

  it('joint ownership defaults to an even split', () => {
    expect(jointOwnership(ALICE, BOB, 5_000)).toEqual([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: BOB, shareBp: 5_000 },
    ])
  })
})

describe('assertSharesValid', () => {
  it('accepts shares summing to 10000', () => {
    expect(() => assertSharesValid(jointOwnership(ALICE, BOB, 3_333))).not.toThrow()
  })

  it('accepts three members — no two-person ceiling', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: BOB, shareBp: 3_000 },
      { memberId: CAROL, shareBp: 2_000 },
    ])).not.toThrow()
  })

  it('rejects shares that do not sum to 10000', () => {
    expect(() => assertSharesValid([{ memberId: ALICE, shareBp: 9_999 }]))
      .toThrow(/10000/)
  })

  it('rejects an empty share list', () => {
    expect(() => assertSharesValid([])).toThrow(/at least one/i)
  })

  it('rejects duplicate members', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: ALICE, shareBp: 5_000 },
    ])).toThrow(/duplicate/i)
  })

  it('rejects negative shares', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 12_000 },
      { memberId: BOB, shareBp: -2_000 },
    ])).toThrow(/negative/i)
  })
})

describe('shareBpForMember', () => {
  it('returns the member share', () => {
    expect(shareBpForMember(jointOwnership(ALICE, BOB, 6_000), BOB)).toBe(4_000)
  })

  it('returns zero for a member with no share', () => {
    expect(shareBpForMember(soleOwnership(ALICE), BOB)).toBe(0)
  })
})

describe('applyViewFilter', () => {
  const value = cents(100_000)

  it('household view returns the full value', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(applyViewFilter(value, shares, { kind: 'household' })).toBe(100_000)
  })

  it('member view returns that member share', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(applyViewFilter(value, shares, { kind: 'member', memberId: ALICE })).toBe(60_000)
    expect(applyViewFilter(value, shares, { kind: 'member', memberId: BOB })).toBe(40_000)
  })

  it('returns zero for a member with no share', () => {
    expect(applyViewFilter(value, soleOwnership(ALICE), { kind: 'member', memberId: BOB }))
      .toBe(0)
  })

  it('sole ownership gives the owner the full value', () => {
    expect(applyViewFilter(value, soleOwnership(ALICE), { kind: 'member', memberId: ALICE }))
      .toBe(100_000)
  })

  // NOTE: the value here must NOT divide evenly across the shares, or this
  // test passes trivially without ever entering the rounding path.
  it('member views sum to the household view when rounding bites', () => {
    const odd = cents(100_001)
    const shares = [
      { memberId: ALICE, shareBp: 3_333 },
      { memberId: BOB, shareBp: 3_333 },
      { memberId: CAROL, shareBp: 3_334 },
    ]
    const household = applyViewFilter(odd, shares, { kind: 'household' })
    const sum =
      applyViewFilter(odd, shares, { kind: 'member', memberId: ALICE }) +
      applyViewFilter(odd, shares, { kind: 'member', memberId: BOB }) +
      applyViewFilter(odd, shares, { kind: 'member', memberId: CAROL })
    expect(sum).toBe(household)
    expect(sum).toBe(100_001)
  })

  it('conserves the total across a wider split', () => {
    const odd = cents(100_007)
    const shares = Array.from({ length: 5 }, (_, i) => ({
      memberId: `m${i}`,
      shareBp: 2_000,
    }))
    const sum = shares.reduce(
      (total, s) =>
        total + applyViewFilter(odd, shares, { kind: 'member', memberId: s.memberId }),
      0,
    )
    expect(sum).toBe(100_007)
  })

  it('conserves the total for negative values', () => {
    const owed = cents(-100_001)
    const shares = [
      { memberId: ALICE, shareBp: 3_333 },
      { memberId: BOB, shareBp: 3_333 },
      { memberId: CAROL, shareBp: 3_334 },
    ]
    const sum =
      applyViewFilter(owed, shares, { kind: 'member', memberId: ALICE }) +
      applyViewFilter(owed, shares, { kind: 'member', memberId: BOB }) +
      applyViewFilter(owed, shares, { kind: 'member', memberId: CAROL })
    expect(sum).toBe(-100_001)
  })
})

describe('normaliseShares', () => {
  it('leaves valid shares untouched', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(normaliseShares(shares)).toEqual(shares)
  })

  it('rescales after a member is removed', () => {
    const remaining = [
      { memberId: ALICE, shareBp: 6_000 },
      { memberId: BOB, shareBp: 2_000 },
    ]
    const result = normaliseShares(remaining)
    expect(result.reduce((s, r) => s + r.shareBp, 0)).toBe(TOTAL_BP)
    expect(result[0].shareBp).toBe(7_500)
    expect(result[1].shareBp).toBe(2_500)
  })

  it('gives the remainder to the largest share so the total is exact', () => {
    const result = normaliseShares([
      { memberId: ALICE, shareBp: 1 },
      { memberId: BOB, shareBp: 1 },
      { memberId: CAROL, shareBp: 1 },
    ])
    expect(result.reduce((s, r) => s + r.shareBp, 0)).toBe(TOTAL_BP)
  })

  it('throws when nothing remains to rescale', () => {
    expect(() => normaliseShares([])).toThrow(/at least one/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/domain/ownership.test.ts`
Expected: FAIL — `Failed to resolve import "./ownership"`

- [ ] **Step 3: Write the implementation**

`src/web/src/domain/ownership.ts`:

```ts
import { scaleCents, type Cents } from './money'

/** Shares are basis points. All shares for one entity sum to this. */
export const TOTAL_BP = 10_000

export interface OwnershipShare {
  memberId: string
  shareBp: number
}

export type View =
  | { kind: 'household' }
  | { kind: 'member'; memberId: string }

export function soleOwnership(memberId: string): OwnershipShare[] {
  return [{ memberId, shareBp: TOTAL_BP }]
}

export function jointOwnership(
  firstMemberId: string,
  secondMemberId: string,
  firstShareBp: number,
): OwnershipShare[] {
  return [
    { memberId: firstMemberId, shareBp: firstShareBp },
    { memberId: secondMemberId, shareBp: TOTAL_BP - firstShareBp },
  ]
}

/**
 * SQLite cannot express a cross-row sum constraint, so this is the enforcement
 * point. Call it on every ownership write, inside the transaction.
 */
export function assertSharesValid(shares: OwnershipShare[]): void {
  if (shares.length === 0) {
    throw new Error('Ownership requires at least one share')
  }

  const seen = new Set<string>()
  for (const share of shares) {
    if (seen.has(share.memberId)) {
      throw new Error(`Duplicate ownership share for member ${share.memberId}`)
    }
    seen.add(share.memberId)

    if (share.shareBp < 0) {
      throw new Error(`Ownership share cannot be negative: ${share.shareBp}`)
    }
    if (!Number.isInteger(share.shareBp)) {
      throw new Error(`Ownership share must be an integer: ${share.shareBp}`)
    }
  }

  const total = shares.reduce((sum, s) => sum + s.shareBp, 0)
  if (total !== TOTAL_BP) {
    throw new Error(`Ownership shares must sum to ${TOTAL_BP}, got ${total}`)
  }
}

export function shareBpForMember(shares: OwnershipShare[], memberId: string): number {
  return shares.find((s) => s.memberId === memberId)?.shareBp ?? 0
}

/**
 * Allocates a value across all shares using largest-remainder distribution,
 * so the parts always sum to exactly the whole. Rounding each member's slice
 * independently does NOT conserve the total — it silently creates or destroys
 * up to (shares.length - 1) cents. Allocation is computed on the absolute
 * value and the sign reapplied, because Math.floor is asymmetric across zero
 * and net worth can be negative.
 */
function allocate(value: Cents, shares: OwnershipShare[]): Map<string, Cents> {
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)

  const parts = shares.map((share) => {
    const product = abs * share.shareBp
    return {
      memberId: share.memberId,
      floor: Math.floor(product / TOTAL_BP),
      remainder: product % TOTAL_BP,
    }
  })

  let leftover = abs - parts.reduce((sum, p) => sum + p.floor, 0)

  // Award the leftover cents to the largest remainders first; ties break by
  // original order, which keeps the result deterministic.
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < byRemainder.length && leftover > 0; i++) {
    byRemainder[i].floor += 1
    leftover -= 1
  }

  return new Map(parts.map((p) => [p.memberId, (p.floor * sign) as Cents]))
}

/**
 * The whole view model. Household is the full value; a member view is that
 * member's share. There is no special-casing of member identity — the p1/p2
 * distinction from the previous implementation does not exist here.
 *
 * Member views are guaranteed to sum to the household view.
 */
export function applyViewFilter(
  value: Cents,
  shares: OwnershipShare[],
  view: View,
): Cents {
  if (view.kind === 'household') return value
  return allocate(value, shares).get(view.memberId) ?? (0 as Cents)
}

/**
 * Rescale shares to sum to TOTAL_BP — used after a member is deleted and their
 * ownership rows cascade away, leaving an entity under-allocated. Rounding
 * remainder goes to the largest share so the total is always exact.
 */
export function normaliseShares(shares: OwnershipShare[]): OwnershipShare[] {
  if (shares.length === 0) {
    throw new Error('Ownership requires at least one share to normalise')
  }

  const total = shares.reduce((sum, s) => sum + s.shareBp, 0)
  if (total === TOTAL_BP) return shares
  if (total === 0) {
    // No information to preserve — split evenly.
    const even = Math.floor(TOTAL_BP / shares.length)
    const rescaled = shares.map((s) => ({ ...s, shareBp: even }))
    rescaled[0].shareBp += TOTAL_BP - even * shares.length
    return rescaled
  }

  const rescaled = shares.map((s) => ({
    ...s,
    shareBp: Math.floor((s.shareBp / total) * TOTAL_BP),
  }))

  const remainder = TOTAL_BP - rescaled.reduce((sum, s) => sum + s.shareBp, 0)
  if (remainder !== 0) {
    let largestIndex = 0
    for (let i = 1; i < rescaled.length; i++) {
      if (rescaled[i].shareBp > rescaled[largestIndex].shareBp) largestIndex = i
    }
    rescaled[largestIndex].shareBp += remainder
  }

  return rescaled
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/domain/ownership.test.ts`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add src/web/src/domain/ownership.ts src/web/src/domain/ownership.test.ts
git commit -m "feat: add share-based ownership domain replacing p1/p2 model"
```

---

### Task 6: Projection engine — port ProjectionEngineTests

Ports `src/api/Clearfolio.Api/Services/ProjectionEngine.cs` (327 lines) and the projection half of `ProjectionEngineTests.cs`.

**Two deliberate divergences from the C#, both improvements:**

1. **`startYear` and the RNG are injected**, not read from ambient `DateTime.UtcNow` / `new Random()`. The C# tests were non-deterministic in principle; these are not.
2. **Rounding is half-up, not banker's.** C# `Math.Round` defaults to `MidpointRounding.ToEven`. No ported test lands on an exact midpoint, so no expectation changes — but the difference is real and is recorded here rather than discovered later.

Internal arithmetic runs in floating-point cents and rounds to integer cents only at output, mirroring how the C# accumulated unrounded doubles and rounded on the way out.

**Files:**
- Create: `src/web/src/domain/projection.ts`
- Test: `src/web/src/domain/projection.test.ts`

**Interfaces:**
- Consumes: `Cents`, `roundToCents` from `./money`
- Produces:
  - `interface ProjectionEntity { id, label, category, entityType: 'asset' | 'liability', currentValue: Cents, annualContribution: Cents, returnRate, volatility, interestRate, contributionEndDate: string | null }`
  - `interface ProjectionOptions { horizon: number; inflationRate?: number; startYear?: number }`
  - `runCompound(entities, options): CompoundResult`
  - `runScenario(entities, options): ScenarioResult`
  - `runMonteCarlo(entities, options & { simulations?: number; random?: () => number }): MonteCarloResult`

- [ ] **Step 1: Write the failing test**

`src/web/src/domain/projection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cents } from './money'
import {
  runCompound, runScenario, runMonteCarlo, type ProjectionEntity,
} from './projection'

const START_YEAR = 2026

function makeAsset(overrides: Partial<ProjectionEntity> = {}): ProjectionEntity {
  return {
    id: 'asset-1',
    label: 'Test Asset',
    category: 'Investment',
    entityType: 'asset',
    currentValue: cents(10_000_000), // $100,000
    annualContribution: cents(0),
    returnRate: 0.07,
    volatility: 0.15,
    interestRate: 0,
    contributionEndDate: null,
    ...overrides,
  }
}

function makeLiability(overrides: Partial<ProjectionEntity> = {}): ProjectionEntity {
  return {
    id: 'liability-1',
    label: 'Test Loan',
    category: 'Mortgage',
    entityType: 'liability',
    currentValue: cents(5_000_000), // $50,000
    annualContribution: cents(1_000_000), // $10,000
    returnRate: 0,
    volatility: 0,
    interestRate: 0.05,
    contributionEndDate: null,
    ...overrides,
  }
}

/** Deterministic uniform source for Monte Carlo tests. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('runCompound', () => {
  it('grows a single asset at its return rate', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.10 })
    const result = runCompound([asset], { horizon: 3, startYear: START_YEAR })

    expect(result.years).toHaveLength(4) // year 0 plus 3
    expect(result.years[0].assets).toBe(10_000_000)
    expect(result.years[1].assets).toBe(11_000_000)
    expect(result.years[2].assets).toBe(12_100_000)
    expect(result.years[3].assets).toBe(13_310_000)
  })

  it('adds contributions after growth', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000),
      returnRate: 0.10,
      annualContribution: cents(1_000_000),
    })
    const result = runCompound([asset], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].assets).toBe(10_000_000)
    expect(result.years[1].assets).toBe(12_000_000) // 100k * 1.10 + 10k
  })

  it('decreases a liability with payments', () => {
    const liability = makeLiability({
      currentValue: cents(5_000_000),
      annualContribution: cents(1_000_000),
      interestRate: 0.05,
    })
    const result = runCompound([liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].liabilities).toBe(5_000_000)
    expect(result.years[1].liabilities).toBe(4_250_000) // 50k * 1.05 - 10k
  })

  it('floors a liability at zero', () => {
    const liability = makeLiability({
      currentValue: cents(500_000),
      annualContribution: cents(1_000_000),
      interestRate: 0,
    })
    const result = runCompound([liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[1].liabilities).toBe(0)
  })

  it('reports net worth as assets minus liabilities', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0 })
    const liability = makeLiability({
      currentValue: cents(4_000_000),
      annualContribution: cents(0),
      interestRate: 0,
    })
    const result = runCompound([asset, liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].netWorth).toBe(6_000_000)
  })

  it('discounts future values by inflation', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0 })
    const result = runCompound([asset], {
      horizon: 1, inflationRate: 0.03, startYear: START_YEAR,
    })

    expect(result.years[0].assets).toBe(10_000_000) // year 0 undiscounted
    expect(result.years[1].assets).toBe(9_708_738)  // 100,000 / 1.03
  })

  it('stops contributions after the end date year', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000),
      returnRate: 0,
      annualContribution: cents(1_000_000),
      contributionEndDate: `${START_YEAR}-12-31`,
    })
    const result = runCompound([asset], { horizon: 2, startYear: START_YEAR })

    expect(result.years[1].assets).toBe(11_000_000) // contribution applies
    expect(result.years[2].assets).toBe(11_000_000) // contribution stopped
  })

  it('returns only current values at horizon zero', () => {
    const asset = makeAsset({ currentValue: cents(5_000_000) })
    const result = runCompound([asset], { horizon: 0, startYear: START_YEAR })

    expect(result.years).toHaveLength(1)
    expect(result.years[0].assets).toBe(5_000_000)
  })

  it('returns zeroes for no entities', () => {
    const result = runCompound([], { horizon: 2, startYear: START_YEAR })

    expect(result.years).toHaveLength(3)
    expect(result.years[0].netWorth).toBe(0)
    expect(result.years[2].netWorth).toBe(0)
  })

  it('returns per-entity projections', () => {
    const asset = makeAsset({ currentValue: cents(5_000_000), returnRate: 0.10 })
    const result = runCompound([asset], { horizon: 2, startYear: START_YEAR })

    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].label).toBe('Test Asset')
    expect(result.entities[0].entityType).toBe('asset')
    expect(result.entities[0].years).toHaveLength(3)
  })
})

describe('runScenario', () => {
  it('base case matches the compound projection', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.07 })
    const compound = runCompound([asset], { horizon: 3, startYear: START_YEAR })
    const scenario = runScenario([asset], { horizon: 3, startYear: START_YEAR })

    for (let i = 0; i <= 3; i++) {
      expect(scenario.years[i].base.assets).toBe(compound.years[i].assets)
    }
  })

  it('orders pessimistic below base below optimistic', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.07 })
    const result = runScenario([asset], { horizon: 5, startYear: START_YEAR })

    for (let i = 1; i <= 5; i++) {
      expect(result.years[i].pessimistic.assets).toBeLessThan(result.years[i].base.assets)
      expect(result.years[i].base.assets).toBeLessThan(result.years[i].optimistic.assets)
    }
  })

  it('declines a liability in every scenario when payments exceed interest', () => {
    const liability = makeLiability({
      currentValue: cents(10_000_000),
      annualContribution: cents(2_000_000),
      interestRate: 0.05,
    })
    const result = runScenario([liability], { horizon: 3, startYear: START_YEAR })

    for (let i = 1; i <= 3; i++) {
      expect(result.years[i].base.liabilities).toBeLessThan(result.years[0].base.liabilities)
    }
  })
})

describe('runMonteCarlo', () => {
  it('returns the expected structure', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 5, simulations: 100, startYear: START_YEAR, random: seededRandom(1),
    })

    expect(result.horizon).toBe(5)
    expect(result.years).toHaveLength(6)
    expect(result.simulations).toBe(100)
  })

  it('has all percentiles equal to the current value at year zero', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000) })
    const result = runMonteCarlo([asset], {
      horizon: 3, simulations: 500, startYear: START_YEAR, random: seededRandom(2),
    })

    expect(result.years[0].p10).toBe(10_000_000)
    expect(result.years[0].p50).toBe(10_000_000)
    expect(result.years[0].p90).toBe(10_000_000)
  })

  it('orders percentiles', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 5, simulations: 1000, startYear: START_YEAR, random: seededRandom(3),
    })

    for (let i = 1; i <= 5; i++) {
      const y = result.years[i]
      expect(y.p10).toBeLessThanOrEqual(y.p25)
      expect(y.p25).toBeLessThanOrEqual(y.p50)
      expect(y.p50).toBeLessThanOrEqual(y.p75)
      expect(y.p75).toBeLessThanOrEqual(y.p90)
    }
  })

  it('clamps simulations to a minimum of 100', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 1, simulations: 10, startYear: START_YEAR, random: seededRandom(4),
    })
    expect(result.simulations).toBe(100)
  })

  it('clamps simulations to a maximum of 10000', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 1, simulations: 99_999, startYear: START_YEAR, random: seededRandom(5),
    })
    expect(result.simulations).toBe(10_000)
  })

  it('is deterministic at zero volatility', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000), returnRate: 0.10, volatility: 0,
    })
    const result = runMonteCarlo([asset], {
      horizon: 2, simulations: 200, startYear: START_YEAR, random: seededRandom(6),
    })

    expect(result.years[1].p10).toBe(result.years[1].p90)
    expect(result.years[2].p10).toBe(result.years[2].p90)
  })

  it('is reproducible for a given seed', () => {
    const options = {
      horizon: 3, simulations: 200, startYear: START_YEAR,
    }
    const a = runMonteCarlo([makeAsset()], { ...options, random: seededRandom(7) })
    const b = runMonteCarlo([makeAsset()], { ...options, random: seededRandom(7) })

    expect(a.years).toEqual(b.years)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/domain/projection.test.ts`
Expected: FAIL — `Failed to resolve import "./projection"`

- [ ] **Step 3: Write the implementation**

`src/web/src/domain/projection.ts`:

```ts
import { roundToCents, type Cents } from './money'

export type EntityType = 'asset' | 'liability'

export interface ProjectionEntity {
  id: string
  label: string
  category: string
  entityType: EntityType
  currentValue: Cents
  annualContribution: Cents
  returnRate: number
  volatility: number
  interestRate: number
  contributionEndDate: string | null
}

export interface ProjectionOptions {
  horizon: number
  inflationRate?: number
  /** Injected for determinism; defaults to the current UTC year. */
  startYear?: number
}

export interface CompoundYear {
  year: number
  assets: Cents
  liabilities: Cents
  netWorth: Cents
}

export interface EntityYear {
  year: number
  value: Cents
}

export interface EntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: EntityYear[]
}

export interface CompoundResult {
  horizon: number
  years: CompoundYear[]
  entities: EntityProjection[]
}

// --- shared helpers ---

function inflationDiscount(inflationRate: number, years: number): number {
  return inflationRate > 0 ? 1 / Math.pow(1 + inflationRate, years) : 1
}

/** Contributions stop after the calendar year containing the end date. */
function contributionFor(entity: ProjectionEntity, year: number): number {
  if (entity.contributionEndDate) {
    const endYear = Number(entity.contributionEndDate.slice(0, 4))
    if (Number.isFinite(endYear) && year > endYear) return 0
  }
  return entity.annualContribution
}

function defaultStartYear(): number {
  return new Date().getUTCFullYear()
}

// --- compound growth ---

export function runCompound(
  entities: ProjectionEntity[],
  options: ProjectionOptions,
): CompoundResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()

  const totals: { assets: number; liabilities: number }[] =
    Array.from({ length: horizon + 1 }, () => ({ assets: 0, liabilities: 0 }))

  const entityResults: EntityProjection[] = entities.map((entity) => {
    const years: EntityYear[] = []
    let value: number = entity.currentValue

    for (let y = 0; y <= horizon; y++) {
      const discount = inflationDiscount(inflationRate, y)
      years.push({ year: startYear + y, value: roundToCents(value * discount) })

      if (entity.entityType === 'asset') totals[y].assets += value
      else totals[y].liabilities += value

      if (y < horizon) {
        const contribution = contributionFor(entity, startYear + y)
        value = entity.entityType === 'asset'
          ? value * (1 + entity.returnRate) + contribution
          : Math.max(0, value * (1 + entity.interestRate) - contribution)
      }
    }

    return {
      id: entity.id,
      label: entity.label,
      category: entity.category,
      entityType: entity.entityType,
      years,
    }
  })

  const years: CompoundYear[] = totals.map((total, y) => {
    const discount = inflationDiscount(inflationRate, y)
    return {
      year: startYear + y,
      assets: roundToCents(total.assets * discount),
      liabilities: roundToCents(total.liabilities * discount),
      netWorth: roundToCents((total.assets - total.liabilities) * discount),
    }
  })

  return { horizon, years, entities: entityResults }
}

// --- scenario ---

export interface ScenarioValues {
  assets: Cents
  liabilities: Cents
  netWorth: Cents
}

export interface ScenarioYear {
  year: number
  pessimistic: ScenarioValues
  base: ScenarioValues
  optimistic: ScenarioValues
}

export interface ScenarioEntityYear {
  year: number
  pessimistic: Cents
  base: Cents
  optimistic: Cents
}

export interface ScenarioEntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: ScenarioEntityYear[]
}

export interface ScenarioResult {
  horizon: number
  years: ScenarioYear[]
  entities: ScenarioEntityProjection[]
}

/** Pessimistic and optimistic bands around the entity's base return rate. */
function scenarioRates(entity: ProjectionEntity): {
  pessimistic: number
  base: number
  optimistic: number
} {
  const base = entity.returnRate
  if (base > 0) {
    return {
      pessimistic: Math.max(base * 0.5, base - 0.03),
      base,
      optimistic: Math.min(base * 1.5, base + 0.03),
    }
  }
  return { pessimistic: base - 0.03, base, optimistic: base + 0.03 }
}

export function runScenario(
  entities: ProjectionEntity[],
  options: ProjectionOptions,
): ScenarioResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()

  interface Totals { assets: number; liabilities: number }
  const totals: { pessimistic: Totals; base: Totals; optimistic: Totals }[] =
    Array.from({ length: horizon + 1 }, () => ({
      pessimistic: { assets: 0, liabilities: 0 },
      base: { assets: 0, liabilities: 0 },
      optimistic: { assets: 0, liabilities: 0 },
    }))

  const entityResults: ScenarioEntityProjection[] = entities.map((entity) => {
    const rates = scenarioRates(entity)
    const years: ScenarioEntityYear[] = []
    let pessimistic: number = entity.currentValue
    let base: number = entity.currentValue
    let optimistic: number = entity.currentValue

    for (let y = 0; y <= horizon; y++) {
      const discount = inflationDiscount(inflationRate, y)
      years.push({
        year: startYear + y,
        pessimistic: roundToCents(pessimistic * discount),
        base: roundToCents(base * discount),
        optimistic: roundToCents(optimistic * discount),
      })

      const bucket = entity.entityType === 'asset' ? 'assets' : 'liabilities'
      totals[y].pessimistic[bucket] += pessimistic
      totals[y].base[bucket] += base
      totals[y].optimistic[bucket] += optimistic

      if (y < horizon) {
        const contribution = contributionFor(entity, startYear + y)
        if (entity.entityType === 'asset') {
          pessimistic = pessimistic * (1 + rates.pessimistic) + contribution
          base = base * (1 + rates.base) + contribution
          optimistic = optimistic * (1 + rates.optimistic) + contribution
        } else {
          const rate = entity.interestRate
          pessimistic = Math.max(0, pessimistic * (1 + rate) - contribution)
          base = Math.max(0, base * (1 + rate) - contribution)
          optimistic = Math.max(0, optimistic * (1 + rate) - contribution)
        }
      }
    }

    return {
      id: entity.id,
      label: entity.label,
      category: entity.category,
      entityType: entity.entityType,
      years,
    }
  })

  const years: ScenarioYear[] = totals.map((total, y) => {
    const discount = inflationDiscount(inflationRate, y)
    const toValues = (t: Totals): ScenarioValues => ({
      assets: roundToCents(t.assets * discount),
      liabilities: roundToCents(t.liabilities * discount),
      netWorth: roundToCents((t.assets - t.liabilities) * discount),
    })
    return {
      year: startYear + y,
      pessimistic: toValues(total.pessimistic),
      base: toValues(total.base),
      optimistic: toValues(total.optimistic),
    }
  })

  return { horizon, years, entities: entityResults }
}

// --- Monte Carlo ---

export interface Percentiles {
  year: number
  p10: Cents
  p25: Cents
  p50: Cents
  p75: Cents
  p90: Cents
}

export interface MonteCarloEntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: Percentiles[]
}

export interface MonteCarloResult {
  horizon: number
  simulations: number
  years: Percentiles[]
  entities: MonteCarloEntityProjection[]
}

export interface MonteCarloOptions extends ProjectionOptions {
  simulations?: number
  /** Injected for determinism; defaults to Math.random. */
  random?: () => number
}

/** Box-Muller transform. */
function sampleNormal(random: () => number, mean: number, stdDev: number): number {
  const u1 = 1 - random()
  const u2 = 1 - random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + stdDev * z
}

/** Linear interpolation between the two nearest ranks of a sorted array. */
function percentile(sorted: number[], p: number): number {
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const frac = index - lower
  return sorted[lower] * (1 - frac) + sorted[upper] * frac
}

function percentilesFor(values: number[], year: number, discount: number): Percentiles {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    year,
    p10: roundToCents(percentile(sorted, 0.10) * discount),
    p25: roundToCents(percentile(sorted, 0.25) * discount),
    p50: roundToCents(percentile(sorted, 0.50) * discount),
    p75: roundToCents(percentile(sorted, 0.75) * discount),
    p90: roundToCents(percentile(sorted, 0.90) * discount),
  }
}

export function runMonteCarlo(
  entities: ProjectionEntity[],
  options: MonteCarloOptions,
): MonteCarloResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()
  const random = options.random ?? Math.random
  const simulations = Math.min(10_000, Math.max(100, options.simulations ?? 1_000))

  const netWorthByYear: number[][] =
    Array.from({ length: horizon + 1 }, () => new Array<number>(simulations).fill(0))

  const entityValuesByYear: number[][][] = entities.map(() =>
    Array.from({ length: horizon + 1 }, () => new Array<number>(simulations).fill(0)),
  )

  for (let sim = 0; sim < simulations; sim++) {
    for (let e = 0; e < entities.length; e++) {
      const entity = entities[e]
      let value: number = entity.currentValue

      for (let y = 0; y <= horizon; y++) {
        entityValuesByYear[e][y][sim] = value
        netWorthByYear[y][sim] += entity.entityType === 'asset' ? value : -value

        if (y < horizon) {
          const contribution = contributionFor(entity, startYear + y)
          if (entity.entityType === 'asset') {
            // Convert geometric (CAGR) to arithmetic mean before sampling.
            const arithmeticMean =
              entity.returnRate + (entity.volatility * entity.volatility) / 2
            const sampled = sampleNormal(random, arithmeticMean, entity.volatility)
            value = Math.max(0, value * (1 + sampled) + contribution)
          } else {
            value = Math.max(0, value * (1 + entity.interestRate) - contribution)
          }
        }
      }
    }
  }

  const years = netWorthByYear.map((values, y) =>
    percentilesFor(values, startYear + y, inflationDiscount(inflationRate, y)),
  )

  const entityProjections: MonteCarloEntityProjection[] = entities.map((entity, e) => ({
    id: entity.id,
    label: entity.label,
    category: entity.category,
    entityType: entity.entityType,
    years: entityValuesByYear[e].map((values, y) =>
      percentilesFor(values, startYear + y, inflationDiscount(inflationRate, y)),
    ),
  }))

  return { horizon, simulations, years, entities: entityProjections }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/domain/projection.test.ts`
Expected: PASS, 21 tests

- [ ] **Step 5: Run the whole domain suite**

Run: `cd src/web && npm test`
Expected: PASS — money, period, frequency, ownership, projection

- [ ] **Step 6: Commit**

```bash
git add src/web/src/domain/projection.ts src/web/src/domain/projection.test.ts
git commit -m "feat: port projection engine with injected clock and RNG"
```

---

### Task 7: Database schema and migrations

> **Amended during execution — the spec is authoritative on both changes.**
>
> 1. **CHECK constraints are required.** SQLite column types are affinities,
>    not types: without CHECKs, `value_cents = 1.5` persists as a float and
>    `entity_type = 'banana'` is accepted, so "money is integer cents" has no
>    database-level enforcement at all. Declare, via Drizzle's `check()`:
>    `typeof(col) = 'integer'` on every `_cents` column (tolerating NULL where
>    the column is nullable), `entity_type IN ('asset','liability')` on
>    `snapshots` / `ownership` / `scenario_assumptions`, and
>    `share_bp BETWEEN 0 AND 10000` on `ownership`. Only the cross-row
>    ownership sum stays in application code. This is the one class of schema
>    decision that must be right on the first release: adding a column later
>    is one `ALTER TABLE`, but changing a CHECK rebuilds the whole table and
>    copies the data against live user databases.
> 2. **`scenario_assumptions` gains `entity_type`** (notNull, same IN check)
>    **plus liability-side overrides**: `interest_rate` (real),
>    `repayment_amount_cents` (integer), `repayment_frequency` (text),
>    `repayment_end_date` (ISO text). Every `ProjectionEntity` in the domain
>    layer carries an `interestRate`; without these a scenario could vary only
>    asset assumptions, leaving debt paydown unmodellable.
>
> The test file must pin all eight global constraints, not four, and must not
> infer money columns from their names alone — a column named `amount` typed
> `real` has to fail.

**Files:**
- Create: `src/web/src/db/schema.ts`
- Create: `src/web/drizzle.config.ts`
- Create: `src/web/src/db/migrations/` (generated)
- Test: `src/web/src/db/schema.test.ts`
- Modify: `src/web/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: Drizzle table objects `households`, `householdMembers`, `sessions`, `appSettings`, `assetTypes`, `liabilityTypes`, `assets`, `liabilities`, `ownership`, `snapshots`, `expenseCategories`, `incomeStreams`, `expenses`, `scenarios`, `scenarioAssumptions`

- [ ] **Step 1: Add dependencies**

Run:

```bash
cd src/web && npm install drizzle-orm better-sqlite3 && npm install -D drizzle-kit @types/better-sqlite3
```

Add to `package.json` scripts:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx src/db/migrate.ts"
```

Run: `cd src/web && npm install -D tsx`

- [ ] **Step 2: Write the failing test**

`src/web/src/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Asserts against the generated migration SQL, which is what actually reaches
 * a user's database. Behavioural constraint tests live in seed.test.ts (Task 8),
 * once there is a migrated database to exercise.
 */
const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations')

function migrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  return files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
}

describe('generated migration', () => {
  it('creates all 15 tables', () => {
    const matches = migrationSql().match(/CREATE TABLE/g) ?? []
    expect(matches).toHaveLength(15)
  })

  it.each([
    'households', 'household_members', 'sessions', 'app_settings',
    'asset_types', 'liability_types', 'assets', 'liabilities',
    'ownership', 'snapshots', 'expense_categories', 'income_streams',
    'expenses', 'scenarios', 'scenario_assumptions',
  ])('creates %s', (table) => {
    expect(migrationSql()).toContain(`\`${table}\``)
  })

  it('enforces one snapshot per entity per period', () => {
    expect(migrationSql()).toMatch(/CREATE UNIQUE INDEX.*uq_snapshots_entity_period/)
  })

  it('enforces one ownership row per entity per member', () => {
    expect(migrationSql()).toMatch(/CREATE UNIQUE INDEX.*uq_ownership_entity_member/)
  })

  it('stores money as integer cents, never as REAL', () => {
    const sql = migrationSql()
    const centsColumns = sql.match(/`\w*_cents`\s+\w+/g) ?? []
    expect(centsColumns.length).toBeGreaterThan(0)
    for (const column of centsColumns) {
      expect(column).toMatch(/integer/i)
    }
  })

  it('stores price_per_unit as REAL, for sub-cent precision', () => {
    expect(migrationSql()).toMatch(/`price_per_unit`\s+real/i)
  })

  it('has no currency column on assets, liabilities or snapshots', () => {
    expect(migrationSql()).not.toMatch(/`currency`/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/db/schema.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, scandir '.../src/db/migrations'`. The migrations do not exist yet; Steps 4–5 create them.

- [ ] **Step 4: Write the schema**

`src/web/src/db/schema.ts`:

```ts
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull().default('AUD'),
  preferredPeriodType: text('preferred_period_type').notNull().default('FY'),
  locale: text('locale').notNull().default('en-AU'),
  createdAt: integer('created_at').notNull(),
})

export const householdMembers = sqliteTable('household_members', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  email: text('email'),
  displayName: text('display_name').notNull(),
  memberTag: text('member_tag').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_members_household').on(t.householdId)])

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (t) => [index('idx_sessions_expires').on(t.expiresAt)])

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const assetTypes = sqliteTable('asset_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  liquidity: text('liquidity').notNull(),
  growthClass: text('growth_class').notNull(),
  isSuper: integer('is_super', { mode: 'boolean' }).notNull().default(false),
  isCgtExempt: integer('is_cgt_exempt', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  defaultReturnRate: real('default_return_rate').notNull().default(0),
  defaultVolatility: real('default_volatility').notNull().default(0),
})

export const liabilityTypes = sqliteTable('liability_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  debtQuality: text('debt_quality').notNull(),
  isHecs: integer('is_hecs', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
})

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  assetTypeId: text('asset_type_id').notNull().references(() => assetTypes.id),
  label: text('label').notNull(),
  symbol: text('symbol'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  // Baseline projection inputs; scenarios may override these.
  contributionAmountCents: integer('contribution_amount_cents'),
  contributionFrequency: text('contribution_frequency'),
  contributionEndDate: text('contribution_end_date'), // ISO YYYY-MM-DD
  isPreTaxContribution: integer('is_pre_tax_contribution', { mode: 'boolean' }).notNull().default(false),
  expectedReturnRate: real('expected_return_rate'),
  expectedVolatility: real('expected_volatility'),
}, (t) => [index('idx_assets_household_active').on(t.householdId, t.isActive)])

export const liabilities = sqliteTable('liabilities', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  liabilityTypeId: text('liability_type_id').notNull().references(() => liabilityTypes.id),
  label: text('label').notNull(),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  repaymentAmountCents: integer('repayment_amount_cents'),
  repaymentFrequency: text('repayment_frequency'),
  repaymentEndDate: text('repayment_end_date'), // ISO YYYY-MM-DD
  interestRate: real('interest_rate'),
}, (t) => [index('idx_liabilities_household_active').on(t.householdId, t.isActive)])

/**
 * Polymorphic: entityId points at an asset or a liability, discriminated by
 * entityType. No FK is possible on a polymorphic column — integrity is
 * enforced in the service layer.
 */
export const ownership = sqliteTable('ownership', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(), // 'asset' | 'liability'
  memberId: text('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  shareBp: integer('share_bp').notNull(),
}, (t) => [
  uniqueIndex('uq_ownership_entity_member').on(t.entityId, t.memberId),
  index('idx_ownership_entity').on(t.entityId),
])

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(), // 'asset' | 'liability'
  period: text('period').notNull(),
  valueCents: integer('value_cents').notNull(),
  units: real('units'),
  pricePerUnit: real('price_per_unit'), // REAL, not cents — needs sub-cent precision
  notes: text('notes'),
  recordedBy: text('recorded_by').notNull().references(() => householdMembers.id),
  recordedAt: integer('recorded_at').notNull(),
}, (t) => [
  uniqueIndex('uq_snapshots_entity_period').on(t.entityId, t.period),
  index('idx_snapshots_household_period').on(t.householdId, t.period),
])

export const expenseCategories = sqliteTable('expense_categories', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_expense_categories_household').on(t.householdId)])

export const incomeStreams = sqliteTable('income_streams', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  ownerMemberId: text('owner_member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  incomeType: text('income_type').notNull().default('Additional'),
  amountCents: integer('amount_cents').notNull(),
  frequency: text('frequency').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [index('idx_income_household_active').on(t.householdId, t.isActive)])

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  ownerMemberId: text('owner_member_id').references(() => householdMembers.id, { onDelete: 'set null' }),
  expenseCategoryId: text('expense_category_id').notNull().references(() => expenseCategories.id),
  label: text('label').notNull(),
  amountCents: integer('amount_cents').notNull(),
  frequency: text('frequency').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  index('idx_expenses_household_active').on(t.householdId, t.isActive),
  index('idx_expenses_category').on(t.expenseCategoryId),
])

export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  horizonYears: integer('horizon_years').notNull().default(20),
  inflationRate: real('inflation_rate').notNull().default(0),
  isBaseline: integer('is_baseline', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_scenarios_household').on(t.householdId)])

export const scenarioAssumptions = sqliteTable('scenario_assumptions', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  returnRate: real('return_rate'),
  volatility: real('volatility'),
  contributionAmountCents: integer('contribution_amount_cents'),
  contributionFrequency: text('contribution_frequency'),
  contributionEndDate: text('contribution_end_date'),
}, (t) => [uniqueIndex('uq_assumption_scenario_entity').on(t.scenarioId, t.entityId)])
```

- [ ] **Step 5: Create the Drizzle config and generate the migration**

`src/web/drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
} satisfies Config
```

Run: `cd src/web && npm run db:generate`
Expected: a `src/db/migrations/0000_*.sql` file plus a `meta/` directory.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd src/web && npx vitest run src/db/schema.test.ts`
Expected: PASS, 21 tests — 15 tables, both unique indexes, cents-are-integer, `price_per_unit` REAL, no `currency` column.

If the cents assertion fails, a money column was declared `real()` instead of `integer()`. If the currency assertion fails, a `currency` column survived the port. Both are Global Constraint violations — fix the schema, regenerate, do not relax the test.

- [ ] **Step 7: Commit**

```bash
git add src/web/src/db src/web/drizzle.config.ts src/web/package.json src/web/package-lock.json
git commit -m "feat: add Drizzle schema for all 15 tables with generated migration"
```

---

### Task 8: Database client, migration runner and seed data

**Files:**
- Create: `src/web/src/db/client.ts`
- Create: `src/web/src/db/seed.ts`
- Create: `src/web/src/db/migrate.ts`
- Test: `src/web/src/db/seed.test.ts`

**Interfaces:**
- Consumes: schema tables from Task 7
- Produces:
  - `getDb(): BetterSQLite3Database` — process-wide singleton
  - `createTestDb(): { db, sqlite }` — in-memory, migrated, for tests
  - `seedReferenceData(db): void` — idempotent
  - `SEED_ASSET_TYPES`, `SEED_LIABILITY_TYPES`

- [ ] **Step 1: Write the failing test**

`src/web/src/db/seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from './client'
import { seedReferenceData } from './seed'
import { assetTypes, liabilityTypes } from './schema'

describe('seedReferenceData', () => {
  it('inserts the reference types', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    expect(db.select().from(assetTypes).all()).toHaveLength(15)
    expect(db.select().from(liabilityTypes).all()).toHaveLength(9)
    sqlite.close()
  })

  it('is idempotent', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)
    seedReferenceData(db)

    expect(db.select().from(assetTypes).all()).toHaveLength(15)
    sqlite.close()
  })

  it('preserves the AU-specific classification flags', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    const types = db.select().from(assetTypes).all()
    expect(types.filter((t) => t.isSuper)).toHaveLength(2)
    expect(types.filter((t) => t.isCgtExempt)).toHaveLength(1)

    const hecs = db.select().from(liabilityTypes).all().filter((t) => t.isHecs)
    expect(hecs).toHaveLength(1)
    expect(hecs[0].name).toContain('HECS')
    sqlite.close()
  })

  it('classifies investment bond as long-term liquidity', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    const bond = db.select().from(assetTypes).all()
      .find((t) => t.name === 'Investment bond')
    expect(bond?.liquidity).toBe('long_term')
    sqlite.close()
  })
})

describe('createTestDb', () => {
  it('applies all migrations', () => {
    const { sqlite } = createTestDb()
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'")
      .all() as { name: string }[]

    expect(tables).toHaveLength(15)
    sqlite.close()
  })

  it('enforces the snapshot period uniqueness constraint', () => {
    const { sqlite } = createTestDb()
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='uq_snapshots_entity_period'")
      .all()

    expect(indexes).toHaveLength(1)
    sqlite.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/db/seed.test.ts`
Expected: FAIL — `Failed to resolve import "./client"`

- [ ] **Step 3: Write the client**

`src/web/src/db/client.ts`:

```ts
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src/db/migrations')

let instance: BetterSQLite3Database | null = null

function configure(sqlite: Database.Database): void {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
}

/** Process-wide singleton. Safe because the app runs as a single container. */
export function getDb(): BetterSQLite3Database {
  if (instance) return instance
  const dbPath = process.env.DB_PATH ?? 'clearfolio.db'
  const sqlite = new Database(dbPath)
  configure(sqlite)
  instance = drizzle(sqlite)
  return instance
}

/** Applies all pending migrations. Called at startup before serving traffic. */
export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

/** Fresh in-memory database with migrations applied, for tests. */
export function createTestDb(): {
  db: BetterSQLite3Database
  sqlite: Database.Database
} {
  const sqlite = new Database(':memory:')
  configure(sqlite)
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, sqlite }
}
```

- [ ] **Step 4: Write the seed data**

`src/web/src/db/seed.ts` — GUIDs are copied verbatim from `ClearfolioDbContext.SeedData` so classification stays stable:

```ts
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { assetTypes, liabilityTypes } from './schema'

export const SEED_ASSET_TYPES = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Cash — savings / transaction', category: 'cash', liquidity: 'immediate', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 1, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Cash — term deposit (≤90 days)', category: 'cash', liquidity: 'short_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 2, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'Term deposit (>90 days)', category: 'cash', liquidity: 'long_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 3, isSystem: true, defaultReturnRate: 0.045, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Australian shares / ETFs', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 4, isSystem: true, defaultReturnRate: 0.07, defaultVolatility: 0.15 },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'International shares / ETFs', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 5, isSystem: true, defaultReturnRate: 0.08, defaultVolatility: 0.17 },
  { id: 'a0000000-0000-0000-0000-00000000000f', name: 'Managed fund', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 6, isSystem: true, defaultReturnRate: 0.06, defaultVolatility: 0.12 },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Bonds / fixed income', category: 'investable', liquidity: 'short_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 7, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.05 },
  { id: 'a0000000-0000-0000-0000-000000000007', name: 'Cryptocurrency', category: 'investable', liquidity: 'immediate', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 8, isSystem: true, defaultReturnRate: 0.0, defaultVolatility: 0.50 },
  { id: 'a0000000-0000-0000-0000-00000000000e', name: 'Investment bond', category: 'investable', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 9, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.08 },
  { id: 'a0000000-0000-0000-0000-000000000008', name: 'Superannuation — Accumulation', category: 'retirement', liquidity: 'restricted', growthClass: 'mixed', isSuper: true, isCgtExempt: false, sortOrder: 10, isSystem: true, defaultReturnRate: 0.07, defaultVolatility: 0.12 },
  { id: 'a0000000-0000-0000-0000-000000000009', name: 'Superannuation — Pension phase', category: 'retirement', liquidity: 'long_term', growthClass: 'mixed', isSuper: true, isCgtExempt: false, sortOrder: 11, isSystem: true, defaultReturnRate: 0.06, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000a', name: 'Primary residence (PPOR)', category: 'property', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: true, sortOrder: 12, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000b', name: 'Investment property', category: 'property', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 13, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000c', name: 'Vehicle', category: 'other', liquidity: 'long_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 14, isSystem: true, defaultReturnRate: -0.10, defaultVolatility: 0.05 },
  { id: 'a0000000-0000-0000-0000-00000000000d', name: 'Other physical asset', category: 'other', liquidity: 'long_term', growthClass: 'mixed', isSuper: false, isCgtExempt: false, sortOrder: 15, isSystem: true, defaultReturnRate: 0.0, defaultVolatility: 0.10 },
] as const

export const SEED_LIABILITY_TYPES = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Home loan — PPOR', category: 'mortgage', debtQuality: 'neutral', isHecs: false, sortOrder: 1, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Home loan — Investment property', category: 'mortgage', debtQuality: 'productive', isHecs: false, sortOrder: 2, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Personal loan', category: 'personal', debtQuality: 'bad', isHecs: false, sortOrder: 3, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000004', name: 'Car loan', category: 'personal', debtQuality: 'bad', isHecs: false, sortOrder: 4, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000005', name: 'Credit card', category: 'credit', debtQuality: 'bad', isHecs: false, sortOrder: 5, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000006', name: 'Student loan (HECS-HELP)', category: 'student', debtQuality: 'neutral', isHecs: true, sortOrder: 6, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000007', name: 'Margin loan', category: 'personal', debtQuality: 'productive', isHecs: false, sortOrder: 7, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000008', name: 'Tax liability', category: 'tax', debtQuality: 'neutral', isHecs: false, sortOrder: 8, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000009', name: 'Other liability', category: 'other', debtQuality: 'neutral', isHecs: false, sortOrder: 9, isSystem: true },
] as const

/** Idempotent — safe to call on every startup. */
export function seedReferenceData(db: BetterSQLite3Database): void {
  db.insert(assetTypes).values([...SEED_ASSET_TYPES]).onConflictDoNothing().run()
  db.insert(liabilityTypes).values([...SEED_LIABILITY_TYPES]).onConflictDoNothing().run()
}
```

- [ ] **Step 5: Write the migration entrypoint**

`src/web/src/db/migrate.ts`:

```ts
import { getDb, runMigrations } from './client'
import { seedReferenceData } from './seed'

const db = getDb()
runMigrations(db)
seedReferenceData(db)
console.log('Migrations applied and reference data seeded.')
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/db/seed.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Commit**

```bash
git add src/web/src/db
git commit -m "feat: add database client, migration runner and reference seed data"
```

---

### Task 9: Authentication — passphrase hashing and sessions

> **Amended during execution — the spec is authoritative.**
>
> 1. **`setPassphrase` must revoke all existing sessions** when a passphrase
>    already exists (not on the bootstrap path). As written below it revokes
>    none, while `removePassphrase` revokes all — an asymmetry that lets a
>    stolen cookie survive a rotation for the full session lifetime. The C#
>    behaves the same way; it is wrong there too. Wrap the settings write and
>    the session delete in `db.transaction(...)`, and do the same for
>    `removePassphrase`'s two deletes.
> 2. **The stored hash format must record the scrypt cost parameters** —
>    `scrypt$<N>$<r>$<p>$<salt>$<hash>` — with named constants passed
>    explicitly to `scryptSync`, and **`verifyPassphrase` deriving with the
>    values parsed from the stored string, not the current constants.** That
>    last part is the whole point: it is what lets the cost be raised later
>    without a permanent dual-path branch. Keep the cost at Node's defaults;
>    recording the parameters buys the option, exercising it is separate.
>    Every malformed stored value must still return `false` rather than
>    throw — including a non-numeric or out-of-range N.
>
> Note on testing the timing property: swapping `timingSafeEqual` for
> `.equals()` or a byte loop passes every test in this task. Only the naive
> `===` fails one. That line is protected by code review, not by the suite.

**Files:**
- Create: `src/web/src/server/auth.ts`
- Test: `src/web/src/server/auth.test.ts`

**Interfaces:**
- Consumes: `appSettings`, `sessions` from `@/db/schema`; `createTestDb` from `@/db/client`
- Produces:
  - `hashPassphrase(passphrase: string): string`
  - `verifyPassphrase(passphrase: string, stored: string): boolean`
  - `isPassphraseSet(db): boolean`
  - `setPassphrase(db, newPassphrase, currentPassphrase?): void`
  - `removePassphrase(db, currentPassphrase): void`
  - `createSession(db, now?): string` — returns the token
  - `validateSession(db, token, now?): boolean`
  - `destroySession(db, token): void`
  - `purgeExpiredSessions(db, now?): number`
  - `MIN_PASSPHRASE_LENGTH = 8`

- [ ] **Step 1: Write the failing test**

`src/web/src/server/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/db/client'
import { sessions } from '@/db/schema'
import {
  hashPassphrase, verifyPassphrase, isPassphraseSet, setPassphrase,
  removePassphrase, createSession, validateSession, destroySession,
  purgeExpiredSessions, MIN_PASSPHRASE_LENGTH,
} from './auth'

const NOW = 1_800_000_000 // fixed epoch seconds

describe('passphrase hashing', () => {
  it('verifies a correct passphrase', () => {
    const stored = hashPassphrase('correct horse battery')
    expect(verifyPassphrase('correct horse battery', stored)).toBe(true)
  })

  it('rejects an incorrect passphrase', () => {
    const stored = hashPassphrase('correct horse battery')
    expect(verifyPassphrase('wrong horse battery', stored)).toBe(false)
  })

  it('produces a different hash each time — the salt varies', () => {
    expect(hashPassphrase('same input')).not.toBe(hashPassphrase('same input'))
  })

  it('rejects a malformed stored value rather than throwing', () => {
    expect(verifyPassphrase('anything', 'not-a-valid-hash')).toBe(false)
  })
})

describe('passphrase lifecycle', () => {
  it('reports no passphrase on a fresh database', () => {
    const { db, sqlite } = createTestDb()
    expect(isPassphraseSet(db)).toBe(false)
    sqlite.close()
  })

  it('sets a passphrase when none exists', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(isPassphraseSet(db)).toBe(true)
    sqlite.close()
  })

  it('rejects a passphrase below the minimum length', () => {
    const { db, sqlite } = createTestDb()
    expect(() => setPassphrase(db, 'short')).toThrow(
      new RegExp(String(MIN_PASSPHRASE_LENGTH)),
    )
    sqlite.close()
  })

  it('requires the current passphrase to change it', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(() => setPassphrase(db, 'second passphrase')).toThrow(/current passphrase/i)
    expect(() => setPassphrase(db, 'second passphrase', 'wrong')).toThrow(/current passphrase/i)
    sqlite.close()
  })

  it('changes the passphrase when the current one is correct', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    setPassphrase(db, 'second passphrase', 'first passphrase')

    const token = createSession(db, NOW)
    expect(validateSession(db, token, NOW)).toBe(true)
    sqlite.close()
  })

  it('removes the passphrase and all sessions', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    const token = createSession(db, NOW)

    removePassphrase(db, 'first passphrase')

    expect(isPassphraseSet(db)).toBe(false)
    expect(validateSession(db, token, NOW)).toBe(false)
    sqlite.close()
  })

  it('refuses to remove the passphrase with the wrong current value', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(() => removePassphrase(db, 'wrong')).toThrow(/current passphrase/i)
    sqlite.close()
  })
})

describe('sessions', () => {
  it('creates a token that validates', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(validateSession(db, token, NOW)).toBe(true)
    sqlite.close()
  })

  it('rejects an unknown token', () => {
    const { db, sqlite } = createTestDb()
    expect(validateSession(db, 'nope', NOW)).toBe(false)
    sqlite.close()
  })

  it('rejects an expired token', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)
    const wayLater = NOW + 60 * 60 * 24 * 365

    expect(validateSession(db, token, wayLater)).toBe(false)
    sqlite.close()
  })

  it('destroys a session', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)
    destroySession(db, token)

    expect(validateSession(db, token, NOW)).toBe(false)
    sqlite.close()
  })

  it('purges only expired sessions', () => {
    const { db, sqlite } = createTestDb()
    const live = createSession(db, NOW)
    const stale = createSession(db, NOW - 60 * 60 * 24 * 400)

    const purged = purgeExpiredSessions(db, NOW)

    expect(purged).toBe(1)
    expect(validateSession(db, live, NOW)).toBe(true)
    expect(db.select().from(sessions).all()).toHaveLength(1)
    expect(stale).not.toBe(live)
    sqlite.close()
  })

  it('issues distinct tokens', () => {
    const { db, sqlite } = createTestDb()
    expect(createSession(db, NOW)).not.toBe(createSession(db, NOW))
    sqlite.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/server/auth.test.ts`
Expected: FAIL — `Failed to resolve import "./auth"`

- [ ] **Step 3: Write the implementation**

`src/web/src/server/auth.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { appSettings, sessions } from '@/db/schema'

export const MIN_PASSPHRASE_LENGTH = 8

const PASSPHRASE_KEY = 'passphrase'
const SCRYPT_KEYLEN = 64
const SALT_BYTES = 16
const TOKEN_BYTES = 32

/** Stored as `scrypt$<saltHex>$<hashHex>`. */
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(passphrase, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassphrase(passphrase: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    if (expected.length !== SCRYPT_KEYLEN) return false
    const actual = scryptSync(passphrase, salt, SCRYPT_KEYLEN)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function storedPassphrase(db: BetterSQLite3Database): string | null {
  const row = db.select().from(appSettings)
    .where(eq(appSettings.key, PASSPHRASE_KEY)).get()
  return row?.value ?? null
}

export function isPassphraseSet(db: BetterSQLite3Database): boolean {
  return storedPassphrase(db) !== null
}

export function setPassphrase(
  db: BetterSQLite3Database,
  newPassphrase: string,
  currentPassphrase?: string,
): void {
  if (newPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  }

  const existing = storedPassphrase(db)
  if (existing !== null) {
    if (!currentPassphrase || !verifyPassphrase(currentPassphrase, existing)) {
      throw new Error('Current passphrase is incorrect.')
    }
  }

  // Derive once — scrypt is deliberately expensive.
  const hashed = hashPassphrase(newPassphrase)

  db.insert(appSettings)
    .values({ key: PASSPHRASE_KEY, value: hashed })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: hashed } })
    .run()
}

export function removePassphrase(
  db: BetterSQLite3Database,
  currentPassphrase: string,
): void {
  const existing = storedPassphrase(db)
  if (existing === null) throw new Error('No passphrase is set.')
  if (!verifyPassphrase(currentPassphrase, existing)) {
    throw new Error('Current passphrase is incorrect.')
  }

  db.delete(appSettings).where(eq(appSettings.key, PASSPHRASE_KEY)).run()
  db.delete(sessions).run()
}

function sessionDays(): number {
  const parsed = Number(process.env.CLEARFOLIO_SESSION_DAYS)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function createSession(db: BetterSQLite3Database, now = nowSeconds()): string {
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  db.insert(sessions).values({
    token,
    createdAt: now,
    expiresAt: now + sessionDays() * 24 * 60 * 60,
  }).run()
  purgeExpiredSessions(db, now)
  return token
}

export function validateSession(
  db: BetterSQLite3Database,
  token: string,
  now = nowSeconds(),
): boolean {
  if (!token) return false
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get()
  if (!row) return false
  if (row.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.token, token)).run()
    return false
  }
  return true
}

export function destroySession(db: BetterSQLite3Database, token: string): void {
  if (!token) return
  db.delete(sessions).where(eq(sessions.token, token)).run()
}

/** Returns the number of rows removed. */
export function purgeExpiredSessions(
  db: BetterSQLite3Database,
  now = nowSeconds(),
): number {
  const result = db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
  return result.changes
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/server/auth.test.ts`
Expected: PASS, 17 tests

- [ ] **Step 5: Commit**

```bash
git add src/web/src/server/auth.ts src/web/src/server/auth.test.ts
git commit -m "feat: add scrypt passphrase auth with session table"
```

---

### Task 10: Session helpers and cookie handling

> **No `middleware.ts`.** Middleware runs on the edge runtime, where `better-sqlite3` cannot load, so it could only check whether the session cookie is *present*. That check is wrong for this app: when no passphrase is set the user is authorised by design and no cookie exists, so cookie-presence middleware would redirect a legitimate user to a login page with no passphrase to accept — an inescapable loop on a default install. `resolveAuthState` in the authenticated layout is the single enforcement point and handles all three states correctly.

**Files:**
- Create: `src/web/src/server/session.ts`
- Test: `src/web/src/server/session.test.ts`

**Interfaces:**
- Consumes: `auth.ts` from Task 9; `households` from `@/db/schema`
- Produces:
  - `SESSION_COOKIE = 'clearfolio_session'`
  - `type AuthState = { status: 'no-setup' } | { status: 'unauthenticated' } | { status: 'authenticated' }`
  - `resolveAuthState(db, token: string | null): AuthState`
  - `sessionCookieOptions(isHttps: boolean): object`
  - `requireSession(): Promise<void>` — server-only, redirects
  - `isSetupComplete(db): boolean`

- [ ] **Step 1: Write the failing test**

`src/web/src/server/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/db/client'
import { households } from '@/db/schema'
import { setPassphrase, createSession } from './auth'
import { resolveAuthState, sessionCookieOptions, isSetupComplete, SESSION_COOKIE } from './session'

const NOW = 1_800_000_000

function withHousehold(db: ReturnType<typeof createTestDb>['db']) {
  db.insert(households).values({
    id: 'household-1',
    name: 'Test Household',
    baseCurrency: 'AUD',
    preferredPeriodType: 'FY',
    locale: 'en-AU',
    createdAt: NOW,
  }).run()
}

describe('isSetupComplete', () => {
  it('is false with no household', () => {
    const { db, sqlite } = createTestDb()
    expect(isSetupComplete(db)).toBe(false)
    sqlite.close()
  })

  it('is true once a household exists', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    expect(isSetupComplete(db)).toBe(true)
    sqlite.close()
  })
})

describe('resolveAuthState', () => {
  it('reports no-setup before a household exists', () => {
    const { db, sqlite } = createTestDb()
    expect(resolveAuthState(db, null)).toEqual({ status: 'no-setup' })
    sqlite.close()
  })

  it('is authenticated when no passphrase is set', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    expect(resolveAuthState(db, null)).toEqual({ status: 'authenticated' })
    sqlite.close()
  })

  it('is unauthenticated with a passphrase and no token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    expect(resolveAuthState(db, null)).toEqual({ status: 'unauthenticated' })
    sqlite.close()
  })

  it('is unauthenticated with an invalid token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    expect(resolveAuthState(db, 'bogus')).toEqual({ status: 'unauthenticated' })
    sqlite.close()
  })

  it('is authenticated with a valid token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    const token = createSession(db)
    expect(resolveAuthState(db, token)).toEqual({ status: 'authenticated' })
    sqlite.close()
  })
})

describe('sessionCookieOptions', () => {
  it('is HttpOnly and strictly same-site', () => {
    const options = sessionCookieOptions(false)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('strict')
    expect(options.path).toBe('/')
  })

  it('is not Secure over plain HTTP', () => {
    expect(sessionCookieOptions(false).secure).toBe(false)
  })

  it('is Secure over HTTPS', () => {
    expect(sessionCookieOptions(true).secure).toBe(true)
  })

  it('uses the documented cookie name', () => {
    expect(SESSION_COOKIE).toBe('clearfolio_session')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/server/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`

- [ ] **Step 3: Write the implementation**

`src/web/src/server/session.ts`:

```ts
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { households } from '@/db/schema'
import { isPassphraseSet, validateSession } from './auth'

export const SESSION_COOKIE = 'clearfolio_session'

export type AuthState =
  | { status: 'no-setup' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }

export function isSetupComplete(db: BetterSQLite3Database): boolean {
  return db.select().from(households).limit(1).all().length > 0
}

/**
 * The single source of truth for what a request is allowed to do.
 * Pure with respect to the request — takes the token, returns a state.
 */
export function resolveAuthState(
  db: BetterSQLite3Database,
  token: string | null,
): AuthState {
  if (!isSetupComplete(db)) return { status: 'no-setup' }
  if (!isPassphraseSet(db)) return { status: 'authenticated' }
  if (token && validateSession(db, token)) return { status: 'authenticated' }
  return { status: 'unauthenticated' }
}

export interface SessionCookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict'
  path: string
  maxAge: number
}

export function sessionCookieOptions(isHttps: boolean): SessionCookieOptions {
  const days = Number(process.env.CLEARFOLIO_SESSION_DAYS)
  const sessionDays = Number.isInteger(days) && days > 0 ? days : 30
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionDays * 24 * 60 * 60,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/server/session.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Confirm no middleware file exists**

Run: `test ! -f src/web/middleware.ts && echo "correct: no auth middleware"`
Expected: prints the confirmation. If a `middleware.ts` exists, delete it — see the note at the top of this task.

- [ ] **Step 6: Commit**

```bash
git add src/web/src/server/session.ts src/web/src/server/session.test.ts
git commit -m "feat: add auth state resolution and session cookie options"
```

---

### Task 11: Design system tokens and application shell

Implements the spec's visual direction: quiet, dense, typographic; tabular numerals; single accent; light and dark both first-class.

**Files:**
- Create: `src/web/app/globals.css`
- Create: `src/web/src/components/theme-toggle.tsx`
- Create: `src/web/src/components/app-shell.tsx`
- Modify: `src/web/app/layout.tsx`
- Modify: `src/web/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `<AppShell>` layout component, `<ThemeToggle>`, CSS custom properties for both themes

- [ ] **Step 1: Install Tailwind**

Run:

```bash
cd src/web && npm install -D tailwindcss@^4.3.3 @tailwindcss/postcss postcss
```

Create `src/web/postcss.config.mjs`:

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

- [ ] **Step 2: Write the design tokens**

`src/web/app/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
}

/* Light is the base definition; dark redefines only what changes.
   Both are first-class — neither is an override of the other. */
:root {
  --surface: oklch(0.99 0 0);
  --surface-raised: oklch(1 0 0);
  --surface-sunken: oklch(0.96 0.002 260);
  --border: oklch(0.90 0.003 260);
  --text: oklch(0.22 0.006 260);
  --text-muted: oklch(0.52 0.008 260);
  --accent: oklch(0.52 0.13 250);
  --accent-text: oklch(0.99 0 0);
  --positive: oklch(0.52 0.12 155);
  --negative: oklch(0.53 0.17 25);
}

:root[data-theme='dark'] {
  --surface: oklch(0.18 0.006 260);
  --surface-raised: oklch(0.22 0.007 260);
  --surface-sunken: oklch(0.15 0.006 260);
  --border: oklch(0.30 0.008 260);
  --text: oklch(0.94 0.003 260);
  --text-muted: oklch(0.68 0.008 260);
  --accent: oklch(0.70 0.13 250);
  --accent-text: oklch(0.18 0.006 260);
  --positive: oklch(0.72 0.14 155);
  --negative: oklch(0.70 0.16 25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --surface: oklch(0.18 0.006 260);
    --surface-raised: oklch(0.22 0.007 260);
    --surface-sunken: oklch(0.15 0.006 260);
    --border: oklch(0.30 0.008 260);
    --text: oklch(0.94 0.003 260);
    --text-muted: oklch(0.68 0.008 260);
    --accent: oklch(0.70 0.13 250);
    --accent-text: oklch(0.18 0.006 260);
    --positive: oklch(0.72 0.14 155);
    --negative: oklch(0.70 0.16 25);
  }
}

body {
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  /* Density over whitespace — this is a tool for reading numbers. */
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* Every figure aligns in its column and does not jitter as values change. */
.tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* Sign and position carry the meaning; colour reinforces but never alone. */
.value-positive { color: var(--positive); }
.value-negative { color: var(--negative); }
```

- [ ] **Step 3: Write the theme toggle**

`src/web/src/components/theme-toggle.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('clearfolio-theme') as Theme | null
    if (stored) setTheme(stored)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    localStorage.setItem('clearfolio-theme', theme)
  }, [theme])

  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const label: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      aria-label={`Theme: ${label[theme]}. Click to change.`}
    >
      {label[theme]}
    </button>
  )
}
```

- [ ] **Step 4: Write the app shell**

`src/web/src/components/app-shell.tsx`:

```tsx
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/liabilities', label: 'Liabilities' },
  { href: '/snapshots', label: 'Snapshots' },
  { href: '/projections', label: 'Projections' },
  { href: '/settings', label: 'Settings' },
]

export function AppShell({
  householdName,
  children,
}: {
  householdName: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">Clearfolio</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {householdName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action="/api/logout" method="post">
            <button type="submit" className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        <nav
          className="w-44 shrink-0 border-r p-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-2 py-1 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire globals.css into the root layout**

Replace `src/web/app/layout.tsx`:

```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clearfolio',
  description: 'Household net worth tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Verify the build**

Run: `cd src/web && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/web/app src/web/src/components src/web/postcss.config.mjs src/web/package.json src/web/package-lock.json
git commit -m "feat: add design tokens, theme toggle and app shell"
```

---

### Task 12: Setup wizard

**Files:**
- Create: `src/web/src/server/services/setup.ts`
- Create: `src/web/app/setup/page.tsx`
- Create: `src/web/app/setup/actions.ts`
- Test: `src/web/src/server/services/setup.test.ts`

**Interfaces:**
- Consumes: schema tables; `seedReferenceData` from `@/db/seed`; `setPassphrase` from `@/server/auth`; `isSetupComplete` from `@/server/session`
- Produces:
  - `interface SetupInput { householdName, displayName, secondMemberName?, baseCurrency, locale, preferredPeriodType, passphrase? }`
  - `completeSetup(db, input, now?): { householdId: string; memberIds: string[] }`

> **Why the passphrase lives here:** spec acceptance criterion 4 requires that a passphrase can be set and that login works. Settings is slice 4, so setup is the only place in slice 1 that can satisfy it — and offering it at first run is the natural product behaviour anyway. `setPassphrase` and its tests already exist from Task 9; this only exposes them.
>
> **No ownership rows are created here.** Ownership attaches to assets and liabilities, which arrive in slice 2. `@/domain/ownership` is not imported by this task.

- [ ] **Step 1: Write the failing test**

`src/web/src/server/services/setup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/db/client'
import { households, householdMembers, scenarios, expenseCategories } from '@/db/schema'
import { isPassphraseSet } from '@/server/auth'
import { completeSetup } from './setup'

const NOW = 1_800_000_000

const INPUT = {
  householdName: 'The Catons',
  displayName: 'Greg',
  baseCurrency: 'AUD',
  locale: 'en-AU',
  preferredPeriodType: 'FY' as const,
}

describe('completeSetup', () => {
  it('creates the household', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const rows = db.select().from(households).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('The Catons')
    expect(rows[0].preferredPeriodType).toBe('FY')
    expect(rows[0].locale).toBe('en-AU')
    sqlite.close()
  })

  it('creates a single primary member', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const members = db.select().from(householdMembers).all()
    expect(members).toHaveLength(1)
    expect(members[0].displayName).toBe('Greg')
    expect(members[0].isPrimary).toBe(true)
    sqlite.close()
  })

  it('creates a second member when supplied', () => {
    const { db, sqlite } = createTestDb()
    const result = completeSetup(db, { ...INPUT, secondMemberName: 'Sam' }, NOW)

    const members = db.select().from(householdMembers).all()
    expect(members).toHaveLength(2)
    expect(members.filter((m) => m.isPrimary)).toHaveLength(1)
    expect(result.memberIds).toHaveLength(2)
    sqlite.close()
  })

  it('seeds a baseline scenario', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const rows = db.select().from(scenarios).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].isBaseline).toBe(true)
    expect(rows[0].name).toBe('Baseline')
    sqlite.close()
  })

  it('seeds reference data and default expense categories', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    expect(db.select().from(expenseCategories).all().length).toBeGreaterThan(0)
    sqlite.close()
  })

  it('refuses to run twice', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)
    expect(() => completeSetup(db, INPUT, NOW)).toThrow(/already/i)
    sqlite.close()
  })

  it('rejects a blank household name', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, householdName: '  ' }, NOW))
      .toThrow(/household name/i)
    sqlite.close()
  })

  it('rejects a blank display name', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, displayName: '' }, NOW))
      .toThrow(/display name/i)
    sqlite.close()
  })

  it('leaves the app open when no passphrase is supplied', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)
    expect(isPassphraseSet(db)).toBe(false)
    sqlite.close()
  })

  it('sets the passphrase when supplied', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, { ...INPUT, passphrase: 'a good passphrase' }, NOW)
    expect(isPassphraseSet(db)).toBe(true)
    sqlite.close()
  })

  it('rejects a too-short passphrase without creating a household', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, passphrase: 'short' }, NOW)).toThrow(/8/)
    expect(db.select().from(households).all()).toHaveLength(0)
    sqlite.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/web && npx vitest run src/server/services/setup.test.ts`
Expected: FAIL — `Failed to resolve import "./setup"`

- [ ] **Step 3: Write the implementation**

`src/web/src/server/services/setup.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  households, householdMembers, scenarios, expenseCategories,
} from '@/db/schema'
import { seedReferenceData } from '@/db/seed'
import { setPassphrase, MIN_PASSPHRASE_LENGTH } from '../auth'
import { isSetupComplete } from '../session'

export interface SetupInput {
  householdName: string
  displayName: string
  secondMemberName?: string
  baseCurrency: string
  locale: string
  preferredPeriodType: 'FY' | 'CY'
  /** Optional. When omitted the app runs unauthenticated, as it does today. */
  passphrase?: string
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Housing', 'Utilities', 'Groceries', 'Transport',
  'Insurance', 'Health', 'Discretionary', 'Other',
]

export function completeSetup(
  db: BetterSQLite3Database,
  input: SetupInput,
  now = Math.floor(Date.now() / 1000),
): { householdId: string; memberIds: string[] } {
  if (isSetupComplete(db)) {
    throw new Error('Setup has already been completed.')
  }
  if (!input.householdName.trim()) {
    throw new Error('Household name is required.')
  }
  if (!input.displayName.trim()) {
    throw new Error('Display name is required.')
  }
  // Validate before writing anything, so a rejected passphrase leaves no
  // half-created household behind.
  if (input.passphrase && input.passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  }

  const householdId = randomUUID()
  const primaryId = randomUUID()
  const memberIds = [primaryId]

  db.transaction((tx) => {
    tx.insert(households).values({
      id: householdId,
      name: input.householdName.trim(),
      baseCurrency: input.baseCurrency,
      preferredPeriodType: input.preferredPeriodType,
      locale: input.locale,
      createdAt: now,
    }).run()

    tx.insert(householdMembers).values({
      id: primaryId,
      householdId,
      email: null,
      displayName: input.displayName.trim(),
      memberTag: 'p1',
      isPrimary: true,
      createdAt: now,
    }).run()

    if (input.secondMemberName?.trim()) {
      const secondId = randomUUID()
      memberIds.push(secondId)
      tx.insert(householdMembers).values({
        id: secondId,
        householdId,
        email: null,
        displayName: input.secondMemberName.trim(),
        memberTag: 'p2',
        isPrimary: false,
        createdAt: now,
      }).run()
    }

    tx.insert(scenarios).values({
      id: randomUUID(),
      householdId,
      name: 'Baseline',
      horizonYears: 20,
      inflationRate: 0,
      isBaseline: true,
      createdAt: now,
    }).run()

    tx.insert(expenseCategories).values(
      DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
        id: randomUUID(),
        householdId,
        name,
        sortOrder: index + 1,
        isDefault: true,
        createdAt: now,
      })),
    ).run()

    seedReferenceData(tx as unknown as BetterSQLite3Database)

    if (input.passphrase) {
      setPassphrase(tx as unknown as BetterSQLite3Database, input.passphrase)
    }
  })

  return { householdId, memberIds }
}
```

> **Note on `memberTag`:** it is retained purely as a display shorthand. It carries no ownership semantics — those live entirely in the `ownership` table. Nothing branches on its value.

- [ ] **Step 4: Write the server action and page**

`src/web/app/setup/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { completeSetup } from '@/server/services/setup'

const SetupSchema = z.object({
  householdName: z.string().trim().min(1, 'Household name is required.'),
  displayName: z.string().trim().min(1, 'Display name is required.'),
  secondMemberName: z.string().trim().optional(),
  baseCurrency: z.string().trim().length(3),
  locale: z.string().trim().min(2),
  preferredPeriodType: z.enum(['FY', 'CY']),
  passphrase: z.string().optional().transform((v) => (v ? v : undefined)),
})

export async function submitSetup(_prev: unknown, formData: FormData) {
  const parsed = SetupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    completeSetup(getDb(), parsed.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Setup failed.' }
  }

  redirect('/dashboard')
}
```

Run: `cd src/web && npm install zod`

`src/web/app/setup/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { submitSetup } from './actions'

const FIELD = 'w-full rounded-md border px-3 py-2 text-sm'
const FIELD_STYLE = { borderColor: 'var(--border)', background: 'var(--surface-raised)' }

export default function SetupPage() {
  const [state, action, pending] = useActionState(submitSetup, null)

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-1 text-lg font-semibold">Welcome to Clearfolio</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        A few details to set up your household.
      </p>

      <form action={action} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs">Household name</span>
          <input name="householdName" required className={FIELD} style={FIELD_STYLE} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">Your name</span>
          <input name="displayName" required className={FIELD} style={FIELD_STYLE} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">
            Partner name <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </span>
          <input name="secondMemberName" className={FIELD} style={FIELD_STYLE} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs">Currency</span>
            <input name="baseCurrency" defaultValue="AUD" required className={FIELD} style={FIELD_STYLE} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs">Locale</span>
            <input name="locale" defaultValue="en-AU" required className={FIELD} style={FIELD_STYLE} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs">Period type</span>
          <select name="preferredPeriodType" defaultValue="FY" className={FIELD} style={FIELD_STYLE}>
            <option value="FY">Financial year (July–June)</option>
            <option value="CY">Calendar year (January–December)</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">
            Passphrase <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </span>
          <input
            name="passphrase"
            type="password"
            minLength={8}
            className={FIELD}
            style={FIELD_STYLE}
          />
          <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
            Leave blank to run without a sign-in prompt. Minimum 8 characters.
          </span>
        </label>

        {state?.error && (
          <p className="text-sm value-negative" role="alert">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {pending ? 'Setting up…' : 'Create household'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src/web && npx vitest run src/server/services/setup.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 6: Commit**

```bash
git add src/web/src/server/services src/web/app/setup src/web/package.json src/web/package-lock.json
git commit -m "feat: add setup wizard with household, members and baseline scenario"
```

---

### Task 13: Login, logout and the authenticated dashboard route

**Files:**
- Create: `src/web/app/login/page.tsx`
- Create: `src/web/app/login/actions.ts`
- Create: `src/web/app/api/logout/route.ts`
- Create: `src/web/app/dashboard/page.tsx`
- Create: `src/web/app/dashboard/layout.tsx`
- Modify: `src/web/app/page.tsx`

**Interfaces:**
- Consumes: `resolveAuthState`, `sessionCookieOptions`, `SESSION_COOKIE`; `createSession`, `destroySession`, `verifyPassphrase`, `isPassphraseSet`
- Produces: routes `/login`, `/dashboard`, `POST /api/logout`; root `/` redirects by auth state

- [ ] **Step 1: Write the login server action**

`src/web/app/login/actions.ts`:

```ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { appSettings } from '@/db/schema'
import { createSession, verifyPassphrase } from '@/server/auth'
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session'

export async function submitLogin(_prev: unknown, formData: FormData) {
  const passphrase = String(formData.get('passphrase') ?? '')
  if (!passphrase) return { error: 'Passphrase is required.' }

  const db = getDb()
  const stored = db.select().from(appSettings)
    .where(eq(appSettings.key, 'passphrase')).get()

  if (!stored) return { error: 'No passphrase is set.' }
  if (!verifyPassphrase(passphrase, stored.value)) {
    return { error: 'Incorrect passphrase.' }
  }

  const token = createSession(db)
  const headerList = await headers()
  const isHttps =
    headerList.get('x-forwarded-proto')?.toLowerCase() === 'https'

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(isHttps))

  redirect('/dashboard')
}
```

- [ ] **Step 2: Write the login page**

`src/web/app/login/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { submitLogin } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(submitLogin, null)

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-lg font-semibold">Clearfolio</h1>

      <form action={action} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs">Passphrase</span>
          <input
            name="passphrase"
            type="password"
            autoFocus
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
          />
        </label>

        {state?.error && (
          <p className="text-sm value-negative" role="alert">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Write the logout route handler**

`src/web/app/api/logout/route.ts`:

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { destroySession } from '@/server/auth'
import { SESSION_COOKIE } from '@/server/session'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) destroySession(getDb(), token)
  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
```

- [ ] **Step 4: Write the authenticated layout and dashboard**

`src/web/app/dashboard/layout.tsx`:

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { households } from '@/db/schema'
import { resolveAuthState, SESSION_COOKIE } from '@/server/session'
import { AppShell } from '@/components/app-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const db = getDb()
  const cookieStore = await cookies()
  const state = resolveAuthState(db, cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')

  const household = db.select().from(households).limit(1).get()

  return <AppShell householdName={household?.name ?? ''}>{children}</AppShell>
}
```

`src/web/app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-base font-semibold">Dashboard</h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No assets recorded yet. Add your first asset to see your net worth.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Make the root route dispatch on auth state**

Replace `src/web/app/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { resolveAuthState, SESSION_COOKIE } from '@/server/session'

export default async function Home() {
  const cookieStore = await cookies()
  const state = resolveAuthState(getDb(), cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')
  redirect('/dashboard')
}
```

- [ ] **Step 6: Verify manually**

Run:

```bash
cd src/web && rm -f /tmp/clearfolio-dev.db && DB_PATH=/tmp/clearfolio-dev.db npm run db:migrate && DB_PATH=/tmp/clearfolio-dev.db npm run dev
```

Expected: visiting `http://localhost:3000` redirects to `/setup`; completing the wizard lands on `/dashboard` showing the shell with navigation and the empty state.

- [ ] **Step 7: Commit**

```bash
git add src/web/app
git commit -m "feat: add login, logout and authenticated dashboard shell"
```

---

### Task 14: Health route handler and security headers

**Files:**
- Create: `src/web/app/api/health/route.ts`
- Modify: `src/web/next.config.ts`

**Interfaces:**
- Consumes: `getDb`
- Produces: `GET /api/health` returning `{ status: 'healthy' }`

- [ ] **Step 1: Write the health route**

`src/web/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    getDb().run(sql`SELECT 1`)
    return NextResponse.json({ status: 'healthy' })
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 })
  }
}
```

- [ ] **Step 2: Port the security headers from nginx**

Read `src/app/security-headers.conf` for the current values, then replace `src/web/next.config.ts`:

```ts
import type { NextConfig } from 'next'

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
```

> If `src/app/security-headers.conf` sets a header not listed here, add it. Do not drop one silently.

- [ ] **Step 3: Verify**

Run:

```bash
cd src/web && DB_PATH=/tmp/clearfolio-dev.db npm run build && DB_PATH=/tmp/clearfolio-dev.db npm run start &
sleep 3 && curl -si localhost:3000/api/health | head -20
```

Expected: `200 OK`, body `{"status":"healthy"}`, and the security headers present.

- [ ] **Step 4: Commit**

```bash
git add src/web/app/api/health src/web/next.config.ts
git commit -m "feat: add health endpoint and security headers"
```

---

### Task 15: Playwright end-to-end coverage

**Files:**
- Create: `src/web/playwright.config.ts`
- Create: `src/web/e2e/setup-and-auth.spec.ts`
- Modify: `src/web/package.json`

**Interfaces:**
- Consumes: the running application
- Produces: `npm run test:e2e`

- [ ] **Step 1: Install Playwright**

Run:

```bash
cd src/web && npm install -D @playwright/test && npx playwright install --with-deps chromium
```

Add to `package.json` scripts:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Write the config**

`src/web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

const DB_PATH = '/tmp/clearfolio-e2e.db'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: `rm -f ${DB_PATH} && npm run build && npm run db:migrate && npm run start -- --port 3100`,
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DB_PATH, CLEARFOLIO_SESSION_DAYS: '30' },
  },
})
```

- [ ] **Step 3: Write the end-to-end test**

`src/web/e2e/setup-and-auth.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const PASSPHRASE = 'e2e test passphrase'

// These tests share one database and run in declaration order, because setup
// can only happen once per database.
test.describe.configure({ mode: 'serial' })

test('first run walks through setup and reaches the dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup/)

  await page.fill('input[name="householdName"]', 'E2E Household')
  await page.fill('input[name="displayName"]', 'Tester')
  await page.fill('input[name="passphrase"]', PASSPHRASE)
  await page.selectOption('select[name="preferredPeriodType"]', 'FY')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('E2E Household')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('navigation and theme toggle render in the shell', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page.getByRole('link', { name: 'Assets' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Projections' })).toBeVisible()

  const toggle = page.getByRole('button', { name: /^Theme:/ })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
})

test('signing out ends the session and requires the passphrase again', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/login/)

  // The session is genuinely gone — the dashboard now redirects to login.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('an incorrect passphrase is rejected', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="passphrase"]', 'definitely wrong')
  await page.click('button[type="submit"]')

  await expect(page.getByRole('alert')).toContainText('Incorrect passphrase')
  await expect(page).toHaveURL(/\/login/)
})

test('the correct passphrase signs back in', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="passphrase"]', PASSPHRASE)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
```

This is the full round-trip required by spec acceptance criteria 4, 5 and 8: passphrase set during setup, session established, sign-out, rejected credential, and successful re-entry.

- [ ] **Step 4: Run the end-to-end suite**

Run: `cd src/web && npm run test:e2e`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/web/playwright.config.ts src/web/e2e src/web/package.json src/web/package-lock.json
git commit -m "test: add Playwright coverage for setup and app shell"
```

---

### Task 16: Container, CI, Justfile and README

**Files:**
- Modify: `Dockerfile`
- Delete: `docker-entrypoint.sh`
- Modify: `Justfile`
- Modify: `.github/workflows/build.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete `src/web` application
- Produces: a single-process container listening on 3000

- [ ] **Step 1: Add the container startup script**

`src/web/scripts/start.sh`:

```sh
#!/bin/sh
set -e

# Migrations must complete before the server accepts traffic.
node ./scripts/migrate.js

exec node server.js
```

Add a build step that compiles `src/db/migrate.ts` for the standalone runtime. In `src/web/package.json` scripts:

```json
"build:migrate": "esbuild src/db/migrate.ts --bundle --platform=node --external:better-sqlite3 --outfile=dist/migrate.js"
```

Run: `cd src/web && npm install -D esbuild`

- [ ] **Step 2: Replace the Dockerfile**

`Dockerfile`:

```dockerfile
# Stage 1: Build the Next.js application
FROM node:24-alpine AS build
WORKDIR /app
ARG APP_VERSION=dev

RUN apk add --no-cache python3 make g++

COPY src/web/package.json src/web/package-lock.json ./
RUN npm ci

COPY src/web/ .
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN npm run build && npm run build:migrate

# Stage 2: Runtime
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/db/migrations ./src/db/migrations
COPY --from=build /app/dist/migrate.js ./scripts/migrate.js
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY src/web/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV DB_PATH=/data/clearfolio.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./start.sh"]
```

- [ ] **Step 3: Remove the obsolete entrypoint**

```bash
git rm docker-entrypoint.sh
```

> `src/app/nginx.conf` and `src/app/security-headers.conf` are **not** deleted — `src/app` stays as porting reference until the parity commit. They simply stop being copied into the image.

- [ ] **Step 4: Update the Justfile**

Replace the `dev` group in `Justfile`:

```just
web_dir := "src/web"

# Run the Next.js dev server
[group('dev')]
dev:
    cd {{web_dir}} && npm run dev

# Run unit tests
[group('dev')]
test *args='':
    cd {{web_dir}} && npm test {{args}}

# Run end-to-end tests
[group('dev')]
test-e2e:
    cd {{web_dir}} && npm run test:e2e

# Generate a migration from schema changes
[group('dev')]
migrate:
    cd {{web_dir}} && npm run db:generate

# Apply pending migrations to the local database
[group('dev')]
migrate-apply:
    cd {{web_dir}} && npm run db:migrate
```

Update `_run` to publish the new port:

```just
[private]
_run:
    docker run -d \
      --name {{container}} \
      -p 4200:3000 \
      -e DB_PATH=/data/clearfolio.db \
      -v clearfolio-data:/data \
      {{image}}
```

Delete the `dev-api`, `dev-app` and `dev-stop` recipes — there is one process now.

- [ ] **Step 5: Update CI**

In `.github/workflows/build.yml`, replace the .NET and Node/Angular build steps with a single Node setup, and add a test gate before the image build:

```yaml
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: src/web/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: src/web

      - name: Run unit tests
        run: npm test
        working-directory: src/web

      - name: Type check
        run: npm run typecheck
        working-directory: src/web
```

Keep the existing GHCR login, multiarch `docker/build-push-action` and tagging steps unchanged.

- [ ] **Step 6: Update the README**

In `README.md`:

- Change the quick-start command to `docker run -d -p 8080:3000 -v clearfolio-data:/data ghcr.io/gcaton/clearfolio`
- Replace the Tech Stack table rows for API and Frontend with a single row: `App | Next.js 16, React 19, Drizzle ORM, SQLite`
- Replace the Local Development prerequisites with `Node.js 24+, Docker`
- Remove `just dev-api` / `just dev-app` from the command list; add `just test-e2e`
- Add a prominent breaking-change note:

```markdown
> **Breaking change in v2.0:** Clearfolio has been rewritten on Next.js. The database schema is not compatible with v1.x — existing `/data` volumes cannot be read. Start with a fresh volume.
```

- [ ] **Step 7: Verify the container end to end**

Run:

```bash
docker build -t clearfolio-dev . && \
docker rm -f clearfolio 2>/dev/null; \
docker volume rm clearfolio-test 2>/dev/null; \
docker run -d --name clearfolio -p 4200:3000 -v clearfolio-test:/data clearfolio-dev && \
sleep 8 && curl -s localhost:4200/api/health && docker logs clearfolio
```

Expected: `{"status":"healthy"}`, logs showing migrations applied, and `http://localhost:4200` serving the setup wizard.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile Justfile .github/workflows/build.yml README.md src/web/scripts src/web/package.json
git commit -m "build: package as single Next.js container, retire nginx"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Architecture / file layout | 1, and enforced throughout |
| Stack and versions | 1, 7, 11, 15 |
| Schema — 15 tables, cents, bp, epoch, soft delete | 7 |
| Ownership table and share semantics | 5, 7, 12 |
| Snapshots — units, price REAL, unique index | 7 |
| Polymorphic entity integrity | 7 (schema comment and generated-SQL assertions), 5 (assertion helpers) |
| Scenarios and assumptions | 7, 12 (baseline seeded) |
| Sessions table | 7, 9 |
| Currency columns dropped | 7 |
| Seed data | 8 |
| Auth — scrypt, cookie | 9, 12 (passphrase set at setup), 13 |
| No auth middleware | 10 (verified absent in Step 5) |
| Rate limiting | **Gap — see below** |
| `CLEARFOLIO_RESET_PASSPHRASE` | **Gap — see below** |
| Visual direction | 11 |
| Testing — ported suites | 3, 4, 6 |
| Packaging — standalone, no nginx, port 3000 | 16 |
| Branch sequencing | Global Constraints; enforced by not deleting `src/api` / `src/app` |
| Acceptance criteria 1–9 | 16, 12, 13, 7, 6, 15, 11 |

**Resolved during review — worth knowing why:**

1. **Acceptance criterion 4 was unreachable.** It requires that a passphrase can be set and login works, but Settings is slice 4, so nothing in slice 1 called `setPassphrase`. Resolved by adding an optional passphrase field to the setup wizard (Task 12) — the natural place for it anyway — which makes the full login round-trip real and testable end-to-end (Task 15).
2. **The planned `middleware.ts` would have locked users out on a default install.** It redirected on cookie *absence*, but when no passphrase is set the user is authorised and no cookie exists — so setup would have bounced to a login page with no passphrase to accept. Removed entirely; `resolveAuthState` in the authenticated layout was already the correct and complete enforcement point. The spec's Authentication section was rewritten to match.
3. **Spec criterion 3 claimed setup creates `ownership` rows.** It cannot — ownership attaches to assets and liabilities, which arrive in slice 2. The spec was corrected; the task was already right.

**Known gaps, deliberately deferred:**

1. **Rate limiting** (spec: Authentication → Rate limiting) has no task. It guards `/api/quote` and `/api/historical-returns`, neither of which exists in slice 1. The login limiter is now *reachable* — a passphrase can be set at setup — so this is a genuine deferral rather than a vacuous one: a self-hosted single-user app behind a passphrase is a weak brute-force target, and the limiter lands with the external proxies it primarily exists for.
2. **`CLEARFOLIO_RESET_PASSPHRASE`** is listed in Global Constraints but has no implementation step. It belongs in the startup path alongside migrations, in the slice that introduces passphrase management in Settings. Until then the variable is documented as retained, not as working. **If you set a passphrase at setup and forget it, slice 1 has no recovery path short of deleting the volume** — worth knowing before the first real use.

If either should land in slice 1 instead, say so before execution starts.

**Placeholder scan:** no TBDs, no "add error handling", no "similar to Task N". Every code step carries its full content.

**Type consistency:** `Cents` flows from Task 2 through 4, 5 and 6 unchanged. `OwnershipShare` and `View` are defined once in Task 5 and consumed in slice 2, not slice 1 — Task 12 does not import them. `ProjectionEntity` field names match between Task 6's tests and implementation. `SESSION_COOKIE` is defined in Task 10 and imported by Task 13 only. `createTestDb` is defined in Task 8 and used by Tasks 8, 9, 10, 12. `resolveAuthState` returns the same three-state union everywhere it is consumed. `SetupInput.passphrase` is optional in Task 12's interface, Zod schema, form field and tests alike. `MIN_PASSPHRASE_LENGTH` is exported from Task 9 and imported by Task 12.
