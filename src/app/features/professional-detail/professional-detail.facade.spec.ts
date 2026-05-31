import { TestBed } from '@angular/core/testing';
import { Router, Navigation, NavigationExtras } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfessionalService } from '../../core/services/professional.service';
import { ProfessionalDetailFacade } from './professional-detail.facade';
import { Professional } from '../../core/types/professional.types';

describe('ProfessionalDetailFacade', () => {
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

  function setupFacade(professional: Professional | null) {
    const nav = professional
      ? { extras: { state: { professional } } as unknown as NavigationExtras } as Navigation
      : null;

    const mockService = { verifyProfessional: vi.fn().mockReturnValue(of(undefined)) };
    const mockAuth = { logout: vi.fn() };
    const mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
      getCurrentNavigation: vi.fn().mockReturnValue(nav),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfessionalDetailFacade,
        { provide: ProfessionalService, useValue: mockService },
        { provide: AuthService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const facade = TestBed.inject(ProfessionalDetailFacade);
    return { facade, mockService, mockAuth, mockRouter };
  }

  describe('constructor', () => {
    it('should load professional from router state', () => {
      const { facade } = setupFacade(mockProfessional);
      expect(facade.professional).toEqual(mockProfessional);
    });

    it('should redirect to /dashboard if no state', () => {
      const { mockRouter } = setupFacade(null);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('goBack', () => {
    it('should navigate to /dashboard', () => {
      const { facade, mockRouter } = setupFacade(mockProfessional);
      facade.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('approve', () => {
    it('should call verifyProfessional with aprovado: true', () => {
      const { facade, mockService } = setupFacade(mockProfessional);
      facade.approve();
      expect(mockService.verifyProfessional).toHaveBeenCalledWith(2, true);
    });

    it('should navigate to /dashboard on success', () => {
      const { facade, mockRouter } = setupFacade(mockProfessional);
      facade.approve();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should set error on failure', async () => {
      // Re-setup with error mock
      const mockService = {
        verifyProfessional: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      };
      const mockAuth = { logout: vi.fn() };
      const mockRouter = {
        navigate: vi.fn().mockResolvedValue(true),
        getCurrentNavigation: vi.fn().mockReturnValue({
          extras: { state: { professional: mockProfessional } },
        }),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ProfessionalDetailFacade,
          { provide: ProfessionalService, useValue: mockService },
          { provide: AuthService, useValue: mockAuth },
          { provide: Router, useValue: mockRouter },
        ],
      });
      const facade = TestBed.inject(ProfessionalDetailFacade);

      facade.approve();
      const err = await firstValueFrom(facade.error);
      expect(err).toBe('Erro ao aprovar cadastro.');
    });
  });

  describe('reject', () => {
    it('should call verifyProfessional with aprovado: false', () => {
      const { facade, mockService } = setupFacade(mockProfessional);
      facade.reject();
      expect(mockService.verifyProfessional).toHaveBeenCalledWith(2, false);
    });

    it('should navigate to /dashboard on success', () => {
      const { facade, mockRouter } = setupFacade(mockProfessional);
      facade.reject();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('logout', () => {
    it('should call logout and navigate to /login', () => {
      const { facade, mockAuth, mockRouter } = setupFacade(mockProfessional);
      facade.logout();
      expect(mockAuth.logout).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('formatDate', () => {
    it('should format ISO to pt-BR', () => {
      const { facade } = setupFacade(mockProfessional);
      const formatted = facade.formatDate('2026-05-30T12:04:12.559577');
      expect(formatted).toBe('30/05/2026, 12:04');
    });
  });

  describe('image preview', () => {
    it('should open preview with URL', async () => {
      const { facade } = setupFacade(mockProfessional);
      facade.openPreview('http://test.com/img.jpg');
      const url = await firstValueFrom(facade.previewImage);
      expect(url).toBe('http://test.com/img.jpg');
    });

    it('should close preview', async () => {
      const { facade } = setupFacade(mockProfessional);
      facade.openPreview('http://test.com/img.jpg');
      facade.closePreview();
      const url = await firstValueFrom(facade.previewImage);
      expect(url).toBeNull();
    });
  });
});
