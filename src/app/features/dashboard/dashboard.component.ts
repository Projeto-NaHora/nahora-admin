import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DashboardFacade } from './dashboard.facade';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DashboardFacade],
})
export class DashboardComponent implements OnInit {
  protected readonly facade = inject(DashboardFacade);

  ngOnInit(): void {
    this.facade.loadPage(0);
  }

  protected getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
}
