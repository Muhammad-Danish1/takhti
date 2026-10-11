import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Parent portal' };

export default function Page() {
  return <PlaceholderPage title="Parent portal" note="Built in Phase 14." />;
}
