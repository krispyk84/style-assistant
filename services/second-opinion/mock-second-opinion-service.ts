import type { SecondOpinionService } from '@/services/second-opinion/second-opinion-service';

export const mockSecondOpinionService: SecondOpinionService = {
  async getOpinion(request) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      success: true,
      data: {
        id: 'mock-opinion-1',
        stylistId: request.stylistId,
        perspective:
          request.stylistId === 'vittorio'
            ? 'The foundation here is solid — an anchor piece with genuine authority. The proportions read well and the palette shows discipline. Where I would push further is the collar space and the trouser break: these two details will either confirm the intention or undercut it.'
            : 'I find this interesting — there is a tension between the structure and the ease here that could be extraordinary if you commit to it. Right now it is hedging. Pick a side: go more architectural or more relaxed, but do not sit in between.',
        keyFeedback: [
          'The anchor piece carries the look with conviction.',
          'The accessory choices are safe — consider one more assertive element.',
          'Colour temperature is cohesive; no friction.',
        ],
        suggestions: [
          'Reduce the trouser break to half-break for a cleaner line.',
          'Swap the belt for a leather tab closure to maintain the minimalist read.',
          'Consider an unlined jacket in the same cloth for summer carry-over.',
        ],
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  },
};
