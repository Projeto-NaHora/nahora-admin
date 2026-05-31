import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfessionalService } from '../../core/services/professional.service';
import { PagedResponse, Professional } from '../../core/types/professional.types';

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  start: number;
  end: number;
}

@Injectable()
export class DashboardFacade {
  private readonly professionalService = inject(ProfessionalService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ── Search stream ──────────────────────────────────────────────
  private readonly search$ = new BehaviorSubject<string>('');

  // ── Page trigger ───────────────────────────────────────────────
  private readonly pageTrigger$ = new BehaviorSubject<number>(0);

  // ── Loading state ─────────────────────────────────────────────
  private readonly loading$ = new BehaviorSubject<boolean>(false);

  // ── Error state ────────────────────────────────────────────────
  private readonly error$ = new BehaviorSubject<string | null>(null);

  // ── Approving/rejecting row tracking ──────────────────────────
  private readonly processingIds$ = new BehaviorSubject<Set<number>>(new Set());

  // ── Data fetch ─────────────────────────────────────────────────
  private readonly rawResponse$ = combineLatest([
    this.pageTrigger$,
    this.search$.pipe(debounceTime(300), distinctUntilChanged()),
  ]).pipe(
    switchMap(([page, search]) => {
      this.loading$.next(true);
      this.error$.next(null);

      return this.professionalService.getPending(page, 5).pipe(
        map((response) => ({
          response,
          search,
          page,
        })),
        catchError(() => {
          this.error$.next('Erro ao carregar profissionais.');
          return EMPTY;
        }),
        finalize(() => this.loading$.next(false)),
      );
    }),
    shareReplay(1),
  );

  // ── Filtered content (client-side search) ─────────────────────
  readonly professionals$ = this.rawResponse$.pipe(
    map(({ response, search }) => {
      if (!search.trim()) {
        return response.content;
      }

      const term = search.toLowerCase();
      return response.content.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          String(p.id).includes(term),
      );
    }),
  );

  // ── Pagination info ────────────────────────────────────────────
  readonly pagination$ = this.rawResponse$.pipe(
    map(({ response }) => {
      const { number: currentPage, totalPages, totalElements, size: pageSize } = response;
      const start = currentPage * pageSize + 1;
      const end = Math.min((currentPage + 1) * pageSize, totalElements);

      return { currentPage, totalPages, totalElements, pageSize, start, end };
    }),
  );

  readonly pageLoading$ = this.loading$.asObservable();
  readonly pageError$ = this.error$.asObservable();
  readonly pendingCount$ = this.rawResponse$.pipe(
    map(({ response }) => response.totalElements),
  );
  readonly processingIds = this.processingIds$.asObservable();

  // ── Actions ────────────────────────────────────────────────────

  loadPage(page: number): void {
    this.pageTrigger$.next(page);
  }

  search(term: string): void {
    this.search$.next(term);
    this.pageTrigger$.next(0);
  }

  previousPage(currentPage: number): void {
    if (currentPage > 0) {
      this.pageTrigger$.next(currentPage - 1);
    }
  }

  nextPage(currentPage: number, totalPages: number): void {
    if (currentPage < totalPages - 1) {
      this.pageTrigger$.next(currentPage + 1);
    }
  }

  approveProfessional(id: number): void {
    this.setProcessing(id, true);

    this.professionalService.verifyProfessional(id, true).subscribe({
      next: () => {
        this.setProcessing(id, false);
        this.loadPage(this.pageTrigger$.value);
      },
      error: () => {
        this.setProcessing(id, false);
        this.error$.next('Erro ao aprovar profissional.');
      },
    });
  }

  rejectProfessional(id: number): void {
    this.setProcessing(id, true);

    this.professionalService.verifyProfessional(id, false).subscribe({
      next: () => {
        this.setProcessing(id, false);
        this.loadPage(this.pageTrigger$.value);
      },
      error: () => {
        this.setProcessing(id, false);
        this.error$.next('Erro ao rejeitar profissional.');
      },
    });
  }

  goToDetail(professional: Professional): void {
    this.router.navigate(['/dashboard', professional.id], {
      state: { professional },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ── Private helpers ────────────────────────────────────────────

  private setProcessing(id: number, processing: boolean): void {
    this.processingIds$.next(
      processing
        ? new Set(this.processingIds$.value).add(id)
        : (() => {
            const next = new Set(this.processingIds$.value);
            next.delete(id);
            return next;
          })(),
    );
  }
}
