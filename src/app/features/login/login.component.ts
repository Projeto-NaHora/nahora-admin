import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';

import { LoginFacade } from './login.facade';

@Component({
  selector: 'app-login',
  imports: [FormsModule, AsyncPipe, NgOptimizedImage],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LoginFacade],
})
export class LoginComponent {
  protected readonly facade = inject(LoginFacade);
}
