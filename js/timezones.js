/* =====================================================================
   TIME ZONES \u2014 billing address -> IANA time zone, and conversions.
   Countries with several zones are resolved by state/province.
   You can always override the zone manually in the app.
   ===================================================================== */
(function () {
  const COUNTRY_TZ = {
    "India": "Asia/Kolkata", "United Kingdom": "Europe/London", "Ireland": "Europe/Dublin",
    "Germany": "Europe/Berlin", "France": "Europe/Paris", "Netherlands": "Europe/Amsterdam",
    "Belgium": "Europe/Brussels", "Switzerland": "Europe/Zurich", "Austria": "Europe/Vienna",
    "Italy": "Europe/Rome", "Spain": "Europe/Madrid", "Portugal": "Europe/Lisbon",
    "Sweden": "Europe/Stockholm", "Norway": "Europe/Oslo", "Denmark": "Europe/Copenhagen",
    "Finland": "Europe/Helsinki", "Poland": "Europe/Warsaw", "Czech Republic": "Europe/Prague",
    "Hungary": "Europe/Budapest", "Romania": "Europe/Bucharest", "Greece": "Europe/Athens",
    "Turkey": "Europe/Istanbul", "Israel": "Asia/Jerusalem", "United Arab Emirates": "Asia/Dubai",
    "Saudi Arabia": "Asia/Riyadh", "Qatar": "Asia/Qatar", "Egypt": "Africa/Cairo",
    "South Africa": "Africa/Johannesburg", "Nigeria": "Africa/Lagos", "Kenya": "Africa/Nairobi",
    "Singapore": "Asia/Singapore", "Malaysia": "Asia/Kuala_Lumpur", "Philippines": "Asia/Manila",
    "Thailand": "Asia/Bangkok", "Vietnam": "Asia/Ho_Chi_Minh", "Indonesia": "Asia/Jakarta",
    "China": "Asia/Shanghai", "Hong Kong": "Asia/Hong_Kong", "Taiwan": "Asia/Taipei",
    "Japan": "Asia/Tokyo", "South Korea": "Asia/Seoul", "Pakistan": "Asia/Karachi",
    "Bangladesh": "Asia/Dhaka", "Sri Lanka": "Asia/Colombo", "Nepal": "Asia/Kathmandu",
    "New Zealand": "Pacific/Auckland", "Argentina": "America/Argentina/Buenos_Aires",
    "Chile": "America/Santiago", "Colombia": "America/Bogota", "Peru": "America/Lima",
    "Costa Rica": "America/Costa_Rica", "Puerto Rico": "America/Puerto_Rico",
    // multi-zone defaults (refined by state below)
    "United States": "America/New_York", "Canada": "America/Toronto",
    "Australia": "Australia/Sydney", "Brazil": "America/Sao_Paulo", "Mexico": "America/Mexico_City",
  };

  const COUNTRY_ALIASES = {
    "usa": "United States", "us": "United States", "u.s.": "United States", "u.s.a.": "United States",
    "united states of america": "United States", "uk": "United Kingdom", "great britain": "United Kingdom",
    "england": "United Kingdom", "scotland": "United Kingdom", "uae": "United Arab Emirates",
    "korea": "South Korea", "republic of korea": "South Korea", "czechia": "Czech Republic",
  };

  const ET = "America/New_York", CT = "America/Chicago", MT = "America/Denver",
        PT = "America/Los_Angeles", AZ = "America/Phoenix";
  const STATE_TZ = {
    "United States": {
      AL: CT, AK: "America/Anchorage", AZ: AZ, AR: CT, CA: PT, CO: MT, CT: ET, DE: ET, DC: ET,
      FL: ET, GA: ET, HI: "Pacific/Honolulu", ID: MT, IL: CT, IN: ET, IA: CT, KS: CT, KY: ET,
      LA: CT, ME: ET, MD: ET, MA: ET, MI: ET, MN: CT, MS: CT, MO: CT, MT: MT, NE: CT, NV: PT,
      NH: ET, NJ: ET, NM: MT, NY: ET, NC: ET, ND: CT, OH: ET, OK: CT, OR: PT, PA: ET, RI: ET,
      SC: ET, SD: CT, TN: CT, TX: CT, UT: MT, VT: ET, VA: ET, WA: PT, WV: ET, WI: CT, WY: MT,
    },
    "Canada": {
      BC: "America/Vancouver", AB: "America/Edmonton", SK: "America/Regina", MB: "America/Winnipeg",
      ON: "America/Toronto", QC: "America/Toronto", NB: "America/Halifax", NS: "America/Halifax",
      PE: "America/Halifax", NL: "America/St_Johns", YT: "America/Whitehorse",
      NT: "America/Yellowknife", NU: "America/Iqaluit",
    },
    "Australia": {
      NSW: "Australia/Sydney", ACT: "Australia/Sydney", VIC: "Australia/Melbourne",
      QLD: "Australia/Brisbane", SA: "Australia/Adelaide", WA: "Australia/Perth",
      TAS: "Australia/Hobart", NT: "Australia/Darwin",
    },
  };

  const US_NAMES = { "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY" };
  const CA_NAMES = { "british columbia":"BC","alberta":"AB","saskatchewan":"SK","manitoba":"MB","ontario":"ON","quebec":"QC","qu\u00e9bec":"QC","new brunswick":"NB","nova scotia":"NS","prince edward island":"PE","newfoundland and labrador":"NL","newfoundland":"NL","yukon":"YT","northwest territories":"NT","nunavut":"NU" };
  const AU_NAMES = { "new south wales":"NSW","australian capital territory":"ACT","victoria":"VIC","queensland":"QLD","south australia":"SA","western australia":"WA","tasmania":"TAS","northern territory":"NT" };

  function normCountry(c) {
    if (!c) return "";
    const t = c.trim();
    const alias = COUNTRY_ALIASES[t.toLowerCase()];
    if (alias) return alias;
    const hit = Object.keys(COUNTRY_TZ).find(k => k.toLowerCase() === t.toLowerCase());
    return hit || t;
  }

  function stateCode(country, state) {
    if (!state) return "";
    const s = state.trim();
    const names = country === "United States" ? US_NAMES : country === "Canada" ? CA_NAMES : country === "Australia" ? AU_NAMES : {};
    return names[s.toLowerCase()] || s.toUpperCase();
  }

  /** Returns { tz, confident, note } */
  function lookupTimeZone(country, state) {
    const c = normCountry(country);
    if (!c) return { tz: "", confident: false, note: "Enter the billing country." };
    const states = STATE_TZ[c];
    if (states) {
      const code = stateCode(c, state);
      if (code && states[code]) return { tz: states[code], confident: true, note: `${c}, ${code}` };
      return { tz: COUNTRY_TZ[c], confident: false, note: `${c} has several time zones. Add the state/province or pick the zone.` };
    }
    if (COUNTRY_TZ[c]) return { tz: COUNTRY_TZ[c], confident: true, note: c };
    return { tz: "", confident: false, note: `No zone on file for "${country}". Pick it manually.` };
  }

  /* ---- conversions (DST-aware via Intl) ---- */
  function offsetMinutes(tz, date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return (asUtc - date.getTime()) / 60000;
  }

  /** Wall-clock time in a zone -> Date (UTC instant). dateStr = "YYYY-MM-DD" */
  function zonedToUtc(dateStr, hour, minute, tz) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const guess = Date.UTC(y, m - 1, d, hour, minute);
    let off = offsetMinutes(tz, new Date(guess));
    let ts = guess - off * 60000;
    const off2 = offsetMinutes(tz, new Date(ts));
    if (off2 !== off) ts = guess - off2 * 60000;
    return new Date(ts);
  }

  function formatInZone(date, tz, withDate = true) {
    const opts = { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" };
    if (withDate) Object.assign(opts, { weekday: "short", day: "numeric", month: "short" });
    return new Intl.DateTimeFormat("en-GB", opts).format(date);
  }

  function hourInZone(date, tz) {
    const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(date);
    return Number(h) + Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "numeric" }).format(date)) / 60;
  }

  function allZones() {
    try { return Intl.supportedValuesOf("timeZone"); }
    catch { return [...new Set(Object.values(COUNTRY_TZ).concat(...Object.values(STATE_TZ).map(Object.values)))].sort(); }
  }

  window.TZ = {
    COUNTRIES: Object.keys(COUNTRY_TZ).sort(),
    lookupTimeZone, zonedToUtc, formatInZone, hourInZone, allZones, normCountry,
  };
})();

