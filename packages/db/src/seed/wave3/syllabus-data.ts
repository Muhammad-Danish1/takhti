/*
 * The syllabus the seed teaches from. Titles follow the national curriculum's own chapter names;
 * nothing here is copied text, only headings a teacher would recognise.
 *
 * A full tree is written for Grades 9 and 10 in Physics, Chemistry, Biology, Mathematics and English:
 * each unit lists its chapters. Every other subject gets a shorter tree from `outline`.
 */

type Unit = readonly [title: string, chapters: readonly string[]];

const physics9: readonly Unit[] = [
  [
    'Physical Quantities and Measurement',
    ['Base and derived quantities', 'Measuring instruments', 'Significant figures'],
  ],
  ['Kinematics', ['Rest and motion', 'Scalars and vectors', 'Equations of motion']],
  ['Dynamics', ['Force, inertia and momentum', 'Newton’s laws of motion', 'Friction']],
  ['Turning Effect of Forces', ['Torque and couple', 'Centre of gravity', 'Equilibrium']],
  ['Gravitation', ['Law of gravitation', 'Mass of the Earth', 'Artificial satellites']],
  [
    'Work and Energy',
    ['Work and its unit', 'Kinetic and potential energy', 'Efficiency and power'],
  ],
  ['Properties of Matter', ['Kinetic molecular model', 'Density and pressure', 'Elasticity']],
  [
    'Thermal Properties of Matter',
    ['Temperature and heat', 'Specific heat capacity', 'Thermal expansion'],
  ],
  ['Transfer of Heat', ['Conduction', 'Convection', 'Radiation']],
];

const physics10: readonly Unit[] = [
  ['Simple Harmonic Motion and Waves', ['Simple harmonic motion', 'Wave motion', 'Ripple tank']],
  ['Sound', ['Sound waves', 'Characteristics of sound', 'Noise pollution']],
  ['Geometrical Optics', ['Reflection of light', 'Refraction of light', 'Lenses and their uses']],
  ['Electrostatics', ['Electric charge', 'Coulomb’s law', 'Capacitors']],
  ['Current Electricity', ['Electric current', 'Ohm’s law', 'Electric power and safety']],
  [
    'Electromagnetism',
    ['Magnetic effects of current', 'Electromagnetic induction', 'Transformers'],
  ],
  ['Basic Electronics', ['Thermionic emission', 'Logic gates', 'Uses of logic gates']],
  [
    'Information and Communication Technology',
    ['Components of a system', 'Transmission of signals', 'Storing information'],
  ],
  ['Atomic and Nuclear Physics', ['Atom and nucleus', 'Radioactivity', 'Fission and fusion']],
];

const chemistry9: readonly Unit[] = [
  ['Fundamentals of Chemistry', ['Branches of chemistry', 'Basic definitions', 'The mole']],
  ['Structure of Atoms', ['Theories of atomic structure', 'Electronic configuration', 'Isotopes']],
  ['Periodic Table and Periodicity', ['The periodic table', 'Periodicity of properties']],
  [
    'Structure of Molecules',
    ['Why atoms form bonds', 'Types of bonds', 'Nature of bonding and properties'],
  ],
  ['Physical States of Matter', ['Gaseous state', 'Liquid state', 'Solid state']],
  ['Solutions', ['Solution and its types', 'Concentration units', 'Solubility']],
  ['Electrochemistry', ['Oxidation and reduction', 'Electrochemical cells', 'Corrosion']],
  ['Chemical Reactivity', ['Metals', 'Non-metals']],
];

const chemistry10: readonly Unit[] = [
  ['Chemical Equilibrium', ['Reversible reactions', 'Law of mass action', 'Equilibrium constant']],
  ['Acids, Bases and Salts', ['Concepts of acids and bases', 'The pH scale', 'Salts']],
  ['Organic Chemistry', ['Organic compounds', 'Sources of organic compounds', 'Functional groups']],
  ['Hydrocarbons', ['Alkanes', 'Alkenes', 'Alkynes']],
  ['Biochemistry', ['Carbohydrates', 'Proteins', 'Lipids and vitamins']],
  ['The Atmosphere', ['Composition of the atmosphere', 'Air pollutants', 'Acid rain and ozone']],
  ['Water', ['Properties of water', 'Hard and soft water', 'Water pollution']],
  ['Chemical Industries', ['Basic metallurgy', 'Manufacture of urea', 'Petroleum industry']],
];

