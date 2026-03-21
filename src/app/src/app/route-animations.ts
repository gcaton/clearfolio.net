import { trigger, transition, style, animate, query } from '@angular/animations';

export const routeAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0 }),
    ], { optional: true }),
    query(':leave', [
      style({ position: 'absolute', width: '100%', opacity: 1 }),
      animate('120ms ease-out', style({ opacity: 0 })),
    ], { optional: true }),
    query(':enter', [
      animate('200ms ease-out', style({ opacity: 1 })),
    ], { optional: true }),
  ]),
]);
