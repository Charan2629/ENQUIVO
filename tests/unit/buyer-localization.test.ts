import { describe, it, expect } from "vitest";
import {
  CONCIERGE_TRANSLATIONS,
  type Language,
  type ConciergeDictionary,
} from "@/lib/i18n/concierge-translations";

describe("Buyer Localization (i18n) Unit Tests", () => {
  const languages: Language[] = ["EN", "HI", "GU"];

  it("provides comprehensive translations for all supported languages", () => {
    languages.forEach((lang) => {
      const dict = CONCIERGE_TRANSLATIONS[lang];
      expect(dict).toBeDefined();
      expect(typeof dict.intakeTitle).toBe("string");
      expect(typeof dict.startSessionButton).toBe("string");
      expect(typeof dict.dpdpConsentLabel).toBe("string");
      expect(typeof dict.reraRegBadge).toBe("string");
    });
  });

  it("enforces that all dictionary keys are populated across EN, HI, and GU", () => {
    const requiredKeys: (keyof ConciergeDictionary)[] = [
      "backToResidences",
      "brandTitle",
      "assistantHeaderTitle",
      "assistantSubtitle",
      "groundedStatusBadge",
      "verifiedAssistantSubtitle",
      "intakeTitle",
      "intakeSubtitle",
      "intakeDisclaimerNotice",
      "nameLabel",
      "namePlaceholder",
      "nameRequiredError",
      "phoneLabel",
      "phonePlaceholder",
      "phoneRequiredError",
      "phoneInvalidError",
      "emailLabel",
      "emailOptional",
      "emailPlaceholder",
      "emailInvalidError",
      "projectInterestLabel",
      "projectAllOption",
      "projectPrakritiOption",
      "projectVaastuOption",
      "dpdpConsentLabel",
      "dpdpConsentRequiredError",
      "startSessionButton",
      "startingSessionButton",
      "privacySignedNotice",
      "requestHumanButton",
      "requestHumanTitle",
      "endSessionButton",
      "optOutButton",
      "consultingDatabaseIndicator",
      "quickQuestionsTitle",
      "quickQuestion1",
      "quickQuestion2",
      "quickQuestion3",
      "inputPlaceholder",
      "sendMessageAria",
      "retryButton",
      "talkToSalesButton",
      "sessionEndedError",
      "temporaryHighDemandError",
      "networkError",
      "humanConnectionError",
      "optOutModalTitle",
      "optOutModalBody",
      "optOutCancelButton",
      "optOutConfirmButton",
      "optOutProcessingButton",
      "optOutSuccessAlert",
      "optOutFailureAlert",
      "statutoryNoticeTitle",
      "statutoryNoticeBody",
      "reraRegBadge",
      "portfolioBadge",
      "aiBadge",
      "footerCompliance",
    ];

    languages.forEach((lang) => {
      const dict = CONCIERGE_TRANSLATIONS[lang];
      requiredKeys.forEach((key) => {
        expect(dict[key], `Missing translation for key: ${key} in ${lang}`).toBeDefined();
        expect(
          (dict[key] as string).length,
          `Empty translation for key: ${key} in ${lang}`
        ).toBeGreaterThan(0);
      });
    });
  });

  it("verifies authentic Devanagari script presence in Hindi translations", () => {
    const hi = CONCIERGE_TRANSLATIONS.HI;
    const devanagariRegex = /[\u0900-\u097F]/;

    expect(devanagariRegex.test(hi.assistantHeaderTitle)).toBe(true);
    expect(devanagariRegex.test(hi.intakeSubtitle)).toBe(true);
    expect(devanagariRegex.test(hi.nameLabel)).toBe(true);
    expect(devanagariRegex.test(hi.dpdpConsentLabel)).toBe(true);
    expect(devanagariRegex.test(hi.startSessionButton)).toBe(true);
    expect(devanagariRegex.test(hi.quickQuestion1)).toBe(true);
  });

  it("verifies authentic Gujarati script presence in Gujarati translations", () => {
    const gu = CONCIERGE_TRANSLATIONS.GU;
    const gujaratiRegex = /[\u0A80-\u0AFF]/;

    expect(gujaratiRegex.test(gu.assistantHeaderTitle)).toBe(true);
    expect(gujaratiRegex.test(gu.intakeSubtitle)).toBe(true);
    expect(gujaratiRegex.test(gu.nameLabel)).toBe(true);
    expect(gujaratiRegex.test(gu.dpdpConsentLabel)).toBe(true);
    expect(gujaratiRegex.test(gu.startSessionButton)).toBe(true);
    expect(gujaratiRegex.test(gu.quickQuestion1)).toBe(true);
  });

  it("guarantees DPDP Act 2023 and RERA compliance identifiers are present in all locales", () => {
    languages.forEach((lang) => {
      const dict = CONCIERGE_TRANSLATIONS[lang];
      // Regulatory labels must remain legally clear and identifiable
      expect(dict.dpdpConsentLabel).toContain("DPDP");
      expect(dict.reraRegBadge).toBe("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    });
  });

  it("correctly evaluates parameterized helper strings across languages", () => {
    // Grounded facts badge
    expect(CONCIERGE_TRANSLATIONS.EN.groundedFactsBadge(3)).toBe(
      "Grounded in 3 verified developer facts"
    );
    expect(CONCIERGE_TRANSLATIONS.EN.groundedFactsBadge(1)).toBe(
      "Grounded in 1 verified developer fact"
    );
    expect(CONCIERGE_TRANSLATIONS.HI.groundedFactsBadge(2)).toContain(
      "2 सत्यापित डेवलपर तथ्यों पर आधारित"
    );
    expect(CONCIERGE_TRANSLATIONS.GU.groundedFactsBadge(4)).toContain(
      "4 ચકાસાયેલ ડેવલપર તથ્યો પર આધારિત"
    );

    // Active consultation with name
    expect(CONCIERGE_TRANSLATIONS.EN.activeConsultationWith("Hardik Patel")).toBe(
      "Consulting with Hardik Patel"
    );
    expect(CONCIERGE_TRANSLATIONS.HI.activeConsultationWith("हार्दिक पटेल")).toContain(
      "हार्दिक पटेल"
    );
    expect(CONCIERGE_TRANSLATIONS.GU.activeConsultationWith("હાર્દિક પટેલ")).toContain(
      "હાર્દિક પટેલ"
    );
  });
});
