# Projections Feature — Design Spec

**Date:** 2026-03-21
**Status:** Draft

## Overview

Add a top-level "Projections" page to Clearfolio that lets users forecast asset growth, liability reduction, and net worth over configurable time horizons using three projection methods: simple compound growth, scenario-based analysis, and Monte Carlo simulation.

## Goals

- Allow users to answer "what will my net worth look like in X years?"
- Support both portfolio-level and per-entity projections
- Provide three levels of analytical sophistication the user can choose between
- Model regular contributions to assets and repayments on liabilities
- Use real historical return data for assets with a market symbol

## Non-Goals

- Life event modelling (e.g. retirement, mortgage payoff events)
- Tax modelling or after-tax projections
- Inflation adjustment
- Real-time portfolio rebalancing suggestions

---

## Data Model Changes

### Asset Entity — New Fields

| Field | Type | Nullable | Description |
|---|---|---|---|
| `contributionAmount` | decimal | yes | Amount contributed per period |
| `contributionFrequency` | string | yes | `weekly` / `fortnightly` / `monthly` / `quarterly` / `yearly` |
| `contributionEndDate` | date | yes | When contributions stop (null = indefinite) |
| `expectedReturnRate` | decimal | yes | Annual return rate override (e.g. 0.07 = 7%) |

### Liability Entity — New Fields

| Field | Type | Nullable | Description |
|---|---|---|---|
| `repaymentAmount` | decimal | yes | Amount repaid per period |
| `repaymentFrequency` | string | yes | `weekly` / `fortnightly` / `monthly` / `quarterly` / `yearly` |
| `repaymentEndDate` | date | yes | When repayments stop (null = indefinite) |
| `interestRate` | decimal | yes | Annual interest rate (e.g. 0.061 = 6.1%) |

### AssetType Entity — New Fields

| Field | Type | Nullable | Description |
|---|---|---|---|
| `defaultReturnRate` | decimal | no | Long-term historical average annual return |
| `defaultVolatility` | decimal | no | Standard deviation of annual returns |

### Seeded Defaults for Asset Types

| Asset Type | Default Return | Default Volatility |
|---|---|---|
| Savings/Transaction | 4% | 1% |
| Term Deposit ≤90d | 4% | 1% |
| Term Deposit >90d | 4.5% | 1% |
| Australian Shares/ETFs | 7% | 15% |
| International Shares/ETFs | 8% | 17% |
| Managed Funds | 6% | 12% |
| Bonds/Fixed Income | 4% | 5% |
| Cryptocurrency | 0% | 50% |
| Investment Bonds | 5% | 8% |
| Super Accumulation | 7% | 12% |
| Super Pension Phase | 6% | 10% |
| Primary Residence (PPOR) | 5% | 10% |
| Investment Property | 5% | 10% |
| Vehicles | -10% | 5% |
| Other Physical Assets | 0% | 10% |

---

## Return Rate Resolution

For each asset, the effective return rate is resolved in priority order:

1. **Asset-level override** — `expectedReturnRate` on the asset entity (user-entered)
2. **Symbol-derived** — For assets with a `symbol`, fetch 5-year historical price data to calculate annualised return and volatility
3. **Type default** — `defaultReturnRate` and `defaultVolatility` from the asset type

The projections page shows which source is active for each entity (badge: "Custom", "From VAS.AX history", or "Type default").

---

## Projection Engines

All three engines run server-side in C#. They share a common input contract and produce mode-specific output.

### Common Input

- List of entities (assets + liabilities) with:
  - Current value (latest snapshot)
  - Contribution/repayment amount and frequency (normalised to annual internally)
  - Effective return rate (resolved per priority above)
  - Volatility (for Monte Carlo)
  - Interest rate (liabilities)
  - Contribution/repayment end date
- Time horizon in years
- View filter (household / memberTag) — applies ownership splits consistent with dashboard logic
- Scope filter (all / financial / liquid) — same category filtering as dashboard

### Engine 1: Simple Compound Growth

Standard compound interest applied yearly:

