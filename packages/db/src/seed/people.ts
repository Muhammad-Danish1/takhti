import type { Random } from './context';

/*
 * Invented people. Every name is a common Pakistani name chosen at random from the lists below;
 * every number has the right shape and belongs to nobody:
 *   - CNIC and B-Form numbers start with 9, a first digit no province uses;
 *   - mobile numbers sit in one block, +92 300 555 0000 onwards, which the seed sets aside.
 */

export interface Name {
  en: string;
  ur: string;
}

const names = (list: readonly (readonly [string, string])[]): Name[] =>
  list.map(([en, ur]) => ({ en, ur }));

export const maleNames = names([
  ['Muhammad', 'محمد'],
  ['Ahmed', 'احمد'],
  ['Ali', 'علی'],
  ['Hassan', 'حسن'],
  ['Hussain', 'حسین'],
  ['Usman', 'عثمان'],
  ['Umar', 'عمر'],
  ['Bilal', 'بلال'],
  ['Hamza', 'حمزہ'],
  ['Ibrahim', 'ابراہیم'],
  ['Yusuf', 'یوسف'],
  ['Zain', 'زین'],
  ['Saad', 'سعد'],
  ['Fahad', 'فہد'],
  ['Imran', 'عمران'],
  ['Kamran', 'کامران'],
  ['Adnan', 'عدنان'],
  ['Faisal', 'فیصل'],
  ['Tariq', 'طارق'],
  ['Khalid', 'خالد'],
  ['Asif', 'آصف'],
  ['Naveed', 'نوید'],
  ['Waqas', 'وقاص'],
  ['Shahid', 'شاہد'],
  ['Rashid', 'راشد'],
  ['Junaid', 'جنید'],
  ['Danish', 'دانش'],
  ['Farhan', 'فرحان'],
  ['Salman', 'سلمان'],
  ['Arslan', 'ارسلان'],
  ['Taha', 'طہٰ'],
  ['Rayyan', 'ریان'],
  ['Ayaan', 'ایان'],
  ['Zaid', 'زید'],
  ['Huzaifa', 'حذیفہ'],
  ['Abdullah', 'عبداللہ'],
  ['Mustafa', 'مصطفیٰ'],
  ['Haris', 'حارث'],
  ['Shayan', 'شایان'],
  ['Daniyal', 'دانیال'],
  ['Moiz', 'معیز'],
  ['Sufyan', 'سفیان'],
  ['Talha', 'طلحہ'],
  ['Anas', 'انس'],
  ['Owais', 'اویس'],
  ['Rehan', 'ریحان'],
  ['Asad', 'اسد'],
  ['Waleed', 'ولید'],
  ['Noman', 'نعمان'],
  ['Irfan', 'عرفان'],
  ['Kashif', 'کاشف'],
  ['Nadeem', 'ندیم'],
  ['Sajid', 'ساجد'],
  ['Zubair', 'زبیر'],
  ['Aamir', 'عامر'],
  ['Babar', 'بابر'],
  ['Shoaib', 'شعیب'],
  ['Yasir', 'یاسر'],
]);

