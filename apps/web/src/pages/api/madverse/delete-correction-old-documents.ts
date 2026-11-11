import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export const config = {
  maxDuration: 60,
};

/**
 * One-shot ops endpoint for AD-2219: delete ONLY superseded Maddocs docs
 * for the DIY publishing agreement name-correction batch.
 *
 * Guards:
 * - Requires x-correction-delete-secret
 * - Hard allowlist of old document IDs
 * - Hard blocklist of current/protected document IDs
 */
const DELETE_SECRET = process.env.CORRECTION_DELETE_SECRET || 'ad-2219-correction-old-docs-only';

/** Current agreements that must never be deleted. */
const PROTECTED_DOCUMENT_IDS = new Set<number>([
  1459, 1460, 1461, 1463, 1468, 1469, 1470, 1472, 1474, 1475, 1476, 1477, 1478, 1479, 1482, 1483,
  1484, 1486, 1487, 1488, 1490, 1506, 1507, 1508, 1509, 1510, 1511, 1512, 1513, 1514, 1515, 1516,
  1517,
]);

/** Superseded originals + intermediate reissues for the 33 correction accounts only. */
const ALLOWED_OLD_DOCUMENT_IDS = new Set<number>([
  1154, 1159, 1161, 1162, 1173, 1189, 1193, 1227, 1241, 1268, 1282, 1296, 1316, 1317, 1325, 1359,
  1361, 1366, 1368, 1371, 1372, 1373, 1375, 1376, 1385, 1391, 1393, 1401, 1402, 1404, 1412, 1419,
  1424, 1440, 1441, 1458, 1462, 1464, 1465, 1466, 1467, 1471, 1473, 1480, 1481, 1485, 1489, 1492,
  1493, 1494, 1495, 1496, 1497, 1498, 1499, 1500, 1501, 1502, 1503,
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = String(req.headers['x-correction-delete-secret'] || '');
  if (!secret || secret !== DELETE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requestedIds: number[] = Array.isArray(req.body?.documentIds)
    ? req.body.documentIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
    : [...ALLOWED_OLD_DOCUMENT_IDS];

  const results: Array<Record<string, unknown>> = [];

  for (const id of requestedIds) {
    if (PROTECTED_DOCUMENT_IDS.has(id)) {
      results.push({ id, status: 'SKIPPED_PROTECTED' });
      continue;
    }

    if (!ALLOWED_OLD_DOCUMENT_IDS.has(id)) {
      results.push({ id, status: 'SKIPPED_NOT_ALLOWLISTED' });
      continue;
    }

    try {
      const document = await prisma.document.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          deletedAt: true,
        },
      });

      if (!document) {
        results.push({ id, status: 'NOT_FOUND' });
        continue;
      }

      if (document.deletedAt) {
        results.push({
          id,
          status: 'ALREADY_DELETED',
          title: document.title,
          documentStatus: document.status,
        });
        continue;
      }

      if (document.status === DocumentStatus.COMPLETED) {
        await prisma.document.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        results.push({
          id,
          status: 'SOFT_DELETED',
          title: document.title,
          documentStatus: document.status,
        });
        continue;
      }

      await prisma.document.delete({
        where: { id },
      });
      results.push({
        id,
        status: 'HARD_DELETED',
        title: document.title,
        documentStatus: document.status,
      });
    } catch (error) {
      results.push({
        id,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    requested: requestedIds.length,
    softDeleted: results.filter((r) => r.status === 'SOFT_DELETED').length,
    hardDeleted: results.filter((r) => r.status === 'HARD_DELETED').length,
    alreadyDeleted: results.filter((r) => r.status === 'ALREADY_DELETED').length,
    notFound: results.filter((r) => r.status === 'NOT_FOUND').length,
    skippedProtected: results.filter((r) => r.status === 'SKIPPED_PROTECTED').length,
    skippedNotAllowlisted: results.filter((r) => r.status === 'SKIPPED_NOT_ALLOWLISTED').length,
    errors: results.filter((r) => r.status === 'ERROR').length,
  };

  return res.status(200).json({ success: true, summary, results });
}
