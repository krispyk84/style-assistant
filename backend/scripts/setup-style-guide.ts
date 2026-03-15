import { promises as fs } from 'node:fs';
import path from 'node:path';

import AdmZip, { type ZipEntry } from 'adm-zip';

import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { openAiClient } from '../src/ai/openai-client.js';
import { styleGuideRepository } from '../src/modules/style-guides/style-guide.repository.js';
import { prisma } from '../src/db/prisma.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current?.startsWith('--') && next && !next.startsWith('--')) {
      values[current.slice(2)] = next;
      index += 1;
    }
  }

  return values;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripMarkup(input: string) {
  return decodeHtmlEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ ]{2,}/g, ' ')
  ).trim();
}

function extractTextFromEpub(epubPath: string) {
  const zip = new AdmZip(epubPath);
  const entries = zip
    .getEntries()
    .filter((entry: ZipEntry) => !entry.isDirectory && /\.(xhtml|html|htm)$/i.test(entry.entryName))
    .sort((left: ZipEntry, right: ZipEntry) => left.entryName.localeCompare(right.entryName));

  const sections: string[] = [];

  for (const entry of entries) {
    const raw = entry.getData().toString('utf8');
    const text = stripMarkup(raw);

    if (text.length > 0) {
      sections.push(`# ${path.basename(entry.entryName)}\n${text}`);
    }
  }

  return sections.join('\n\n');
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs();
  const sourcePath = path.resolve(args.file ?? env.STYLE_GUIDE_SOURCE_PATH);
  const outputDir = path.resolve(args.outputDir ?? 'style-guides/processed');
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const processedTextPath = path.join(outputDir, `${baseName}.txt`);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.access(sourcePath);

  logger.info({ sourcePath }, 'Preparing style guide EPUB');
  const extractedText = extractTextFromEpub(sourcePath);

  if (!extractedText.trim()) {
    throw new Error('No text content could be extracted from the EPUB.');
  }

  await fs.writeFile(processedTextPath, extractedText, 'utf8');
  logger.info({ processedTextPath }, 'Wrote processed style guide text');

  const uploadedFile = await openAiClient.uploadFile({
    filename: path.basename(processedTextPath),
    mimeType: 'text/plain',
    content: await fs.readFile(processedTextPath),
  });

  const vectorStore = await openAiClient.createVectorStore(`Style Assistant Guide: ${baseName}`);
  await openAiClient.attachFilesToVectorStore(vectorStore.id, [uploadedFile.id]);

  let isIndexed = false;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const current = await openAiClient.getVectorStore(vectorStore.id);
    const inProgress = current.file_counts?.in_progress ?? 0;
    const failed = current.file_counts?.failed ?? 0;

    if (failed > 0) {
      throw new Error('Vector store indexing reported failed files.');
    }

    if (inProgress === 0) {
      isIndexed = true;
      break;
    }

    await sleep(2000);
  }

  if (!isIndexed) {
    throw new Error('Vector store indexing did not finish before the polling timeout.');
  }

  await styleGuideRepository.replaceActive({
    name: 'Esquire 2024 Style Guide',
    sourceFilename: path.basename(sourcePath),
    sourceMimeType: 'application/epub+zip',
    sourcePath,
    processedTextPath,
    openAiFileId: uploadedFile.id,
    vectorStoreId: vectorStore.id,
    metadata: {
      extractedFrom: 'epub',
      processedTextFilename: path.basename(processedTextPath),
    },
  });

  logger.info(
    {
      vectorStoreId: vectorStore.id,
      fileId: uploadedFile.id,
      processedTextPath,
    },
    'Style guide setup complete'
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  logger.error({ error }, 'Style guide setup failed');
  await prisma.$disconnect();
  process.exit(1);
});
