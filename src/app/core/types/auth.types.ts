export interface LoginRequest {
  identificador: string;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tipoUsuario: 'ADMIN' | 'CLIENTE';
}

export interface AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
}
