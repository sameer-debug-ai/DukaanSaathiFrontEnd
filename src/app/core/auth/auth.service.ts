import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, AuthPayload, Language, User } from '../models/api.models';
import { storage } from '../utils/storage';

/** Non-secret flag: "this browser has a refresh cookie worth trying". */
const SESSION_HINT = 'ds.session';

export interface RegisterRequest {
  name: string;
  shopName: string;
  phone: string;
  password: string;
  preferredLanguage: Language;
}

/**
 * Holds the session. The access token lives only in memory; the refresh token is
 * an httpOnly cookie the browser sends to /api/auth/refresh, so a page reload
 * silently restores the session via restoreSession().
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  private accessToken: string | null = null;
  private refresh$: Observable<string> | null = null;

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  token(): string | null {
    return this.accessToken;
  }

  login(phone: string, password: string): Observable<User> {
    return this.http
      .post<ApiResponse<AuthPayload>>(`${this.base}/login`, { phone, password }, { withCredentials: true })
      .pipe(map((r) => this.setSession(r.data)));
  }

  register(body: RegisterRequest): Observable<User> {
    return this.http
      .post<ApiResponse<AuthPayload>>(`${this.base}/register`, body, { withCredentials: true })
      .pipe(map((r) => this.setSession(r.data)));
  }

  /** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
  refresh(): Observable<string> {
    if (!this.refresh$) {
      this.refresh$ = this.http
        .post<ApiResponse<AuthPayload>>(`${this.base}/refresh`, {}, { withCredentials: true })
        .pipe(
          map((r) => {
            this.setSession(r.data);
            return r.data.accessToken;
          }),
          finalize(() => (this.refresh$ = null)),
          shareReplay(1),
        );
    }
    return this.refresh$;
  }

  /** Called once at app start. Never throws: no cookie simply means "logged out". */
  async restoreSession(): Promise<void> {
    // Skip the network round-trip (and a console 401) when this browser never logged in.
    if (storage.get(SESSION_HINT) !== '1') return;
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clearSession();
    }
  }

  logout(): void {
    const done = () => {
      this.clearSession();
      void this.router.navigateByUrl('/login');
    };
    this.http.post(`${this.base}/logout`, {}, { withCredentials: true }).subscribe({ next: done, error: done });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .patch<ApiResponse<null>>(`${this.base}/change-password`, { currentPassword, newPassword })
      .pipe(map(() => undefined));
  }

  updateProfile(patch: Partial<Omit<User, 'id' | 'settings'>> & { settings?: Partial<User['settings']> }): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.base}/me`, patch).pipe(
      map((r) => r.data),
      tap((u) => this._user.set(u)),
    );
  }

  clearSession(): void {
    this.accessToken = null;
    this._user.set(null);
    storage.remove(SESSION_HINT);
  }

  private setSession(payload: AuthPayload): User {
    this.accessToken = payload.accessToken;
    this._user.set(payload.user);
    storage.set(SESSION_HINT, '1');
    return payload.user;
  }
}
