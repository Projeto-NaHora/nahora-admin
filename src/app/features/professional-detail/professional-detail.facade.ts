import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfessionalService } from '../../core/services/professional.service';
import { Professional } from '../../core/types/professional.types';

@Injectable()
export class ProfessionalDetailFacade {
  private readonly authService = inject(AuthService);
  private readonly professionalService = inject(ProfessionalService);
  private readonly router = inject(Router);

  readonly professional: Professional;

  private readonly verifying$ = new BehaviorSubject<boolean>(false);
  readonly verifying = this.verifying$.asObservable();

  private readonly error$ = new BehaviorSubject<string | null>(null);
  readonly error = this.error$.asObservable();

  private readonly previewImage$ = new BehaviorSubject<string | null>(null);
  readonly previewImage = this.previewImage$.asObservable();

  constructor() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state?.['professional'] as Professional | undefined;

    if (!state) {
      this.router.navigate(['/dashboard']);
      // Dummy professional — won't render because navigation redirects
      this.professional = {} as Professional;
      return;
    }

    this.professional = state;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  approve(): void {
    this.verifying$.next(true);
    this.error$.next(null);

    this.professionalService.verifyProfessional(this.professional.id, true).subscribe({
      next: () => {
        this.verifying$.next(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.verifying$.next(false);
        this.error$.next('Erro ao aprovar cadastro.');
      },
    });
  }

  reject(): void {
    this.verifying$.next(true);
    this.error$.next(null);

    this.professionalService.verifyProfessional(this.professional.id, false).subscribe({
      next: () => {
        this.verifying$.next(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.verifying$.next(false);
        this.error$.next('Erro ao rejeitar cadastro.');
      },
    });
  }

  openPreview(url: string): void {
    this.previewImage$.next(url);
  }

  closePreview(): void {
    this.previewImage$.next(null);
  }

  formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }
}
