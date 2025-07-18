import type { NextApiRequest, NextApiResponse } from 'next';

import { createLabelAgreementOptimized } from '@documenso/lib/server-only/madverse';

export const config = {
  maxDuration: 60,
};

// Input validation with detailed error messages

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      errors: ['Request body is required and must be a valid JSON object'],
    };
  }

  const data = body as Record<string, unknown>;
  const required = [
    { field: 'labelName', type: 'string' },
    { field: 'labelAddress', type: 'string' },
    { field: 'labelEmail', type: 'string' },
    { field: 'distributionRoyaltySplit', type: 'number' },
    { field: 'publishingRoyaltySplit', type: 'number' },
    { field: 'usersName', type: 'string' },
  ];

  // Check required fields and types
  for (const { field, type } of required) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Field '${field}' must be of type ${type}, got ${typeof data[field]}`);
    }
  }

  // Validate email format if email is provided
  if (data.labelEmail && typeof data.labelEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.labelEmail)) {
      errors.push('labelEmail must be a valid email address (example: user@domain.com)');
    }
  }

  // Validate royalty split ranges if provided
  if (data.distributionRoyaltySplit && typeof data.distributionRoyaltySplit === 'number') {
    if (data.distributionRoyaltySplit < 0 || data.distributionRoyaltySplit > 100) {
      errors.push('distributionRoyaltySplit must be a number between 0 and 100');
    }
  }

  if (data.publishingRoyaltySplit && typeof data.publishingRoyaltySplit === 'number') {
    if (data.publishingRoyaltySplit < 0 || data.publishingRoyaltySplit > 100) {
      errors.push('publishingRoyaltySplit must be a number between 0 and 100');
    }
  }

  // Validate string fields are not empty
  const stringFields = ['labelName', 'labelAddress', 'usersName'];
  for (const field of stringFields) {
    if (data[field] && typeof data[field] === 'string' && (data[field] as string).trim() === '') {
      errors.push(`Field '${field}' cannot be empty`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      allowedMethods: ['POST'],
    });
  }

  // Validate input with detailed error messages
  const validation = validateRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Invalid request data',
      message: 'Please check the following validation errors:',
      validationErrors: validation.errors,
      expectedFormat: {
        labelName: 'string (required, non-empty)',
        labelAddress: 'string (required, non-empty)',
        labelEmail: 'string (required, valid email format)',
        distributionRoyaltySplit: 'number (required, 0-100)',
        publishingRoyaltySplit: 'number (required, 0-100)',
        usersName: 'string (required, non-empty)',
      },
    });
  }

  try {
    const {
      labelName,
      labelAddress,
      labelEmail,
      distributionRoyaltySplit,
      publishingRoyaltySplit,
      usersName,
    } = req.body;

    // Use optimized workflow with Label Enterprise Publishing Plan title
    const result = await createLabelAgreementOptimized({
      labelName,
      labelAddress,
      labelEmail,
      distributionRoyaltySplit,
      publishingRoyaltySplit,
      usersName,
      agreementTitle: 'Label Enterprise Publishing Plan',
      reminderEndpoint: '/api/madverse/resend-label-invite',
    });

    if (!result.success) {
      return res.status(500).json({
        error: result.error,
        message:
          'Document creation failed. Please try again or contact support if the issue persists.',
      });
    }

    return res.status(200).json({
      success: true,
      documentId: result.documentId,
      signingUrl: result.signingUrl,
      message: 'Label enterprise publishing agreement created successfully',
    });
  } catch (error) {
    console.error('Label publishing agreement creation failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during document creation. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error instanceof Error ? error.message : 'Unknown error',
      }),
    });
  }
}
