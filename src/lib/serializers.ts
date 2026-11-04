/**
 * src/lib/serializers.ts
 *
 * Safe serialization utilities for API responses and BigInt currency values.
 * Standard JSON.stringify throws TypeError on BigInt values.
 * These utilities ensure safe conversion to string/number DTO representations.
 */

/**
 * Recursively converts any BigInt properties in an object or array to strings
 * so the object can be safely returned via Response.json().
 */
export function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

/**
 * Formats a BigInt paise amount into Rupees (e.g. 100000000n paise -> 1000000.00 INR).
 */
export function formatPaiseToRupees(amountPaise: bigint): number {
  return Number(amountPaise) / 100;
}

/**
 * Formats a BigInt paise amount into an Indian currency display string (e.g. "₹12,00,000.00").
 */
export function formatPaiseToCurrencyString(amountPaise: bigint): string {
  const rupees = formatPaiseToRupees(amountPaise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}
