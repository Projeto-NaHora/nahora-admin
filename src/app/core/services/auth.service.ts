import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';

import { LoginRequest, LoginResponse } from '../types/auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // ── Token management ─────────────────────────────────────────────

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  refreshToken(): Observable<{ accessToken: string; refreshToken: string }> {
    const currentRefreshToken = this.getRefreshToken();

    if (!currentRefreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        refreshToken: currentRefreshToken,
      })
      .pipe(
        tap((data) => this.setTokens(data.accessToken, data.refreshToken)),
      );
  }

  // ── Auth actions ──────────────────────────────────────────────────

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>('/auth/login', credentials)
      .pipe(
        tap((data) => this.setTokens(data.accessToken, data.refreshToken)),
      );
  }

  logout(): void {
    this.clearTokens();
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }
}
