# Locale Internationalisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all date and currency formatting culture-specific, driven by household-level `locale` and `baseCurrency` settings.

**Architecture:** Add a `locale` field to the Household entity (API + DB). Create a frontend `LocaleService` that exposes `locale()` and `currency()` signals from the household. Create `AppCurrencyPipe` and `AppDatePipe` that auto-inject these values. Replace all hardcoded `'AUD'`, `'en-AU'`, and `'$'` references across the app.

**Tech Stack:** .NET 9 / EF Core (SQLite), Angular 19, PrimeNG, Chart.js

**Spec:** `docs/superpowers/specs/2026-03-22-locale-internationalisation-design.md`

---

### Task 1: Add `locale` to API — Entity, DTOs, DbContext

**Files:**
- Modify: `src/api/Clearfolio.Api/Models/Household.cs:8` — add Locale property
- Modify: `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs:30-31` — add column mapping
- Modify: `src/api/Clearfolio.Api/DTOs/HouseholdDto.cs:5-15` — add Locale to both DTOs
- Modify: `src/api/Clearfolio.Api/DTOs/SetupRequest.cs:5-9` — add Locale field
- Modify: `src/api/Clearfolio.Api/DTOs/ExportDto.cs:15-18` — add Locale to ExportHouseholdDto

- [ ] **Step 1: Add `Locale` property to Household entity**

In `src/api/Clearfolio.Api/Models/Household.cs`, add after line 8 (`PreferredPeriodType`):
```csharp
public string Locale { get; set; } = "en-AU";
```

- [ ] **Step 2: Add column mapping in DbContext**

In `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs`, add after the `PreferredPeriodType` mapping (line 30), before `CreatedAt`:
```csharp
e.Property(h => h.Locale).HasColumnName("locale").HasDefaultValue("en-AU");
```

- [ ] **Step 3: Add `Locale` to HouseholdDto and UpdateHouseholdRequest**

In `src/api/Clearfolio.Api/DTOs/HouseholdDto.cs`:

Update `HouseholdDto` (line 5-10):
```csharp
public record HouseholdDto(
    Guid Id,
    string Name,
    string BaseCurrency,
    string PreferredPeriodType,
    string Locale,
    string CreatedAt);
```

Update `UpdateHouseholdRequest` (line 12-15):
```csharp
public record UpdateHouseholdRequest(
    [Required, StringLength(100)] string Name,
    [Required, StringLength(10)] string BaseCurrency,
    [Required, StringLength(2)] string PreferredPeriodType,
    [Required, StringLength(10)] string Locale);
```

- [ ] **Step 4: Add `Locale` to SetupRequest**

In `src/api/Clearfolio.Api/DTOs/SetupRequest.cs`:
```csharp
public record SetupRequest(
    [Required, StringLength(100)] string DisplayName,
    [StringLength(100)] string? HouseholdName,
    [StringLength(10)] string? Currency,
    [StringLength(2)] string? PeriodType,
    [StringLength(10)] string? Locale);
```

- [ ] **Step 5: Add `Locale` to ExportHouseholdDto**

In `src/api/Clearfolio.Api/DTOs/ExportDto.cs`, update lines 15-18:
```csharp
public record ExportHouseholdDto(
    string Name,
    string BaseCurrency,
    string PreferredPeriodType,
    string? Locale);
```

Note: `Locale` is nullable here for backward compatibility with old exports that lack it.

- [ ] **Step 6: Commit**

```bash
git add src/api/Clearfolio.Api/Models/Household.cs src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs src/api/Clearfolio.Api/DTOs/HouseholdDto.cs src/api/Clearfolio.Api/DTOs/SetupRequest.cs src/api/Clearfolio.Api/DTOs/ExportDto.cs
git commit -m "feat(api): add locale field to household entity and DTOs"
```

---

