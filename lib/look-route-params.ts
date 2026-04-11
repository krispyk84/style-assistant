/**
 * URL route parameter shape for the look generation and results screens.
 * All fields are string | undefined because expo-router serialises every
 * route param as a URL string.
 */
export type LookRouteParams = {
  anchorItems?: string;
  anchorItemDescription?: string;
  vibeKeywords?: string;
  photoPending?: string;
  tiers?: string;
  anchorImageUri?: string;
  anchorImageWidth?: string;
  anchorImageHeight?: string;
  anchorImageFileName?: string;
  anchorImageMimeType?: string;
  uploadedAnchorImageId?: string;
  uploadedAnchorImageCategory?: string;
  uploadedAnchorImageStorageProvider?: string;
  uploadedAnchorImageStorageKey?: string;
  uploadedAnchorImagePublicUrl?: string;
  uploadedAnchorImageOriginalFilename?: string;
  uploadedAnchorImageSizeBytes?: string;
  recommendationTitle?: string;
  recommendationAnchorItem?: string;
  recommendationKeyPieces?: string;
  recommendationShoes?: string;
  recommendationAccessories?: string;
  recommendationFitNotes?: string;
  recommendationWhyItWorks?: string;
  recommendationStylingDirection?: string;
  recommendationDetailNotes?: string;
  recommendationSketchStatus?: string;
  recommendationSketchImageUrl?: string;
  recommendationSketchStorageKey?: string;
  recommendationSketchMimeType?: string;
  weatherTemperatureC?: string;
  weatherApparentTemperatureC?: string;
  weatherCode?: string;
  weatherSeason?: string;
  weatherSummary?: string;
  weatherStylingHint?: string;
  weatherLocationLabel?: string;
  weatherFetchedAt?: string;
  addAnchorToCloset?: string;
};
