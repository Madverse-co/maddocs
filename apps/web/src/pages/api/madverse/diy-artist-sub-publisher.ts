import type { NextApiRequest, NextApiResponse } from 'next';

import {
  normalizeOwnerType,
  type DiyOwnerType,
} from '@documenso/lib/server-only/madverse-diy-artist-helpers';
import {
  createDiyArtistAgreementOptimized,
  DIY_MADVERSE_SIGNER,
} from '@documenso/lib/server-only/madverse';

export const config = {
  maxDuration: 60,
};

const OWNER_TYPE_VALUES = ['LABEL', 'ARTIST', 'label', 'artist', 'single_artist'] as const;

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
    { field: 'ownerType', type: 'string' },
    { field: 'artistName', type: 'string' },
    { field: 'ownerDesignation', type: 'string' },
    { field: 'ownerAddress', type: 'string' },
    { field: 'ownerEmail', type: 'string' },
    { field: 'usersName', type: 'string' },
  ];

  for (const { field, type } of required) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Field '${field}' must be of type ${type}, got ${typeof data[field]}`);
    }
  }

  if (data.ownerType && typeof data.ownerType === 'string') {
    if (!normalizeOwnerType(data.ownerType)) {
      errors.push(`ownerType must be one of: LABEL, ARTIST (aliases: label, artist, single_artist)`);
    }
  }

  if (data.ownerEmail && typeof data.ownerEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.ownerEmail)) {
      errors.push('ownerEmail must be a valid email address');
    } else if (
      data.ownerEmail.trim().toLowerCase() === DIY_MADVERSE_SIGNER.email.toLowerCase()
    ) {
      errors.push(
        `ownerEmail cannot be the same as the Madverse signer (${DIY_MADVERSE_SIGNER.email})`,
      );
    }
  }

  const stringFields = ['artistName', 'ownerDesignation', 'ownerAddress', 'usersName'];
  for (const field of stringFields) {
    if (data[field] && typeof data[field] === 'string' && (data[field] as string).trim() === '') {
      errors.push(`Field '${field}' cannot be empty`);
    }
  }

  const normalizedOwnerType =
    typeof data.ownerType === 'string' ? normalizeOwnerType(data.ownerType) : null;

  if (normalizedOwnerType === 'ARTIST') {
    if (!data.ipiNumber || typeof data.ipiNumber !== 'string' || !String(data.ipiNumber).trim()) {
      errors.push('ipiNumber is required when ownerType is ARTIST');
    }
  }

  if (data.ownerAliases !== undefined) {
    if (
      typeof data.ownerAliases !== 'string' &&
      !(
        Array.isArray(data.ownerAliases) &&
        data.ownerAliases.every((item) => typeof item === 'string')
      )
    ) {
      errors.push('ownerAliases must be a string or array of strings');
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

  const validation = validateRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Invalid request data',
      message: 'Please check the following validation errors:',
      validationErrors: validation.errors,
      expectedFormat: {
        ownerType: 'LABEL | ARTIST (aliases: label, artist, single_artist)',
        artistName: 'string (required) — base artist/label name',
        signatoryName: 'string (optional) — name on signature block; defaults to artistName',
        legalName: 'string (optional) — e.g. "Ojeswa Jain AKA Osho Jain" for label',
        ownerDesignation: 'string (required) — e.g. Proprietor, Author/Composer',
        ownerAddress: 'string (required)',
        ownerEmail: 'string (required)',
        usersName: 'string (required)',
        ownerAliases: 'string | string[] (optional)',
        ipiNumber: 'string (required for ARTIST only)',
      },
    });
  }

  try {
    const {
      ownerType: ownerTypeRaw,
      artistName,
      signatoryName,
      legalName,
      ownerDesignation,
      ownerAddress,
      ownerEmail,
      ownerAliases,
      usersName,
      ipiNumber,
    } = req.body;

    const ownerType = normalizeOwnerType(ownerTypeRaw) as DiyOwnerType;

    const result = await createDiyArtistAgreementOptimized({
      ownerType,
      artistName,
      signatoryName,
      legalName,
      ownerDesignation,
      ownerAddress,
      ownerEmail,
      ownerAliases,
      usersName,
      ipiNumber,
      agreementTitle: 'Madverse Sub-Publisher Services Agreement',
      reminderEndpoint: '/api/madverse/resend-label-invite',
    });

    if (!result.success) {
      console.error('[diy-artist-sub-publisher] Agreement creation failed', {
        error: result.error,
        step: 'step' in result ? result.step : undefined,
        apiStatus: 'apiStatus' in result ? result.apiStatus : undefined,
        apiBody: 'apiBody' in result ? result.apiBody : undefined,
        ownerType,
        ownerEmail,
      });

      return res.status(500).json({
        error: result.error,
        message:
          'Sub-publisher agreement creation failed. Please try again or contact support if the issue persists.',
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            step: 'step' in result ? result.step : undefined,
            apiStatus: 'apiStatus' in result ? result.apiStatus : undefined,
            apiBody: 'apiBody' in result ? result.apiBody : undefined,
          },
        }),
      });
    }

    return res.status(200).json({
      success: true,
      documentId: result.documentId,
      signingUrl: result.signingUrl,
      ownerType,
      message: 'Madverse sub-publisher agreement created successfully',
    });
  } catch (error) {
    console.error('DIY artist sub-publisher agreement creation failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during document creation. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error instanceof Error ? error.message : 'Unknown error',
      }),
    });
  }
}
