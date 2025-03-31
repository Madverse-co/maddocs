import { z } from 'zod';

export const ChromePdfOptionsSchema = z.object({
  landscape: z.boolean().optional(),
  printBackground: z.boolean().optional(),
  displayHeaderFooter: z.boolean().optional(),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional(),
  paperWidth: z.number().optional(),
  paperHeight: z.number().optional(),
  marginTop: z.number().optional(),
  marginBottom: z.number().optional(),
  marginLeft: z.number().optional(),
  marginRight: z.number().optional(),
  pageRanges: z.string().optional(),
  ignoreInvalidPageRanges: z.boolean().optional(),
  scale: z.number().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  preferCSSPageSize: z.boolean().optional(),
  transferMode: z.enum(['ReturnBase64', 'ReturnUrl', 'Preserve']).optional(),
});

export type ChromePdfOptions = z.infer<typeof ChromePdfOptionsSchema>;

export const WkHtmlToPdfOptionsSchema = z.object({
  orientation: z.enum(['Portrait', 'Landscape']).optional(),
  pageSize: z.string().optional(),
  title: z.string().optional(),
  zoom: z.number().optional(),
  toc: z.boolean().optional(),
  grayscale: z.boolean().optional(),
  images: z.boolean().optional(),
  noImages: z.boolean().optional(),
  lowquality: z.boolean().optional(),
  dpi: z.number().optional(),
  imageDpi: z.number().optional(),
  imageQuality: z.number().optional(),
  marginTop: z.string().optional(),
  marginRight: z.string().optional(),
  marginBottom: z.string().optional(),
  marginLeft: z.string().optional(),
  footerCenter: z.string().optional(),
  footerLeft: z.string().optional(),
  footerRight: z.string().optional(),
  footerFontSize: z.number().optional(),
  footerSpacing: z.number().optional(),
  headerCenter: z.string().optional(),
  headerLeft: z.string().optional(),
  headerRight: z.string().optional(),
  headerFontSize: z.number().optional(),
  headerSpacing: z.number().optional(),
});

export type WkHtmlToPdfOptions = z.infer<typeof WkHtmlToPdfOptionsSchema>;

export const LibreOfficeOptionsSchema = z.object({
  pageRanges: z.string().optional(),
  password: z.string().optional(),
});

export type LibreOfficeOptions = z.infer<typeof LibreOfficeOptionsSchema>;

export const MergeOptionsSchema = z.object({
  pdfUrls: z.array(z.string()),
  fileNames: z.array(z.string()).optional(),
});

export type MergeOptions = z.infer<typeof MergeOptionsSchema>;

export const PdfResponseSchema = z.object({
  Success: z.boolean(),
  FileUrl: z.string(),
  MbOut: z.number(),
  Cost: z.number(),
  ResponseId: z.string(),
});

export type PdfResponse = z.infer<typeof PdfResponseSchema>;

// Add module declaration so TypeScript can find it
declare global {
  interface Api2PdfInstance {
    wkHtmlToPdf: (html: string, options?: WkHtmlToPdfOptions) => Promise<PdfResponse>;
    chromeHtmlToPdf: (html: string, options?: ChromePdfOptions) => Promise<PdfResponse>;
    headlessChromeFromUrl: (url: string, options?: ChromePdfOptions) => Promise<PdfResponse>;
    libreOffice: (
      file: string | Buffer | NodeJS.ReadStream,
      options?: LibreOfficeOptions,
    ) => Promise<PdfResponse>;
    merge: (files: string[], options?: MergeOptions) => Promise<PdfResponse>;
  }

  class Api2Pdf {
    constructor(apiKey: string);
    wkHtmlToPdf: (html: string, options?: WkHtmlToPdfOptions) => Promise<PdfResponse>;
    chromeHtmlToPdf: (html: string, options?: ChromePdfOptions) => Promise<PdfResponse>;
    headlessChromeFromUrl: (url: string, options?: ChromePdfOptions) => Promise<PdfResponse>;
    libreOffice: (
      file: string | Buffer | NodeJS.ReadStream,
      options?: LibreOfficeOptions,
    ) => Promise<PdfResponse>;
    merge: (files: string[], options?: MergeOptions) => Promise<PdfResponse>;
  }
}

export default Api2Pdf;
