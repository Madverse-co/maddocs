import { initClient } from '@ts-rest/core';
import { Client } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
// @ts-expect-error api2pdf doesn't have types and for some reason my types aren't recognised by ts.
import Api2Pdf from 'api2pdf';
import crypto from 'crypto';

import { ApiContractV1 } from '@documenso/api/v1/contract';

import { labelInvite } from './madverse-templates';

const api2pdf = new Api2Pdf(process.env.API2PDF_API_KEY ?? '');

interface GeneratePdfParams {
  labelName: string;
  labelAddress: string;
  royaltySplit?: number;
  distributionRoyaltySplit?: number;
  publishingRoyaltySplit?: number;
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

export async function generatePdf({
  labelName,
  labelAddress,
  royaltySplit,
  distributionRoyaltySplit,
  publishingRoyaltySplit,
}: GeneratePdfParams) {
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
    htmlContent = htmlContent.replace('[Suvan Date]', '');
    htmlContent = htmlContent.replace('For the Label', `For ${labelName}`);

    // Replace the placeholder content
    htmlContent = htmlContent.replace('[Label Name]', labelName);
    htmlContent = htmlContent.replace('[Label Address]', labelAddress);

    // Handle royalty split replacement based on agreement type
    let royaltyText = '';
    if (distributionRoyaltySplit !== undefined && publishingRoyaltySplit !== undefined) {
      // Combined agreement - show both splits
      royaltyText = `Distribution: ${distributionRoyaltySplit}% (${numberToWords(distributionRoyaltySplit)} percent), Publishing: ${publishingRoyaltySplit}% (${numberToWords(publishingRoyaltySplit)} percent)`;
    } else {
      // Single agreement - use the provided split
      const effectiveRoyaltySplit =
        royaltySplit ?? distributionRoyaltySplit ?? publishingRoyaltySplit ?? 0;
      royaltyText = `${effectiveRoyaltySplit}% (${numberToWords(effectiveRoyaltySplit)} percent)`;
    }

    htmlContent = htmlContent.replace('[Royalty Split]', royaltyText);

    // Get coordinates of signature boxes
    const signBoxCoordinates = {
      x: 60.5,
      y: 67.9,
      width: 20,
      height: 6,
      marker: 'SIGNATURE',
      pageNumber: 1,
    };

    const nameBoxCoordinates = {
      x: 47.8,
      y: 59.4,
      width: 23,
      height: 3,
      marker: 'NAME',
      pageNumber: 1,
    };

    const dateBoxCoordinates = {
      x: 53.9,
      y: 63.4,
      width: 23,
      height: 2,
      marker: 'DATE',
      pageNumber: 1,
    };

    const signatureBoxCoordinates = [signBoxCoordinates, nameBoxCoordinates, dateBoxCoordinates];
    const madverseSignatureBoxCoordinates = [
      {
        x: 22.7,
        y: 67.7,
        width: 20,
        height: 6,
        marker: 'SIGNATURE',
        pageNumber: 1,
      },
      {
        x: 17.14,
        y: 64.5,
        width: 23,
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
      if (response.status === 404)
        console.warn(
          `Event: AGREEMENT_COMPLETED - Webhook endpoint not found for recipient ${labelEmail}: HTTP 404 - ${errorText}`,
        );
      else
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
      if (response.status === 404)
        console.warn(
          `Event: LABEL_ARTIST_AGREEMENT_SIGNED - Webhook endpoint not found for recipient ${recipientEmail}: HTTP 404 - probably not a label x artist agreement, can be safely ignored - ${errorText}`,
        );
      else
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

// SPEED OPTIMIZATION UTILITIES
// ============================

interface SignatureCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
  marker: string;
  pageNumber: number;
}

interface RecipientData {
  recipientId: string;
  signingUrl: string;
}

interface FieldCoordinate {
  recipientId: number;
  type: string;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
}

interface CachedPdfData {
  signatureBoxCoordinates: SignatureCoordinate[];
  madverseSignatureBoxCoordinates: SignatureCoordinate[];
  createdAt: number;
}

// Serverless-compatible PDF cache using Upstash Redis
const CACHE_DURATION = 10 * 60; // 10 minutes in seconds for Redis TTL

// Initialize Redis client (will be null if env vars not available)
let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch (error) {
  console.log('Upstash Redis not available, PDF caching disabled:', error);
}

// Singleton API client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedApiClient: any = null;

function getCachedApiClient() {
  if (!cachedApiClient) {
    cachedApiClient = initClient(ApiContractV1, {
      baseUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}`,
      baseHeaders: {
        authorization: `${process.env.ADMIN_ACCOUNT_API_KEY ?? ''}`,
      },
    });
  }
  return cachedApiClient;
}

function generateCacheKey(params: GeneratePdfParams): string {
  return `pdf_cache_${crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex')}`;
}

// Optimized PDF generation with Redis caching
export async function generatePdfOptimized(params: GeneratePdfParams) {
  const cacheKey = generateCacheKey(params);

  if (redis) {
    try {
      // Try to get from Redis cache
      const cached = await redis.get<CachedPdfData>(cacheKey);
      if (cached) {
        console.log('Using cached PDF for', params.labelName);
        // Note: File object can't be serialized, so we'll need to regenerate but use cached coordinates
        const pdfResult = await generatePdf(params);
        if (pdfResult.success) {
          return {
            success: true,
            file: pdfResult.file,
            signatureBoxCoordinates: cached.signatureBoxCoordinates,
            madverseSignatureBoxCoordinates: cached.madverseSignatureBoxCoordinates,
          };
        }
      }
    } catch (error) {
      console.log('Redis cache miss or error, generating fresh PDF:', error);
    }
  }

  const result = await generatePdf(params);

  if (result.success && result.file && redis) {
    try {
      // Cache the coordinate data (not the file itself due to serialization)
      const cacheData: CachedPdfData = {
        signatureBoxCoordinates: result.signatureBoxCoordinates,
        madverseSignatureBoxCoordinates: result.madverseSignatureBoxCoordinates,
        createdAt: Date.now(),
      };

      await redis.set(cacheKey, cacheData, { ex: CACHE_DURATION });
    } catch (error) {
      console.log('Failed to cache PDF data:', error);
    }
  }

  return result;
}

// Pre-process signature field coordinates
export function prepareSignatureFields(
  userCoordinates: SignatureCoordinate[],
  madverseCoordinates: SignatureCoordinate[],
  recipientData: RecipientData[],
): FieldCoordinate[] {
  const getFieldTypeFromMarker = (marker: string) => {
    switch (marker) {
      case 'NAME':
        return 'NAME';
      case 'DATE':
        return 'DATE';
      case 'SIGNATURE':
        return 'SIGNATURE';
      default:
        return 'SIGNATURE';
    }
  };

  const coordinates = userCoordinates.map((coord) => ({
    recipientId: Number(recipientData[0].recipientId),
    type: getFieldTypeFromMarker(coord.marker),
    pageNumber: coord.pageNumber || 1,
    pageX: coord.x,
    pageY: coord.y,
    pageWidth: coord.width,
    pageHeight: coord.height || 50,
  }));

  madverseCoordinates.forEach((coord) => {
    coordinates.push({
      recipientId: Number(recipientData[1].recipientId),
      type: getFieldTypeFromMarker(coord.marker),
      pageNumber: coord.pageNumber || 1,
      pageX: coord.x,
      pageY: coord.y,
      pageWidth: coord.width,
      pageHeight: coord.height || 50,
    });
  });

  return coordinates;
}

// Optimized file upload with retry
export async function uploadFileOptimized(uploadUrl: string, file: File, maxRetries = 3) {
  const formData = new FormData();
  formData.append('file', file);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: formData,
      });

      if (uploadResponse.ok) {
        return { success: true };
      }

      if (attempt === maxRetries) {
        return {
          success: false,
          error: `Failed to upload after ${maxRetries} attempts`,
        };
      }

      // Exponential backoff
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), Math.pow(2, attempt) * 1000);
      });
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), Math.pow(2, attempt) * 1000);
      });
    }
  }

  return { success: false, error: 'Upload failed' };
}

