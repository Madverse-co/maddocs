import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let cachedTemplate: string | null = null;

function loadDiyArtistTemplate(): string {
  const candidates = [
    join(process.cwd(), 'packages/lib/server-only/madverse-diy-artist-template.html'),
    join(process.cwd(), '../../packages/lib/server-only/madverse-diy-artist-template.html'),
    join(__dirname, 'madverse-diy-artist-template.html'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf8');
    }
  }

  throw new Error('madverse-diy-artist-template.html not found');
}

/** Loaded on first DIY agreement request — avoids breaking label flows at module init. */
export function getDiyArtistSubPublisherAgreement(): string {
  if (!cachedTemplate) {
    cachedTemplate = loadDiyArtistTemplate();
  }

  return cachedTemplate;
}
