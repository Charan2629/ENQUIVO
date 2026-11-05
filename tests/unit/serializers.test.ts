import { describe, it, expect } from "vitest";
import {
  serializeBigInt,
  formatPaiseToRupees,
  formatPaiseToCurrencyString,
} from "@/lib/serializers";

describe("src/lib/serializers.ts Unit Tests", () => {
  describe("serializeBigInt", () => {
    it("converts top-level BigInt fields in an object to string representations", () => {
      const input = {
        id: "source-spend-1",
        source: "PROPERTY_PORTAL",
        monthYear: "2026-11",
        amountPaise: BigInt(120000000),
      };

      const result = serializeBigInt(input);

      expect(result).toEqual({
        id: "source-spend-1",
        source: "PROPERTY_PORTAL",
        monthYear: "2026-11",
        amountPaise: "120000000",
      });
      expect(typeof result.amountPaise).toBe("string");
    });

    it("converts nested BigInt fields recursively", () => {
      const input = {
        meta: {
          transaction: {
            feePaise: BigInt(2500),
            breakdown: {
              taxPaise: BigInt(450),
            },
          },
        },
      };

      const result = serializeBigInt(input);

      expect(result).toEqual({
        meta: {
          transaction: {
            feePaise: "2500",
            breakdown: {
              taxPaise: "450",
            },
          },
        },
      });
      expect(typeof result.meta.transaction.feePaise).toBe("string");
      expect(typeof result.meta.transaction.breakdown.taxPaise).toBe("string");
    });

    it("converts BigInt properties within arrays of objects", () => {
      const input = [
        { source: "PORTAL", amountPaise: BigInt(120000000) },
        { source: "SOCIAL", amountPaise: BigInt(80000000) },
      ];

      const result = serializeBigInt(input);

      expect(result).toEqual([
        { source: "PORTAL", amountPaise: "120000000" },
        { source: "SOCIAL", amountPaise: "80000000" },
      ]);
    });

    it("converts standalone BigInt values and arrays of BigInts", () => {
      expect(serializeBigInt(BigInt(100))).toBe("100");
      expect(serializeBigInt([BigInt(1), BigInt(2), BigInt(3)])).toEqual([
        "1",
        "2",
        "3",
      ]);
    });

    it("preserves non-BigInt primitive types without alteration", () => {
      const input = {
        name: "Prakriti Heights",
        units: 210,
        active: true,
        notes: null,
      };

      const result = serializeBigInt(input);

      expect(result).toEqual(input);
    });

    it("handles zero and negative BigInts correctly", () => {
      const input = {
        zero: BigInt(0),
        negative: BigInt(-50000),
      };

      const result = serializeBigInt(input);

      expect(result).toEqual({
        zero: "0",
        negative: "-50000",
      });
    });

    it("handles empty objects and empty arrays", () => {
      expect(serializeBigInt({})).toEqual({});
      expect(serializeBigInt([])).toEqual([]);
    });

    it("ensures the output can be serialized with standard JSON.stringify without throwing TypeError", () => {
      const rawPayload = {
        budgetPaise: BigInt(300000000),
      };

      // Native JSON.stringify throws on BigInt
      expect(() => JSON.stringify(rawPayload)).toThrow(TypeError);

      // Serialized payload does not throw
      const safePayload = serializeBigInt(rawPayload);
      expect(() => JSON.stringify(safePayload)).not.toThrow();
      expect(JSON.stringify(safePayload)).toBe('{"budgetPaise":"300000000"}');
    });
  });

  describe("formatPaiseToRupees", () => {
    it("converts standard crore and lakh paise values to rupees", () => {
      // ₹12,00,000 = 120,000,000 paise
      expect(formatPaiseToRupees(BigInt(120000000))).toBe(1200000);

      // ₹8,00,000 = 80,000,000 paise
      expect(formatPaiseToRupees(BigInt(80000000))).toBe(800000);

      // ₹5,00,000 = 50,000,000 paise
      expect(formatPaiseToRupees(BigInt(50000000))).toBe(500000);
    });

    it("converts paise amounts with fractional rupees accurately", () => {
      // 12550 paise = ₹125.50
      expect(formatPaiseToRupees(BigInt(12550))).toBe(125.5);

      // 99 paise = ₹0.99
      expect(formatPaiseToRupees(BigInt(99))).toBe(0.99);

      // 1 paisa = ₹0.01
      expect(formatPaiseToRupees(BigInt(1))).toBe(0.01);
    });

    it("handles boundary zero value", () => {
      expect(formatPaiseToRupees(BigInt(0))).toBe(0);
    });

    it("handles negative paise amounts", () => {
      expect(formatPaiseToRupees(BigInt(-50000))).toBe(-500);
      expect(formatPaiseToRupees(BigInt(-75))).toBe(-0.75);
    });

    it("handles large values within JavaScript safe integer limits", () => {
      // 9,007,199,254,740,991 paise (~₹90.07 lakh crore)
      const maxSafePaise = BigInt(Number.MAX_SAFE_INTEGER);
      expect(formatPaiseToRupees(maxSafePaise)).toBe(
        Number.MAX_SAFE_INTEGER / 100
      );
    });
  });

  describe("formatPaiseToCurrencyString", () => {
    it("formats whole rupee amounts with Indian currency formatting and INR symbol", () => {
      expect(formatPaiseToCurrencyString(BigInt(120000000))).toBe(
        "₹12,00,000.00"
      );
      expect(formatPaiseToCurrencyString(BigInt(80000000))).toBe(
        "₹8,00,000.00"
      );
      expect(formatPaiseToCurrencyString(BigInt(50000000))).toBe(
        "₹5,00,000.00"
      );
    });

    it("formats 250 paise correctly", () => {
      // 1. Call the function with the input.
      const result = formatPaiseToCurrencyString(BigInt(250));
      // 2. Check that the output is exactly "₹2.50".
      expect(result).toBe("₹2.50");
    });

    it("formats fractional rupee values to 2 decimal places", () => {
      expect(formatPaiseToCurrencyString(BigInt(123456))).toBe("₹1,234.56");
      expect(formatPaiseToCurrencyString(BigInt(50))).toBe("₹0.50");
      expect(formatPaiseToCurrencyString(BigInt(5))).toBe("₹0.05");
    });

    it("formats zero paise as ₹0.00", () => {
      expect(formatPaiseToCurrencyString(BigInt(0))).toBe("₹0.00");
    });

    it("formats negative amounts with negative sign", () => {
      expect(formatPaiseToCurrencyString(BigInt(-50000))).toBe("-₹500.00");
      expect(formatPaiseToCurrencyString(BigInt(-123456))).toBe("-₹1,234.56");
    });
  });
});
