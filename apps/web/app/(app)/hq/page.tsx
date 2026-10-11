import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Head office' };

export default function Page() {
  return <PlaceholderPage title="Head office" note="Built in Phase 15." />;
}
