import { useAuth } from '@/contexts/auth-context';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useLogout() {
  const { signOut } = useAuth();
  return { handleLogout: () => void signOut() };
}
