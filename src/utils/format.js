/**
 * Format a fuel price for display.
 * @param {number} price
 * @param {string} currency - currency symbol/code (e.g. '€', 'CLP', 'p')
 * @param {number} [decimals=3] - decimal places for this currency
 */
export function formatPrice(price, currency, decimals = 3) {
  if (price == null) return '\u2014';
  if (currency === 'p') {
    return `${price.toFixed(1)}p`;
  }
  if (currency === 'c') {
    return `${price.toFixed(1)}c`;
  }
  const formatted = decimals === 0
    ? Math.round(price).toLocaleString('en')
    : price.toFixed(decimals);
  return `${currency}\u00A0${formatted}`;
}

/**
 * Format a price rounded for savings display.
 */
export function formatPriceShort(price, currency, decimals = 3) {
  if (price == null) return '\u2014';
  if (currency === 'p') {
    return `${price.toFixed(0)}p`;
  }
  if (currency === 'c') {
    return `${price.toFixed(0)}c`;
  }
  const d = Math.min(decimals, 2);
  const formatted = d === 0
    ? Math.round(price).toLocaleString('en')
    : price.toFixed(d);
  return `${currency}\u00A0${formatted}`;
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
