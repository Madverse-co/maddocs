export type DiyOwnerType = 'LABEL' | 'ARTIST';

export interface DiyOwnerContext {
  ownerType: DiyOwnerType;
  artistName: string;
  signatoryName: string;
  ownerDesignation: string;
  legalName?: string;
  extraAliases?: string[];
}

export function normalizeOwnerType(value: string): DiyOwnerType | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'label') return 'LABEL';
  if (normalized === 'artist' || normalized === 'single_artist') return 'ARTIST';
  if (value === 'LABEL' || value === 'ARTIST') return value;

  return null;
}

export function shouldIncludeIprsSchedule(ownerType: DiyOwnerType): boolean {
  return ownerType === 'ARTIST';
}

export function buildOwnerPartyLine({
  ownerType,
  artistName,
  ownerDesignation,
  legalName,
}: DiyOwnerContext): string {
  const name = artistName.trim();

  if (ownerType === 'ARTIST') {
    return `${name} (${ownerDesignation.trim()})`;
  }

  const ownedBy = legalName?.trim() ? ` (Owned by : ${legalName.trim()})` : '';
  return `${name} Official${ownedBy}`;
}

export function buildDefaultOwnerAliases({
  ownerType,
  artistName,
  extraAliases = [],
}: Pick<DiyOwnerContext, 'ownerType' | 'artistName' | 'extraAliases'>): string[] {
  const name = artistName.trim();
  const extras = extraAliases.map((a) => a.trim()).filter(Boolean);

  if (ownerType === 'ARTIST') {
    return extras.length > 0 ? extras : [name];
  }

  const defaults = [`${name} Official`];
  const merged = [...defaults, ...extras.filter((a) => a !== defaults[0])];
  return merged;
}

export function getDiyAgreementSignaturePages(includeIprs: boolean) {
  return {
    witnessPage: 8,
    iprsSignaturePage: includeIprs ? 11 : null,
  };
}
