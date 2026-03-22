# Locale & Internationalisation Design

## Goal

Make all date and currency formatting in Clearfolio culture-specific, driven by a household-level `locale` and existing `baseCurrency` setting. English-only; no translated strings.

## 1. API & Database

Add a `locale` column (string, not null, default `'en-AU'`) to the `households` table.

- Add `Locale` property to the `Household` entity
- Add `locale` to `UpdateHouseholdRequest` DTO
- Add `locale` to `ExportHouseholdDto` — imports of old data without `locale` fall back to `'en-AU'`
- Validate `locale` on the API: must be one of the allowed values (`en-AU`, `en-US`, `en-GB`, `en-NZ`, `en-CA`, `en-IE`)
- Include `locale` in the setup (create household) flow
- Add an EF migration for the new column

## 2. Frontend LocaleService

New `LocaleService` (providedIn: root):

- Injects `ApiService`, fetches household on init
- Exposes two readonly signals:
  - `locale()` — e.g. `'en-AU'`, from `household.locale`
  - `currency()` — e.g. `'AUD'`, from `household.baseCurrency` (existing field)
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

### Templates — currency pipe

Files: `cashflow.component.html` (~17 instances), `net-worth-change.component.ts` (inline template, 1 instance), `assets.component.html` (1 instance), `settings.component.html` (goal inputs)

All `| currency: 'AUD' : 'symbol' : '...'` become `| appCurrency:'...'`

### Templates — date pipe (1 instance)

File: `snapshots.component.html`

`| date: 'short'` becomes `| appDate:'short'`

### CurrencyDisplayComponent

File: `currency-display.component.ts`

- Currently has `currency = input<string>('AUD')` with hardcoded default
- Inject `LocaleService`, use `localeService.currency()` as the default instead of `'AUD'`
- Used ~5 times in `dashboard.component.html`

### p-inputnumber components (~9 instances)

Files: `cashflow.component.html`, `settings.component.html`, `snapshots.component.html`, `record-value-dialog.component.ts`, `assets.component.html`, `liabilities.component.html`

Bind `[currency]="localeService.currency()"` and `[locale]="localeService.locale()"` instead of hardcoded `'AUD'` / `'en-AU'`.

For `record-value-dialog.component.ts`: inject `LocaleService` directly rather than relying on the parent-provided `currency` input for locale/currency binding. Keep the `currency` input for per-asset currency overrides.

### TypeScript — pdf-report.service.ts

- Inject `LocaleService`
- Replace hardcoded `'en-AU'` in `toLocaleDateString()` with `localeService.locale()`
- Replace hardcoded `'en-AU'` / `'AUD'` in `Intl.NumberFormat` with service values

### TypeScript — chart-options.ts

- Accept locale/currency as parameters instead of hardcoding `'$'`
- Use `Intl.NumberFormat` with the provided locale/currency for axis labels

### TypeScript — projection-chart-options.ts

- Same treatment as `chart-options.ts`: replace hardcoded `'$'` in `formatCurrency()` with `Intl.NumberFormat` using locale/currency parameters

### TypeScript — dashboard.component.ts

- Replace hardcoded `'$'` in milestone toast messages (e.g. `$500K`, `$1M`) with locale-aware currency symbol

### TypeScript — form default values

Files: `assets.component.ts`, `liabilities.component.ts`, `snapshots.component.ts`

Replace hardcoded `currency: 'AUD'` in new-entity form defaults with `localeService.currency()`.

### TypeScript — chart tooltip/axis configs

Files: `assets.component.ts`, `liabilities.component.ts`, `snapshots.component.ts`

Replace hardcoded `currency: 'AUD'` in chart config objects with `localeService.currency()`.

## 6. Setup Flow

Add a `locale` dropdown (same predefined options as settings) alongside the existing `currency` field in the setup component. Default: `'en-AU'`.

## Out of Scope

- Translated UI strings (English only)
- Per-asset or per-liability currency (already handled by existing `currency` field on those models)
- RTL layout support
- Locale-to-currency auto-mapping in setup (user picks both independently)
- Additional locale registrations (Angular includes `en-US` by default; `en-AU`, `en-GB` etc. share the same base formatting via `Intl` APIs in the custom pipes)
