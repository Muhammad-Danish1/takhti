import Link from 'next/link';
import { PlaceholderPage } from '@/components/placeholder-page';

const portals = [
  { href: '/platform', label: 'Platform console' },
  { href: '/hq', label: 'Head office' },
  { href: '/school', label: 'School' },
  { href: '/teach', label: 'Teacher' },
  { href: '/family', label: 'Parent' },
  { href: '/learn', label: 'Student' },
] as const;

export default function HomePage() {
  return (
    <PlaceholderPage
      title="Takhti"
      note="The backend is being built first. These portals are placeholders until their phases."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {portals.map((portal) => (
          <li key={portal.href}>
            <Link
              className="block border border-border bg-card px-4 py-3 text-foreground hover:bg-accent"
              href={portal.href}
            >
              {portal.label}
            </Link>
          </li>
        ))}
      </ul>
    </PlaceholderPage>
  );
}
