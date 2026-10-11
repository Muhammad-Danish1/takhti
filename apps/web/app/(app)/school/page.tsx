import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/placeholder-page';

export const metadata: Metadata = { title: 'School' };

export default function Page() {
  return <PlaceholderPage title="School" note="Built in Phases 7 to 12." />;
}
