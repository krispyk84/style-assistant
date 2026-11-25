import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetExportService } from './closet-export.service.js';

export const closetExportRouter = Router();

closetExportRouter.get(
  '/closet/export',
  requireAuth,
  asyncHandler(async (request, response) => {
    const buffer = await closetExportService.buildArchive(request.userId!);
    const filename = `vesture-closet-export-${new Date().toISOString().slice(0, 10)}.zip`;
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', String(buffer.length));
    response.send(buffer);
  })
);
