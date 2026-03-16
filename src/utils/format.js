/**
 * Format a fuel price for display.
 */
export function formatPrice(price, currency) {
  if (price == null) return '—';
  if (currency === 'p') {
    return `${price.toFixed(1)}p`;
  }
  return `${currency}\u00A0${price.toFixed(3)}`;
}

/**
 * Format a price rounded to 2 decimals (for savings display).
 */
export function formatPriceShort(price, currency) {
  if (price == null) return '—';
  if (currency === 'p') {
    return `${price.toFixed(0)}p`;
  }
  return `${currency}\u00A0${price.toFixed(2)}`;
}

/**
 * Format a date string to a relative or short format.
 */
export function formatUpdated(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffDay < 1) return 'verified today';
  if (diffDay === 1) return 'verified yesterday';
  if (diffDay < 7) return `verified ${diffDay}d ago`;

  return 'verified ' + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
