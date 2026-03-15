import { canUseRealApi } from '@/lib/api/api-client';
import { apiUploadsService } from '@/services/uploads/api-uploads-service';
import { mockUploadsService } from '@/services/uploads/mock-uploads-service';

export const uploadsService = canUseRealApi() ? apiUploadsService : mockUploadsService;
