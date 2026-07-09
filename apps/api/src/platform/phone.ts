// Strip everything except digits and a leading +. Storage-canonical form.
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
