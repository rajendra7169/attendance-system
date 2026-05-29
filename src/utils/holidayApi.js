/**
 * Fetch public holidays from Nager.Date (https://date.nager.at).
 * Free, no auth required.
 *
 * For countries Nager doesn't support (Nepal among them), we ship a
 * hardcoded fallback list.
 */

export const COUNTRY_OPTIONS = [
  { code: "NP", name: "Nepal" },
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
];

// Hardcoded Nepal holidays (Nager doesn't cover NP) — common ones
const NEPAL_HOLIDAYS = (year) => [
  { date: `${year}-01-01`, name: "New Year (English)" },
  { date: `${year}-01-29`, name: "Martyrs' Day" },
  { date: `${year}-02-19`, name: "National Democracy Day" },
  { date: `${year}-03-08`, name: "International Women's Day" },
  { date: `${year}-04-14`, name: "Nepali New Year" },
  { date: `${year}-05-01`, name: "Labor Day" },
  { date: `${year}-05-29`, name: "Republic Day" },
  { date: `${year}-09-19`, name: "Constitution Day" },
  { date: `${year}-12-25`, name: "Christmas" },
];

export async function fetchHolidays(year, countryCode) {
  if (countryCode === "NP") {
    return NEPAL_HOLIDAYS(year);
  }
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
    );
    if (!res.ok) throw new Error(`Holiday fetch failed: ${res.status}`);
    const data = await res.json();
    return data.map((h) => ({
      date: h.date,
      name: h.localName || h.name,
    }));
  } catch (e) {
    console.error(e);
    throw new Error(`Could not fetch holidays for ${countryCode}. ${e.message}`);
  }
}
