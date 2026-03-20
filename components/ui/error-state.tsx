import { EmptyState } from '@/components/ui/empty-state';

import { Href } from 'expo-router';

type ErrorStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: Href;
};

export function ErrorState(props: ErrorStateProps) {
  return <EmptyState {...props} icon="alert-circle-outline" />;
}
