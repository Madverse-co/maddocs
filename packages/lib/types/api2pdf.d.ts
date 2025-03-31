declare module 'api2pdf' {
  export interface PdfResponse {
    Success: boolean;
    FileUrl: string;
    MbOut: number;
    Cost: number;
    ResponseId: string;
  }

  export interface ChromePdfOptions {
    landscape?: boolean;
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    paperWidth?: number;
    paperHeight?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    pageRanges?: string;
    ignoreInvalidPageRanges?: boolean;
    scale?: number;
    width?: string;
    height?: string;
    preferCSSPageSize?: boolean;
    transferMode?: 'ReturnBase64' | 'ReturnUrl' | 'Preserve';
  }

  export interface WkHtmlToPdfOptions {
    orientation?: 'Portrait' | 'Landscape';
    pageSize?: 'A4' | 'Letter' | 'Legal' | string;
    title?: string;
    zoom?: number;
    toc?: boolean;
    grayscale?: boolean;
    images?: boolean;
    noImages?: boolean;
    lowquality?: boolean;
    dpi?: number;
    imageDpi?: number;
    imageQuality?: number;
    marginTop?: string;
    marginRight?: string;
    marginBottom?: string;
    marginLeft?: string;
    footerCenter?: string;
    footerLeft?: string;
    footerRight?: string;
    footerFontSize?: number;
    footerSpacing?: number;
    headerCenter?: string;
    headerLeft?: string;
    headerRight?: string;
    headerFontSize?: number;
    headerSpacing?: number;
  }

  export interface LibreOfficeOptions {
    pageRanges?: string;
    password?: string;
  }

  export interface MergeOptions {
    pdfUrls: string[];
    fileNames?: string[];
  }

  export type FileInput = string | Buffer | NodeJS.ReadStream;

  export default class Api2Pdf {
    constructor(apiKey: string);

    wkHtmlToPdf(html: string, options?: WkHtmlToPdfOptions): Promise<PdfResponse>;
    chromeHtmlToPdf(html: string, options?: ChromePdfOptions): Promise<PdfResponse>;
    headlessChromeFromUrl(url: string, options?: ChromePdfOptions): Promise<PdfResponse>;
    libreOffice(file: FileInput, options?: LibreOfficeOptions): Promise<PdfResponse>;
    merge(files: string[], options?: MergeOptions): Promise<PdfResponse>;
  }
}
