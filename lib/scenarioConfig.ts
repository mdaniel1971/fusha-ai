// Scenario-based visual learning configuration

export interface Hotspot {
  id: string;
  label: string;
  labelArabic: string;
  top: string;
  left: string;
  contextPrompt: string;
  vocabularyFocus: string[];
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

// Looking for the Mosque scenario
export const LOOKING_FOR_MOSQUE: Scenario = {
  id: 'looking-for-mosque',
  title: 'Looking for the Mosque',
  titleArabic: 'البحث عن المسجد',
  description: 'Practice asking for directions and describing locations in Arabic',
  scenes: [
    {
      id: 1,
      image: '/scenes/scene1.png',
      title: 'Asking for Directions',
      titleArabic: 'السؤال عن الاتجاهات',
      description: 'You are on a street and need to ask someone for directions to the mosque.',
      hotspots: [
        {
          id: 'person',
          label: 'Person',
          labelArabic: 'شخص',
          top: '45%',
          left: '42%',
          contextPrompt: `The student clicked on a person on the street. Guide them to practice asking for directions in Arabic. Focus on polite greetings and asking "Where is the mosque?" (أين المسجد؟). Encourage them to use phrases like:
- السلام عليكم (Peace be upon you)
- من فضلك (Please)
- أين المسجد؟ (Where is the mosque?)
- شكراً (Thank you)
Start by having them greet the person, then ask for directions.`,
          vocabularyFocus: ['السلام عليكم', 'من فضلك', 'أين', 'المسجد', 'شكراً'],
        },
        {
          id: 'street-sign',
          label: 'Street Sign',
          labelArabic: 'لافتة الشارع',
          top: '25%',
          left: '30%',
          contextPrompt: `The student clicked on a street sign. Help them practice reading Arabic street names and direction words. Focus on:
- شارع (street)
- يمين (right)
- يسار (left)
- مباشرة (straight)
Ask them what they see on the sign and practice direction vocabulary.`,
          vocabularyFocus: ['شارع', 'يمين', 'يسار', 'مباشرة', 'اتجاه'],
        },
        {
          id: 'shop',
          label: 'Shop',
          labelArabic: 'متجر',
          top: '35%',
          left: '60%',
          contextPrompt: `The student clicked on a shop. Help them practice asking shopkeepers for directions. Shopkeepers often know the neighborhood well. Focus on:
- متجر / دكان (shop)
- هل تعرف؟ (Do you know?)
- قريب (near)
- بعيد (far)
Practice a conversation asking the shopkeeper if they know where the mosque is.`,
          vocabularyFocus: ['متجر', 'دكان', 'هل تعرف', 'قريب', 'بعيد'],
        },
      ],
    },
    {
      id: 2,
      image: '/scenes/scene2.png',
      title: 'Following the Path',
      titleArabic: 'اتباع الطريق',
      description: 'You can see the mosque in the distance and need to find your way there.',
      hotspots: [
        {
          id: 'mosque-distance',
          label: 'Mosque in Distance',
          labelArabic: 'المسجد من بعيد',
          top: '15%',
          left: '45%',
          contextPrompt: `The student clicked on the mosque visible in the distance. Help them practice describing what they see and expressing that they can see their destination. Focus on:
- أرى (I see)
- المسجد (the mosque)
- هناك (there)
- بعيد / قريب (far / near)
- الحمد لله (Praise be to God - expression of relief)
Practice describing the mosque they can see.`,
          vocabularyFocus: ['أرى', 'المسجد', 'هناك', 'بعيد', 'الحمد لله'],
        },
        {
          id: 'path',
          label: 'Path',
          labelArabic: 'الطريق',
          top: '60%',
          left: '50%',
          contextPrompt: `The student clicked on the path. Help them practice describing the route and asking about the way. Focus on:
- طريق (path/way)
- هذا الطريق (this path)
- إلى (to)
- كيف أصل؟ (How do I get there?)
- امشِ (walk - imperative)
Practice asking if this is the right path to the mosque.`,
          vocabularyFocus: ['طريق', 'هذا', 'إلى', 'كيف أصل', 'امشِ'],
        },
        {
          id: 'buildings',
          label: 'Buildings',
          labelArabic: 'مباني',
          top: '40%',
          left: '20%',
          contextPrompt: `The student clicked on nearby buildings. Help them practice using landmarks for directions. Focus on:
- مبنى / مباني (building / buildings)
- بجانب (next to)
- أمام (in front of)
- وراء (behind)
- بين (between)
Practice describing the mosque's location relative to buildings.`,
          vocabularyFocus: ['مبنى', 'بجانب', 'أمام', 'وراء', 'بين'],
        },
      ],
    },
    {
      id: 3,
      image: '/scenes/scene3.png',
      title: 'Arriving at the Mosque',
      titleArabic: 'الوصول إلى المسجد',
      description: 'You have arrived at the mosque and want to enter.',
      hotspots: [
        {
          id: 'mosque-entrance',
          label: 'Mosque Entrance',
          labelArabic: 'مدخل المسجد',
          top: '40%',
          left: '45%',
          contextPrompt: `The student clicked on the mosque entrance. Help them practice vocabulary for entering the mosque. Focus on:
- مدخل (entrance)
- باب (door)
- بِسْمِ اللَّهِ (In the name of God - said when entering)
- أدخل (I enter)
- الصلاة (prayer)
Practice the phrases used when entering a mosque.`,
          vocabularyFocus: ['مدخل', 'باب', 'بِسْمِ اللَّهِ', 'أدخل', 'الصلاة'],
        },
        {
          id: 'people',
          label: 'People',
          labelArabic: 'الناس',
          top: '55%',
          left: '45%',
          contextPrompt: `The student clicked on people near the mosque. Help them practice greeting people at the mosque and asking about prayer times. Focus on:
- الناس (people)
- السلام عليكم (greeting)
- متى الصلاة؟ (When is the prayer?)
- جماعة (congregation)
- إمام (prayer leader)
Practice greeting people and asking about prayer times.`,
          vocabularyFocus: ['الناس', 'السلام عليكم', 'متى', 'الصلاة', 'جماعة'],
        },
        {
          id: 'courtyard',
          label: 'Courtyard',
          labelArabic: 'الفناء',
          top: '70%',
          left: '50%',
          contextPrompt: `The student clicked on the mosque courtyard. Help them practice vocabulary for mosque areas and ablution. Focus on:
- فناء (courtyard)
- وضوء (ablution)
- ماء (water)
- نظيف (clean)
- مكان الصلاة (prayer area)
Practice asking where to perform ablution.`,
          vocabularyFocus: ['فناء', 'وضوء', 'ماء', 'نظيف', 'مكان'],
        },
      ],
    },
  ],
};

// Export all scenarios
export const SCENARIOS: Scenario[] = [LOOKING_FOR_MOSQUE];

// Helper to get scenario by ID
export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
