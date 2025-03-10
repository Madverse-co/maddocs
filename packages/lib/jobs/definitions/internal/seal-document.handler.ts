import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import PostHogServerClient from '../../../server-only/feature-flags/get-post-hog-server-client';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { insertFieldInPDF } from '../../../server-only/pdf/insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../../../server-only/pdf/normalize-signature-appearances';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { getFile } from '../../../universal/upload/get-file';
import { putPdfFile } from '../../../universal/upload/put-file';
import { fieldsContainUnsignedRequiredField } from '../../../utils/advanced-fields-helpers';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentJobDefinition } from './seal-document';

export const run = async ({
  payload,
  io,
}: {
  payload: TSealDocumentJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

  try {
    const document = await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
        recipients: {
          every: {
            signingStatus: SigningStatus.SIGNED,
          },
        },
      },
      include: {
        documentMeta: true,
        recipients: true,
        team: {
          select: {
            teamGlobalSettings: {
              select: {
                includeSigningCertificate: true,
              },
            },
          },
        },
      },
    });

    // Seems silly but we need to do this in case the job is re-ran
    // after it has already run through the update task further below.
    // eslint-disable-next-line @typescript-eslint/require-await
    const documentStatus = await io.runTask('get-document-status', async () => {
      return document.status;
    });

    // This is the same case as above.
    // eslint-disable-next-line @typescript-eslint/require-await
    const documentDataId = await io.runTask('get-document-data-id', async () => {
      return document.documentDataId;
    });

    const documentData = await prisma.documentData.findFirst({
      where: {
        id: documentDataId,
      },
    });

    if (!documentData) {
      throw new Error(`Document ${document.id} has no document data`);
    }

    const recipients = await prisma.recipient.findMany({
      where: {
        documentId: document.id,
        role: {
          not: RecipientRole.CC,
        },
      },
    });

    if (recipients.some((recipient) => recipient.signingStatus !== SigningStatus.SIGNED)) {
      throw new Error(`Document ${document.id} has unsigned recipients`);
    }

    const fields = await prisma.field.findMany({
      where: {
        documentId: document.id,
      },
      include: {
        signature: true,
      },
    });

    if (fieldsContainUnsignedRequiredField(fields)) {
      throw new Error(`Document ${document.id} has unsigned required fields`);
    }

    if (isResealing) {
      // If we're resealing we want to use the initial data for the document
      // so we aren't placing fields on top of eachother.
      documentData.data = documentData.initialData;
    }

    const pdfData = await getFile(documentData);

    const certificateData =
      (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true)
        ? await getCertificatePdf({
            documentId,
            language: document.documentMeta?.language,
          }).catch(() => null)
        : null;

    const newDataId = await io.runTask('decorate-and-sign-pdf', async () => {
      const pdfDoc = await PDFDocument.load(pdfData);

      // Normalize and flatten layers that could cause issues with the signature
      normalizeSignatureAppearances(pdfDoc);
      flattenForm(pdfDoc);
      flattenAnnotations(pdfDoc);

      if (certificateData) {
        const certificateDoc = await PDFDocument.load(new Uint8Array(certificateData));

        const certificatePages = await pdfDoc.copyPages(
          certificateDoc,
          certificateDoc.getPageIndices(),
        );

        certificatePages.forEach((page) => {
          pdfDoc.addPage(page);
        });
      }

      for (const field of fields) {
        if (field.inserted) {
          await insertFieldInPDF(pdfDoc, field);
        }
      }

      // Re-flatten the form to handle our checkbox and radio fields that
      // create native arcoFields
      flattenForm(pdfDoc);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

      const { name } = path.parse(document.title);

      const documentData = await putPdfFile({
        name: `${name}_signed.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(new Uint8Array(pdfBuffer).buffer),
      });

      return documentData.id;
    });

    const postHog = PostHogServerClient();

    if (postHog) {
      postHog.capture({
        distinctId: nanoid(),
        event: 'App: Document Sealed',
        properties: {
          documentId: document.id,
        },
      });
    }

    await io.runTask('update-document', async () => {
      await prisma.$transaction(async (tx) => {
        const newData = await tx.documentData.findFirstOrThrow({
          where: {
            id: newDataId,
          },
        });

        await tx.document.update({
          where: {
            id: document.id,
          },
          data: {
            status: DocumentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        await tx.documentData.update({
          where: {
            id: documentData.id,
          },
          data: {
            data: newData.data,
          },
        });

        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
            documentId: document.id,
            requestMetadata,
            user: null,
            data: {
              transactionId: nanoid(),
            },
          }),
        });
      });
    });

    await io.runTask('send-completed-email', async () => {
      let shouldSendCompletedEmail = sendEmail && !isResealing;

      if (isResealing && documentStatus !== DocumentStatus.COMPLETED) {
        shouldSendCompletedEmail = sendEmail;
      }

      if (shouldSendCompletedEmail) {
        // Send webhook POST request to madverse for each recipient
        const recipients = document.recipients;

        // Get recipient details and send to webhook
        await Promise.all(
          recipients.map(async (recipient) => {
            try {
              // Send webhook with recipient details
              const response = await fetch(`${process.env.MADVERSE_DOMAIN}/api/agreement-webhook`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.MADVERSE_WEBHOOK_KEY}`,
                },
                body: JSON.stringify({
                  event: 'AGREEMENT_COMPLETED',
                  payload: {
                    name: recipient.name.split(' - ')[0],
                    label: recipient.name.split(' - ')[1],
                    email: recipient.email,
                  }
                }),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error(
                  `Event: AGREEMENT_COMPLETED - Failed to send webhook for recipient ${recipient.email}: HTTP ${response.status} - ${errorText}`,
                );

                // Just log to console instead of creating an audit log with invalid fields
                console.error(
                  `Event: AGREEMENT_COMPLETED - Webhook to Madverse failed for document ${document.id}, recipient ${recipient.email}: HTTP ${response.status} - ${errorText}`,
                );
              } else {
                console.log(
                  `Event: AGREEMENT_COMPLETED - Successfully sent webhook to Madverse for document ${document.id}, recipient ${recipient.email}`,
                );
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Event: AGREEMENT_COMPLETED - Error sending webhook for recipient ${recipient.email}:`, errorMessage);

              // Just log to console instead of creating an audit log with invalid fields
              console.error(
                `Event: AGREEMENT_COMPLETED - Error sending webhook to Madverse for document ${document.id}, recipient ${recipient.email}: ${errorMessage}`,
              );
            }
          }),
        );

        await sendCompletedEmail({ documentId, requestMetadata });
      }
    });

    const updatedDocument = await prisma.document.findFirstOrThrow({
      where: {
        id: document.id,
      },
      include: {
        documentData: true,
        documentMeta: true,
        recipients: true,
      },
    });
    
    try {
      await triggerWebhook({
        event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
        data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
        userId: updatedDocument.userId,
        teamId: updatedDocument.teamId ?? undefined,
      });
    } catch (error) {
      console.error(`[DEBUG ERROR] Failed to trigger webhook:`, error);
    }
    
  } catch (error) {
    console.error(`[DEBUG ERROR] Error in seal-document job for document ID: ${documentId}:`, error);
    throw error;
  }
};
