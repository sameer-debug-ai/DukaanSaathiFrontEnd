import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, Paged } from '../models/api.models';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Thin wrapper over HttpClient that unwraps `{ success, data }` responses. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(this.url(path), { params: toParams(params) }).pipe(map((r) => r.data));
  }

  /** GET for list endpoints that return pagination info in `meta`. */
  getPaged<T>(path: string, params?: QueryParams): Observable<Paged<T>> {
    return this.http
      .get<ApiResponse<T[]>>(this.url(path), { params: toParams(params) })
      .pipe(
        map((r) => ({
          items: r.data,
          meta: {
            page: r.meta?.page ?? 1,
            limit: r.meta?.limit ?? r.data.length,
            total: r.meta?.total ?? r.data.length,
            totalPages: r.meta?.totalPages ?? 1,
          },
        })),
      );
  }

  /** Full response, when the caller needs `message` or `meta`. */
  getRaw<T>(path: string, params?: QueryParams): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(this.url(path), { params: toParams(params) });
  }

  getBlob(path: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(this.url(path), { params: toParams(params), responseType: 'blob' });
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(path), body).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(this.url(path), body).pipe(map((r) => r.data));
  }

  delete<T = null>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(this.url(path)).pipe(map((r) => r.data));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

function toParams(params?: QueryParams): HttpParams | undefined {
  if (!params) return undefined;
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    p = p.set(k, String(v));
  }
  return p;
}

/** Pulls a human-readable message out of an HttpErrorResponse. */
export function apiErrorMessage(err: unknown, fallback = 'Kuch galat ho gaya. Dobara try karein.'): string {
  const e = err as { status?: number; error?: { message?: string } };
  if (e?.status === 0) return 'Internet ya server se connection nahi ho pa raha';
  return e?.error?.message || fallback;
}
