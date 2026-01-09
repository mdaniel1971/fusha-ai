// Scenario: Asking for Directions to the Mosque

export interface Hotspot {
  id: string;
  position: {
    top: string;
    left: string;
  };
  english: string;
  englishPlural?: string;
  arabic: string;
  arabicPlural?: string;
  transliteration: string;
  transliterationPlural?: string;
}

export interface Scene {
  id: number;
  image: string;
  title: string;
  titleArabic: string;
  description: string;
  hotspots: Hotspot[];
}

export interface Scenario {
  id: string;
  title: string;
  titleArabic: string;
  description: string;
  scenes: Scene[];
}

export const directionsToMosqueScenario: Scenario = {
  id: 'directions-to-mosque',
  title: 'Looking for the Mosque',
  titleArabic: 'البحث عن المسجد',
  description: 'Learn vocabulary for asking directions and describing locations',
  scenes: [
    {
      id: 1,
      image: '/scenes/scene1.png',
      title: 'On the Street',
      titleArabic: 'في الشارع',
      description: 'Tap objects to learn their names in Arabic',
      hotspots: [
        {
          id: 'man',
          position: { top: '45%', left: '42%' },
          english: 'man',
          englishPlural: 'men',
          arabic: 'رَجُلٌ',
          arabicPlural: 'رِجَالٌ',
          transliteration: 'rajul',
          transliterationPlural: 'rijāl',
        },
        {
          id: 'street',
          position: { top: '70%', left: '50%' },
          english: 'street',
          englishPlural: 'streets',
          arabic: 'شَارِعٌ',
          arabicPlural: 'شَوَارِعُ',
          transliteration: 'shāriʿ',
          transliterationPlural: 'shawāriʿ',
        },
        {
          id: 'sign',
          position: { top: '25%', left: '30%' },
          english: 'sign',
          englishPlural: 'signs',
          arabic: 'لَافِتَةٌ',
          arabicPlural: 'لَافِتَاتٌ',
          transliteration: 'lāfita',
          transliterationPlural: 'lāfitāt',
        },
        {
          id: 'shop',
          position: { top: '35%', left: '60%' },
          english: 'shop',
          englishPlural: 'shops',
          arabic: 'دُكَّانٌ',
          arabicPlural: 'دَكَاكِينُ',
          transliteration: 'dukkān',
          transliterationPlural: 'dakākīn',
        },
        {
          id: 'tree',
          position: { top: '30%', left: '15%' },
          english: 'tree',
          englishPlural: 'trees',
          arabic: 'شَجَرَةٌ',
          arabicPlural: 'أَشْجَارٌ',
          transliteration: 'shajara',
          transliterationPlural: 'ashjār',
        },
      ],
    },
    {
      id: 2,
      image: '/scenes/scene2.png',
      title: 'Following the Path',
      titleArabic: 'اتباع الطريق',
      description: 'Tap objects to learn their names in Arabic',
      hotspots: [
        {
          id: 'mosque',
          position: { top: '15%', left: '45%' },
          english: 'mosque',
          englishPlural: 'mosques',
          arabic: 'مَسْجِدٌ',
          arabicPlural: 'مَسَاجِدُ',
          transliteration: 'masjid',
          transliterationPlural: 'masājid',
        },
        {
          id: 'path',
          position: { top: '60%', left: '50%' },
          english: 'path',
          englishPlural: 'paths',
          arabic: 'طَرِيقٌ',
          arabicPlural: 'طُرُقٌ',
          transliteration: 'ṭarīq',
          transliterationPlural: 'ṭuruq',
        },
        {
          id: 'building',
          position: { top: '40%', left: '20%' },
          english: 'building',
          englishPlural: 'buildings',
          arabic: 'مَبْنًى',
          arabicPlural: 'مَبَانٍ',
          transliteration: 'mabnā',
          transliterationPlural: 'mabānī',
        },
        {
          id: 'minaret',
          position: { top: '10%', left: '48%' },
          english: 'minaret',
          englishPlural: 'minarets',
          arabic: 'مِئْذَنَةٌ',
          arabicPlural: 'مَآذِنُ',
          transliteration: 'miʾdhana',
          transliterationPlural: 'maʾādhin',
        },
        {
          id: 'sky',
          position: { top: '5%', left: '80%' },
          english: 'sky',
          arabic: 'سَمَاءٌ',
          transliteration: 'samāʾ',
        },
      ],
    },
    {
      id: 3,
      image: '/scenes/scene3.png',
      title: 'At the Mosque',
      titleArabic: 'في المسجد',
      description: 'Tap objects to learn their names in Arabic',
      hotspots: [
        {
          id: 'door',
          position: { top: '40%', left: '45%' },
          english: 'door',
          englishPlural: 'doors',
          arabic: 'بَابٌ',
          arabicPlural: 'أَبْوَابٌ',
          transliteration: 'bāb',
          transliterationPlural: 'abwāb',
        },
        {
          id: 'woman',
          position: { top: '55%', left: '30%' },
          english: 'woman',
          englishPlural: 'women',
          arabic: 'اِمْرَأَةٌ',
          arabicPlural: 'نِسَاءٌ',
          transliteration: 'imraʾa',
          transliterationPlural: 'nisāʾ',
        },
        {
          id: 'courtyard',
          position: { top: '70%', left: '50%' },
          english: 'courtyard',
          englishPlural: 'courtyards',
          arabic: 'فِنَاءٌ',
          arabicPlural: 'أَفْنِيَةٌ',
          transliteration: 'fināʾ',
          transliterationPlural: 'afniya',
        },
        {
          id: 'water',
          position: { top: '65%', left: '70%' },
          english: 'water',
          arabic: 'مَاءٌ',
          transliteration: 'māʾ',
        },
        {
          id: 'prayer',
          position: { top: '45%', left: '60%' },
          english: 'prayer',
          englishPlural: 'prayers',
          arabic: 'صَلَاةٌ',
          arabicPlural: 'صَلَوَاتٌ',
          transliteration: 'ṣalāh',
          transliterationPlural: 'ṣalawāt',
        },
      ],
    },
  ],
};
