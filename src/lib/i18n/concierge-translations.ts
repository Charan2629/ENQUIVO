export type Language = "EN" | "HI" | "GU";

export interface ConciergeDictionary {
  // Page & Header
  backToResidences: string;
  brandTitle: string;
  assistantHeaderTitle: string;
  assistantSubtitle: string;
  groundedStatusBadge: string;
  activeConsultationWith: (name: string) => string;
  verifiedAssistantSubtitle: string;

  // Intake Form
  intakeTitle: string;
  intakeSubtitle: string;
  intakeDisclaimerNotice: string;
  nameLabel: string;
  namePlaceholder: string;
  nameRequiredError: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneRequiredError: string;
  emailLabel: string;
  emailOptional: string;
  emailPlaceholder: string;
  projectInterestLabel: string;
  projectAllOption: string;
  projectPrakritiOption: string;
  projectVaastuOption: string;
  dpdpConsentLabel: string;
  dpdpConsentRequiredError: string;
  startSessionButton: string;
  startingSessionButton: string;
  privacySignedNotice: string;

  // Active Chat
  requestHumanButton: string;
  requestHumanTitle: string;
  endSessionButton: string;
  optOutButton: string;
  connectedWithHumanBanner: (name: string, summary: string, status: string) => string;
  groundedFactsBadge: (count: number) => string;
  consultingDatabaseIndicator: string;
  quickQuestionsTitle: string;
  quickQuestion1: string;
  quickQuestion2: string;
  quickQuestion3: string;
  inputPlaceholder: string;
  sendMessageAria: string;
  retryButton: string;
  talkToSalesButton: string;

  // Errors
  sessionEndedError: string;
  temporaryHighDemandError: string;
  networkError: string;
  humanConnectionError: string;

  // Opt-Out Modal
  optOutModalTitle: string;
  optOutModalBody: string;
  optOutCancelButton: string;
  optOutConfirmButton: string;
  optOutProcessingButton: string;
  optOutSuccessAlert: string;
  optOutFailureAlert: string;

  // Statutory Footer
  statutoryNoticeTitle: string;
  statutoryNoticeBody: string;
  reraRegBadge: string;
  portfolioBadge: string;
  aiBadge: string;
  footerCompliance: string;
}