export const femaleNames = names([
  ['Ayesha', 'عائشہ'],
  ['Fatima', 'فاطمہ'],
  ['Maryam', 'مریم'],
  ['Zainab', 'زینب'],
  ['Khadija', 'خدیجہ'],
  ['Hina', 'حنا'],
  ['Sana', 'ثناء'],
  ['Sara', 'سارہ'],
  ['Noor', 'نور'],
  ['Amna', 'آمنہ'],
  ['Iqra', 'اقراء'],
  ['Hira', 'حرا'],
  ['Rabia', 'رابعہ'],
  ['Sadia', 'سعدیہ'],
  ['Nadia', 'نادیہ'],
  ['Saima', 'صائمہ'],
  ['Samina', 'ثمینہ'],
  ['Farah', 'فرح'],
  ['Mehwish', 'مہوش'],
  ['Komal', 'کومل'],
  ['Bushra', 'بشریٰ'],
  ['Uzma', 'عظمیٰ'],
  ['Shazia', 'شازیہ'],
  ['Nasreen', 'نسرین'],
  ['Rubina', 'روبینہ'],
  ['Asma', 'اسماء'],
  ['Javeria', 'جویریہ'],
  ['Laiba', 'لائبہ'],
  ['Mahnoor', 'ماہ نور'],
  ['Eman', 'ایمان'],
  ['Anaya', 'عنایہ'],
  ['Zara', 'زارا'],
  ['Aleena', 'علینہ'],
  ['Areeba', 'اریبہ'],
  ['Hania', 'ہانیہ'],
  ['Minahil', 'مناہل'],
  ['Rida', 'ردا'],
  ['Maham', 'ماہم'],
  ['Kinza', 'کنزہ'],
  ['Sidra', 'سدرہ'],
  ['Tooba', 'طوبیٰ'],
  ['Wajiha', 'وجیہہ'],
  ['Yusra', 'یسریٰ'],
  ['Zoya', 'زویا'],
  ['Dua', 'دعا'],
  ['Fiza', 'فضا'],
  ['Haleema', 'حلیمہ'],
  ['Jannat', 'جنت'],
  ['Mishal', 'مشعل'],
  ['Nimra', 'نمرہ'],
  ['Rimsha', 'رمشا'],
  ['Saba', 'صبا'],
  ['Tehreem', 'تحریم'],
  ['Alishba', 'علیشبہ'],
  ['Momina', 'مومنہ'],
  ['Sumaira', 'سمیرا'],
]);

export const surnames = names([
  ['Ahmed', 'احمد'],
  ['Khan', 'خان'],
  ['Malik', 'ملک'],
  ['Hussain', 'حسین'],
  ['Sheikh', 'شیخ'],
  ['Raza', 'رضا'],
  ['Ali', 'علی'],
  ['Qureshi', 'قریشی'],
  ['Javed', 'جاوید'],
  ['Shah', 'شاہ'],
  ['Butt', 'بٹ'],
  ['Chaudhry', 'چوہدری'],
  ['Siddiqui', 'صدیقی'],
  ['Iqbal', 'اقبال'],
  ['Akhtar', 'اختر'],
  ['Baig', 'بیگ'],
  ['Mirza', 'مرزا'],
  ['Anwar', 'انور'],
  ['Yousaf', 'یوسف'],
  ['Latif', 'لطیف'],
  ['Ashraf', 'اشرف'],
  ['Mehmood', 'محمود'],
  ['Rehman', 'رحمٰن'],
  ['Aslam', 'اسلم'],
  ['Saleem', 'سلیم'],
  ['Farooq', 'فاروق'],
  ['Nawaz', 'نواز'],
  ['Sharif', 'شریف'],
  ['Abbasi', 'عباسی'],
  ['Awan', 'اعوان'],
  ['Bhatti', 'بھٹی'],
  ['Cheema', 'چیمہ'],
  ['Dar', 'ڈار'],
  ['Gill', 'گل'],
  ['Hashmi', 'ہاشمی'],
  ['Jamil', 'جمیل'],
  ['Kazmi', 'کاظمی'],
  ['Lodhi', 'لودھی'],
  ['Memon', 'میمن'],
  ['Naqvi', 'نقوی'],
  ['Rana', 'رانا'],
  ['Tahir', 'طاہر'],
  ['Usmani', 'عثمانی'],
  ['Virk', 'ورک'],
  ['Warraich', 'وڑائچ'],
  ['Zaidi', 'زیدی'],
  ['Gondal', 'گوندل'],
  ['Kiani', 'کیانی'],
  ['Mughal', 'مغل'],
  ['Niazi', 'نیازی'],
  ['Rizvi', 'رضوی'],
  ['Sandhu', 'سندھو'],
]);

