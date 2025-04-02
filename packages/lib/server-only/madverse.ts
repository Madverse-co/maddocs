import { Client } from '@upstash/qstash';

import Api2Pdf from '@documenso/lib/types/pdf';

import { labelInvite } from './madverse-templates';

const api2pdf = new Api2Pdf(process.env.API2PDF_API_KEY ?? '');

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

export const generatePDFBuffer = async (html: string) => {
  const response = await api2pdf.chromeHtmlToPdf(html);

  if (!response.Success) {
    throw new Error(`Failed to generate PDF: ${response}`);
  }

  const fileUrl = response.FileUrl;
  const pdfResponse = await fetch(fileUrl);
  const pdfBuffer = await pdfResponse.arrayBuffer();
  return pdfBuffer;
};

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
    htmlContent = htmlContent.replace('[Today Date]', todayDate);
    // htmlContent = htmlContent.replace('[Rohan Date]', todayDate);

    // Replace the placeholder content
    htmlContent = htmlContent.replace('[Label Name]', labelName);
    htmlContent = htmlContent.replace('[Label Address]', labelAddress);
    htmlContent = htmlContent.replace(
      '[Royalty Split]',
      `${royaltySplit}% (${numberToWords(royaltySplit)} percent)`,
    );

    // Get coordinates of signature boxes
    const signBoxCoordinates = {
      x: 60.5,
      y: 67.9,
      width: 15.5,
      height: 4,
      marker: 'SIGNATURE',
      pageNumber: 1,
    };

    const nameBoxCoordinates = {
      x: 53.8,
      y: 59.4,
      width: 17,
      height: 3,
      marker: 'NAME',
      pageNumber: 1,
    };

    const dateBoxCoordinates = {
      x: 53.9,
      y: 62.4,
      width: 15.5,
      height: 2,
      marker: 'DATE',
      pageNumber: 1,
    };

    const signatureBoxCoordinates = [signBoxCoordinates, nameBoxCoordinates, dateBoxCoordinates];
    const madverseSignatureBoxCoordinates = [
      {
        x: 22.7,
        y: 67.7,
        width: 15.5,
        height: 4,
        marker: 'SIGNATURE',
        pageNumber: 1,
      },
      {
        x: 17.14,
        y: 63.5,
        width: 15.5,
        height: 2,
        marker: 'DATE',
        pageNumber: 1,
      },
    ];

    // Generate PDF in memory
    const pdfBuffer = new Uint8Array(await generatePDFBuffer(htmlContent));

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

enum AgreementEventType {
  AGREEMENT_SIGNED_BY_USER = 'AGREEMENT_SIGNED_BY_USER',
  AGREEMENT_COMPLETED = 'AGREEMENT_COMPLETED',
  LABEL_ARTIST_AGREEMENT_SIGNED = 'LABEL_ARTIST_AGREEMENT_SIGNED',
}

export const sendAgreementCompletedWebhook = async (
  documentId: number,
  labelEmail: string,
  pdfS3Key: string,
) => {
  try {
    const response = await fetch(`${process.env.MADVERSE_DOMAIN}/api/agreement-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MADVERSE_WEBHOOK_KEY}`,
      },
      body: JSON.stringify({
        event: AgreementEventType.AGREEMENT_COMPLETED,
        payload: {
          documentId,
          key: pdfS3Key,
          email: labelEmail,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(
        `Event: AGREEMENT_COMPLETED - Failed to send webhook for recipient ${labelEmail}: HTTP ${response.status} - ${errorText}`,
      );
    } else {
      console.log(
        `Event: AGREEMENT_COMPLETED - Successfully sent webhook to Madverse for recipient ${labelEmail}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `Event: AGREEMENT_COMPLETED - Error sending webhook for recipient ${labelEmail}:`,
      errorMessage,
    );
  }
};

export const sendLabelXArtistWebhook = async (documentId: number, recipientEmail: string) => {
  try {
    const response = await fetch(`${process.env.MADVERSE_DOMAIN}/api/agreement-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MADVERSE_WEBHOOK_KEY}`,
      },
      body: JSON.stringify({
        event: AgreementEventType.LABEL_ARTIST_AGREEMENT_SIGNED,
        payload: {
          documentId,
          email: recipientEmail,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(
        `Event: LABEL_ARTIST_AGREEMENT_SIGNED - Failed to send webhook for recipient ${recipientEmail}: HTTP ${response.status} - ${errorText}`,
      );
    } else {
      console.log(
        `Event: LABEL_ARTIST_AGREEMENT_SIGNED - Successfully sent webhook to Madverse for recipient ${recipientEmail}`,
      );
    }
  } catch (error) {
    console.error('Error in sending LabelXArtist webhook:', error);
  }
};
