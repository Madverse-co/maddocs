import type { NextApiRequest, NextApiResponse } from 'next';

import { initClient } from '@ts-rest/core';

import { ApiContractV1 } from '@documenso/api/v1/contract';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId, labelName, labelEmail } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const client = initClient(ApiContractV1, {
      baseUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}`,
      baseHeaders: {
        authorization: `${process.env.ADMIN_ACCOUNT_API_KEY ?? ''}`,
      },
    });

    // Get document status
    const documentResponse = await client.getDocument({
      params: {
        id: documentId,
      },
    });

    if (documentResponse.status !== 200) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documentResponse.body;

    // Check if document is already completed
    if (document.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'Document already completed, no reminder sent',
      });
    }

    // Find pending recipients
    const pendingRecipients = document.recipients.filter(
      (recipient) => recipient.signingStatus === 'NOT_SIGNED' && recipient.email === labelEmail,
    );

    if (pendingRecipients.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending recipients found for this email',
      });
    }

    // Resend email to pending recipients
    const resendResponse = await client.resendDocument({
      params: {
        id: documentId,
      },
      body: {
        recipients: [pendingRecipients[0].id],
      },
    });

    if (resendResponse.status !== 200) {
      return res.status(500).json({ error: 'Failed to resend document' });
    }

    return res.status(200).json({
      success: true,
      message: `Reminder sent to ${labelName} (${labelEmail})`,
    });
  } catch (error) {
    console.error('Error resending label invite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
