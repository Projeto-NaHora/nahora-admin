import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/types/auth.types';

export interface LoginFormState {
  email: string;
  password: string;
  keepConnected: boolean;
  showPassword: boolean;
}

export interface LoginPageState {
  loading: boolean;
  error: string | null;
}

@Injectable()
export class LoginFacade {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly pageState = new BehaviorSubject<LoginPageState>({
    loading: false,
    error: null,
  });

  readonly pageState$: Observable<LoginPageState> = this.pageState.asObservable();

  readonly formState$ = new BehaviorSubject<LoginFormState>({
    email: '',
    password: '',
    keepConnected: false,
    showPassword: false,
  });

  updateForm(partial: Partial<LoginFormState>): void {
    this.formState$.next({ ...this.formState$.value, ...partial });
  }

  toggleShowPassword(): void {
    this.updateForm({ showPassword: !this.formState$.value.showPassword });
  }

  submit(): Observable<null> {
    this.pageState.next({ loading: true, error: null });

    const { email, password, keepConnected } = this.formState$.value;

    return this.authService.login({ identificador: email, senha: password }).pipe(
      switchMap((response) => {
        if (response.tipoUsuario !== 'ADMIN') {
          this.authService.logout();
          this.pageState.next({
            loading: false,
            error: 'Acesso permitido apenas para administradores.',
          });
          return of(null);
        }

        this.pageState.next({ loading: false, error: null });
        this.router.navigate(['/dashboard']);
        return of(null);
      }),
      catchError((err: unknown) => {
        let message: string;

        if (err instanceof HttpErrorResponse) {
          if (err.status === 401) {
            message = 'E-mail ou senha inválidos.';
          } else if (err.status === 0) {
            // Network-level error: CORS, connection refused, DNS failure, etc.
            message =
              'Sem conexão com o servidor. Verifique se o servidor está rodando ' +
              'e se o endereço está correto.';
          } else {
            message = `Erro do servidor (HTTP ${err.status}). Tente novamente.`;
          }
        } else {
          // Non-HTTP error (e.g. RxJS TimeoutError)
          message = 'O servidor demorou muito para responder. Tente novamente.';
        }

        this.pageState.next({ loading: false, error: message });
        return of(null);
      }),
    );
  }
}
