export function normalizeMerchant(merchant: string): string {
  let value = merchant.toLowerCase().trim();
  value = value.replace(/#\d+$/g, '');
  value = value.replace(/\b\d{6,}\b/g, ' ');
  value = value.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}