// Batch field addition using consistent API
export async function addFieldsBatch(documentId: string, coordinates: FieldCoordinate[]) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/v1/documents/${documentId}/fields`,
      {
        method: 'POST',
        headers: {
          Authorization: `${process.env.ADMIN_ACCOUNT_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coordinates),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add fields',
    };
  }
}

// Synchronous reminder scheduling for Lambda compatibility
export async function scheduleRemindersSync(
  documentId: string,
  labelName: string,
  labelEmail: string,
  reminderEndpoint: string = '/api/madverse/resend-label-invite',
) {
  // Skip QStash in local development (localhost URLs not supported)
  if (!process.env.VERCEL_URL && !process.env.NODE_ENV?.includes('production')) {
    console.log('Skipping QStash scheduling in local development');
    return { success: true };
  }

  try {
    // Use Vercel URL in production/preview, fallback to NEXT_PUBLIC_WEBAPP_URL
    const baseUrl = `https://${process.env.NEXT_PUBLIC_WEBAPP_URL}`;

    const reminderUrl = `${baseUrl}${reminderEndpoint}`;
    const reminderData = { documentId, labelName, labelEmail };

    const reminderPromises = [];
    for (let day = 2; day <= 10; day += 2) {
      const notBefore = Math.floor((Date.now() + day * 24 * 60 * 60 * 1000) / 1000);
      const deduplicationId = `reminder-${documentId}-day-${day}`;

      reminderPromises.push(
        addEventToQueue(
          reminderUrl,
          reminderData,
          deduplicationId,
          'document-reminders',
          notBefore,
        ),
      );
    }

    await Promise.all(reminderPromises);
    return { success: true };
  } catch (error) {
    console.error('Failed to schedule reminders:', error);
    return { success: false, error: 'Failed to schedule reminders' };
  }
}

