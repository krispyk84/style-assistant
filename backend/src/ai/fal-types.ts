export type GenerateImageInput = {
  prompt: string;
  loraType: 'closet' | 'outfit';
  /**
   * 'accessory' skips the VESTURE_ITEM trigger word so the LoRA's mannequin prior
   * does not fire for product-only items (sunglasses, bags, watches, etc.).
   * Defaults to 'garment' when omitted.
   */
  itemType?: 'garment' | 'accessory';
  /**
   * Optional publicly-accessible URL of the source garment image.
   * When provided the generation runs in img2img mode: Flux starts from
   * a partially-noised version of the source image (strength ~0.45) so the
   * output inherits the garment's structural geometry while the LoRA still
   * applies the Vesture illustration style.
   *
   * Only pass URLs that are reachable by fal.ai — i.e. public https:// URLs
   * (S3 / R2 in production). Skip for localhost / local storage.
   */
  sourceImageUrl?: string;
  supabaseUserId?: string;
  /**
   * Optional anchor-category-specific drift suppression terms.
   * Appended to the base NEGATIVE_PROMPT so the model cannot substitute a
   * tier-appropriate archetype for the user's actual anchor item category.
   * Example: "blazer, suit jacket, field jacket" when anchor is a bomber jacket.
   */
  additionalNegativePrompt?: string;
};
