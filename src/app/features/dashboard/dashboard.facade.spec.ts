import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfessionalService } from '../../core/services/professional.service';
import { DashboardFacade } from './dashboard.facade';
import { PagedResponse, Professional } from '../../core/types/professional.types';

describe('DashboardFacade', () => {
  let facade: DashboardFacade;
  let mockProfessionalService: {
    getPending: ReturnType<typeof vi.fn>;
    verifyProfessional: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: { logout: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  const mockProfessional: Professional = {
    id: 2,
    nome: 'João Profissional',
    telefone: '77777777777',
    email: 'pro3@val.com',
    rgFrente: 'http://localhost/rg_frente.jpg',
    rgVerso: 'http://localhost/rg_verso.jpg',
    selfieComDocumento: 'http://localhost/selfie.jpg',
    criadoEm: '2026-05-30T12:04:12.559577',
  };

  const createResponse = (
    overrides: Partial<PagedResponse<Professional>> = {},
  ): PagedResponse<Professional> => ({
    content: [mockProfessional],
    pageable: { pageNumber: 0, pageSize: 5, sort: { empty: true, sorted: false, unsorted: true }, offset: 0, paged: true, unpaged: false },
    totalPages: 5,
    totalElements: 23,
    size: 5,
    number: 0,
    sort: { empty: true, sorted: false, unsorted: true },
    last: false,
    first: true,
    numberOfElements: 5,
    empty: false,
    ...overrides,
  });

  beforeEach(() => {
    mockProfessionalService = {
      getPending: vi.fn().mockReturnValue(of(createResponse())),
      verifyProfessional: vi.fn().mockReturnValue(of(undefined)),
    };
    mockAuthService = { logout: vi.fn() };
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        DashboardFacade,
        { provide: ProfessionalService, useValue: mockProfessionalService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    facade = TestBed.inject(DashboardFacade);
    vi.clearAllMocks();
  });

  describe('loadPage', () => {
    it('should fetch professionals', async () => {
      facade.loadPage(0);
      const pros = await firstValueFrom(facade.professionals$);
      expect(pros.length).toBeGreaterThan(0);
      expect(mockProfessionalService.getPending).toHaveBeenCalledWith(0, 5);
    });

    it('should fetch a different page', async () => {
      facade.loadPage(2);
      await firstValueFrom(facade.professionals$);
      expect(mockProfessionalService.getPending).toHaveBeenCalledWith(2, 5);
    });

    it('should set error on failure', async () => {
      mockProfessionalService.getPending.mockReturnValue(throwError(() => new Error('fail')));

      // Subscribe to pageError$ and skip the initial null value
      const errPromise = new Promise<string>((resolve) => {
        const sub = facade.pageError$.subscribe((err) => {
          if (err !== null) {
            resolve(err);
            sub.unsubscribe();
          }
        });
      });

      facade.loadPage(0);
      // Trigger pipeline by subscribing
      facade.professionals$.subscribe({ error: () => {} });

      const err = await errPromise;
      expect(err).toBe('Erro ao carregar profissionais.');
    });
  });

  describe('pagination$', () => {
    it('should compute correct values', async () => {
      facade.loadPage(0);
      const p = await firstValueFrom(facade.pagination$);
      expect(p.start).toBe(1);
      expect(p.end).toBe(5);
      expect(p.totalElements).toBe(23);
      expect(p.totalPages).toBe(5);
    });
  });

  describe('pendingCount$', () => {
    it('should emit totalElements', async () => {
      facade.loadPage(0);
      const count = await firstValueFrom(facade.pendingCount$);
      expect(count).toBe(23);
    });
  });

  describe('search', () => {
    it('should filter by nome', async () => {
      const p2 = { ...mockProfessional, id: 3, nome: 'Maria Silva' };
      mockProfessionalService.getPending.mockReturnValue(
        of(createResponse({ content: [mockProfessional, p2] })),
      );
      facade.loadPage(0);
      facade.search('Maria');

      const pros = await firstValueFrom(facade.professionals$);
      expect(pros.length).toBe(1);
      expect(pros[0].nome).toBe('Maria Silva');
    });

    it('should reset to page 0', async () => {
      facade.loadPage(2);
      facade.search('João');
      await firstValueFrom(facade.professionals$);
      expect(mockProfessionalService.getPending).toHaveBeenLastCalledWith(0, 5);
    });

    it('should show all when search is empty', async () => {
      facade.loadPage(0);
      facade.search('');
      const pros = await firstValueFrom(facade.professionals$);
      expect(pros.length).toBe(1);
    });
  });

  describe('pagination navigation', () => {
    it('should go to previous page', async () => {
      facade.loadPage(1);
      facade.previousPage(1);
      await firstValueFrom(facade.professionals$);
      expect(mockProfessionalService.getPending).toHaveBeenLastCalledWith(0, 5);
    });

    it('should not go below page 0', async () => {
      facade.loadPage(0);
      facade.previousPage(0);
      await firstValueFrom(facade.professionals$);
      expect(mockProfessionalService.getPending).toHaveBeenLastCalledWith(0, 5);
    });

    it('should go to next page', async () => {
      facade.loadPage(0);
      facade.nextPage(0, 5);
      await firstValueFrom(facade.professionals$);
      expect(mockProfessionalService.getPending).toHaveBeenLastCalledWith(1, 5);
    });
  });

  describe('approveProfessional', () => {
    it('should call verify with aprovado: true', () => {
      facade.loadPage(0);
      facade.approveProfessional(2);
      expect(mockProfessionalService.verifyProfessional).toHaveBeenCalledWith(2, true);
    });

    it('should reload page after success', async () => {
      facade.loadPage(0);
      // Trigger initial load by subscribing
      await firstValueFrom(facade.professionals$);

      mockProfessionalService.verifyProfessional.mockReturnValue(of(undefined));
      facade.approveProfessional(2);

      // Wait for reload triggered by approve
      await firstValueFrom(facade.professionals$);
      // Initial load + reload after approve
      expect(mockProfessionalService.getPending).toHaveBeenCalledTimes(2);
    });

    it('should set error on failure', async () => {
      facade.loadPage(0);
      mockProfessionalService.verifyProfessional.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      facade.approveProfessional(2);
      const err = await firstValueFrom(facade.pageError$);
      expect(err).toBe('Erro ao aprovar profissional.');
    });
  });

  describe('rejectProfessional', () => {
    it('should call verify with aprovado: false', () => {
      facade.loadPage(0);
      facade.rejectProfessional(5);
      expect(mockProfessionalService.verifyProfessional).toHaveBeenCalledWith(5, false);
    });
  });

  describe('goToDetail', () => {
    it('should navigate with professional state', () => {
      facade.goToDetail(mockProfessional);
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/dashboard', mockProfessional.id],
        { state: { professional: mockProfessional } },
      );
    });
  });

  describe('logout', () => {
    it('should call logout and navigate to /login', () => {
      facade.logout();
      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