const biology9: readonly Unit[] = [
  ['Introduction to Biology', ['Divisions and branches', 'Levels of organisation']],
  ['Solving a Biological Problem', ['Biological method', 'Data organisation and analysis']],
  ['Biodiversity', ['Classification', 'Five kingdoms', 'Conservation']],
  ['Cells and Tissues', ['Microscopy and cell theory', 'Cellular structures', 'Tissues']],
  ['Cell Cycle', ['Mitosis', 'Meiosis']],
  ['Enzymes', ['Characteristics of enzymes', 'Mechanism of enzyme action']],
  ['Bioenergetics', ['ATP', 'Photosynthesis', 'Respiration']],
  ['Nutrition', ['Mineral nutrition in plants', 'Human digestive system', 'Disorders of the gut']],
  ['Transport', ['Transport in plants', 'Human blood', 'Human heart and vessels']],
];

const biology10: readonly Unit[] = [
  [
    'Gaseous Exchange',
    ['Gaseous exchange in plants', 'Human respiratory system', 'Respiratory disorders'],
  ],
  ['Homeostasis', ['Homeostasis in plants', 'Human urinary system', 'Kidney disorders']],
  ['Coordination and Control', ['Nervous system', 'Receptors', 'Endocrine system']],
  ['Support and Movement', ['Human skeleton', 'Joints', 'Muscles and movement']],
  ['Reproduction', ['Asexual reproduction', 'Reproduction in plants', 'Reproduction in animals']],
  ['Inheritance', ['Genes and chromosomes', 'Mendel’s laws', 'Variation and evolution']],
  [
    'Man and His Environment',
    ['Levels of ecological organisation', 'Flow of materials and energy', 'Pollution'],
  ],
  ['Biotechnology', ['Fermentation', 'Genetic engineering']],
  ['Pharmacology', ['Medicinal drugs', 'Addictive drugs', 'Antibiotics and vaccines']],
];

const maths9: readonly Unit[] = [
  [
    'Matrices and Determinants',
    ['Types of matrices', 'Addition and multiplication', 'Solving simultaneous equations'],
  ],
  [
    'Real and Complex Numbers',
    ['Properties of real numbers', 'Radicals and radicands', 'Complex numbers'],
  ],
  ['Logarithms', ['Scientific notation', 'Laws of logarithms', 'Applications']],
  ['Algebraic Expressions and Formulas', ['Algebraic expressions', 'Algebraic formulas', 'Surds']],
  ['Factorization', ['Factorizing expressions', 'Remainder and factor theorems']],
  [
    'Linear Equations and Inequalities',
    ['Linear equations', 'Equations with absolute value', 'Linear inequalities'],
  ],
  ['Linear Graphs', ['Cartesian plane', 'Conversion graphs', 'Graphical solution of equations']],
  ['Coordinate Geometry', ['Distance formula', 'Collinear points', 'Mid-point formula']],
  ['Congruent Triangles', ['Congruency of triangles', 'Theorems on congruent triangles']],
  ['Pythagoras’ Theorem', ['Statement and proof', 'Applications']],
];

const maths10: readonly Unit[] = [
  [
    'Quadratic Equations',
    ['Solving by factorization', 'Quadratic formula', 'Equations reducible to quadratic form'],
  ],
  [
    'Theory of Quadratic Equations',
    ['Nature of the roots', 'Roots and coefficients', 'Simultaneous equations'],
  ],
  ['Variations', ['Ratio and proportion', 'Theorems on proportion', 'Joint variation']],
  ['Partial Fractions', ['Proper and improper fractions', 'Resolving into partial fractions']],
  ['Sets and Functions', ['Operations on sets', 'Binary relations', 'Functions']],
  [
    'Basic Statistics',
    ['Frequency distribution', 'Measures of central tendency', 'Measures of dispersion'],
  ],
  [
    'Introduction to Trigonometry',
    ['Measurement of an angle', 'Trigonometric ratios', 'Trigonometric identities'],
  ],
  ['Chords of a Circle', ['Theorems on chords']],
  ['Tangent to a Circle', ['Theorems on tangents']],
  ['Practical Geometry: Circles', ['Constructing circles', 'Tangents to a circle']],
];

