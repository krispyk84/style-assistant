import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { buildLookRouteParams, parseLookInput } from '@/lib/look-route';
import { createMockRequestId } from '@/lib/look-mock-data';

export default function ReviewRequestScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    anchorItems?: string;
    anchorItemDescription?: string;
    photoPending?: string;
    tiers?: string;
    anchorImageUri?: string;
    anchorImageWidth?: string;
    anchorImageHeight?: string;
    anchorImageFileName?: string;
    anchorImageMimeType?: string;
    weatherTemperatureC?: string;
    weatherApparentTemperatureC?: string;
    weatherCode?: string;
    weatherSeason?: string;
    weatherSummary?: string;
    weatherStylingHint?: string;
    weatherLocationLabel?: string;
    weatherFetchedAt?: string;
    addAnchorToCloset?: string;
  }>();
  const input = parseLookInput(params);

  if (!input) {
    return (
      <AppScreen>
        <ErrorState
          title="Request details missing"
          message="Start from Create a look so the review step has an anchor item and tier selections."
          actionLabel="Create a look"
          actionHref="/create-look"
        />
      </AppScreen>
    );
  }

  if (!params.requestId) {
    return <Redirect href="/create-look" />;
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Confirm Brief" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Ready to generate?</AppText>
          <AppText tone="muted">
            We&apos;ve gathered your wardrobe anchors and aesthetic preferences. Review your brief below.
          </AppText>
        </View>

        <LookRequestReviewCard input={input} />

        <View style={{ gap: spacing.sm }}>
          <PrimaryButton
            label="Generate Outfit Recommendations"
            onPress={() => {
              const freshRequestId = createMockRequestId();
              router.push({
                pathname: '/results/[requestId]',
                params: { ...buildLookRouteParams(freshRequestId, input), addAnchorToCloset: params.addAnchorToCloset },
              });
            }}
          />
          <PrimaryButton label="Edit request" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    </AppScreen>
  );
}
