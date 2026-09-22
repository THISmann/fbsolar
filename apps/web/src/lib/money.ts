/** Display catalog amounts in West African CFA francs (FCFA / XOF). */
export function formatFcfa(value: number | string, locale = 'fr-FR'): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) return '—';
  return `${Math.round(amount).toLocaleString(locale, { maximumFractionDigits: 0 })} FCFA`;
}
