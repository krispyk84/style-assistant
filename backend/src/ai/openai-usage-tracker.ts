import { calcTextCost, calcImageCost } from './costs.js';
import type { AiFeature } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';

export function trackTextUsage(params: {
  supabaseUserId: string;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): void {
  usageService.record({
    supabaseUserId: params.supabaseUserId,
    feature: params.feature,
    model: params.model,
    costUsd: calcTextCost(params.inputTokens, params.outputTokens),
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
  });
}

export function trackImageUsage(params: {
  supabaseUserId: string;
  feature: AiFeature;
  model: string;
  size: string;
  quality: string;
}): void {
  usageService.record({
    supabaseUserId: params.supabaseUserId,
    feature: params.feature,
    model: params.model,
    costUsd: calcImageCost(params.size, params.quality),
  });
}