### Task 2: Update API endpoints to use `locale`

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs:27,37-43,127,188-190`
- Modify: `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs:62-69`

- [ ] **Step 1: Update GetHousehold to include Locale**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, line 27:
```csharp
return Results.Ok(new HouseholdDto(h.Id, h.Name, h.BaseCurrency, h.PreferredPeriodType, h.Locale, h.CreatedAt));
```

- [ ] **Step 2: Update UpdateHousehold to set Locale**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, add after line 39 (`household.PreferredPeriodType = ...`):
```csharp
household.Locale = request.Locale;
```

Update the return on line 43:
```csharp
return Results.Ok(new HouseholdDto(household.Id, household.Name, household.BaseCurrency, household.PreferredPeriodType, household.Locale, household.CreatedAt));
```

- [ ] **Step 3: Update ExportData to include Locale**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, line 127:
```csharp
Household: new ExportHouseholdDto(household.Name, household.BaseCurrency, household.PreferredPeriodType, household.Locale),
```

- [ ] **Step 4: Update ImportData to restore Locale**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, add after line 190 (`household.PreferredPeriodType = ...`):
```csharp
household.Locale = data.Household.Locale ?? "en-AU";
```

- [ ] **Step 5: Add locale validation to UpdateHousehold endpoint**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, add validation at the start of the `UpdateHousehold` method (after the null check for `household`, before setting properties):
```csharp
string[] allowedLocales = ["en-AU", "en-US", "en-GB", "en-NZ", "en-CA", "en-IE"];
if (!allowedLocales.Contains(request.Locale))
    return ApiErrors.BadRequest("Invalid locale. Allowed values: en-AU, en-US, en-GB, en-NZ, en-CA, en-IE.");
```

- [ ] **Step 6: Update SetupMember to accept Locale**

In `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs`, update the household creation (lines 62-69):
```csharp
var household = new Household
{
    Id = Guid.NewGuid(),
    Name = request.HouseholdName ?? "My Household",
    BaseCurrency = request.Currency ?? "AUD",
    PreferredPeriodType = request.PeriodType ?? "FY",
    Locale = request.Locale ?? "en-AU",
    CreatedAt = DateTime.UtcNow.ToString("o")
};
```

- [ ] **Step 7: Build and verify**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs
git commit -m "feat(api): wire locale through household endpoints and setup"
```

---

### Task 3: Add EF migration for locale column

**Files:**
- Create: New migration files under `src/api/Clearfolio.Api/Migrations/`

- [ ] **Step 1: Generate migration**

```bash
cd src/api/Clearfolio.Api && dotnet ef migrations add AddHouseholdLocale
```

- [ ] **Step 2: Review the generated migration**

Open the generated migration file and verify it adds a `locale` column with default value `'en-AU'`.

- [ ] **Step 3: Commit**

```bash
git add src/api/Clearfolio.Api/Migrations/
git commit -m "feat(api): add migration for household locale column"
```

---

### Task 4: Update frontend models and API service

**Files:**
- Modify: `src/app/src/app/core/api/models.ts:1-13` — add locale to Household and UpdateHouseholdRequest
- Modify: `src/app/src/app/core/api/api.service.ts:140-142` — add locale to setup method

- [ ] **Step 1: Add `locale` to frontend Household interface**

