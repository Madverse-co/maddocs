import chromium from '@sparticuz/chromium-min';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer-core';

import { labelInvite } from './madverse-templates';

interface GeneratePdfParams {
  labelName: string;
  labelAddress: string;
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
    const response = await fetch(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/v1/documents`, {
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

export async function generatePdf({ labelName, labelAddress }: GeneratePdfParams) {
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
        
        /* Add signature box styles */
        .signature-box {
          display: inline-block;
          width: 150px;
          height: 40px;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          margin-left: 10px;
          vertical-align: middle;
        }
        .name-box {
          display: inline-block;
          width: 150px;
          height: 40px;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          margin-left: 10px;
          vertical-align: middle;
        }
        .date-box {
          display: inline-block;
          width: 150px;
          height: 40px;
          background-color: #f5f5f5;
        }
        .today-date-box {
          display: inline-block;
          width: 150px;
          height: 40px;
          background-color: #f5f5f5;
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
    htmlContent = htmlContent.replace('Compass Box Studio', labelName);
    htmlContent = htmlContent.replace('307, Off, Airport Rd, behind', '');
    htmlContent = htmlContent.replace(
      'C.S.D. Depot, Sardarnagar, Ahmedabad Cantonment, Ahmedabad, Gujarat 380004',
      labelAddress,
    );

    // Use puppeteer in memory without writing to disk
    const browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(
        `https://github.com/Sparticuz/chromium/releases/download/v132.0.0/chromium-v132.0.0-pack.tar`,
      ),
      headless: 'shell',
    });
    console.log('generatePdf: Browser launched');
    const page = await browser.newPage();

    // Load HTML content directly instead of from file
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Get coordinates of signature boxes
    const signBoxCoordinates = {
      x: 21,
      y: 68.6,
      width: 15.5,
      height: 4,
      marker: 'SIGNATURE',
      pageNumber: 6,
    };

    const nameBoxCoordinates = {
      x: 21,
      y: 76,
      width: 15.5,
      height: 4,
      marker: 'NAME',
      pageNumber: 6,
    };

    const dateBoxCoordinates = {
      x: 21,
      y: 83,
      width: 15.5,
      height: 4,
      marker: 'DATE',
      pageNumber: 6,
    };

    const signatureBoxCoordinates = [signBoxCoordinates, nameBoxCoordinates, dateBoxCoordinates];
    const madverseSignatureBoxCoordinates = {
      x: 75,
      y: 68.6,
      width: 15.5,
      height: 4,
      marker: 'SIGNATURE',
      pageNumber: 6,
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
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    let finalPdfBuffer = pdfBuffer;

    if (pageCount > 2) {
      const pagesToKeep = pageCount - 2;
      const newPdfDoc = await PDFDocument.create();
      const copiedPages = await newPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: pagesToKeep }, (_, i) => i),
      );
      copiedPages.forEach((page) => newPdfDoc.addPage(page));

      const pdfBytes = await newPdfDoc.save();
      finalPdfBuffer = new Uint8Array(Buffer.from(pdfBytes));
    }

    // Create a File object from the buffer
    const pdfFile = new File([finalPdfBuffer], `${labelName.replace(/\s+/g, '_')}.pdf`, {
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

export async function sendDocument(documentId: string) {
  try {
    const response = await fetch(`/api/v1/documents/${documentId}/send`, {
      method: 'POST',
      headers: {
        Authorization: process.env.ADMIN_ACCOUNT_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sendEmail: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send document');
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Document sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send document',
    };
  }
}
