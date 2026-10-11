import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Student portal' };

export default function Page() {
  return <PlaceholderPage title="Student portal" note="Built in Phase 14." />;
}
