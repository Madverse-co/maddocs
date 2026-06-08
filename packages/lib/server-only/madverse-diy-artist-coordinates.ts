export interface DiyAgreementFieldCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
  marker: string;
  pageNumber: number;
}

export const DIY_AGREEMENT_WITNESS_PAGE = 8;
export const DIY_AGREEMENT_IPRS_PAGE = 11;

/** Owner — left column */
export const DIY_OWNER_WITNESS_FIELDS: DiyAgreementFieldCoordinate[] = [
  {
    x: 22,
    y: 50,
    width: 9,
    height: 2,
    marker: 'SIGNATURE',
    pageNumber: DIY_AGREEMENT_WITNESS_PAGE,
  },
  {
    x: 18.5,
    y: 55.5,
    width: 11.5,
    height: 2,
    marker: 'DATE',
    pageNumber: DIY_AGREEMENT_WITNESS_PAGE,
  },
];

/** Rohan Jain / Madverse — right column */
export const DIY_MADVERSE_WITNESS_FIELDS: DiyAgreementFieldCoordinate[] = [
  {
    x: 61,
    y: 52.9,
    width: 8.5,
    height: 1.6,
    marker: 'SIGNATURE',
    pageNumber: DIY_AGREEMENT_WITNESS_PAGE,
  },
  {
    x: 56.5,
    y: 55.5,
    width: 11.5,
    height: 2,
    marker: 'DATE',
    pageNumber: DIY_AGREEMENT_WITNESS_PAGE,
  },
];

/** Owner only — Schedule C IPRS letter */
export const DIY_OWNER_IPRS_FIELDS: DiyAgreementFieldCoordinate[] = [
  {
    x: 74,
    y: 11,
    width: 20,
    height: 2,
    marker: 'DATE',
    pageNumber: DIY_AGREEMENT_IPRS_PAGE,
  },
  {
    x: 12,
    y: 57.5,
    width: 22,
    height: 3.5,
    marker: 'SIGNATURE',
    pageNumber: DIY_AGREEMENT_IPRS_PAGE,
  },
];
