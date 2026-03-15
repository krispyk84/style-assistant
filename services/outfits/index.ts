import { canUseRealApi } from '@/lib/api/api-client';
import { apiOutfitsService } from '@/services/outfits/api-outfits-service';
import { mockOutfitsService } from '@/services/outfits/mock-outfits-service';

export const outfitsService = canUseRealApi() ? apiOutfitsService : mockOutfitsService;
