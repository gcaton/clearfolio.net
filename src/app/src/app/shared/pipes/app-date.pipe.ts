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
