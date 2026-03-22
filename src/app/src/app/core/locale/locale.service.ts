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
