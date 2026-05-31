import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { LoginFacade } from './login.facade';
import { LoginResponse } from '../../core/types/auth.types';

describe('LoginFacade', () => {
  let facade: LoginFacade;
  let mockAuthService: { login: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  const adminResponse: LoginResponse = {
    accessToken: 'at-1',
    refreshToken: 'rt-1',
    tipoUsuario: 'ADMIN',
  };

  const clienteResponse: LoginResponse = {
    accessToken: 'at-2',
    refreshToken: 'rt-2',
    tipoUsuario: 'CLIENTE',
  };

  beforeEach(() => {
    mockAuthService = { login: vi.fn(), logout: vi.fn() };
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        LoginFacade,
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    facade = TestBed.inject(LoginFacade);
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty form state', async () => {
      const state = await firstValueFrom(facade.formState$);
      expect(state.email).toBe('');
      expect(state.password).toBe('');
      expect(state.keepConnected).toBe(false);
      expect(state.showPassword).toBe(false);
    });

    it('should have clean page state', async () => {
      const state = await firstValueFrom(facade.pageState$);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('updateForm', () => {
    it('should patch email', async () => {
      facade.updateForm({ email: 'test@example.com' });
      const state = await firstValueFrom(facade.formState$);
      expect(state.email).toBe('test@example.com');
    });

    it('should patch password', async () => {
      facade.updateForm({ password: 'secret' });
      const state = await firstValueFrom(facade.formState$);
      expect(state.password).toBe('secret');
    });

    it('should patch keepConnected', async () => {
      facade.updateForm({ keepConnected: true });
      const state = await firstValueFrom(facade.formState$);
      expect(state.keepConnected).toBe(true);
    });

    it('should merge partial updates', async () => {
      facade.updateForm({ email: 'a@b.com' });
      facade.updateForm({ password: 'pwd' });
      const state = await firstValueFrom(facade.formState$);
      expect(state.email).toBe('a@b.com');
      expect(state.password).toBe('pwd');
      expect(state.keepConnected).toBe(false);
    });
  });

  describe('toggleShowPassword', () => {
    it('should toggle from false to true', async () => {
      facade.toggleShowPassword();
      const state = await firstValueFrom(facade.formState$);
      expect(state.showPassword).toBe(true);
    });

    it('should toggle from true to false', async () => {
      facade.updateForm({ showPassword: true });
      facade.toggleShowPassword();
      const state = await firstValueFrom(facade.formState$);
      expect(state.showPassword).toBe(false);
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      facade.updateForm({ email: 'admin@nahora.com', password: 'pass' });
    });

    it('should call authService.login with correct credentials', async () => {
      mockAuthService.login.mockReturnValue(of(adminResponse));
      await firstValueFrom(facade.submit());
      expect(mockAuthService.login).toHaveBeenCalledWith({
        identificador: 'admin@nahora.com',
        senha: 'pass',
      });
    });

    it('should navigate to /dashboard on ADMIN response', async () => {
      mockAuthService.login.mockReturnValue(of(adminResponse));
      await firstValueFrom(facade.submit());
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should show error and logout on non-ADMIN response', async () => {
      mockAuthService.login.mockReturnValue(of(clienteResponse));
      const result = await firstValueFrom(facade.submit());
      expect(result).toBeNull();
      expect(mockAuthService.logout).toHaveBeenCalled();
    });

    it('should set error message on non-ADMIN', async () => {
      mockAuthService.login.mockReturnValue(of(clienteResponse));
      await firstValueFrom(facade.submit());
      const state = await firstValueFrom(facade.pageState$);
      expect(state.error).toBe('Acesso permitido apenas para administradores.');
    });

    it('should set error on 401', async () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 })),
      );
      await firstValueFrom(facade.submit());
      const state = await firstValueFrom(facade.pageState$);
      expect(state.error).toBe('E-mail ou senha inválidos.');
    });

    it('should set server error on 500', async () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      await firstValueFrom(facade.submit());
      const state = await firstValueFrom(facade.pageState$);
      expect(state.error).toBe('Erro do servidor (HTTP 500). Tente novamente.');
    });

    it('should set timeout error for non-HTTP errors', async () => {
      // RxJS TimeoutError is not an HttpErrorResponse
      const timeoutError = new Error('Timeout has occurred');
      timeoutError.name = 'TimeoutError';
      mockAuthService.login.mockReturnValue(throwError(() => timeoutError));
      await firstValueFrom(facade.submit());
      const state = await firstValueFrom(facade.pageState$);
      expect(state.error).toBe(
        'O servidor demorou muito para responder. Tente novamente.',
      );
    });

    it('should set network error when no response', async () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 0 })),
      );
      await firstValueFrom(facade.submit());
      const state = await firstValueFrom(facade.pageState$);
      expect(state.error).toContain('Sem conexão com o servidor');
    });
  });
});
