import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Strips spaces/dashes and a +91 / 91 / 0 prefix from an Indian mobile number. */
export function normalizePhone(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export const indianPhone: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value as string | null;
  if (!v) return null;
  return /^[6-9]\d{9}$/.test(normalizePhone(v)) ? null : { phone: true };
};

/** Group validator: `password` and `confirmPassword` must match. */
export const passwordsMatch: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const a = g.get('password')?.value as string | undefined;
  const b = g.get('confirmPassword')?.value as string | undefined;
  return a && b && a !== b ? { mismatch: true } : null;
};
