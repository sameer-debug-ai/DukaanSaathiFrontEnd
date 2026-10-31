import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  /** Products in this category. */
  productCount: number;
}

/** Product categories the shop manages (name + active). */
@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly api = inject(ApiService);

  list() {
    return this.api.get<Category[]>('/categories');
  }
  /** Names for the product form's dropdown: active categories only. */
  active() {
    return this.api.get<string[]>('/categories/active');
  }
  create(name: string) {
    return this.api.post<Category>('/categories', { name });
  }
  update(id: string, body: { name?: string; isActive?: boolean }) {
    return this.api.patch<Category>(`/categories/${id}`, body);
  }
}
