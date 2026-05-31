import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { LoginResponse } from '../types/auth.types';

describe('AuthService', () => {
  let service: AuthService;
  let mockHttp: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = { post: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: HttpClient, useValue: mockHttp },
      ],
    });
    service = TestBed.inject(AuthService);
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Token management ───────────────────────────────────────────────

  describe('getAccessToken', () => {
    it('should return the access token from localStorage', () => {
      localStorage.setItem('accessToken', 'at-abc');
      expect(service.getAccessToken()).toBe('at-abc');
    });

    it('should return null when no access token is stored', () => {
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return the refresh token from localStorage', () => {
      localStorage.setItem('refreshToken', 'rt-def');
      expect(service.getRefreshToken()).toBe('rt-def');
    });

    it('should return null when no refresh token is stored', () => {
      expect(service.getRefreshToken()).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('should store both tokens in localStorage', () => {
      service.setTokens('at-new', 'rt-new');
      expect(localStorage.getItem('accessToken')).toBe('at-new');
      expect(localStorage.getItem('refreshToken')).toBe('rt-new');
    });
  });

  describe('clearTokens', () => {
    it('should remove both tokens from localStorage', () => {
      localStorage.setItem('accessToken', 'at');
      localStorage.setItem('refreshToken', 'rt');
      service.clearTokens();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should call POST /auth/refresh with the stored refresh token', async () => {
      localStorage.setItem('refreshToken', 'rt-old');
      const mockTokenPair = { accessToken: 'at-new', refreshToken: 'rt-new' };
      mockHttp.post.mockReturnValue(of(mockTokenPair));

      const result = await firstValueFrom(service.refreshToken());

      expect(mockHttp.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'rt-old',
      });
      expect(result).toEqual(mockTokenPair);
    });

    it('should store the new tokens on success', async () => {
      localStorage.setItem('refreshToken', 'rt-old');
      const mockTokenPair = { accessToken: 'at-new', refreshToken: 'rt-new' };
      mockHttp.post.mockReturnValue(of(mockTokenPair));

      await firstValueFrom(service.refreshToken());

      expect(localStorage.getItem('accessToken')).toBe('at-new');
      expect(localStorage.getItem('refreshToken')).toBe('rt-new');
    });

    it('should throw when no refresh token is available', async () => {
      await expect(firstValueFrom(service.refreshToken())).rejects.toThrow(
        'No refresh token available',
      );
    });

    it('should propagate API errors', async () => {
      localStorage.setItem('refreshToken', 'rt-old');
      const apiError = new Error('Session expired');
      mockHttp.post.mockReturnValue(throwError(() => apiError));

      await expect(firstValueFrom(service.refreshToken())).rejects.toBe(apiError);
    });
  });

  // ── Auth actions ────────────────────────────────────────────────────

  describe('login', () => {
    it('should call POST /auth/login with credentials', async () => {
      const mockResponse: LoginResponse = {
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        tipoUsuario: 'ADMIN',
      };
      mockHttp.post.mockReturnValue(of(mockResponse));

      const result = await firstValueFrom(
        service.login({ identificador: 'admin@nahora.com', senha: 'pass123' }),
      );

      expect(mockHttp.post).toHaveBeenCalledWith('/auth/login', {
        identificador: 'admin@nahora.com',
        senha: 'pass123',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should store tokens on successful login', async () => {
      const mockResponse: LoginResponse = {
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        tipoUsuario: 'ADMIN',
      };
      mockHttp.post.mockReturnValue(of(mockResponse));

      await firstValueFrom(
        service.login({ identificador: 'admin@nahora.com', senha: 'pass123' }),
      );

      expect(localStorage.getItem('accessToken')).toBe('at-123');
      expect(localStorage.getItem('refreshToken')).toBe('rt-456');
    });

    it('should propagate errors from the API', async () => {
      const apiError = new Error('Unauthorized');
      mockHttp.post.mockReturnValue(throwError(() => apiError));

      await expect(
        firstValueFrom(service.login({ identificador: 'a@b.com', senha: 'x' })),
      ).rejects.toBe(apiError);
    });
  });

  describe('logout', () => {
    it('should remove tokens from localStorage', () => {
      localStorage.setItem('accessToken', 'abc');
      localStorage.setItem('refreshToken', 'def');
      service.logout();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when accessToken exists', () => {
      localStorage.setItem('accessToken', 'abc');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when accessToken does not exist', () => {
      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
