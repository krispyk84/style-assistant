import { createContext, PropsWithChildren, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type ToastTone = 'success' | 'error';

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const value = useMemo(
    () => ({
      showToast(message: string, tone: ToastTone = 'success') {
        setToast({ message, tone });
        opacity.setValue(0);

        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(2000),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => setToast(null));
      },
    }),
    [opacity]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.xxl * 2,
            alignItems: 'center',
          }}>
          <Animated.View
            style={{
              opacity,
              backgroundColor: toast.tone === 'success' ? theme.colors.card : theme.colors.danger,
              borderColor: theme.colors.border,
              borderRadius: 18,
              borderWidth: 1,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              width: '100%',
            }}>
            <AppText
              style={{
                color: toast.tone === 'success' ? theme.colors.text : theme.colors.surface,
                textAlign: 'center',
              }}>
              {toast.message}
            </AppText>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
