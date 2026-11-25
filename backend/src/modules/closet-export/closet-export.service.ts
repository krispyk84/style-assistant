import path from 'node:path';
import { promises as fsPromises } from 'node:fs';

import AdmZip from 'adm-zip';

import { storageConfig } from '../../config/storage.js';
import { closetRepository } from '../closet/closet.repository.js';
import { fragrancesRepository } from '../fragrances/fragrances.repository.js';

// ── Image fetch ──────────────────────────────────────────────────────────────
// Same disk-first/HTTP-fallback strategy as closet-sketch.service.ts's
// imageUrlToDataUrl — works for local-disk files, DB-backed media routes, and
// S3 public URLs alike, since an HTTP fetch of any of those resolves correctly.

async function fetchImageBytes(imageUrl: string): Promise<{ buffer: Buffer; extension: string } | null> {
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      return { buffer, extension: path.extname(storageKey).toLowerCase() || '.jpg' };
    } catch {
      // Not on disk — fall through to HTTP fetch (DB-backed media route or S3).
    }
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const extension = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    return { buffer: Buffer.from(await res.arrayBuffer()), extension };
  } catch {
    return null;
  }
}

function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'item'}-${id.slice(-6)}`;
}

// ── CSV ────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('; ') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvCell(row[col])).join(','));
  }
  return lines.join('\n');
}

// ── Archive ──────────────────────────────────────────────────────────────────

const GARMENT_CSV_COLUMNS = [
  'id', 'title', 'brand', 'size', 'category', 'subcategory', 'primaryColor', 'colorFamily',
  'material', 'formality', 'silhouette', 'season', 'weight', 'pattern', 'fitStatus',
  'lensShape', 'frameColor', 'notes', 'savedAt', 'hasOriginalImage', 'hasSketch',
];

const FRAGRANCE_CSV_COLUMNS = [
  'id', 'brand', 'name', 'concentration', 'primaryVibe', 'secondaryVibes', 'isSignature',
  'currentVolumeMl', 'userNotes', 'createdAt', 'hasOriginalImage', 'hasSketch',
];

export const closetExportService = {
  async buildArchive(supabaseUserId: string): Promise<Buffer> {
    const [garments, fragranceEntries] = await Promise.all([
      closetRepository.getItems(supabaseUserId),
      fragrancesRepository.listUserFragrances(supabaseUserId),
    ]);

    const zip = new AdmZip();

    const garmentRows: Record<string, unknown>[] = [];
    for (const item of garments) {
      const slug = slugify(item.title, item.id);
      let imagePath: string | null = null;
      let sketchPath: string | null = null;

      if (item.uploadedImageUrl) {
        const image = await fetchImageBytes(item.uploadedImageUrl);
        if (image) {
          imagePath = `images/garments/${slug}${image.extension}`;
          zip.addFile(imagePath, image.buffer);
        }
      }
      if (item.sketchImageUrl) {
        const sketch = await fetchImageBytes(item.sketchImageUrl);
        if (sketch) {
          sketchPath = `sketches/garments/${slug}${sketch.extension}`;
          zip.addFile(sketchPath, sketch.buffer);
        }
      }

      garmentRows.push({
        id: item.id,
        title: item.title,
        brand: item.brand,
        size: item.size,
        category: item.category,
        subcategory: item.subcategory,
        primaryColor: item.primaryColor,
        colorFamily: item.colorFamily,
        material: item.material,
        formality: item.formality,
        silhouette: item.silhouette,
        season: item.season,
        weight: item.weight,
        pattern: item.pattern,
        fitStatus: item.fitStatus,
        lensShape: item.lensShape,
        frameColor: item.frameColor,
        notes: item.notes,
        savedAt: item.savedAt.toISOString(),
        hasOriginalImage: Boolean(imagePath),
        hasSketch: Boolean(sketchPath),
        imageFile: imagePath,
        sketchFile: sketchPath,
      });
    }

    const fragranceRows: Record<string, unknown>[] = [];
    for (const entry of fragranceEntries) {
      const slug = slugify(`${entry.fragrance.brand} ${entry.fragrance.name}`, entry.id);
      let imagePath: string | null = null;
      let sketchPath: string | null = null;

      if (entry.originalImageUrl) {
        const image = await fetchImageBytes(entry.originalImageUrl);
        if (image) {
          imagePath = `images/fragrances/${slug}${image.extension}`;
          zip.addFile(imagePath, image.buffer);
        }
      }
      if (entry.bottleSketchUrl) {
        const sketch = await fetchImageBytes(entry.bottleSketchUrl);
        if (sketch) {
          sketchPath = `sketches/fragrances/${slug}${sketch.extension}`;
          zip.addFile(sketchPath, sketch.buffer);
        }
      }

      fragranceRows.push({
        id: entry.id,
        brand: entry.fragrance.brand,
        name: entry.fragrance.name,
        concentration: entry.fragrance.concentration,
        topNotes: entry.fragrance.topNotes,
        middleNotes: entry.fragrance.middleNotes,
        baseNotes: entry.fragrance.baseNotes,
        mainAccords: entry.fragrance.mainAccords,
        primaryVibe: entry.fragrance.primaryVibe,
        secondaryVibes: entry.fragrance.secondaryVibes,
        isSignature: entry.isSignature,
        currentVolumeMl: entry.currentVolumeMl,
        userNotes: entry.userNotes,
        createdAt: entry.createdAt.toISOString(),
        hasOriginalImage: Boolean(imagePath),
        hasSketch: Boolean(sketchPath),
        imageFile: imagePath,
        sketchFile: sketchPath,
      });
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      garmentCount: garmentRows.length,
      fragranceCount: fragranceRows.length,
      garments: garmentRows,
      fragrances: fragranceRows,
    };

    zip.addFile('closet-export.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    zip.addFile('garments.csv', Buffer.from(toCsv(garmentRows, GARMENT_CSV_COLUMNS)));
    zip.addFile('fragrances.csv', Buffer.from(toCsv(fragranceRows, FRAGRANCE_CSV_COLUMNS)));

    return zip.toBuffer();
  },
};
