const CURRENT_TIMEZONE_NAMES = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Coral_Harbour": "America/Atikokan",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
} as const satisfies Record<string, string>;

type LegacyTimezoneName = keyof typeof CURRENT_TIMEZONE_NAMES;

export function currentTimezoneName(zone: string): string {
  return isLegacyTimezoneName(zone) ? CURRENT_TIMEZONE_NAMES[zone] : zone;
}

export function legacyTimezoneNames(zone: string): string[] {
  return Object.entries(CURRENT_TIMEZONE_NAMES)
    .filter(([, currentName]) => currentName === zone)
    .map(([legacyName]) => legacyName);
}

function isLegacyTimezoneName(zone: string): zone is LegacyTimezoneName {
  return Object.hasOwn(CURRENT_TIMEZONE_NAMES, zone);
}
