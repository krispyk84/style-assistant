import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { buildProfileFragrancePayload, fieldsFromCatalogFragrance } from '@/lib/fragrance-form-mappers';
import { fragrancesService } from '@/services/fragrances';
import type { Fragrance } from '@/types/fragrance';
import type { UploadedImageAsset } from '@/types/media';

type UseFragranceFormParams = {
  visible: boolean;
};

export function useFragranceForm({ visible }: UseFragranceFormParams) {
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [concentration, setConcentration] = useState<string | undefined>();
  const [accordNames, setAccordNames] = useState<string[]>([]);
  const [primaryVibe, setPrimaryVibe] = useState<string | undefined>();
  const [secondaryVibes, setSecondaryVibes] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [dayNight, setDayNight] = useState<string[]>([]);
  const [formalityTags, setFormalityTags] = useState<string[]>([]);
  const [isSignature, setIsSignature] = useState(false);
  const [currentVolumeMl, setCurrentVolumeMl] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [topNotes, setTopNotes] = useState<string[] | null>(null);
  const [middleNotes, setMiddleNotes] = useState<string[] | null>(null);
  const [baseNotes, setBaseNotes] = useState<string[] | null>(null);

  // ── Identify (profile) state ─────────────────────────────────────────────
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  // Set only on a confident AI match ('found'/'created') — the submit step
  // uses this to send profileOverrides instead of re-resolving a catalog row.
  // Cleared whenever the user edits brand/name/concentration away from it
  // (see identityMatchesResolved at the submit call site).
  const [resolvedFragrance, setResolvedFragrance] = useState<Fragrance | null>(null);

  // ── Bottle sketch state (mirrors useSaveToClosetSubmit's sketch handling) ──
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchJobId, setSketchJobId] = useState<string | null>(null);
  const [sketchImageUrl, setSketchImageUrl] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const sketchTranslateX = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (!isGeneratingSketch) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sketchTranslateX, { toValue: 220, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sketchTranslateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isGeneratingSketch, sketchTranslateX]);

  useEffect(() => {
    if (!sketchJobId) return;
    const interval = setInterval(() => {
      void fragrancesService.getSketchPreview(sketchJobId).then((response) => {
        if (!response.success || !response.data) return;
        if (response.data.sketchStatus === 'ready' && response.data.sketchImageUrl) {
          setSketchImageUrl(response.data.sketchImageUrl);
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        } else if (response.data.sketchStatus === 'failed') {
          // Partial-failure resilience: sketch failing never blocks saving —
          // metadata identified so far is kept, the user can still save.
          setSketchError('Bottle sketch generation failed — you can still save without it.');
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [sketchJobId]);

  function resetFields() {
    setBrand('');
    setName('');
    setConcentration(undefined);
    setAccordNames([]);
    setPrimaryVibe(undefined);
    setSecondaryVibes([]);
    setSeasons([]);
    setDayNight([]);
    setFormalityTags([]);
    setIsSignature(false);
    setCurrentVolumeMl('');
    setUserNotes('');
    setTopNotes(null);
    setMiddleNotes(null);
    setBaseNotes(null);
    setIsIdentifying(false);
    setIdentifyError(null);
    setNeedsReview(false);
    setResolvedFragrance(null);
    setIsGeneratingSketch(false);
    setSketchJobId(null);
    setSketchImageUrl(null);
    setSketchError(null);
  }

  useEffect(() => {
    if (!visible) return;
    resetFields();
  }, [visible]);

  function applyResolvedFragrance(fragrance: Fragrance) {
    const populated = fieldsFromCatalogFragrance(fragrance);
    setBrand(populated.brand ?? '');
    setName(populated.name ?? '');
    setConcentration(populated.concentration);
    setAccordNames(populated.accordNames ?? []);
    setPrimaryVibe(populated.primaryVibe);
    setSecondaryVibes(populated.secondaryVibes ?? []);
    setSeasons(populated.seasons ?? []);
    setDayNight(populated.dayNight ?? []);
    setFormalityTags(populated.formalityTags ?? []);
    setTopNotes(populated.topNotes ?? null);
    setMiddleNotes(populated.middleNotes ?? null);
    setBaseNotes(populated.baseNotes ?? null);
    setResolvedFragrance(fragrance);
    setNeedsReview(false);
  }

  function applyNeedsReviewHint(hint: { brand: string | null; name: string | null; concentration: string | null }) {
    setBrand(hint.brand ?? '');
    setName(hint.name ?? '');
    setConcentration(hint.concentration ?? undefined);
    setResolvedFragrance(null);
    setNeedsReview(true);
  }

  /** The unified "Identify, Sketch & Fill Fragrance Details" action — one context-aware action covering identification + metadata autofill + bottle sketch, per the fragrance-specific Add Closet Item flow. */
  async function handleIdentify(uploadedImage: UploadedImageAsset) {
    setIsIdentifying(true);
    setIdentifyError(null);
    setNeedsReview(false);

    const profileResponse = await fragrancesService.profileFragrance(buildProfileFragrancePayload(uploadedImage.publicUrl));

    let sketchBrand = brand;
    let sketchName = name;
    let sketchConcentration = concentration;

    if (profileResponse.success && profileResponse.data) {
      const result = profileResponse.data;
      if (result.status === 'needs_review') {
        applyNeedsReviewHint(result.hint);
        sketchBrand = result.hint.brand ?? '';
        sketchName = result.hint.name ?? '';
        sketchConcentration = result.hint.concentration ?? undefined;
      } else {
        applyResolvedFragrance(result.fragrance);
        sketchBrand = result.fragrance.brand;
        sketchName = result.fragrance.name;
        sketchConcentration = result.fragrance.concentration ?? undefined;
      }
    } else {
      // Partial-failure resilience: identification failing never blocks the
      // sketch attempt or the ability to save via manual entry below.
      setIdentifyError(profileResponse.error?.message ?? "Couldn't identify this fragrance automatically — enter the details below.");
      setNeedsReview(true);
    }

    setIsIdentifying(false);

    if (sketchBrand.trim() || sketchName.trim() || uploadedImage.publicUrl) {
      void handleGenerateSketch(uploadedImage, { brand: sketchBrand, name: sketchName, concentration: sketchConcentration });
    }
  }

  async function handleGenerateSketch(
    uploadedImage: UploadedImageAsset,
    identity: { brand: string; name: string; concentration: string | undefined },
  ) {
    setSketchError(null);
    setIsGeneratingSketch(true);

    const response = await fragrancesService.startSketchPreview({
      brand: identity.brand.trim() || 'Fragrance',
      name: identity.name.trim() || 'Unidentified bottle',
      concentration: identity.concentration,
      imageUrl: uploadedImage.publicUrl,
    });

    if (response.success && response.data) {
      setSketchJobId(response.data.jobId);
    } else {
      setSketchError(response.error?.message ?? 'Sketch generation is not available right now.');
      setIsGeneratingSketch(false);
    }
  }

  const fields = {
    brand,
    name,
    concentration,
    accordNames,
    primaryVibe,
    secondaryVibes,
    seasons,
    dayNight,
    formalityTags,
    isSignature,
    currentVolumeMl,
    userNotes,
    topNotes,
    middleNotes,
    baseNotes,
  };

  const setters = {
    setBrand,
    setName,
    setConcentration,
    setAccordNames,
    setPrimaryVibe,
    setSecondaryVibes,
    setSeasons,
    setDayNight,
    setFormalityTags,
    setIsSignature,
    setCurrentVolumeMl,
    setUserNotes,
  };

  return {
    fields,
    setters,
    isIdentifying,
    identifyError,
    needsReview,
    resolvedFragrance,
    isGeneratingSketch,
    sketchImageUrl,
    sketchError,
    sketchTranslateX,
    handleIdentify,
    resetFields,
  };
}
