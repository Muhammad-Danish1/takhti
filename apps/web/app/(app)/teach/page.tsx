import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'Teacher portal' };

export default function Page() {
  return <PlaceholderPage title="Teacher portal" note="Built in Phase 13." />;
}
