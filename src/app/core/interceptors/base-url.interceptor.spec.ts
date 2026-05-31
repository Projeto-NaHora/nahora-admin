import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { baseUrlInterceptor } from './base-url.interceptor';

describe('baseUrlInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([baseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should prepend environment.apiUrl to relative URLs', () => {
    http.get('/auth/login').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.url).toContain('/api/v1/auth/login');
    req.flush({});
  });

  it('should not modify absolute http URLs', () => {
    http.get('http://example.com/data').subscribe();

    const req = httpMock.expectOne('http://example.com/data');
    expect(req.request.url).toBe('http://example.com/data');
    req.flush({});
  });

  it('should not modify absolute https URLs', () => {
    http.get('https://example.com/data').subscribe();

    const req = httpMock.expectOne('https://example.com/data');
    expect(req.request.url).toBe('https://example.com/data');
    req.flush({});
  });
});
