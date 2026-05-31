import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';

import { ProfessionalDetailFacade } from './professional-detail.facade';

@Component({
  selector: 'app-professional-detail',
  imports: [AsyncPipe],
  templateUrl: './professional-detail.component.html',
  styleUrl: './professional-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfessionalDetailFacade],
})
export class ProfessionalDetailComponent {
  protected readonly facade = inject(ProfessionalDetailFacade);

  protected getInitials(name: string): string {
    const parts = name?.trim().split(' ') ?? [];
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
}