// Complete optimized document creation workflow
export async function createLabelAgreementOptimized({
  labelName,
  labelAddress,
  labelEmail,
  royaltySplit,
  distributionRoyaltySplit,
  publishingRoyaltySplit,
  usersName,
  agreementTitle = 'Madverse Label Enterprise Plan Agreement',
  reminderEndpoint = '/api/madverse/resend-label-invite',
}: {
  labelName: string;
  labelAddress: string;
  labelEmail: string;
  royaltySplit?: number;
  distributionRoyaltySplit?: number;
  publishingRoyaltySplit?: number;
  usersName: string;
  agreementTitle?: string;
  reminderEndpoint?: string;
}) {
  const client = getCachedApiClient();

  // Add timeout protection for PDF generation (45s max for Lambda)
  const pdfTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('PDF generation timeout')), 45000);
  });

  // Phase 1: Parallel PDF generation and recipient setup
  const recipients = [
    {
      name: `${usersName} - ${labelName}`,
      email: labelEmail,
      role: 'SIGNER' as const,
      signingOrder: 1,
    },
    {
      name: 'Suvan Mathur',
      email: 'suvan.mathur@madverse.co',
      role: 'SIGNER' as const,
      signingOrder: 2,
    },
  ];

  let pdfResult: Awaited<ReturnType<typeof generatePdfOptimized>>;
  try {
    pdfResult = await Promise.race([
      generatePdfOptimized({
        labelName,
        labelAddress,
        royaltySplit,
        distributionRoyaltySplit,
        publishingRoyaltySplit,
      }),
      pdfTimeout,
    ]);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF generation failed',
    };
  }

  if (!pdfResult.success || !pdfResult.file) {
    return {
      success: false,
      error:
        'success' in pdfResult && !pdfResult.success
          ? 'Failed to generate PDF'
          : 'Failed to generate PDF',
    };
  }

  // Phase 2: Document creation (must happen first to get upload URL)
  const docResult = await client.createDocument({
    body: {
      title: `${labelName} - ${agreementTitle}`,
      recipients,
      meta: {
        subject: `Please sign the ${agreementTitle}`,
        message: `Madverse has invited you ${labelName} to sign the ${agreementTitle}`,
        signingOrder: 'SEQUENTIAL',
      },
    },
  });

  if (docResult.status !== 200) {
    return { success: false, error: 'Failed to create document' };
  }

  const { uploadUrl, documentId, recipients: recipientData } = docResult.body;

  // Phase 3: Parallel upload and coordinate preparation
  const [uploadResult, coordinates] = await Promise.all([
    uploadFileOptimized(uploadUrl, pdfResult.file),
    Promise.resolve(
      prepareSignatureFields(
        pdfResult.signatureBoxCoordinates,
        pdfResult.madverseSignatureBoxCoordinates,
        recipientData,
      ),
    ),
  ]);

  if (!uploadResult.success) {
    return { success: false, error: 'Failed to upload PDF' };
  }

  // Phase 4: Add fields and send document in parallel
  const [addFieldsResult, sendResult] = await Promise.all([
    addFieldsBatch(String(documentId), coordinates),
    client.sendDocument({
      body: {
        sendEmail: true,
        sendCompletionEmails: true,
      },
      params: {
        id: String(documentId),
      },
    }),
  ]);

  if (!addFieldsResult.success) {
    return { success: false, error: 'Failed to add signature fields' };
  }

  if (sendResult.status !== 200) {
    return { success: false, error: 'Failed to send document' };
  }

  // Phase 5: Schedule reminders synchronously for Lambda compatibility
  const reminderResult = await scheduleRemindersSync(
    String(documentId),
    labelName,
    labelEmail,
    reminderEndpoint,
  );
  if (!reminderResult.success) {
    console.warn('Failed to schedule reminders, but document creation succeeded');
  }

  return {
    success: true,
    documentId,
    signingUrl: recipientData[0].signingUrl, // Return label signing URL (correct recipient)
  };
}
