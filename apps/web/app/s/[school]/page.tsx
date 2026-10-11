import { PlaceholderPage } from '@/components/placeholder-page';

export default async function SchoolSitePage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  return <PlaceholderPage title={school} note="Public school websites are built in Phase 20." />;
}
