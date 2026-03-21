# Locale & Internationalisation Design

## Goal

Make all date and currency formatting in Clearfolio culture-specific, driven by a household-level `locale` and `baseCurrency` setting. English-only; no translated strings.

## 1. API & Database

Add a `locale` column (string, not null, default `'en-AU'`) to the `households` table.

- Add `Locale` property to the `Household` entity
- Add `locale` to `UpdateHouseholdRequest` DTO
- Include `locale` in the setup (create household) flow
- Include `locale` in export/import data flows
- Add an EF migration for the new column

## 2. Frontend LocaleService

New `LocaleService` (providedIn: root):

- Injects `ApiService`, fetches household on init
- Exposes two readonly signals:
  - `locale()` — e.g. `'en-AU'`
  - `currency()` — e.g. `'AUD'`
- Defaults to `'en-AU'` / `'AUD'` until household loads
- Updates reactively when the household is saved in settings

## 3. Settings UI

Add a **Locale** dropdown to the Household settings tab with predefined options:

- `en-AU` (Australia)
- `en-US` (United States)
- `en-GB` (United Kingdom)
- `en-NZ` (New Zealand)
- `en-CA` (Canada)
- `en-IE` (Ireland)

Saving the household updates `LocaleService` immediately.

## 4. Custom Pipes

### AppCurrencyPipe

- Standalone pipe, wraps Angular's `CurrencyPipe`
- Usage: `{{ value | appCurrency }}` or `{{ value | appCurrency:'1.0-0' }}`
- Reads `locale()` and `currency()` from `LocaleService`
- Default digit format: `'1.2-2'`

### AppDatePipe

- Standalone pipe, wraps Angular's `DatePipe`
- Usage: `{{ value | appDate }}` or `{{ value | appDate:'short' }}`
- Reads `locale()` from `LocaleService`
- Default format: `'mediumDate'`

## 5. Hardcoded Reference Replacement

### Templates — currency pipe (~20 instances)

Files: `cashflow.component.html`, `net-worth-change.component.ts`, `assets.component.html`, `settings.component.html`, `snapshots.component.html`

All `| currency: 'AUD' : 'symbol' : '...'` become `| appCurrency:'...'`

### Templates — date pipe (1 instance)

File: `snapshots.component.html`

`| date: 'short'` becomes `| appDate:'short'`

### p-inputnumber components (~7 instances)

Files: `cashflow.component.html`, `settings.component.html`, `snapshots.component.html`, `record-value-dialog.component.ts`, `assets.component.html`, `liabilities.component.html`

Bind `[currency]="localeService.currency()"` and `[locale]="localeService.locale()"` instead of hardcoded `'AUD'` / `'en-AU'`.

### TypeScript — pdf-report.service.ts

- Inject `LocaleService`
- Replace hardcoded `'en-AU'` in `toLocaleDateString()` with `localeService.locale()`
- Replace hardcoded `'en-AU'` / `'AUD'` in `Intl.NumberFormat` with service values

### TypeScript — chart-options.ts

- Accept locale/currency as parameters instead of hardcoding `'$'`
- Use `Intl.NumberFormat` with the provided locale/currency for axis labels

### TypeScript — component chart configs

Files: `assets.component.ts`, `liabilities.component.ts`, `snapshots.component.ts`

Replace hardcoded `currency: 'AUD'` in chart tooltip/axis config with service value.

## 6. Setup Flow

Add a `locale` dropdown (same predefined options as settings) alongside the existing `currency` field in the setup component. Default: `'en-AU'`.

## Out of Scope

- Translated UI strings (English only)
- Per-asset or per-liability currency (already handled by existing `currency` field on those models)
- RTL layout support
- Additional locale registrations (Angular includes `en-US` by default; `en-AU`, `en-GB` etc. share the same base formatting via `Intl` APIs in the custom pipes)