const english9: readonly Unit[] = [
  ['The Saviour of Mankind', ['Reading comprehension', 'Vocabulary', 'Writing a summary']],
  ['Patriotism', ['Reading comprehension', 'Parts of speech', 'Paragraph writing']],
  ['Media and Its Impact', ['Reading comprehension', 'Tenses', 'Writing an email']],
  ['Daffodils', ['Understanding the poem', 'Figures of speech']],
  ['The Quaid’s Vision and Pakistan', ['Reading comprehension', 'Direct and indirect speech']],
  ['Stopping by Woods on a Snowy Evening', ['Understanding the poem', 'Paraphrasing']],
  ['All Is Not Lost', ['Reading comprehension', 'Active and passive voice', 'Story writing']],
  ['Drug Addiction', ['Reading comprehension', 'Letter writing']],
  ['Three Days to See', ['Reading comprehension', 'Essay writing']],
];

const english10: readonly Unit[] = [
  ['An Embodiment of Justice', ['Reading comprehension', 'Vocabulary', 'Writing a summary']],
  ['Chinese New Year', ['Reading comprehension', 'Punctuation']],
  ['Try Again', ['Understanding the poem', 'Paraphrasing']],
  ['First Aid', ['Reading comprehension', 'Conditional sentences', 'Writing instructions']],
  ['Television vs Newspapers', ['Reading comprehension', 'Comparing and contrasting']],
  ['Little by Little One Walks Far', ['Reading comprehension', 'Writing an application']],
  ['Selecting the Right Career', ['Reading comprehension', 'Formal letter']],
  ['A World Without Books', ['Reading comprehension', 'Essay writing']],
  ['Population Growth and World Food Supplies', ['Reading comprehension', 'Translation into Urdu']],
];

/** `grade:subject code` → the full tree of that subject in that grade. */
export const fullTrees: Readonly<Record<string, readonly Unit[]>> = {
  '9:PHY': physics9,
  '10:PHY': physics10,
  '9:CHEM': chemistry9,
  '10:CHEM': chemistry10,
  '9:BIO': biology9,
  '10:BIO': biology10,
  '9:MATH': maths9,
  '10:MATH': maths10,
  '9:ENG': english9,
  '10:ENG': english10,
};

/** What a chapter of a full tree is broken into: the same three steps a teacher plans a chapter in. */
export const topicSteps = [
  'Concepts and definitions',
  'Worked examples',
  'Exercise and review',
] as const;

interface OutlineUnit {
  title: string;
  titleUr?: string;
  chapters: readonly string[];
}

