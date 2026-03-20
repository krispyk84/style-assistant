import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

const appVersion = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  href?: string;
  showChevron?: boolean;
};

function SettingsRow({ icon, label, value, href, showChevron = true }: SettingsRowProps) {
  const content = (
    <View 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderSubtle,
      }}>
      <View 
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        }}>
        <Ionicons name={icon} size={18} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sectionTitle">{label}</AppText>
        {value && <AppText variant="caption" tone="muted">{value}</AppText>}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.subtleText} />
      )}
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          {content}
        </Pressable>
      </Link>
    );
  }

  return content;
}

export default function SettingsScreen() {
  const { isSaving, profile, saveProfile } = useAppSession();
  const [isSavedMessageVisible, setIsSavedMessageVisible] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader 
          eyebrow="Settings"
          title="Preferences"
          subtitle="Manage your profile and app settings."
          variant="page"
        />
        
        {/* Profile Section */}
        <View
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: spacing.lg,
            },
            theme.shadows.md,
          ]}>
          <AppText variant="eyebrow" tone="subtle" style={{ marginBottom: spacing.sm }}>Account</AppText>
          
          <Pressable 
            onPress={() => setShowProfileForm(!showProfileForm)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <SettingsRow 
              icon="person-outline" 
              label="Edit Profile" 
              value="Update your style preferences"
              showChevron={!showProfileForm}
            />
          </Pressable>
          
          {showProfileForm && (
            <View style={{ marginTop: spacing.lg }}>
              <ProfileForm
                initialValue={profile}
                submitLabel={isSaving ? 'Saving...' : 'Save Changes'}
                disabled={isSaving}
                onSubmit={async (nextProfile) => {
                  await saveProfile(nextProfile, true);
                  setIsSavedMessageVisible(true);
                  setTimeout(() => setIsSavedMessageVisible(false), 3000);
                }}
              />
              {isSavedMessageVisible && (
                <View 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: spacing.xs,
                    marginTop: spacing.md,
                    padding: spacing.sm,
                    backgroundColor: theme.colors.successLight,
                    borderRadius: theme.radius.sm,
                  }}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <AppText variant="caption" style={{ color: theme.colors.success }}>Profile saved successfully</AppText>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* App Info Section */}
        <View
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: spacing.lg,
            },
            theme.shadows.sm,
          ]}>
          <AppText variant="eyebrow" tone="subtle" style={{ marginBottom: spacing.sm }}>About</AppText>
          
          <SettingsRow 
            icon="information-circle-outline" 
            label="Version" 
            value={`Vesture ${appVersion}`}
            showChevron={false}
          />
          
          <View 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingVertical: spacing.md,
            }}>
            <View 
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.accentLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}>
              <Ionicons name="heart-outline" size={18} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="sectionTitle">Made with care</AppText>
              <AppText variant="caption" tone="muted">Your personal styling assistant</AppText>
            </View>
          </View>
        </View>
      </View>
    </AppScreen>
  );
}
