import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CreateLookTabRedirect() {
  const params = useLocalSearchParams<{
    closetItemId?: string;
    closetItemTitle?: string;
    closetItemImageUrl?: string;
    fresh?: string;
  }>();

  return (
    <Redirect
      href={{
        pathname: '/create-look',
        params,
      }}
    />
  );
}
