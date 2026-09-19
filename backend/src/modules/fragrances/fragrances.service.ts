import { HttpError } from '../../lib/http-error.js';
import { createOrReuseManualFragrance, resolveFragranceProfile } from './fragrance-profile.service.js';
import { fragranceSketchService } from './fragrance-sketch.service.js';
import { fragrancesRepository } from './fragrances.repository.js';
import type { UserFragranceUpdateInput } from './fragrances.repository.js';
import type {
  AddUserFragrancePayload,
  CreateManualFragrancePayload,
  FragranceSketchPreviewPayload,
  ProfileFragrancePayload,
  UpdateUserFragrancePayload,
} from './fragrances.validation.js';

export const fragrancesService = {
  async searchCatalog(query: string) {
    return fragrancesRepository.searchCatalog(query);
  },

  async profileFragrance(payload: ProfileFragrancePayload, supabaseUserId: string) {
    return resolveFragranceProfile({
      brand: payload.brand,
      name: payload.name,
      concentration: payload.concentration,
      imageUrl: payload.imageUrl,
      supabaseUserId,
    });
  },

  /** Manual fallback (spec section 17) — no AI call, user-supplied identity only. */
  async createManualFragrance(payload: CreateManualFragrancePayload) {
    return createOrReuseManualFragrance(payload);
  },

  async startSketchPreview(payload: FragranceSketchPreviewPayload, supabaseUserId?: string) {
    const jobId = await fragranceSketchService.startSketchJob(payload, supabaseUserId);
    return { jobId };
  },

  async getSketchPreview(jobId: string) {
    const result = await fragranceSketchService.getSketchJobStatus(jobId);
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Sketch job not found.');
    return result;
  },

  async addToCloset(payload: AddUserFragrancePayload, supabaseUserId: string) {
    const fragrance = await fragrancesRepository.findById(payload.fragranceId);
    if (!fragrance) throw new HttpError(404, 'NOT_FOUND', 'Fragrance not found in catalog.');

    const existingOwnership = await fragrancesRepository.findExistingOwnership(supabaseUserId, payload.fragranceId);
    if (existingOwnership) throw new HttpError(409, 'ALREADY_OWNED', 'This fragrance is already in your closet.');

    return fragrancesRepository.createUserFragrance({
      supabaseUserId,
      fragranceId: payload.fragranceId,
      originalImageUrl: payload.originalImageUrl,
      bottleSketchUrl: payload.bottleSketchUrl,
      bottleSketchStatus: payload.bottleSketchUrl ? 'ready' : 'not_started',
      isSignature: payload.isSignature ?? false,
      currentVolumeMl: payload.currentVolumeMl ?? null,
      userNotes: payload.userNotes,
      // Validated as a plain JSON-safe record by addUserFragranceSchema at the
      // route boundary — same trust boundary as updateUserFragrance below.
      profileOverrides: payload.profileOverrides as UserFragranceUpdateInput['profileOverrides'],
    });
  },

  async listUserFragrances(supabaseUserId: string) {
    return fragrancesRepository.listUserFragrances(supabaseUserId);
  },

  async updateUserFragrance(id: string, supabaseUserId: string, payload: UpdateUserFragrancePayload) {
    const existing = await fragrancesRepository.getUserFragrance(id, supabaseUserId);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Fragrance not found in your closet.');

    // profileOverrides is validated as a plain JSON-safe record by
    // updateUserFragranceSchema (zod) at the route boundary — safe to treat
    // as Prisma.InputJsonValue here without re-validating its shape.
    await fragrancesRepository.updateUserFragrance(id, supabaseUserId, payload as UserFragranceUpdateInput);
    return fragrancesRepository.getUserFragrance(id, supabaseUserId);
  },

  async removeUserFragrance(id: string, supabaseUserId: string) {
    const existing = await fragrancesRepository.getUserFragrance(id, supabaseUserId);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Fragrance not found in your closet.');

    // Removes only the UserFragrance ownership row — the shared Fragrance
    // catalog record is never touched by a single user's removal.
    await fragrancesRepository.deleteUserFragrance(id, supabaseUserId);
    return { deleted: true };
  },
};
