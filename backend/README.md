# Style Assistant API

Node.js + TypeScript API for the Style Assistant app. The service is designed for Render, uses Express, PostgreSQL, Prisma, Zod validation, local image storage, server-side OpenAI Responses API calls, and optional vector-store retrieval from a style guide document.

## Stack

- Node.js 20+
- Express
- PostgreSQL
- Prisma ORM
- Zod validation
- Pino logging

## Local setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Create or point to a PostgreSQL database, then set `DATABASE_URL` in `.env`.

4. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the API:

```bash
npm run dev
```

The API will start on `http://localhost:4000` by default.

## Style guide retrieval setup

The backend can bias its styling outputs using a reference guide stored in an OpenAI vector store. The source file you mentioned should be kept here by default:

- `backend/style-guides/source/Esquire-2024.epub`

You can also leave the file where it is and pass an explicit path to the setup script.

Recommended setup:

1. Put the EPUB at `backend/style-guides/source/Esquire-2024.epub`
2. Run a migration for the new `StyleGuideDocument` table
3. Run the setup script:

```bash
npm run style-guide:setup
```

Or with an explicit path:

```bash
npm run style-guide:setup -- --file /Users/karimhamasni/Downloads/Esquire.epub
```

What the script does:

- extracts readable text from the EPUB into `backend/style-guides/processed/*.txt`
- uploads the processed text file to OpenAI
- creates a vector store
- links the file to that vector store
- stores the active vector store id and file metadata in the database

Retrieval is optional at runtime. If no vector store is configured or no relevant excerpts are found, the app still works using only the base stylist rules.

## Routes

- `GET /health`
- `GET /profile`
- `POST /profile`
- `POST /outfits/generate`
- `POST /outfits/:id/regenerate-tier`
- `POST /compatibility-check`
- `POST /selfie-review`

## AI approach

The service keeps all prompt logic and OpenAI calls on the backend. Mobile clients only talk to this API. Uploaded images are stored locally first, then converted into model-ready image inputs on the server so the same structure can later be swapped to object storage without changing the route contracts.

## Render deployment notes

This repo includes a root [`render.yaml`](../render.yaml) that points Render at the `backend/` directory.

Recommended Render setup:

- Runtime: Node
- Root Directory: `backend`
- Build Command: `npm install && npm run prisma:generate && npm run build`
- Start Command: `npm run start:migrate`

Required Render environment variables:

- `DATABASE_URL`
- `NODE_ENV=production`
- `PORT` is injected by Render
- `LOG_LEVEL=info`
- `CORS_ORIGIN` set to your Expo/API consumer origin as needed
- `OPENAI_API_KEY`
- `OPENAI_RESPONSES_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_TIMEOUT_MS`
- `STYLE_GUIDE_ENABLED`
- `STYLE_GUIDE_VECTOR_STORE_ID`
- `STYLE_GUIDE_SOURCE_PATH`
- `STYLE_GUIDE_MAX_RESULTS`
- `STYLE_GUIDE_SCORE_THRESHOLD`
- `STORAGE_PROVIDER`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_LOCAL_DIR`
- `STORAGE_MAX_FILE_SIZE_MB`

## Future integration points

- Swap the local storage provider for S3 or another object store by implementing the same storage adapter interface.
- Add auth and user scoping once identity is introduced.
- Add additional retrieval sources beyond the Esquire guide once you want broader editorial grounding.
