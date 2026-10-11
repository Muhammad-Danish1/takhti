import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return <PlaceholderPage title="Sign in" note="The sign-in screens are built in Phase 5." />;
}
