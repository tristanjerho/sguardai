/**
 * Dental wisdom, reminders, cheer dialogues and trivia for Sparky the Smile Guard
 */

export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function getGreeting(name = 'Friend') {
  const time = getTimeOfDay();
  const firstName = name.split(' ')[0] || 'Friend';

  const greetings = {
    morning: [
      `Good morning, ${firstName}! Ready to brighten your smile today? Don't forget your 2-minute morning brush! ✨`,
      `Rise and shine, ${firstName}! A clean set of teeth makes every morning better! ☀️`,
      `Morning, ${firstName}! Sparky here to help you guard that champion smile today! 🪥`,
    ],
    afternoon: [
      `Good afternoon, ${firstName}! Remember to rinse with water after lunch to keep plaque away! 💧`,
      `Hope your day is sparkling bright, ${firstName}! Keep up the great dental routine! 🦷`,
      `Afternoon check-in, ${firstName}! Orthodontic brackets feeling comfortable today? 🌟`,
    ],
    evening: [
      `Good evening, ${firstName}! Getting ready to wind down? Get your floss and toothbrush ready! 🌙`,
      `Hey ${firstName}, evening is prime time for thorough flossing between every bracket! 🧵`,
      `Relax and protect your smile tonight, ${firstName}! You did great today! ✨`,
    ],
    night: [
      `Bedtime already, ${firstName}? Never sleep with unbrushed teeth—Sparky needs nighttime defense! 😴`,
      `Sweet dreams, ${firstName}! Make sure nighttime brushing and retainers/elastics are in place! 🌙`,
      `Night night, ${firstName}! Sparky will guard your smile while you dream! 🌟`,
    ],
  };

  const pool = greetings[time] || greetings.morning;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const MASCOT_MESSAGES = {
  brushingReminder: [
    "Brush for a full 2 minutes twice a day with fluoride toothpaste! Tilt at a 45° angle towards the gumline.",
    "Gentle circular motions protect your enamel better than scrubbing back and forth! Be kind to your gums.",
    "Don't forget to brush your tongue! It removes lingering bacteria and keeps your breath super fresh.",
    "Replace your toothbrush or electric head every 3 months—or sooner if the bristles are frayed!",
  ],
  rubberBandReminder: [
    "Wearing your orthodontic elastics 24/7 (except when eating) cuts months off your treatment time!",
    "Hook your rubber bands exactly as your orthodontist demonstrated! Consistency is the secret to a perfect bite.",
    "Always carry extra elastic packets in your bag so you can replace broken ones immediately.",
  ],
  appointmentReminder: [
    "Your upcoming orthodontic adjustment keeps your tooth movement active and on schedule!",
    "Before your appointment, give your teeth an extra thorough brush so your dentist can inspect clearly.",
  ],
  milestoneCelebration: [
    "Woohoo! You're on a roll with your oral care streak! Your enamel thanks you! 🎉",
    "Brilliant work! Consistent daily habits create the healthiest lifelong smiles! 🏆",
    "Sparky is cheering for you! Another milestone achieved in your smile journey! 🌟",
  ],
  encouragement: [
    "Every day you care for your teeth brings you closer to your dream smile!",
    "Braces adjustments might feel tight for a day, but your straight smile will last a lifetime!",
    "Healthy gums and clean teeth are the ultimate superpower! Keep smiling bright!",
  ],
  toothTrivia: [
    "Tooth enamel is the hardest substance in the entire human body—even harder than your bones!",
    "Humans have only two sets of teeth in their lifetime (baby & adult), but sharks can go through over 30,000 teeth!",
    "If you don't floss, you miss cleaning about 35% of each tooth's surface area!",
    "Your mouth produces roughly 25,000 quarts of saliva in a lifetime—enough to fill two swimming pools!",
    "No two people have the same set of teeth or tongue print—they are as unique as your fingerprints!",
    "The average person spends roughly 38.5 total days of their lifetime brushing their teeth!",
    "Ancient Egyptians used crushed eggshells, pumice, and ashes as tooth powder around 5000 BC!",
    "Cavities are the second most common disease in the world after the common cold!",
    "Tooth enamel cannot regenerate or repair itself once lost because it contains no living cells—so guard it carefully!",
    "Braces date back to ancient times: mummies have been found with gold bands wrapped around their teeth!",
    "Chewing sugar-free xylitol gum stimulates saliva production and neutralizes harmful plaque acids!",
    "Your teeth start developing before you are even born, hidden underneath your baby gums!",
    "Crooked teeth aren't just cosmetic: straighter teeth are significantly easier to keep clean and cavity-free!",
    "Fluoride remineralizes weak spots in enamel before they turn into actual cavities!",
    "Smiling releases endorphins and serotonin, which naturally lower stress and boost your mood!",
  ],
};

export const TRIVIA_QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is the hardest substance found in the human body?',
    options: ['Femur Bone', 'Tooth Enamel', 'Skull', 'Fingernails'],
    correctIndex: 1,
    explanation: 'Tooth enamel is 96% mineralized hydroxyapatite, making it harder than any bone in your skeleton!',
  },
  {
    id: 'q2',
    question: 'What percentage of tooth surface do you miss if you skip flossing?',
    options: ['About 10%', 'About 20%', 'About 35%', 'About 50%'],
    correctIndex: 2,
    explanation: 'Interdental spaces between your teeth account for approximately 35% of the total tooth surface.',
  },
  {
    id: 'q3',
    question: 'How long should you ideally brush your teeth during each session?',
    options: ['30 seconds', '1 minute', '2 minutes', '5 minutes'],
    correctIndex: 2,
    explanation: 'Dental associations worldwide recommend brushing for at least 2 full minutes (30 seconds per quadrant).',
  },
];
