declare module 'api2pdf' {
  export default class Api2Pdf {
    constructor(apiKey: string);

    wkHtmlToPdf(html: string, options?: any): Promise<any>;
    chromeHtmlToPdf(html: string, options?: any): Promise<any>;
    headlessChromeFromUrl(url: string, options?: any): Promise<any>;
    libreOffice(file: string | Buffer, options?: any): Promise<any>;
    merge(files: string[], options?: any): Promise<any>;
  }
}