In `src/app/src/app/core/api/models.ts`, update lines 1-7:
```typescript
export interface Household {
  id: string;
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
  locale: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add `locale` to UpdateHouseholdRequest**

In `src/app/src/app/core/api/models.ts`, update lines 9-13:
```typescript
export interface UpdateHouseholdRequest {
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
  locale: string;
}
```

- [ ] **Step 3: Add `locale` to API setup method**

In `src/app/src/app/core/api/api.service.ts`, update line 140-141:
```typescript
setup(displayName: string, householdName?: string, currency?: string, periodType?: string, locale?: string) {
  return this.http.post<Member>('/api/members/setup', { displayName, householdName, currency, periodType, locale });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/core/api/models.ts src/app/src/app/core/api/api.service.ts
git commit -m "feat(app): add locale to frontend household model and API service"
```

---

### Task 5: Create LocaleService

**Files:**
- Create: `src/app/src/app/core/locale/locale.service.ts`

- [ ] **Step 1: Create the LocaleService**

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private api = inject(ApiService);

  private _locale = signal('en-AU');
  private _currency = signal('AUD');

  readonly locale = this._locale.asReadonly();
  readonly currency = this._currency.asReadonly();

  init() {
    this.api.getHousehold().subscribe((h) => {
      this._locale.set(h.locale || 'en-AU');
      this._currency.set(h.baseCurrency || 'AUD');
    });
  }

  update(locale: string, currency: string) {
    this._locale.set(locale);
    this._currency.set(currency);
  }
}
```

- [ ] **Step 2: Initialize LocaleService on app startup**

In `src/app/src/app/app.ts`, `AuthService.init()` is called at line 152. Add `LocaleService` init immediately after it:

```typescript
import { LocaleService } from './core/locale/locale.service';
```

Add injection alongside existing services:
```typescript
private localeService = inject(LocaleService);
```

At line 153 (after `this.auth.init()`), add:
```typescript
this.localeService.init();
```

- [ ] **Step 3: Commit**

```bash
git add src/app/src/app/core/locale/locale.service.ts src/app/src/app/app.ts
git commit -m "feat(app): create LocaleService for reactive locale/currency signals"
```

---

### Task 6: Create AppCurrencyPipe and AppDatePipe

**Files:**
- Create: `src/app/src/app/shared/pipes/app-currency.pipe.ts`
- Create: `src/app/src/app/shared/pipes/app-date.pipe.ts`

- [ ] **Step 1: Create AppCurrencyPipe**

```typescript
import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LocaleService } from '../../core/locale/locale.service';

@Pipe({ name: 'appCurrency', standalone: true })
export class AppCurrencyPipe implements PipeTransform {
  private currencyPipe = new CurrencyPipe('en');
  private localeService = inject(LocaleService);

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    return this.currencyPipe.transform(
      value,
      this.localeService.currency(),
      'symbol',
      digitsInfo ?? '1.2-2',
      this.localeService.locale()
    );
  }
}
```

- [ ] **Step 2: Create AppDatePipe**

```typescript
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LocaleService } from '../../core/locale/locale.service';

@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  private datePipe = new DatePipe('en');
  private localeService = inject(LocaleService);

  transform(value: string | number | Date | null | undefined, format?: string): string | null {
    return this.datePipe.transform(value, format ?? 'mediumDate', undefined, this.localeService.locale());
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/src/app/shared/pipes/
git commit -m "feat(app): add AppCurrencyPipe and AppDatePipe with locale injection"
```

---

### Task 7: Update settings UI — add locale dropdown and wire LocaleService

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.ts` — add locale options, update saveHousehold
- Modify: `src/app/src/app/features/settings/settings.component.html` — add locale dropdown to Household tab, add locale to updateHousehold call

- [ ] **Step 1: Add locale options and inject LocaleService in settings component**

In `src/app/src/app/features/settings/settings.component.ts`, add import:
```typescript
import { LocaleService } from '../../core/locale/locale.service';
```

Add injection:
```typescript
private localeService = inject(LocaleService);
```

Add locale options array (near the existing `periodOptions`):
```typescript
protected localeOptions = [
  { label: 'Australia (en-AU)', value: 'en-AU' },
  { label: 'United States (en-US)', value: 'en-US' },
  { label: 'United Kingdom (en-GB)', value: 'en-GB' },
  { label: 'New Zealand (en-NZ)', value: 'en-NZ' },
  { label: 'Canada (en-CA)', value: 'en-CA' },
  { label: 'Ireland (en-IE)', value: 'en-IE' },
];
```

- [ ] **Step 2: Update saveHousehold to include locale and notify LocaleService**

In `src/app/src/app/features/settings/settings.component.ts`, update `saveHousehold()` method. The `updateHousehold` call (around line 477) should include `locale`:
```typescript
saveHousehold() {
  const h = this.household();
  if (!h) return;
  this.api
    .updateHousehold({
      name: h.name,
      baseCurrency: h.baseCurrency,
      preferredPeriodType: h.preferredPeriodType,
      locale: h.locale,
    })
    .subscribe((updated) => {
      this.household.set(updated);
      this.localeService.update(updated.locale, updated.baseCurrency);
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Household settings updated' });
    });
}
```

- [ ] **Step 3: Add locale dropdown to settings HTML**

In `src/app/src/app/features/settings/settings.component.html`, add after the Period Type select in the Household tab (after the `p-select` for period):
```html
<label for="locale">Locale</label>
<p-select
  id="locale"
  [(ngModel)]="h.locale"
  [options]="localeOptions"
  optionLabel="label"
  optionValue="value"
/>
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd src/app && npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/features/settings/
git commit -m "feat(app): add locale dropdown to household settings and wire LocaleService"
```

---

### Task 8: Update setup flow with locale

**Files:**
- Modify: `src/app/src/app/features/setup/setup.component.ts:14,25-26,29-32,39-44`
- Modify: `src/app/src/app/features/setup/setup.component.html:30-31`

- [ ] **Step 1: Add locale model and options to setup component**

In `src/app/src/app/features/setup/setup.component.ts`:

Add `Select` import:
```typescript
import { Select } from 'primeng/select';
```

Update imports array to include `Select`:
```typescript
imports: [FormsModule, InputText, Button, SelectButton, Select],
```

Add locale model (after line 26):
```typescript
protected locale = model('en-AU');
```

Add locale options (after `periodOptions`):
```typescript
protected localeOptions = [
  { label: 'Australia (en-AU)', value: 'en-AU' },
  { label: 'United States (en-US)', value: 'en-US' },
  { label: 'United Kingdom (en-GB)', value: 'en-GB' },
  { label: 'New Zealand (en-NZ)', value: 'en-NZ' },
  { label: 'Canada (en-CA)', value: 'en-CA' },
  { label: 'Ireland (en-IE)', value: 'en-IE' },
];
```

- [ ] **Step 2: Pass locale to API setup call**

In `src/app/src/app/features/setup/setup.component.ts`, update the `submit()` method (lines 39-44):
```typescript
await firstValueFrom(this.api.setup(
  name,
  this.householdName().trim() || undefined,
  this.currency() || undefined,
  this.periodType() || undefined,
  this.locale() || undefined
));
```

- [ ] **Step 3: Add locale dropdown to setup HTML**

In `src/app/src/app/features/setup/setup.component.html`, add after the currency input (after line 31):
```html
<label for="locale">Locale</label>
<p-select id="locale" [(ngModel)]="locale" [options]="localeOptions" optionLabel="label" optionValue="value" />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/features/setup/
git commit -m "feat(app): add locale selection to setup flow"
```

---

### Task 9: Replace hardcoded currency pipes in cashflow

**Files:**
- Modify: `src/app/src/app/features/cashflow/cashflow.component.html` — replace all `| currency: 'AUD' : 'symbol' : '1.0-0'` with `| appCurrency:'1.0-0'`
- Modify: `src/app/src/app/features/cashflow/cashflow.component.ts` — add AppCurrencyPipe import, inject LocaleService for p-inputnumber bindings

- [ ] **Step 1: Add imports to cashflow component**

In the cashflow component `.ts` file, add `AppCurrencyPipe` to imports and inject `LocaleService`:
```typescript
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { LocaleService } from '../../core/locale/locale.service';
```

Add to component imports array: `AppCurrencyPipe`

Add injection:
```typescript
protected localeService = inject(LocaleService);
```

- [ ] **Step 2: Replace all currency pipe instances in cashflow HTML**

Replace all instances of `| currency: 'AUD' : 'symbol' : '1.0-0'` with `| appCurrency:'1.0-0'` across lines 23, 27, 31, 35, 54, 57, 123, 125, 135, 199, 201, 212, 220, 267, 269, 280.

- [ ] **Step 3: Replace hardcoded p-inputnumber currency/locale**

On lines 326 and 388, replace `currency="AUD"` with `[currency]="localeService.currency()"` and add `[locale]="localeService.locale()"`.

- [ ] **Step 4: Verify build**

Run: `cd src/app && npx ng build --configuration development 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/features/cashflow/
git commit -m "feat(app): replace hardcoded AUD with locale-aware pipes in cashflow"
```

---

### Task 10: Replace hardcoded references in shared components

**Files:**
- Modify: `src/app/src/app/shared/components/net-worth-change.component.ts` — replace `| currency: 'AUD'` with `| appCurrency`
- Modify: `src/app/src/app/shared/components/currency-display.component.ts` — inject LocaleService, use as default
- Modify: `src/app/src/app/shared/components/record-value-dialog.component.ts` — inject LocaleService, bind p-inputnumber

- [ ] **Step 1: Update net-worth-change.component.ts**

Replace the inline template currency pipe. Change:
```
{{ absChange() | currency: 'AUD' : 'symbol-narrow' : '1.0-0' }}
```
to:
```
{{ absChange() | appCurrency:'1.0-0' }}
```

Add `AppCurrencyPipe` to the component's imports array.

- [ ] **Step 2: Update currency-display.component.ts**

Replace the `CurrencyPipe` usage with `AppCurrencyPipe`. The component currently has:
```typescript
template: `<span [class]="cssClass()">{{ value() | currency: currency() : 'symbol-narrow' : '1.0-0' }}</span>`,
```

Since the component accepts a `currency` input for per-asset currencies, replace the template with:
```typescript
template: `<span [class]="cssClass()">{{ value() | currency: effectiveCurrency() : 'symbol-narrow' : '1.0-0' : effectiveLocale() }}</span>`,
```

Add `LocaleService` injection and a computed for the effective values:
```typescript
private localeService = inject(LocaleService);
protected effectiveCurrency = computed(() => this.currency() || this.localeService.currency());
protected effectiveLocale = computed(() => this.localeService.locale());
```

Change the `currency` input default from `'AUD'` to `''` (empty string, so the computed falls through to localeService):
```typescript
currency = input<string>('');
```

- [ ] **Step 3: Update record-value-dialog.component.ts**

Inject `LocaleService` as `protected localeService`:
```typescript
protected localeService = inject(LocaleService);
```

In the inline template, replace:
```html
currency="AUD"
locale="en-AU"
```
with:
```html
[currency]="localeService.currency()"
[locale]="localeService.locale()"
```

Remove the `currency` input default `'AUD'` — the component uses `localeService.currency()` for display. Keep the `currency` input for the save call (line 123: `currency: this.currency()`), but change the default:
```typescript
currency = input<string>('');
```
Update the save call to fall back to locale service:
```typescript
currency: this.currency() || this.localeService.currency(),
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/shared/components/
git commit -m "feat(app): replace hardcoded AUD in shared components with locale service"
```

---

### Task 11: Replace hardcoded references in settings, snapshots, assets, liabilities

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.html` — bind p-inputnumber locale/currency
- Modify: `src/app/src/app/features/snapshots/snapshots.component.html` — bind p-inputnumber, replace date pipe
- Modify: `src/app/src/app/features/snapshots/snapshots.component.ts:334` — form default currency
- Modify: `src/app/src/app/features/assets/assets.component.ts:219` — form default currency
- Modify: `src/app/src/app/features/assets/assets.component.html:169` — p-inputnumber binding
- Modify: `src/app/src/app/features/liabilities/liabilities.component.ts:162` — form default currency
- Modify: `src/app/src/app/features/liabilities/liabilities.component.html:140` — p-inputnumber binding

- [ ] **Step 1: Update settings p-inputnumber bindings**

In `src/app/src/app/features/settings/settings.component.html`, replace the goals `p-inputnumber` components. Change `currency="AUD" locale="en-AU"` to `[currency]="localeService.currency()" [locale]="localeService.locale()"`. Expose `localeService` as protected in the settings component.

- [ ] **Step 2: Update snapshots**

In `snapshots.component.html`, replace `currency="AUD" locale="en-AU"` on the p-inputnumber with locale service bindings. Replace `| date: 'short'` with `| appDate:'short'`.

In `snapshots.component.ts`, inject `LocaleService`, add `AppDatePipe` and `AppCurrencyPipe` to imports. Replace `currency: 'AUD'` on line 334 with `currency: this.localeService.currency()`.

- [ ] **Step 3: Update assets**

In `assets.component.ts`, inject `LocaleService`. Replace `currency: 'AUD'` on line 219 with `currency: this.localeService.currency()`.

In `assets.component.html`, update the p-inputnumber fallback from `'AUD'` to `localeService.currency()`.

- [ ] **Step 4: Update liabilities**

In `liabilities.component.ts`, inject `LocaleService`. Replace `currency: 'AUD'` on line 162 with `currency: this.localeService.currency()`.

In `liabilities.component.html`, update the p-inputnumber fallback from `'AUD'` to `localeService.currency()`.

- [ ] **Step 5: Verify build**

Run: `cd src/app && npx ng build --configuration development 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/features/settings/ src/app/src/app/features/snapshots/ src/app/src/app/features/assets/ src/app/src/app/features/liabilities/
git commit -m "feat(app): replace hardcoded AUD/en-AU in settings, snapshots, assets, liabilities"
```

---

### Task 12: Update chart formatting functions

**Files:**
- Modify: `src/app/src/app/features/dashboard/chart-options.ts:44-53` — parameterise currency
- Modify: `src/app/src/app/features/projections/projection-chart-options.ts:4-16` — parameterise currency
- Modify: `src/app/src/app/features/dashboard/dashboard.component.ts:191-192` — milestone formatting
- Modify: All component files that call these chart-options functions — pass locale/currency

- [ ] **Step 1: Update chart-options.ts**

Change `currencyFormatter` and `currencyAbbr` to accept `locale` and `currency` parameters:
```typescript
function currencyFormatter(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(value));
}

function currencyAbbr(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value);
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(0).replace(/[\d.,\s]/g, '').trim();
  if (abs >= 1_000_000) return symbol + (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return symbol + (value / 1_000).toFixed(0) + 'K';
  return symbol + Math.round(value).toString();
}
```

Update the functions/factories that call these to accept and pass through locale/currency.

- [ ] **Step 2: Update projection-chart-options.ts**

Apply the same pattern to `formatCurrency`:
```typescript
export function formatCurrency(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(0).replace(/[\d.,\s]/g, '').trim();
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${symbol}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}
```

- [ ] **Step 3: Update dashboard milestone formatting**

In `dashboard.component.ts`, inject `LocaleService`. Replace lines 191-192 with locale-aware formatting:
```typescript
const symbol = new Intl.NumberFormat(this.localeService.locale(), {
  style: 'currency', currency: this.localeService.currency(), maximumFractionDigits: 0
}).format(0).replace(/[\d.,\s]/g, '').trim();
const formatted = crossedMilestone >= 1000000
  ? `${symbol}${(crossedMilestone / 1000000).toFixed(crossedMilestone % 1000000 === 0 ? 0 : 1)}M`
  : `${symbol}${(crossedMilestone / 1000).toFixed(0)}K`;
```

- [ ] **Step 4: Update all callers of chart-options functions**

Update dashboard, assets, liabilities, snapshots, and projections components to inject `LocaleService` and pass `localeService.locale()` and `localeService.currency()` when calling chart option builder functions.

- [ ] **Step 5: Verify build**

Run: `cd src/app && npx ng build --configuration development 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/features/dashboard/ src/app/src/app/features/projections/ src/app/src/app/features/assets/ src/app/src/app/features/liabilities/ src/app/src/app/features/snapshots/
git commit -m "feat(app): replace hardcoded $ with locale-aware currency in charts and milestones"
```

---

### Task 13: Update pdf-report.service.ts

**Files:**
- Modify: `src/app/src/app/core/pdf-report.service.ts:111,670-675`

- [ ] **Step 1: Inject LocaleService**

Add `LocaleService` injection to the pdf report service.

- [ ] **Step 2: Replace hardcoded locale in date formatting**

Line 111: Replace `'en-AU'` in `toLocaleDateString()` with `this.localeService.locale()`.

- [ ] **Step 3: Replace hardcoded locale/currency in Intl.NumberFormat**

Lines 670-675: Replace:
```typescript
new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
```
with:
```typescript
new Intl.NumberFormat(this.localeService.locale(), {
  style: 'currency',
  currency: this.localeService.currency(),
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/core/pdf-report.service.ts
git commit -m "feat(app): replace hardcoded en-AU/AUD in PDF report service with locale service"
```

---

### Task 14: Update frontend export/import to include locale

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.ts` — export/import goals with locale awareness

- [ ] **Step 1: Update export to include locale from goals**

The export already goes through the API which now includes locale. Verify no frontend-side changes needed beyond what was already done in Task 7.

- [ ] **Step 2: Update import to restore LocaleService**

In the `onImportFile` handler, after import completes, refresh the locale service:
```typescript
this.localeService.init();
```

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/app/src/app/features/settings/settings.component.ts
git commit -m "feat(app): refresh locale service on data import"
```

---

### Task 15: End-to-end verification

- [ ] **Step 1: Build API**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeds.

- [ ] **Step 2: Build frontend**

Run: `cd src/app && npx ng build --configuration development`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Search for remaining hardcoded references**

Run grep for any remaining `'AUD'`, `'en-AU'`, or standalone `'$'` in templates and TypeScript (excluding test files, node_modules):
```bash
grep -rn "'AUD'\|\"AUD\"\|'en-AU'\|\"en-AU\"" src/app/src/app/ --include="*.ts" --include="*.html" | grep -v node_modules | grep -v '.spec.'
```

Expected: No results (or only the `localeOptions` arrays and the `LocaleService` defaults).

- [ ] **Step 4: Commit any final fixes**

If any remaining references found, fix and commit.
