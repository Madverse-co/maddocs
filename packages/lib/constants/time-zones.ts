// Minimal timezone data to avoid webpack issues with @vvo/tzdb
// This is a temporary fix - we can enhance this later
const MINIMAL_TIMEZONE_DATA = [
  { name: 'Etc/UTC', rawOffsetInMinutes: 0 },
  { name: 'America/New_York', rawOffsetInMinutes: -300 },
  { name: 'Europe/London', rawOffsetInMinutes: 0 },
  { name: 'Asia/Tokyo', rawOffsetInMinutes: 540 },
  { name: 'America/Los_Angeles', rawOffsetInMinutes: -480 },
  { name: 'Asia/Kolkata', rawOffsetInMinutes: 330 }, // India Standard Time (IST) UTC+5:30
];

const MINIMAL_TIMEZONE_NAMES = [
  'Etc/UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'America/Los_Angeles',
  'Asia/Kolkata',
];

export const TIME_ZONE_DATA = MINIMAL_TIMEZONE_DATA;

export const DEFAULT_DOCUMENT_TIME_ZONE = 'Etc/UTC';

export type TimeZone = {
  name: string;
  rawOffsetInMinutes: number;
};

export const minutesToHours = (minutes: number): string => {
  const hours = Math.abs(Math.floor(minutes / 60));
  const min = Math.abs(minutes % 60);
  const sign = minutes >= 0 ? '+' : '-';

  return `${sign}${String(hours).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const getGMTOffsets = (timezones: TimeZone[]): string[] => {
  const gmtOffsets: string[] = [];

  for (const timezone of timezones) {
    const offsetValue = minutesToHours(timezone.rawOffsetInMinutes);
    const gmtText = `(${offsetValue})`;

    gmtOffsets.push(`${timezone.name} ${gmtText}`);
  }

  return gmtOffsets;
};

export const splitTimeZone = (input: string | null): string => {
  if (input === null) {
    return '';
  }
  const [timeZone] = input.split('(');

  return timeZone.trim();
};

export const TIME_ZONES_FULL = getGMTOffsets(TIME_ZONE_DATA);

export const TIME_ZONES = ['Etc/UTC', ...MINIMAL_TIMEZONE_NAMES];
