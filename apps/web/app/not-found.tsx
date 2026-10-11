import Link from 'next/link';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function NotFound() {
  return (
    <PlaceholderPage title="Page not found" note="The page you asked for does not exist.">
      <Link className="text-link underline" href="/">
        Go to the start page
      </Link>
    </PlaceholderPage>
  );
}
