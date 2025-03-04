import chromium from '@sparticuz/chromium-min';
import { Client } from '@upstash/qstash';
import puppeteer from 'puppeteer';
import { type Browser } from 'puppeteer';
import { type Browser as BrowserCore } from 'puppeteer-core';

import { labelInvite } from './madverse-templates';

interface GeneratePdfParams {
  labelName: string;
  labelAddress: string;
  royaltySplit: number;
}

interface CreateDocumentRecipient {
  name: string;
  email: string;
  role: 'SIGNER';
  signingOrder: number;
}

interface CreateDocumentPayload {
  title: string;
  externalId?: string;
  recipients: CreateDocumentRecipient[];
}

export async function createDocument(payload: CreateDocumentPayload) {
  try {
    const url = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/v1/documents`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: process.env.ADMIN_ACCOUNT_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create document');
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Document creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create document',
    };
  }
}

function numberToWords(n: number) {
  if (n < 0) return false;
  const single_digit = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double_digit = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const below_hundred = [
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  let word = '';
  if (n === 0) return 'Zero';
  function translate(n: number) {
    word = '';
    if (n < 10) {
      word = single_digit[n] + ' ';
    } else if (n < 20) {
      word = double_digit[n - 10] + ' ';
    } else if (n < 100) {
      const rem = translate(n % 10);
      word = below_hundred[(n - (n % 10)) / 10 - 2] + ' ' + rem;
    }
    return word;
  }
  const result = translate(n);
  return result.trim();
}

export async function generatePdf({ labelName, labelAddress, royaltySplit }: GeneratePdfParams) {
  try {
    let htmlContent = labelInvite;

    // Add consistent styling
    const styleTag = `
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.4;
          color: #333;
        }
        h1 {
          font-size: 12pt;
          font-weight: bold;
          margin: 8px 0;
        }
        p {
          margin: 6px 0;
          font-size: 11pt;
        }
        .s1, .s2, .s3 {
          font-size: 11pt;
        }
        li {
          margin: 6px 0;
        }
        table {
          font-size: 11pt;
        }
        .page-break {
          page-break-after: always;
        }
      </style>
    `;

    // Insert style tag before closing head tag
    htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);

    // Add today's date in the MADverse signature section
    const todayDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    htmlContent = htmlContent.replace('<span class="today-date-box"></span>', todayDate);

    // Replace the placeholder content
    htmlContent = htmlContent.replace('[Label Name]', labelName);
    htmlContent = htmlContent.replace(
      'with registered address at [Label Address]',
      `with registered address at ${labelAddress}`,
    );
    htmlContent = htmlContent.replace(
      'xxx% (xxx percent)',
      `${royaltySplit}% (${numberToWords(royaltySplit)} percent)`,
    );
    htmlContent = htmlContent.replace('[Date]', todayDate);

    let browser: Browser | BrowserCore;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(
          `https://github.com/Sparticuz/chromium/releases/download/v132.0.0/chromium-v132.0.0-pack.tar`,
        ),
        headless: 'shell',
      });
    } else {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    console.log('generatePdf: Browser launched');
    const page = await browser.newPage();

    // Load HTML content directly instead of from file
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Get coordinates of signature boxes
    const signBoxCoordinates = {
      x: 30.7,
      y: 65.2,
      width: 15.5,
      height: 4,
      marker: 'SIGNATURE',
      pageNumber: 7,
    };

    const nameBoxCoordinates = {
      x: 30.7,
      y: 70.7,
      width: 15.5,
      height: 4,
      marker: 'NAME',
      pageNumber: 7,
    };

    const dateBoxCoordinates = {
      x: 30.7,
      y: 72.7,
      width: 15.5,
      height: 4,
      marker: 'DATE',
      pageNumber: 7,
    };

    const signatureBoxCoordinates = [signBoxCoordinates, nameBoxCoordinates, dateBoxCoordinates];
    const madverseSignatureBoxCoordinates = {
      x: 69.6,
      y: 65.2,
      width: 15.5,
      height: 4,
      marker: 'SIGNATURE',
      pageNumber: 7,
    };

    // Generate PDF in memory
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    await browser.close();

    // Process the PDF in memory
    const pdfFile = new File([pdfBuffer], `${labelName.replace(/\s+/g, '_')}.pdf`, {
      type: 'application/pdf',
    });

    return {
      success: true,
      file: pdfFile,
      signatureBoxCoordinates,
      madverseSignatureBoxCoordinates,
    };
  } catch (error) {
    console.error('PDF generation failed:', error);
    return {
      success: false,
      error: 'Failed to generate PDF',
    };
  }
}

export const addEventToQueue = async (
  url: string,
  body: Record<string, unknown>,
  deduplicationId?: string,
  queue?: string,
  notBefore?: number, // milliseconds
) => {
  try {
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN,
    });

    await qstash.publishJSON({
      url,
      body,
      queue,
      deduplicationId,
      notBefore,
    });
  } catch (error) {
    console.error('Error in adding event to qstash queue : ', {
      error: error,
      url,
      body,
      queue,
      deduplicationId,
      notBefore,
    });
  }
};
