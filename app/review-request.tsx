import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';
import { buildLookResultsHref, parseLookInput } from '@/lib/look-route';

export default function ReviewRequestScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    anchorItemDescription?: string;
    photoPending?: string;
    tiers?: string;
    anchorImageUri?: string;
    anchorImageWidth?: string;
    anchorImageHeight?: string;
    anchorImageFileName?: string;
    anchorImageMimeType?: string;
  }>();
  const input = parseLookInput(params);

  if (!input) {
    return (
      <AppScreen>
        <ErrorState
          title="Request details missing"
          message="Start from Create a look so the review step has an anchor item and tier selections."
          actionLabel="Create a look"
          actionHref="/(app)/create-look"
        />
      </AppScreen>
    );
  }

  if (!params.requestId) {
    return <Redirect href="/(app)/create-look" />;
  }

  const requestId = params.requestId;

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Review request"
          subtitle="Confirm the prompt before generating outfit recommendations."
        />
        <LookRequestReviewCard input={input} />
        <AppText tone="muted">
          The backend will use your anchor item, image, and profile context to generate three styling tiers.
        </AppText>
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton
            label="Generate looks"
            onPress={() =>
              router.push(buildLookResultsHref(requestId, input))
            }
          />
          <PrimaryButton label="Edit request" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    </AppScreen>
  );
}
