export function formatMoney(cents: number | undefined | null) {
  if (cents === undefined || cents === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatPercent(value: number | undefined | null) {
  if (value === undefined || value === null) return '0,0%';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
}
