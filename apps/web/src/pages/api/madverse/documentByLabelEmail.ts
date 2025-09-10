import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@documenso/prisma';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      allowedMethods: ['POST'],
    });
  }

  try {
    const { labelEmail } = req.body;

    if (!labelEmail || typeof labelEmail !== 'string') {
      return res.status(400).json({
        error: 'Invalid request data',
        message: 'labelEmail is required and must be a string',
        expectedFormat: {
          labelEmail: 'string (required, valid email format)',
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(labelEmail)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'labelEmail must be a valid email address (example: user@domain.com)',
      });
    }

    // Find the document where one of the recipients has the provided email
    const document = await prisma.document.findFirst({
      where: {
        recipients: {
          some: {
            email: labelEmail.toLowerCase(),
          },
        },
      },
      select: {
        id: true,
        externalId: true,
        title: true,
        status: true,
        createdAt: true,
        recipients: {
          where: {
            email: labelEmail.toLowerCase(),
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            signingStatus: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: `No document found with recipient email: ${labelEmail}`,
      });
    }

    // Get the recipient details
    const recipient = document.recipients[0];

    return res.status(200).json({
      success: true,
      documentId: String(document.id),
      externalId: document.externalId,
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
      },
      recipient: {
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingStatus: recipient.signingStatus,
      },
      owner: document.user
        ? {
            id: document.user.id,
            name: document.user.name,
            email: document.user.email,
          }
        : null,
      team: document.team
        ? {
            id: document.team.id,
            name: document.team.name,
            url: document.team.url,
          }
        : null,
      message: `Document found: ${document.title}`,
    });
  } catch (error) {
    console.error('Error finding document by label email:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        'An unexpected error occurred while searching for the document. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error instanceof Error ? error.message : 'Unknown error',
      }),
    });
  }
}