/** Names the named records of the seed use that are not in the lists above. */
const extraNames: Record<string, string> = {
  Masih: 'مسیح',
  Daniel: 'دانیال',
  Omar: 'عمر',
  Adeel: 'عدیل',
  Dr: 'ڈاکٹر',
  Abdul: 'عبد',
  Waheed: 'الوحید',
  Ghulam: 'غلام',
  Rasool: 'رسول',
  Sher: 'شیر',
  Zaman: 'زمان',
  Akram: 'اکرم',
  Parveen: 'پروین',
  Anjum: 'انجم',
  Arshad: 'ارشد',
  Mahmood: 'محمود',
  Kamal: 'کمال',
  Rauf: 'رؤف',
  Shafiq: 'شفیق',
  Arif: 'عارف',
  Sobia: 'صوبیہ',
  Lakhani: 'لاکھانی',
  Yasmin: 'یاسمین',
  Dawood: 'داؤد',
  Waqar: 'وقار',
};

const urduByEnglish = new Map<string, string>([
  ...[...maleNames, ...femaleNames, ...surnames].map((name) => [name.en, name.ur] as const),
  ...Object.entries(extraNames),
]);

/** The Urdu spelling of a full name whose every word is known; otherwise nothing, and the name stays in English only. */
export function urduOf(fullName: string): string | null {
  const words = fullName.split(' ').map((word) => urduByEnglish.get(word));
  return words.every((word) => word !== undefined) ? words.join(' ') : null;
}

const alsoMale = new Set(['Waqar', 'Abdul', 'Arshad', 'Sher', 'Ghulam', 'Daniel', 'Omar', 'Adeel']);
const knownMale = new Set(maleNames.map((name) => name.en));
const knownFemale = new Set(femaleNames.map((name) => name.en));

/** Whether a seeded person is a man or a woman, from their first name. Every name the seed uses is known. */
export function genderOf(name: string): 'male' | 'female' {
  const first = name.replace(/^(Dr|Mr|Mrs|Ms) /, '').split(' ')[0] ?? '';
  if (knownMale.has(first) || alsoMale.has(first)) return 'male';
  if (knownFemale.has(first) || first === 'Yasmin' || first === 'Sobia') return 'female';
  throw new Error(`The seed does not know whether "${name}" is a man's or a woman's name`);
}

export const fullName = (first: Name, last: Name): Name => ({
  en: `${first.en} ${last.en}`,
  ur: `${first.ur} ${last.ur}`,
});

// ---------------------------------------------------------------- numbers that belong to nobody

/** A number of the CNIC shape, `9NNNN-NNNNNNN-N`. `serial` must be unique among the numbers handed out. */
export function identityNumber(serial: number, block: 0 | 1): string {
  const body = String(serial).padStart(7, '0');
  const check = (serial * 7 + block * 3) % 10;
  return `9${String(block).padStart(4, '0')}-${body}-${check}`;
}

/** A mobile number from the seed's block: `+92300555NNNN` and upwards. */
export const mobileNumber = (serial: number): string => `+92300${String(5550000 + serial)}`;

const lahoreAreas = [
  'Johar Town',
  'Model Town',
  'Gulberg',
  'Garden Town',
  'Wapda Town',
  'Township',
  'Faisal Town',
  'Allama Iqbal Town',
  'Samanabad',
  'Shadman',
  'Cantt',
  'DHA Phase 4',
  'Valencia Town',
  'Sabzazar',
  'Mughalpura',
];
const karachiAreas = ['Gulshan-e-Iqbal', 'North Nazimabad', 'PECHS', 'Malir', 'Clifton'];

/** A street address in the city, invented. */
export function addressIn(city: 'Lahore' | 'Karachi', rand: Random): string {
  const area = rand.pick(city === 'Lahore' ? lahoreAreas : karachiAreas);
  return `House ${rand.int(1, 480)}, Street ${rand.int(1, 40)}, ${area}, ${city}`;
}

export const occupations = [
  'Shopkeeper',
  'Government employee',
  'Teacher',
  'Engineer',
  'Doctor',
  'Banker',
  'Driver',
  'Businessman',
  'Farmer',
  'Tailor',
  'Accountant',
  'Electrician',
  'Salesman',
  'Lawyer',
  'Overseas worker',
  'Army (retired)',
];
