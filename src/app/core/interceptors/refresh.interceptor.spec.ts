import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';

import { refreshInterceptor } from './refresh.interceptor';
import { AuthService } from '../services/auth.service';

describe('refreshInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: { refreshToken: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn>; getAccessToken: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      refreshToken: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockReturnValue(null),
    };
    mockRouter = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);

    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should pass through non-401 errors', async () => {
    const promise = firstValueFrom(http.get('/api/data'));

    const req = httpMock.expectOne('/api/data');
    req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    await expect(promise).rejects.toThrow();
    expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
  });

  it('should pass through /auth/refresh 401s (prevents infinite loop)', async () => {
    mockAuthService.refreshToken.mockReturnValue(throwError(() => new Error('refresh failed')));

    const promise = firstValueFrom(http.post('/auth/refresh', { refreshToken: 'rt' }));

    const req = httpMock.expectOne('/auth/refresh');
    req.flush({ message: 'Invalid refresh' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toThrow();
    // Should not call refreshToken (it's the refresh URL itself)
    expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
  });

  it('should refresh token and retry on single 401', async () => {
    mockAuthService.refreshToken.mockReturnValue(
      of({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    );

    const promise = firstValueFrom(http.get('/api/data'));

    // Request gets 401 → triggers refresh → retry with new token
    const req1 = httpMock.expectOne('/api/data');
    req1.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // The interceptor retries immediately (refresh is synchronous mock)
    const req2 = httpMock.expectOne('/api/data');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer new-at');
    req2.flush({ ok: true });

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('should queue multiple concurrent 401s and only refresh once', async () => {
    // Use a Subject so the refresh doesn't complete synchronously —
    // both 401s arrive before we resolve the refresh
    const refreshSubject = new Subject<{ accessToken: string; refreshToken: string }>();
    mockAuthService.refreshToken.mockReturnValue(refreshSubject);

    const promise1 = firstValueFrom(http.get('/api/data1'));
    const promise2 = firstValueFrom(http.get('/api/data2'));

    // Both original requests are pending
    const req1 = httpMock.expectOne('/api/data1');
    const req2 = httpMock.expectOne('/api/data2');

    // Flush both with 401 — the first triggers refresh, the second queues
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });
    req2.flush({}, { status: 401, statusText: 'Unauthorized' });

    // Now resolve the refresh — both queued requests retry
    refreshSubject.next({ accessToken: 'new-at', refreshToken: 'new-rt' });
    refreshSubject.complete();

    // Both retry with the new token
    const retry1 = httpMock.expectOne('/api/data1');
    const retry2 = httpMock.expectOne('/api/data2');
    expect(retry1.request.headers.get('Authorization')).toBe('Bearer new-at');
    expect(retry2.request.headers.get('Authorization')).toBe('Bearer new-at');
    retry1.flush({ ok: 1 });
    retry2.flush({ ok: 2 });

    const [r1, r2] = await Promise.all([promise1, promise2]);
    expect(r1).toEqual({ ok: 1 });
    expect(r2).toEqual({ ok: 2 });
    expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('should logout and redirect to /login on refresh failure', async () => {
    mockAuthService.refreshToken.mockReturnValue(
      throwError(() => new Error('Session expired')),
    );

    const promise = firstValueFrom(http.get('/api/data'));

    const req = httpMock.expectOne('/api/data');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toThrow('Session expired');
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
