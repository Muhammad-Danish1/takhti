import type { Province } from '../../kernel/primitives';
import type { BoardKind } from './setup.constants';

/*
 * The examination boards a school in Pakistan may register its Grade 9 and 10 students with.
 *
 * This list is product data, not demonstration data: the `boards` table is brought in line with it
 * on every migration run, in every environment, the same way the `permissions` table follows the
 * catalogue. A board that leaves the list is switched off, never deleted, because past results name it.
 *
 * A website is given only where it has been checked; the rest are filled in as each is confirmed.
 */

export interface BoardDef {
  /** Stable, never reused: `bise-lahore`. */
  key: string;
  name: string;
  shortName: string;
  province: Province;
  kind: BoardKind;
  website?: string;
}

const bise = (
  key: string,
  city: string,
  province: Province,
  name = `Board of Intermediate and Secondary Education, ${city}`,
): BoardDef => ({ key, name, shortName: `BISE ${city}`, province, kind: 'bise' });

export const boardCatalogue: readonly BoardDef[] = [
  {
    key: 'fbise',
    name: 'Federal Board of Intermediate and Secondary Education',
    shortName: 'FBISE',
    province: 'ict',
    kind: 'federal',
    website: 'https://www.fbise.edu.pk',
  },
  // Punjab: nine boards.
  { ...bise('bise-lahore', 'Lahore', 'punjab'), website: 'https://www.biselahore.com' },
  bise('bise-gujranwala', 'Gujranwala', 'punjab'),
  bise('bise-rawalpindi', 'Rawalpindi', 'punjab'),
  bise('bise-faisalabad', 'Faisalabad', 'punjab'),
  bise('bise-multan', 'Multan', 'punjab'),
  bise('bise-sargodha', 'Sargodha', 'punjab'),
  bise('bise-bahawalpur', 'Bahawalpur', 'punjab'),
  bise('bise-dg-khan', 'Dera Ghazi Khan', 'punjab'),
  bise('bise-sahiwal', 'Sahiwal', 'punjab'),
  // Sindh.
  {
    key: 'bsek',
    name: 'Board of Secondary Education, Karachi',
    shortName: 'BSEK',
    province: 'sindh',
    kind: 'bise',
  },
  bise('bise-hyderabad', 'Hyderabad', 'sindh'),
  bise('bise-sukkur', 'Sukkur', 'sindh'),
  bise('bise-larkana', 'Larkana', 'sindh'),
  bise('bise-mirpurkhas', 'Mirpurkhas', 'sindh'),
  bise('bise-shaheed-benazirabad', 'Shaheed Benazirabad', 'sindh'),
  // Khyber Pakhtunkhwa.
  bise('bise-peshawar', 'Peshawar', 'kp'),
  bise('bise-mardan', 'Mardan', 'kp'),
  bise('bise-abbottabad', 'Abbottabad', 'kp'),
  bise('bise-swat', 'Swat', 'kp'),
  bise('bise-kohat', 'Kohat', 'kp'),
  bise('bise-malakand', 'Malakand', 'kp'),
  bise('bise-bannu', 'Bannu', 'kp'),
  bise('bise-di-khan', 'Dera Ismail Khan', 'kp'),
  // Balochistan and Azad Jammu and Kashmir.
  {
    key: 'bbise-quetta',
    name: 'Balochistan Board of Intermediate and Secondary Education, Quetta',
    shortName: 'BBISE Quetta',
    province: 'balochistan',
    kind: 'bise',
  },
  {
    key: 'ajk-bise',
    name: 'Azad Jammu and Kashmir Board of Intermediate and Secondary Education, Mirpur',
    shortName: 'AJK BISE',
    province: 'ajk',
    kind: 'bise',
  },
  // Private.
  {
    key: 'aku-eb',
    name: 'Aga Khan University Examination Board',
    shortName: 'AKU-EB',
    province: 'sindh',
    kind: 'private',
    website: 'https://examinationboard.aku.edu',
  },
];
