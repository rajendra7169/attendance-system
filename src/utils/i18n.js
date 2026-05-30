import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "tally:lang";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ne", label: "नेपाली" },
  { code: "hi", label: "हिन्दी" },
];

// Translation dictionary. Keys are dot-paths; values are per-language strings.
// English entries double as the fallback when a key is missing in the
// selected language. Add new keys here as more surfaces are translated.
const DICT = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.my_attendance": "My attendance",
    "nav.admin": "Admin",
    "nav.logout": "Logout",
    "nav.toggle_theme": "Toggle theme",
    "nav.language": "Language",

    "greeting.morning": "Good morning",
    "greeting.afternoon": "Good afternoon",
    "greeting.evening": "Good evening",
    "dashboard.subtitle": "Submit your attendance and track your record.",
    "dashboard.today": "Today",
    "dashboard.request_leave": "Request leave",
    "dashboard.wrapped": "Wrapped",

    "checkin.now": "Check in now",
    "checkin.in_progress": "Checking in...",
    "checkin.half_day": "Half day",
    "checkin.half_day_hint": "(counts as 0.5)",
    "checkin.half_button": "Check in (half day)",
    "checkout.now": "Check out now",
    "checkout.in_progress": "Checking out...",
    "break.start": "Start break",
    "break.end": "End break",
    "break.on_break": "On break",
    "break.resting": "Pause — your tree is resting",
    "checkin.working": "Currently working · your tree is growing",
    "checkin.day_complete": "Day complete. See you tomorrow!",

    "presence.in_office": "In office",
    "presence.not_in_office": "Not in office",
    "presence.turn_on": "Turn on location to verify office",
    "presence.blocked": "Location blocked",

    "login.email": "Email",
    "login.password": "Password",
    "login.sign_in": "Sign in",
    "login.forgot": "Forgot password?",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.loading": "Loading...",
  },
  ne: {
    "nav.dashboard": "ड्यासबोर्ड",
    "nav.my_attendance": "मेरो हाजिरी",
    "nav.admin": "एडमिन",
    "nav.logout": "लग आउट",
    "nav.toggle_theme": "थिम परिवर्तन",
    "nav.language": "भाषा",

    "greeting.morning": "शुभ प्रभात",
    "greeting.afternoon": "नमस्ते",
    "greeting.evening": "शुभ साँझ",
    "dashboard.subtitle": "आफ्नो हाजिरी पेश गर्नुहोस् र रेकर्ड हेर्नुहोस्।",
    "dashboard.today": "आज",
    "dashboard.request_leave": "बिदा अनुरोध",
    "dashboard.wrapped": "वर्षको सारांश",

    "checkin.now": "अहिले चेक-इन",
    "checkin.in_progress": "चेक-इन हुँदै...",
    "checkin.half_day": "आधा दिन",
    "checkin.half_day_hint": "(०.५ गणना हुन्छ)",
    "checkin.half_button": "चेक-इन (आधा दिन)",
    "checkout.now": "अहिले चेक-आउट",
    "checkout.in_progress": "चेक-आउट हुँदै...",
    "break.start": "विश्राम सुरु",
    "break.end": "विश्राम समाप्त",
    "break.on_break": "विश्राममा",
    "break.resting": "विराम — तपाईंको रुख विश्राममा छ",
    "checkin.working": "कार्यरत · तपाईंको रुख बढ्दै छ",
    "checkin.day_complete": "दिन पूरा भयो। भोलि भेटौंला!",

    "presence.in_office": "कार्यालयमा",
    "presence.not_in_office": "कार्यालयमा छैन",
    "presence.turn_on": "स्थान सक्षम गर्नुहोस्",
    "presence.blocked": "स्थान बन्द छ",

    "login.email": "इमेल",
    "login.password": "पासवर्ड",
    "login.sign_in": "साइन-इन",
    "login.forgot": "पासवर्ड बिर्सनुभयो?",

    "common.cancel": "रद्द गर्नुहोस्",
    "common.save": "सुरक्षित गर्नुहोस्",
    "common.loading": "लोड हुँदै...",
  },
  hi: {
    "nav.dashboard": "डैशबोर्ड",
    "nav.my_attendance": "मेरी उपस्थिति",
    "nav.admin": "एडमिन",
    "nav.logout": "लॉग आउट",
    "nav.toggle_theme": "थीम बदलें",
    "nav.language": "भाषा",

    "greeting.morning": "सुप्रभात",
    "greeting.afternoon": "नमस्ते",
    "greeting.evening": "शुभ संध्या",
    "dashboard.subtitle": "अपनी उपस्थिति दर्ज करें और रिकॉर्ड देखें।",
    "dashboard.today": "आज",
    "dashboard.request_leave": "छुट्टी का अनुरोध",
    "dashboard.wrapped": "वार्षिक सारांश",

    "checkin.now": "अभी चेक-इन करें",
    "checkin.in_progress": "चेक-इन हो रहा है...",
    "checkin.half_day": "आधा दिन",
    "checkin.half_day_hint": "(0.5 गिना जाता है)",
    "checkin.half_button": "चेक-इन (आधा दिन)",
    "checkout.now": "अभी चेक-आउट करें",
    "checkout.in_progress": "चेक-आउट हो रहा है...",
    "break.start": "ब्रेक शुरू",
    "break.end": "ब्रेक समाप्त",
    "break.on_break": "ब्रेक पर",
    "break.resting": "विराम — आपका पेड़ आराम कर रहा है",
    "checkin.working": "कार्यरत · आपका पेड़ बढ़ रहा है",
    "checkin.day_complete": "दिन पूरा हुआ। कल मिलते हैं!",

    "presence.in_office": "ऑफिस में",
    "presence.not_in_office": "ऑफिस में नहीं",
    "presence.turn_on": "स्थान चालू करें",
    "presence.blocked": "स्थान अवरुद्ध",

    "login.email": "ईमेल",
    "login.password": "पासवर्ड",
    "login.sign_in": "साइन-इन",
    "login.forgot": "पासवर्ड भूल गए?",

    "common.cancel": "रद्द करें",
    "common.save": "सहेजें",
    "common.loading": "लोड हो रहा है...",
  },
};

function resolveInitial() {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && DICT[saved]) return saved;
  const browser = navigator.language?.slice(0, 2);
  if (browser && DICT[browser]) return browser;
  return "en";
}

const LangContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(resolveInitial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next) => {
    if (!DICT[next]) return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  // Lookup with English fallback so partially-translated screens still render.
  const t = (key) => DICT[lang]?.[key] ?? DICT.en[key] ?? key;

  return React.createElement(
    LangContext.Provider,
    { value: { lang, setLang, t } },
    children,
  );
}

export function useTranslation() {
  return useContext(LangContext);
}
