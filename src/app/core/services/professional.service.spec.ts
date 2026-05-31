import { HttpClient, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ProfessionalService } from './professional.service';
import { PagedResponse, Professional } from '../types/professional.types';

describe('ProfessionalService', () => {
  let service: ProfessionalService;
  let mockHttp: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  const mockProfessional: Professional = {
    id: 2,
    nome: 'João Profissional',
    telefone: '77777777777',
    email: 'pro3@val.com',
    rgFrente: 'http://localhost:9000/rg_frente.jpg',
    rgVerso: 'http://localhost:9000/rg_verso.jpg',
    selfieComDocumento: 'http://localhost:9000/selfie.jpg',
    criadoEm: '2026-05-30T12:04:12.559577',
  };

  const mockPagedResponse: PagedResponse<Professional> = {
    content: [mockProfessional],
    pageable: {
      pageNumber: 0, pageSize: 5,
      sort: { empty: true, sorted: false, unsorted: true },
      offset: 0, paged: true, unpaged: false,
    },
    last: true, totalPages: 1, totalElements: 23,
    size: 5, number: 0,
    sort: { empty: true, sorted: false, unsorted: true },
    first: true, numberOfElements: 1, empty: false,
  };

  beforeEach(() => {
    mockHttp = { get: vi.fn(), patch: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ProfessionalService,
        { provide: HttpClient, useValue: mockHttp },
      ],
    });
    service = TestBed.inject(ProfessionalService);
    vi.clearAllMocks();
  });

  describe('getPending', () => {
    it('should call GET with default params', async () => {
      mockHttp.get.mockReturnValue(of(mockPagedResponse));

      const result = await firstValueFrom(service.getPending());

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/admin/profissionais/pendentes',
        expect.objectContaining({ params: expect.any(HttpParams) }),
      );
      const [, options] = mockHttp.get.mock.calls[0];
      const httpParams = options.params as HttpParams;
      expect(httpParams.get('page')).toBe('0');
      expect(httpParams.get('size')).toBe('5');
      expect(result).toEqual(mockPagedResponse);
    });

    it('should call with custom page/size', async () => {
      mockHttp.get.mockReturnValue(of(mockPagedResponse));

      const result = await firstValueFrom(service.getPending(2, 10));

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/admin/profissionais/pendentes',
        expect.objectContaining({ params: expect.any(HttpParams) }),
      );
      const [, options] = mockHttp.get.mock.calls[0];
      const httpParams = options.params as HttpParams;
      expect(httpParams.get('page')).toBe('2');
      expect(httpParams.get('size')).toBe('10');
      expect(result).toEqual(mockPagedResponse);
    });

    it('should propagate errors', async () => {
      const apiError = new Error('Network error');
      mockHttp.get.mockReturnValue(throwError(() => apiError));

      await expect(firstValueFrom(service.getPending())).rejects.toBe(apiError);
    });
  });

  describe('verifyProfessional', () => {
    it('should PATCH with aprovado: true', async () => {
      mockHttp.patch.mockReturnValue(of(undefined));

      await firstValueFrom(service.verifyProfessional(2, true));

      expect(mockHttp.patch).toHaveBeenCalledWith(
        '/admin/profissionais/2/verificar',
        { aprovado: true },
      );
    });

    it('should PATCH with aprovado: false', async () => {
      mockHttp.patch.mockReturnValue(of(undefined));

      await firstValueFrom(service.verifyProfessional(5, false));

      expect(mockHttp.patch).toHaveBeenCalledWith(
        '/admin/profissionais/5/verificar',
        { aprovado: false },
      );
    });

    it('should propagate errors', async () => {
      const apiError = new Error('Not found');
      mockHttp.patch.mockReturnValue(throwError(() => apiError));

      await expect(
        firstValueFrom(service.verifyProfessional(99, true)),
      ).rejects.toBe(apiError);
    });
  });
});