/** Subject code → units for the shorter trees. A grade takes six of them, starting further along as the grade rises. */
export const outline: Readonly<Record<string, readonly OutlineUnit[]>> = {
  ENG: [
    {
      title: 'Reading and comprehension',
      chapters: ['Reading aloud', 'Answering questions on a passage'],
    },
    { title: 'Grammar', chapters: ['Nouns and pronouns', 'Verbs and tenses'] },
    { title: 'Vocabulary', chapters: ['Word meanings', 'Synonyms and antonyms'] },
    { title: 'Creative writing', chapters: ['Sentences and paragraphs', 'Stories and letters'] },
    { title: 'Poems', chapters: ['Recitation', 'Meaning of the poem'] },
    { title: 'Listening and speaking', chapters: ['Conversation', 'Describing a picture'] },
    {
      title: 'Punctuation and spelling',
      chapters: ['Capital letters and full stops', 'Spelling rules'],
    },
    { title: 'Composition', chapters: ['Essay writing', 'Applications'] },
  ],
  URD: [
    {
      title: 'Prose',
      titleUr: 'نثر',
      chapters: ['Lessons from the textbook', 'Questions and answers'],
    },
    { title: 'Poetry', titleUr: 'نظم', chapters: ['Poems', 'Explanation of verses'] },
    { title: 'Grammar', titleUr: 'قواعد', chapters: ['Parts of speech', 'Tenses'] },
    {
      title: 'Vocabulary',
      titleUr: 'ذخیرہ الفاظ',
      chapters: ['Word meanings', 'Idioms and proverbs'],
    },
    {
      title: 'Composition',
      titleUr: 'انشا پردازی',
      chapters: ['Essays', 'Letters and applications'],
    },
    { title: 'Handwriting', titleUr: 'خوش خطی', chapters: ['Joining letters', 'Dictation'] },
    {
      title: 'Comprehension',
      titleUr: 'تفہیم',
      chapters: ['Reading a passage', 'Summary writing'],
    },
    {
      title: 'Ghazals',
      titleUr: 'غزلیات',
      chapters: ['Selected ghazals', 'Poets and their style'],
    },
  ],
  MATH: [
    { title: 'Numbers and place value', chapters: ['Counting and ordering', 'Place value'] },
    { title: 'Addition and subtraction', chapters: ['Adding', 'Subtracting'] },
    { title: 'Multiplication and division', chapters: ['Tables', 'Dividing'] },
    { title: 'Fractions and decimals', chapters: ['Fractions', 'Decimals'] },
    { title: 'Measurement', chapters: ['Length, mass and capacity', 'Time and money'] },
    { title: 'Geometry', chapters: ['Lines and angles', 'Shapes'] },
    { title: 'Data handling', chapters: ['Tables and charts', 'Averages'] },
    { title: 'Algebra', chapters: ['Patterns and expressions', 'Simple equations'] },
    { title: 'Ratio and percentage', chapters: ['Ratio and proportion', 'Percentage'] },
  ],
  SCI: [
    { title: 'Living things', chapters: ['Plants', 'Animals'] },
    { title: 'The human body', chapters: ['Organs and systems', 'Health and hygiene'] },
    { title: 'Matter', chapters: ['States of matter', 'Changes in matter'] },
    { title: 'Force and energy', chapters: ['Push and pull', 'Forms of energy'] },
    { title: 'Light and sound', chapters: ['Light', 'Sound'] },
    { title: 'Earth and space', chapters: ['The Earth', 'The solar system'] },
    { title: 'Environment', chapters: ['Habitats', 'Pollution'] },
    { title: 'Electricity and magnetism', chapters: ['Circuits', 'Magnets'] },
  ],
  SST: [
    { title: 'Our country', chapters: ['Land and people', 'Provinces'] },
    { title: 'Maps and globes', chapters: ['Reading a map', 'Directions'] },
    { title: 'History', chapters: ['Early civilisations', 'The Pakistan Movement'] },
    { title: 'Citizenship', chapters: ['Rights and duties', 'Government'] },
    { title: 'Weather and climate', chapters: ['Seasons', 'Climate regions'] },
    { title: 'Economy', chapters: ['Agriculture', 'Trade and industry'] },
    { title: 'Culture', chapters: ['Languages and festivals', 'Dress and food'] },
  ],
  PST: [
    {
      title: 'Ideological basis of Pakistan',
      chapters: ['Ideology of Pakistan', 'Sayings of the Quaid and Iqbal'],
    },
    { title: 'Making of Pakistan', chapters: ['The Pakistan Movement', 'Emergence of Pakistan'] },
    {
      title: 'Land and environment',
      chapters: ['Location and physical features', 'Climate and hazards'],
    },
    { title: 'History of Pakistan', chapters: ['The early years', 'Constitutional development'] },
    {
      title: 'Pakistan in world affairs',
      chapters: ['Foreign policy', 'Relations with neighbours'],
    },
    { title: 'Economic development', chapters: ['Resources', 'Industry and trade'] },
    { title: 'Population and society', chapters: ['Population', 'Culture of Pakistan'] },
  ],
  ISL: [
    {
      title: 'Quran',
      titleUr: 'قرآن مجید',
      chapters: ['Selected verses', 'Translation and meaning'],
    },
    { title: 'Hadith', titleUr: 'حدیث', chapters: ['Selected ahadith', 'Lessons for daily life'] },
    {
      title: 'Beliefs',
      titleUr: 'ایمانیات',
      chapters: ['Oneness of Allah', 'Prophethood and the Hereafter'],
    },
    { title: 'Worship', titleUr: 'عبادات', chapters: ['Prayer and fasting', 'Zakat and Hajj'] },
    { title: 'Seerah', titleUr: 'سیرت طیبہ', chapters: ['Life in Makkah', 'Life in Madinah'] },
    {
      title: 'Morals and manners',
      titleUr: 'اخلاق و آداب',
      chapters: ['Truthfulness and trust', 'Rights of others'],
    },
    {
      title: 'Islamic history',
      titleUr: 'اسلامی تاریخ',
      chapters: ['The rightly guided caliphs', 'Great personalities'],
    },
  ],
  ETH: [
    { title: 'Values', chapters: ['Honesty', 'Respect'] },
    { title: 'World religions', chapters: ['Major religions', 'Places of worship'] },
    { title: 'Great personalities', chapters: ['Reformers', 'Peace makers'] },
    { title: 'Living together', chapters: ['Tolerance', 'Helping others'] },
    { title: 'Rights and duties', chapters: ['Human rights', 'Duties of a citizen'] },
    { title: 'Character building', chapters: ['Self-control', 'Hard work'] },
  ],
  NAZ: [
    { title: 'Qaida', titleUr: 'قاعدہ', chapters: ['Letters and sounds', 'Joining letters'] },
    { title: 'Tajweed', titleUr: 'تجوید', chapters: ['Makharij', 'Rules of recitation'] },
    { title: 'Recitation', titleUr: 'ناظرہ', chapters: ['Para by para', 'Revision'] },
    { title: 'Memorisation', titleUr: 'حفظ', chapters: ['Short surahs', 'Daily duas'] },
    { title: 'Prayer', titleUr: 'نماز', chapters: ['Words of the prayer', 'Method of prayer'] },
    { title: 'Selected surahs', titleUr: 'منتخب سورتیں', chapters: ['Recitation', 'Meaning'] },
  ],
  COMP: [
    { title: 'Parts of a computer', chapters: ['Hardware', 'Input and output devices'] },
    { title: 'Using a computer', chapters: ['Keyboard and mouse', 'Files and folders'] },
    { title: 'Word processing', chapters: ['Typing a document', 'Formatting'] },
    { title: 'Spreadsheets', chapters: ['Cells and formulas', 'Charts'] },
    { title: 'The internet', chapters: ['Browsing and search', 'Staying safe online'] },
    { title: 'Presentations', chapters: ['Slides', 'Pictures and animation'] },
    { title: 'Coding', chapters: ['Algorithms', 'Block programming'] },
  ],
  CS: [
    { title: 'Problem solving', chapters: ['Algorithms and flowcharts', 'Test data'] },
    { title: 'Binary system', chapters: ['Number systems', 'Boolean algebra'] },
    { title: 'Networks', chapters: ['Data communication', 'Computer networks'] },
    { title: 'Data and privacy', chapters: ['Ethical issues', 'Encryption'] },
    { title: 'Designing a website', chapters: ['HTML basics', 'Links, lists and images'] },
    { title: 'Programming in C', chapters: ['Input and output', 'Conditions and loops'] },
  ],
  DRW: [
    { title: 'Drawing', chapters: ['Lines and shapes', 'Still life'] },
    { title: 'Colour', chapters: ['Primary and secondary colours', 'Painting'] },
    { title: 'Craft', chapters: ['Paper craft', 'Clay work'] },
    { title: 'Calligraphy', chapters: ['Basic strokes', 'Words and phrases'] },
    { title: 'Patterns', chapters: ['Geometric patterns', 'Truck art'] },
    { title: 'Nature study', chapters: ['Leaves and flowers', 'Landscapes'] },
  ],
  PE: [
    { title: 'Fitness', chapters: ['Warm-up drills', 'Stretching'] },
    { title: 'Athletics', chapters: ['Running', 'Jumping'] },
    { title: 'Ball games', chapters: ['Cricket', 'Football'] },
    { title: 'Indoor games', chapters: ['Badminton', 'Table tennis'] },
    { title: 'Team work', chapters: ['Relays', 'Tug of war'] },
    { title: 'Health', chapters: ['Posture', 'Food and rest'] },
  ],
};
