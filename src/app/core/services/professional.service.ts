import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResponse, Professional, VerifyRequest } from '../types/professional.types';

@Injectable({ providedIn: 'root' })
export class ProfessionalService {
  private readonly http = inject(HttpClient);

  getPending(page: number = 0, size: number = 5): Observable<PagedResponse<Professional>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PagedResponse<Professional>>(
      '/admin/profissionais/pendentes',
      { params },
    );
  }

  verifyProfessional(id: number, aprovado: boolean): Observable<void> {
    const body: VerifyRequest = { aprovado };

    return this.http.patch<void>(
      `/admin/profissionais/${id}/verificar`,
      body,
    );
  }
}