export const CONCIERGE_TRANSLATIONS: Record<Language, ConciergeDictionary> = {
  EN: {
    backToResidences: "Back to Residences",
    brandTitle: "ENQUIVO",
    assistantHeaderTitle: "Residential AI Concierge",
    assistantSubtitle:
      "Dedicated consultation for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). Strictly grounded in verified developer facts.",
    groundedStatusBadge: "Grounded Truth",
    activeConsultationWith: (name: string) => `Consulting with ${name}`,
    verifiedAssistantSubtitle: "Verified Ahmedabad Residential Assistant",

    intakeTitle: "ENQUIVO Residential Concierge",
    intakeSubtitle:
      "Connect instantly with our grounded residential AI assistant for Prakriti Heights and Vaastu Enclave. All replies are strictly grounded in verified developer facts.",
    intakeDisclaimerNotice:
      "24/7 Grounded AI • 2 Live Developments • ₹65 Lakh to ₹1.2 Crore",
    nameLabel: "Full Name",
    namePlaceholder: "e.g. Hardik Patel",
    nameRequiredError: "Please enter your full name.",
    phoneLabel: "Mobile Phone Number (India)",
    phonePlaceholder: "e.g. +91 98765 43210",
    phoneRequiredError: "Please enter your mobile phone number.",
    emailLabel: "Email Address",
    emailOptional: "(Optional)",
    emailPlaceholder: "name@example.com",
    projectInterestLabel: "Project Interest",
    projectAllOption: "All Projects (Ahmedabad Portfolio)",
    projectPrakritiOption: "Prakriti Heights (SG Highway Corridor)",
    projectVaastuOption: "Vaastu Enclave (Shela / South Bopal)",
    dpdpConsentLabel:
      "DPDP Act 2023 Digital Consent: I consent to ENQUIVO processing my name and contact number to provide verified residential property information and schedule site visits in Ahmedabad. I understand I can withdraw consent at any time.",
    dpdpConsentRequiredError:
      "Digital consent under the DPDP Act 2023 is required to proceed.",
    startSessionButton: "Start AI Concierge Consultation",
    startingSessionButton: "Establishing Secure Session...",
    privacySignedNotice:
      "HTTP-only signed cookie session. No marketing spam. DPDP Act 2023 protected.",

    requestHumanButton: "Sales Exec",
    requestHumanTitle: "Connect directly with senior sales executive",
    endSessionButton: "End Session",
    optOutButton: "Opt Out (DPDP)",
    connectedWithHumanBanner: (name: string, summary: string, status: string) =>
      `Connected with ${name}: ${summary} (Status: ${status})`,
    groundedFactsBadge: (count: number) =>
      `Grounded in ${count} verified developer fact${count === 1 ? "" : "s"}`,
    consultingDatabaseIndicator: "Consulting verified database...",
    quickQuestionsTitle: "Quick Inquiries",
    quickQuestion1: "What are the prices and configurations for 2 and 3 BHK?",
    quickQuestion2: "Tell me about Prakriti Heights on SG Highway",
    quickQuestion3: "What site visit slots are available this week?",
    inputPlaceholder:
      "Ask about configurations, pricing, or visit availability...",
    sendMessageAria: "Send message",
    retryButton: "Retry",
    talkToSalesButton: "Talk to Sales",

    sessionEndedError: "Session ended or expired. Please re-authenticate.",
    temporaryHighDemandError:
      "The AI Concierge is currently experiencing temporary high demand. Please try again in a moment.",
    networkError:
      "Network connection interrupted. Please try again or connect with our sales team.",
    humanConnectionError:
      "Failed to connect with sales team. Please try again.",

    optOutModalTitle: "Withdraw Consent & Opt Out?",
    optOutModalBody:
      "Under the Digital Personal Data Protection (DPDP) Act 2023, exercising your right to opt out will immediately revoke your active session and suppress any future automated communication.",
    optOutCancelButton: "Cancel",
    optOutConfirmButton: "Confirm Opt-Out",
    optOutProcessingButton: "Processing...",
    optOutSuccessAlert:
      "Your consent has been successfully withdrawn. You will receive no further communications.",
    optOutFailureAlert: "Failed to record opt-out. Please refresh and try again.",

    statutoryNoticeTitle: "Statutory Demonstration Notice:",
    statutoryNoticeBody:
      "Project specifications, pricing, and registration status (RERA Reg: DEMO-ONLY-NOT-VERIFIED) are synthetic seed data for technical evaluation purposes only. No real commercial offering or external solicitation is made.",
    reraRegBadge: "RERA Reg: DEMO-ONLY-NOT-VERIFIED",
    portfolioBadge: "Ahmedabad Verified Residential Portfolio",
    aiBadge: "24/7 Grounded AI",
    footerCompliance:
      "RERA Reg: DEMO-ONLY-NOT-VERIFIED • DPDP Act 2023 Digital Consent Enforced • Ahmedabad, Gujarat",
  },

  HI: {
    backToResidences: "मुख्य पृष्ठ पर वापस जाएँ",
    brandTitle: "ENQUIVO",
    assistantHeaderTitle: "आवासीय AI कंसीयर्ज",
    assistantSubtitle:
      "प्रकृति हाइट्स (SG हाईवे) और वास्तु एन्क्लेव (शीला) के लिए समर्पित परामर्श। पूरी तरह से डेवलपर के सत्यापित तथ्यों पर आधारित।",
    groundedStatusBadge: "सत्यापित आधार",
    activeConsultationWith: (name: string) => `${name} के साथ परामर्श जारी`,
    verifiedAssistantSubtitle: "सत्यापित अहमदाबाद आवासीय सहायक",

    intakeTitle: "ENQUIVO आवासीय कंसीयर्ज",
    intakeSubtitle:
      "प्रकृति हाइट्स और वास्तु एन्क्लेव के बारे में 24/7 तत्काल सत्यापित जानकारी प्राप्त करें और निजी साइट विज़िट बुक करें। सभी उत्तर सत्यापित तथ्यों पर आधारित हैं।",
    intakeDisclaimerNotice:
      "24/7 सत्यापित AI • 2 प्रमुख प्रोजेक्ट • ₹65 लाख से ₹1.2 करोड़",
    nameLabel: "पूरा नाम",
    namePlaceholder: "उदा. हार्दिक पटेल",
    nameRequiredError: "कृपया अपना पूरा नाम दर्ज करें।",
    phoneLabel: "मोबाइल नंबर (भारत)",
    phonePlaceholder: "उदा. +91 98765 43210",
    phoneRequiredError: "कृपया अपना मोबाइल फ़ोन नंबर दर्ज करें।",
    emailLabel: "ईमेल पता",
    emailOptional: "(वैकल्पिक)",
    emailPlaceholder: "name@example.com",
    projectInterestLabel: "परियोजना में रुचि",
    projectAllOption: "सभी प्रोजेक्ट्स (अहमदाबाद पोर्टफोलियो)",
    projectPrakritiOption: "प्रकृति हाइट्स (SG हाईवे कॉरिडोर)",
    projectVaastuOption: "वास्तु एन्क्लेव (शीला / साउथ बोपल)",
    dpdpConsentLabel:
      "DPDP अधिनियम 2023 डिजिटल सहमति: मैं ENQUIVO को संपत्ति की सत्यापित जानकारी देने और अहमदाबाद में साइट विज़िट निर्धारित करने हेतु मेरा नाम और संपर्क नंबर प्रोसेस करने की सहमति देता हूँ। मैं किसी भी समय सहमति वापस ले सकता हूँ।",
    dpdpConsentRequiredError:
      "आगे बढ़ने के लिए DPDP अधिनियम 2023 के तहत डिजिटल सहमति अनिवार्य है।",
    startSessionButton: "AI कंसीयर्ज परामर्श शुरू करें",
    startingSessionButton: "सुरक्षित सत्र प्रारंभ हो रहा है...",
    privacySignedNotice:
      "HTTP-only हस्ताक्षरित कुकी सत्र। कोई स्पैम नहीं। DPDP अधिनियम 2023 द्वारा सुरक्षित।",

    requestHumanButton: "बिक्री अधिकारी",
    requestHumanTitle: "वरिष्ठ बिक्री कार्यकारी से सीधे संपर्क करें",
    endSessionButton: "सत्र समाप्त करें",
    optOutButton: "ऑप्ट आउट (DPDP)",
    connectedWithHumanBanner: (name: string, summary: string, status: string) =>
      `${name} से जुड़े: ${summary} (स्थिति: ${status})`,
    groundedFactsBadge: (count: number) =>
      `${count} सत्यापित डेवलपर तथ्यों पर आधारित`,
    consultingDatabaseIndicator: "सत्यापित डेटाबेस से जानकारी जांची जा रही है...",
    quickQuestionsTitle: "त्वरित प्रश्न",
    quickQuestion1: "2 और 3 BHK की कीमतें और कॉन्फ़िगरेशन क्या हैं?",
    quickQuestion2: "SG हाईवे पर प्रकृति हाइट्स के बारे में बताएँ",
    quickQuestion3: "इस सप्ताह साइट विज़िट के कौन-से स्लॉट उपलब्ध हैं?",
    inputPlaceholder:
      "कॉन्फ़िगरेशन, कीमतों या विज़िट स्लॉट के बारे में पूछें...",
    sendMessageAria: "संदेश भेजें",
    retryButton: "पुनः प्रयास करें",
    talkToSalesButton: "बिक्री टीम से बात करें",

    sessionEndedError: "सत्र समाप्त हो गया है। कृपया पुनः प्रमाणीकरण करें।",
    temporaryHighDemandError:
      "AI कंसीयर्ज पर वर्तमान में अत्यधिक मांग है। कृपया थोड़ी देर बाद प्रयास करें।",
    networkError:
      "नेटवर्क कनेक्शन में व्यवधान आया। कृपया पुनः प्रयास करें या बिक्री टीम से जुड़ें।",
    humanConnectionError:
      "बिक्री टीम से संपर्क स्थापित करने में विफल। कृपया पुनः प्रयास करें।",

    optOutModalTitle: "सहमति वापस लें और ऑप्ट आउट करें?",
    optOutModalBody:
      "डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम 2023 के अंतर्गत, ऑप्ट आउट करने पर आपका सक्रिय सत्र तुरंत समाप्त हो जाएगा और भविष्य के सभी स्वचालित संदेश रोक दिए जाएंगे।",
    optOutCancelButton: "रद्द करें",
    optOutConfirmButton: "ऑप्ट-आउट की पुष्टि करें",
    optOutProcessingButton: "प्रक्रिया जारी है...",
    optOutSuccessAlert:
      "आपकी सहमति सफलतापूर्वक वापस ले ली गई है। आपको आगे कोई संदेश प्राप्त नहीं होगा।",
    optOutFailureAlert: "ऑप्ट-आउट दर्ज करने में विफल। कृपया पुनः प्रयास करें।",

    statutoryNoticeTitle: "वैधानिक प्रदर्शन सूचना:",
    statutoryNoticeBody:
      "परियोजना विनिर्देश, कीमतें और पंजीकरण स्थिति (RERA Reg: DEMO-ONLY-NOT-VERIFIED) केवल तकनीकी मूल्यांकन के लिए सिंथेटिक डेटा हैं। कोई व्यावसायिक प्रस्ताव नहीं है।",
    reraRegBadge: "RERA Reg: DEMO-ONLY-NOT-VERIFIED",
    portfolioBadge: "अहमदाबाद सत्यापित आवासीय पोर्टफोलियो",
    aiBadge: "24/7 ग्राउंडेड एआई",
    footerCompliance:
      "RERA Reg: DEMO-ONLY-NOT-VERIFIED • DPDP अधिनियम 2023 डिजिटल सहमति लागू • अहमदाबाद, गुजरात",
  },

  GU: {
    backToResidences: "મુખ્ય પેજ પર પાછા જાઓ",
    brandTitle: "ENQUIVO",
    assistantHeaderTitle: "રેસિડેન્શિયલ AI કોન્સિયર્જ",
    assistantSubtitle:
      "પ્રકૃતિ હાઇટ્સ (SG હાઇવે) અને વાસ્તુ એન્ક્લેવ (શીલા) માટે સમર્પિત પરામર્શ. સંપૂર્ણપણે ચકાસાયેલ ડેવલપર તથ્યો પર આધારિત.",
    groundedStatusBadge: "પ્રમાણિત આધાર",
    activeConsultationWith: (name: string) => `${name} સાથે પરામર્શ ચાલુ`,
    verifiedAssistantSubtitle: "ચકાસાયેલ અમદાવાદ રેસિડેન્શિયલ આસિસ્ટન્ટ",

    intakeTitle: "ENQUIVO રેસિડેન્શિયલ કોન્સિયર્જ",
    intakeSubtitle:
      "પ્રકૃતિ હાઇટ્સ અને વાસ્તુ એન્ક્લેવ વિશે 24/7 ત્વરિત ચકાસાયેલ માહિતી મેળવો અને ખાનગી સાઇટ મુલાકાત બુક કરો. બધા જવાબો ડેવલપરના ચકાસાયેલ તથ્યો પર આધારિત છે.",
    intakeDisclaimerNotice:
      "24/7 ચકાસાયેલ AI • 2 લાઈવ પ્રોજેક્ટ્સ • ₹65 લાખ થી ₹1.2 કરોડ",
    nameLabel: "પૂરું નામ",
    namePlaceholder: "દા.ત. હાર્દિક પટેલ",
    nameRequiredError: "કૃપા કરીને તમારું પૂરું નામ દાખલ કરો.",
    phoneLabel: "મોબાઈલ નંબર (ભારત)",
    phonePlaceholder: "દા.ત. +91 98765 43210",
    phoneRequiredError: "કૃપા કરીને તમારો મોબાઈલ નંબર દાખલ કરો.",
    emailLabel: "ઈમેલ એડ્રેસ",
    emailOptional: "(વૈકલ્પિક)",
    emailPlaceholder: "name@example.com",
    projectInterestLabel: "પ્રોજેક્ટ પસંદગી",
    projectAllOption: "બધા પ્રોજેક્ટ્સ (અમદાવાદ પોર્ટફોલિયો)",
    projectPrakritiOption: "પ્રકૃતિ હાઇટ્સ (SG હાઇવે કોરિડોર)",
    projectVaastuOption: "વાસ્તુ એન્ક્લેવ (શીલા / સાઉથ બોપલ)",
    dpdpConsentLabel:
      "DPDP એક્ટ 2023 ડિજિટલ સંમતિ: હું અમદાવાદમાં મિલકતની ચકાસાયેલ વિગતો આપવા અને સાઇટ મુલાકાત શેડ્યૂલ કરવા માટે ENQUIVO ને મારું નામ અને સંપર્ક નંબર પ્રોસેસ કરવાની સંમતિ આપું છું. હું કોઈપણ સમયે સંમતિ પાછી ખેંચી શકું છું.",
    dpdpConsentRequiredError:
      "આગળ વધવા માટે DPDP એક્ટ 2023 હેઠળ ડિજિટલ સંમતિ ફરજિયાત છે.",
    startSessionButton: "AI કોન્સિયર્જ પરામર્શ શરૂ કરો",
    startingSessionButton: "સુરક્ષિત સત્ર શરૂ થઈ રહ્યું છે...",
    privacySignedNotice:
      "HTTP-only સુરક્ષિત કૂકી સત્ર. કોઈ માર્કેટિંગ સ્પામ નહીં. DPDP એક્ટ 2023 સુરક્ષિત.",

    requestHumanButton: "સેલ્સ એક્ઝિક્યુટિવ",
    requestHumanTitle: "વરિષ્ઠ સેલ્સ એક્ઝિક્યુટિવ સાથે સીધા જોડાઓ",
    endSessionButton: "સત્ર સમાપ્ત કરો",
    optOutButton: "ઑપ્ટ આઉટ (DPDP)",
    connectedWithHumanBanner: (name: string, summary: string, status: string) =>
      `${name} સાથે જોડાયેલા: ${summary} (સ્થિતિ: ${status})`,
    groundedFactsBadge: (count: number) =>
      `${count} ચકાસાયેલ ડેવલપર તથ્યો પર આધારિત`,
    consultingDatabaseIndicator: "ચકાસાયેલ ડેટાબેઝ તપાસવામાં આવી રહ્યો છે...",
    quickQuestionsTitle: "ઝડપી પ્રશ્નો",
    quickQuestion1: "2 અને 3 BHK ની કિંમતો અને વિગતો શું છે?",
    quickQuestion2: "SG હાઇવે પર પ્રકૃતિ હાઇટ્સ વિશે માહિતી આપો",
    quickQuestion3: "આ અઠવાડિયે સાઇટ મુલાકાતના કયા સ્લોટ્સ ઉપલબ્ધ છે?",
    inputPlaceholder:
      "રૂપરેખાંકન, કિંમતો અથવા સાઇટ મુલાકાત વિશે પૂછો...",
    sendMessageAria: "સંદેશ મોકલો",
    retryButton: "ફરી પ્રયાસ કરો",
    talkToSalesButton: "સેલ્સ ટીમ સાથે વાત કરો",

    sessionEndedError: "સત્ર સમાપ્ત થઈ ગયું છે. કૃપા કરીને ફરી પ્રમાણીકરણ કરો.",
    temporaryHighDemandError:
      "AI કોન્સિયર્જ પર હાલમાં ભારે ટ્રાફિક છે. કૃપા કરીને થોડીવાર પછી પ્રયાસ કરો.",
    networkError:
      "નેટવર્ક કનેક્શનમાં વિક્ષેપ આવ્યો. કૃપા કરીને ફરી પ્રયાસ કરો અથવા સેલ્સ ટીમનો સંપર્ક કરો.",
    humanConnectionError:
      "સેલ્સ ટીમ સાથે જોડાવામાં નિષ્ફળતા. કૃપા કરીને ફરી પ્રયાસ કરો.",

    optOutModalTitle: "સંમતિ પાછી ખેંચો અને ઑપ્ટ આઉટ કરો?",
    optOutModalBody:
      "ડિજિટલ પર્સનલ ડેટા પ્રોટેક્શન (DPDP) એક્ટ 2023 હેઠળ, ઑપ્ટ આઉટ કરવાથી તમારું સક્રિય સત્ર તરત રદ થશે અને ભવિષ્યના તમામ આપોઆપ સંદેશાઓ બંધ થશે.",
    optOutCancelButton: "રદ કરો",
    optOutConfirmButton: "ઑપ્ટ-આઉટની પુષ્ટિ કરો",
    optOutProcessingButton: "પ્રક્રિયા ચાલુ છે...",
    optOutSuccessAlert:
      "તમારી સંમતિ સફળતાપૂર્વક પાછી ખેંચી લેવામાં આવી છે. તમને હવે કોઈ સંદેશા મોકલવામાં આવશે નહીં.",
    optOutFailureAlert: "ઑપ્ટ-આઉટ નોંધવામાં નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો.",

    statutoryNoticeTitle: "વૈધાનિક પ્રદર્શન નોટિસ:",
    statutoryNoticeBody:
      "પ્રોજેક્ટ વિશિષ્ટતાઓ, કિંમતો અને નોંધણી સ્થિતિ (RERA Reg: DEMO-ONLY-NOT-VERIFIED) ફક્ત ટેકનિકલ મૂલ્યાંકન માટેનો સિન્થેટિક ડેટા છે. કોઈ વાસ્તવિક વ્યાપારી ઓફર નથી.",
    reraRegBadge: "RERA Reg: DEMO-ONLY-NOT-VERIFIED",
    portfolioBadge: "અમદાવાદ ચકાસાયેલ રહેણાંક પોર્ટફોલિયો",
    aiBadge: "24/7 ગ્રાઉન્ડેડ એઆઈ",
    footerCompliance:
      "RERA Reg: DEMO-ONLY-NOT-VERIFIED • DPDP અધિનિયમ 2023 ડિજિટલ સંમતિ લાગુ • અમદાવાદ, ગુજરાત",
  },
};