- **Assets:** `value = (previousValue + annualContribution) × (1 + returnRate)`
- **Liabilities:** `value = (previousValue - annualRepayment) × (1 + interestRate)`, floored at 0
- Contributions stop after `contributionEndDate` if set
- Produces a single projection line per entity

### Engine 2: Scenario-Based

Three named scenarios applied simultaneously:

| Scenario | Return Modifier | Description |
|---|---|---|
| Pessimistic | base rate × 0.5 | Prolonged downturn |
| Base | base rate × 1.0 | Long-term averages hold |
| Optimistic | base rate × 1.5 | Sustained bull market |

- Liability interest rates remain constant across scenarios (conservative: debt cost doesn't decrease in downturns)
- Contributions/repayments remain constant across scenarios
- Produces three projection lines per entity

### Engine 3: Monte Carlo

- Runs N simulations (default 1,000, configurable) per year of horizon
- Each year, each asset's return is sampled from a normal distribution: `N(returnRate, volatility)`
- Liability interest rates are deterministic (no randomness)
- Contributions/repayments applied deterministically each year
- Output: percentile bands — P10, P25, P50 (median), P75, P90
- All percentiles computed across the full simulation set per year

### Contribution Normalisation

All frequencies are converted to annual amounts:

| Frequency | Multiplier |
|---|---|
| weekly | × 52 |
| fortnightly | × 26 |
| monthly | × 12 |
| quarterly | × 4 |
| yearly | × 1 |

---

## API Endpoints

### New Projection Endpoints

**`POST /api/projections/compound`**

Request:
```json
{
  "horizon": 5,
  "view": "household",
  "scope": "all",
  "entityIds": ["guid1", "guid2"]
}
```

Response:
```json
{
  "mode": "compound",
  "horizon": 5,
  "years": [
    { "year": 2026, "assets": 900000, "liabilities": 430000, "netWorth": 470000 },
    { "year": 2027, "assets": 975000, "liabilities": 405000, "netWorth": 570000 }
  ],
  "entities": [
    {
      "id": "guid1",
      "label": "Vanguard ETF",
      "category": "investable",
      "entityType": "asset",
      "years": [
        { "year": 2026, "value": 92000 },
        { "year": 2027, "value": 105400 }
      ]
    }
  ]
}
```

**`POST /api/projections/scenario`**

Same request. Response `years` entries shaped as:
```json
{
  "year": 2026,
  "pessimistic": { "assets": 870000, "liabilities": 435000, "netWorth": 435000 },
  "base": { "assets": 900000, "liabilities": 430000, "netWorth": 470000 },
  "optimistic": { "assets": 935000, "liabilities": 425000, "netWorth": 510000 }
}
```

Entity-level entries include the same three scenarios per year.

**`POST /api/projections/monte-carlo`**

Same request, plus optional `simulations` field (default 1000). Response `years` entries shaped as:
```json
{
  "year": 2026,
  "p10": 420000,
  "p25": 455000,
  "p50": 470000,
  "p75": 490000,
  "p90": 525000
}
```

Entity-level entries include the same percentile fields.

### Supporting Endpoints

**`GET /api/projections/defaults`**

Returns the effective return rate, volatility, and rate source for each active entity.

Response:
```json
[
  {
    "entityId": "guid1",
    "entityType": "asset",
    "label": "Vanguard ETF",
    "effectiveReturnRate": 0.072,
    "effectiveVolatility": 0.148,
    "rateSource": "symbol",
    "contributionAmount": 500,
    "contributionFrequency": "monthly",
    "annualContribution": 6000
  }
]
```

**`GET /api/historical-returns/{symbol}`**

Fetches historical price data for a symbol, calculates and returns annualised return and volatility.

Response:
```json
{
  "symbol": "VAS.AX",
  "annualisedReturn": 0.072,
  "volatility": 0.148,
  "dataPoints": 1260,
  "periodYears": 5
}
```

### Modified Existing Endpoints

- `POST /api/assets` and `PUT /api/assets/{id}` — Extended to accept `contributionAmount`, `contributionFrequency`, `contributionEndDate`, `expectedReturnRate`
- `POST /api/liabilities` and `PUT /api/liabilities/{id}` — Extended to accept `repaymentAmount`, `repaymentFrequency`, `repaymentEndDate`, `interestRate`
- `GET /api/asset-types` — Response now includes `defaultReturnRate` and `defaultVolatility`

---

## Frontend

### Navigation

Add "Projections" to the nav bar between "Snapshots" and "Settings". Same route guard (`requireSetupComplete`) as other feature routes.

Route: `/projections` — lazy-loaded standalone component.

### Page Layout

**Unified view** with controls bar at top:

1. **Method dropdown** — Compound Growth / Scenarios / Monte Carlo
2. **Horizon presets** — 1y, 3y, 5y, 10y, 20y as toggle buttons, plus a "Custom" button that reveals a numeric input
3. **Scope filter** — All / Financial / Liquid (same as dashboard)
4. **Simulations count** — Visible only in Monte Carlo mode (numeric input, default 1,000)

The existing **view selector** (Household / Member) in the top nav applies to projections the same way it applies to dashboard.

### Chart Area

ECharts visualisation that adapts based on selected method:

- **Compound Growth:** Smooth line chart with three series — assets (green, dashed), liabilities (red, dashed), net worth (blue, solid). Currency-formatted Y axis, year X axis.
- **Scenario-Based:** Three net worth lines — pessimistic (red), base (blue), optimistic (green) — with shaded area between pessimistic and optimistic.
- **Monte Carlo:** Fan chart with nested probability bands — P10-P90 (outer, lightest fill), P25-P75 (inner, darker fill), P50 median (solid line). Legend explains band meanings.

### Summary Stats

Below the chart, stat cards showing:

- **Compound:** Projected net worth, total growth %, total contributions
- **Scenario:** Pessimistic / Base / Optimistic projected net worth
- **Monte Carlo:** P10, P25-P75 range, P50 median, P90

### Entity Drill-Down

Below the stats, a **card grid** showing each entity with:

- Entity label and type
- Contribution/repayment amount and frequency
- Sparkline showing projected value over the horizon
- Current value → projected value with growth %
- Click a card to filter the main chart to that entity only

### Contribution Fields on Edit Dialogs

A new "Projections" section on the existing asset and liability edit dialogs:

**Assets:**
- Contribution Amount (currency input)
- Frequency (dropdown: weekly / fortnightly / monthly / quarterly / yearly)
- Contribution End Date (date picker, optional)
- Expected Annual Return (percentage input, shows source badge)
- Volatility (percentage input, shown when symbol-derived, shows source badge)

**Liabilities:**
- Repayment Amount (currency input)
- Frequency (dropdown)
- Repayment End Date (date picker, optional)
- Annual Interest Rate (percentage input)

All fields optional. Source badges indicate "Custom", "From {SYMBOL} history", or "Type default".

---

## Historical Returns Data Source

For assets with a `symbol`, the backend fetches historical price data to calculate annualised return and volatility. The data source should provide at least 5 years of daily or weekly price history.

Implementation options (to be resolved during implementation):
- Yahoo Finance API (free, widely used, covers ASX via `.AX` suffix)
- Alpha Vantage (free tier available)

The historical return calculation:
1. Fetch 5 years of adjusted close prices
2. Calculate daily/weekly returns
3. Annualise: mean return × 252 (trading days) or × 52 (weeks)
4. Volatility: standard deviation of returns × √252 or √52

Results are cached to avoid repeated API calls. Cache duration: 24 hours.

---

## View & Scope Filtering

Projections reuse the same filtering logic as the dashboard:

**View filtering:**
- `household` — Full entity values
- `memberTag` (p1/p2) — Sole-owned assets: full value for owner, zero for other. Joint: weighted by `jointSplit` (p1 gets split%, p2 gets 1-split%)

**Scope filtering:**
- `all` — All assets and liabilities
- `financial` — Cash + investable + retirement assets; personal/credit/student/tax/other liabilities
- `liquid` — Cash + investable assets only; no liabilities
