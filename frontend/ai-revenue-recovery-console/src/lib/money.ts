/**
 * Money utilities for exact integer paise representation
 * Respects strict financial-system semantics: integer minor units only,
 * dedicated formatter for presentation, no floating-point business calculations.
 */

/**
 * Format paise into clean INR currency string (e.g. ₹8,499 or ₹8,499.50)
 */
export function formatPaise(paise: number, options?: { showPence?: boolean; compact?: boolean }): string {
  if (paise === undefined || paise === null || isNaN(paise)) return '₹0';

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);

  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  // Indian number system formatting (lakhs & crores)
  const formatIndianNumber = (num: number): string => {
    const s = num.toString();
    if (s.length <= 3) return s;
    const lastThree = s.substring(s.length - 3);
    const otherNumbers = s.substring(0, s.length - 3);
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${formattedOther},${lastThree}`;
  };

  if (options?.compact) {
    if (rupees >= 10000000) {
      // Crores
      const cr = (rupees / 10000000).toFixed(2);
      return `${isNegative ? '-' : ''}₹${cr}Cr`;
    }
    if (rupees >= 100000) {
      // Lakhs
      const lk = (rupees / 100000).toFixed(1);
      return `${isNegative ? '-' : ''}₹${lk}L`;
    }
    if (rupees >= 1000) {
      const k = (rupees / 1000).toFixed(1);
      return `${isNegative ? '-' : ''}₹${k}k`;
    }
  }

  let formatted = `₹${formatIndianNumber(rupees)}`;

  if (options?.showPence && remainingPaise > 0) {
    formatted += `.${remainingPaise.toString().padStart(2, '0')}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format integer percentage (e.g. 0.89 -> "89%")
 */
export function formatPercentage(decimal: number, decimals: number = 0): string {
  if (decimal === undefined || decimal === null || isNaN(decimal)) return '0%';
  const pct = decimal * 100;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Format raw numbers with Indian comma grouping
 */
export function formatCount(num: number): string {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
}
