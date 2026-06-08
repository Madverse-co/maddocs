import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import type { DiyOwnerType } from './madverse-diy-artist-helpers';

const MADVERSE_STAMP_FILENAME = 'madverse-digital-stamp.png';

function resolveMadverseStampPath(): string | null {
  const candidates = [
    join(process.cwd(), 'packages/lib/server-only/assets', MADVERSE_STAMP_FILENAME),
    join(process.cwd(), '../../packages/lib/server-only/assets', MADVERSE_STAMP_FILENAME),
    join(process.cwd(), 'Madverse digital Stamp.png'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getMadverseStampHtml(): string {
  const stampPath = resolveMadverseStampPath();

  if (!stampPath) {
    console.warn('Madverse digital stamp PNG not found; using SVG fallback');
    return getCircularTextStampSvg('MADVERSE MUSIC PUBLISHING', {
      stroke: '#000',
      radius: 52,
    });
  }

  const base64 = readFileSync(stampPath).toString('base64');
  return `<img class="stamp-image madverse-stamp-img" src="data:image/png;base64,${base64}" alt="Madverse stamp" />`;
}

function getOwnerStampLabel(artistName: string, ownerType: DiyOwnerType): string {
  const base = artistName.trim().toUpperCase();

  if (ownerType === 'ARTIST') {
    return base;
  }

  return `${base} OFFICIAL`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStampTypography(label: string, arcRadius: number) {
  const arcLength = Math.PI * arcRadius * 0.94;
  let fontSize = 8;
  let letterSpacing = 1.2;

  for (let fs = 9; fs >= 4.5; fs -= 0.25) {
    const estimatedWidth = label.length * (fs * 0.54 + letterSpacing);
    if (estimatedWidth <= arcLength) {
      fontSize = fs;
      break;
    }
    fontSize = fs;
  }

  let estimatedWidth = label.length * (fontSize * 0.54 + letterSpacing);
  if (estimatedWidth > arcLength) {
    letterSpacing = Math.max(0, arcLength / label.length - fontSize * 0.54);
    estimatedWidth = label.length * (fontSize * 0.54 + letterSpacing);
  }

  if (estimatedWidth > arcLength && fontSize > 4.5) {
    fontSize = Math.max(4.5, (arcLength / label.length) * 0.85);
    letterSpacing = Math.max(0, arcLength / label.length - fontSize * 0.54);
  }

  return { fontSize: Math.round(fontSize * 10) / 10, letterSpacing: Math.round(letterSpacing * 10) / 10 };
}

function getCircularTextStampSvg(
  label: string,
  options: { stroke: string; radius: number },
): string {
  const text = escapeSvgText(label);
  const { stroke, radius } = options;
  const { fontSize, letterSpacing } = getStampTypography(label, radius - 6);
  const size = radius * 2 + 24;
  const center = size / 2;
  const arcRadius = radius - 6;
  const displaySize = 78;

  return `<svg class="stamp-svg owner-stamp-svg" width="${displaySize}" height="${displaySize}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="ownerStampArc-${radius}" d="M ${center - arcRadius},${center + 2} A ${arcRadius},${arcRadius} 0 0,1 ${center + arcRadius},${center + 2}" fill="none"/>
  </defs>
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${stroke}" stroke-width="1"/>
  <text font-family="Courier New, Courier, monospace" font-size="${fontSize}" fill="${stroke === '#000' ? '#000' : '#6b9fd4'}" letter-spacing="${letterSpacing}">
    <textPath href="#ownerStampArc-${radius}" startOffset="50%" text-anchor="middle">${text}</textPath>
  </text>
</svg>`;
}

export function getOwnerStampHtml(artistName: string, ownerType: DiyOwnerType): string {
  const label = getOwnerStampLabel(artistName, ownerType);

  return `<div class="stamp-wrap owner-stamp-wrap">${getCircularTextStampSvg(label, {
    stroke: '#6b9fd4',
    radius: 30,
  })}</div>`;
}
