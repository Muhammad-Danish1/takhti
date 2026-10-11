import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Platform console' };

export default function Page() {
  return <PlaceholderPage title="Platform console" note="Built in Phase 6." />;
}
