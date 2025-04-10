import type { NextApiRequest, NextApiResponse } from 'next';

import { initClient } from '@ts-rest/core';

import { ApiContractV1 } from '@documenso/api/v1/contract';
import { generatePdf } from '@documenso/lib/server-only/madverse';
import { addEventToQueue } from '@documenso/lib/server-only/madverse';

export const config = {
  maxDuration: 60,
};

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { labelName, labelAddress, labelEmail, royaltySplit, usersName } = req.body;
    const pdfFile = await generatePdf({ labelName, labelAddress, royaltySplit });

    if (!pdfFile.success || !pdfFile.file) {
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }

    const recipients = [
      {
        name: `${usersName} - ${labelName}`,
        email: labelEmail,
        role: 'SIGNER' as const,
        signingOrder: 1,
      },
      {
        name: 'Rohan Nesho Jain',
        email: 'suvan.mathur@madverse.co',
        role: 'SIGNER' as const,
        signingOrder: 2,
      },
    ];

    const client = initClient(ApiContractV1, {
      baseUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}`,
      baseHeaders: {
        authorization: `${process.env.ADMIN_ACCOUNT_API_KEY ?? ''}`,
      },
    });

    const doc = await client.createDocument({
      body: {
        title: `Madverse Label Enterprise Plan Agreement`,
        recipients,
        meta: {
          subject: `Please sign the Madverse Label Enterprise Plan Agreement`,
          message: `Madverse has invited you ${labelName} to sign the Madverse Label Enterprise Plan Agreement`,
          signingOrder: 'SEQUENTIAL',
        },
      },
    });

    if (doc.status !== 200) {
      return res.status(500).json({ error: 'Failed to create document' });
    }

    const { uploadUrl, documentId, recipients: recipientData } = doc.body;

    // Upload the PDF file
    const formData = new FormData();
    formData.append('file', pdfFile.file);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      return res.status(500).json({ error: 'Failed to upload PDF' });
    }

    const userCoordinates = pdfFile.signatureBoxCoordinates;
    const madverseCoordinates = pdfFile.madverseSignatureBoxCoordinates;

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

    // Add signature fields to the document
    const addFieldsResponse = await fetch(
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

    if (!addFieldsResponse.ok) {
      const errorData = await addFieldsResponse.json();
      console.error('Failed to add fields:', {
        status: addFieldsResponse.status,
        statusText: addFieldsResponse.statusText,
        error: errorData,
      });
      return res.status(500).json({ error: 'Failed to add signature fields', details: errorData });
    }

    const sendDocumentResponse = await client.sendDocument({
      body: {
        sendEmail: true,
        sendCompletionEmails: true,
      },
      params: {
        id: String(documentId),
      },
    });

    if (sendDocumentResponse.status !== 200) {
      return res.status(500).json({ error: 'Failed to send document via email' });
    }

    // Schedule reminder emails via QStash
    const reminderUrl = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/madverse/resend-label-invite`;
    const reminderData = {
      documentId: String(documentId),
      labelName,
      labelEmail,
    };

    // Schedule reminders for 2, 4, 6, 8, and 10 days from now
    for (let day = 2; day <= 10; day += 2) {
      const notBefore = Date.now() + day * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const deduplicationId = `reminder-${documentId}-day-${day}`;

      await addEventToQueue(
        reminderUrl,
        reminderData,
        deduplicationId,
        'document-reminders',
        notBefore,
      );
    }

    return res.status(200).json({
      success: true,
      documentId,
      signingUrl: recipientData[1].signingUrl,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
