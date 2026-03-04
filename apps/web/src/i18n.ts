export type Lang = "en" | "ar";

export interface T {
  appName: string;
  createRoom: string;
  joinRoom: string;
  enterCode: string;
  join: string;
  create: string;
  back: string;
  playerName: string;
  tagline: string;
  lang: string;
  installHint: string;
  installHintClose: string;
  // lobby
  roomCode: string;
  shareWhatsApp: string;
  players: string;
  ready: string;
  notReady: string;
  youLabel: string;
  hostLabel: string;
  startGame: string;
  waitingForPlayers: string;
  // arena – ready check
  duelAnnounce: string;   // "{a} vs {b}"
  tapToReady: string;
  waitingForOpponent: string;
  benchedThisDuel: string;
  // arena – result
  youWon: string;
  youLost: string;
  itsDraw: string;
  pointsEarned: string;   // "+{n} pts"
  nextDuelIn: string;
  // arena – winner screen
  championIs: string;
  finalLeaderboard: string;
  playAgain: string;
  // leaderboard
  pts: string;
  // errors
  err_name_required: string;
  err_invalid_code: string;
  err_not_found: string;
  err_full: string;
  err_unknown: string;
}

const en: T = {
  appName: "Unipal Arena",
  createRoom: "Create Room",
  joinRoom: "Join Room",
  enterCode: "4-digit room code",
  join: "Join",
  create: "Create",
  back: "Back",
  playerName: "Your name",
  tagline: "May the best player win.",
  lang: "AR",
  installHint: 'Tap Share then "Add to Home Screen" to install.',
  installHintClose: "Dismiss",
  roomCode: "Room Code",
  shareWhatsApp: "Invite via WhatsApp",
  players: "Players",
  ready: "Ready",
  notReady: "Not Ready",
  youLabel: "you",
  hostLabel: "host",
  startGame: "Start Game",
  waitingForPlayers: "Waiting for players…",
  duelAnnounce: "{a} vs {b}",
  tapToReady: "Tap Ready when you're set!",
  waitingForOpponent: "Waiting for opponent…",
  benchedThisDuel: "You are benched this duel. Sit tight!",
  youWon: "You Won!",
  youLost: "You Lost",
  itsDraw: "Draw!",
  pointsEarned: "+{n} pts",
  nextDuelIn: "Next duel starting…",
  championIs: "{name} is the Champion! 🏆",
  finalLeaderboard: "Final Standings",
  playAgain: "Play Again",
  pts: "pts",
  err_name_required: "Name is required.",
  err_invalid_code: "Room code must be 4 digits.",
  err_not_found: "Room not found.",
  err_full: "Room is full (max 12 players).",
  err_unknown: "Something went wrong.",
};

const ar: T = {
  appName: "حلبة يونيبال",
  createRoom: "إنشاء غرفة",
  joinRoom: "الانضمام لغرفة",
  enterCode: "رمز الغرفة (4 أرقام)",
  join: "انضم",
  create: "إنشاء",
  back: "رجوع",
  playerName: "اسمك",
  tagline: "لتفز الأفضل.",
  lang: "EN",
  installHint: 'اضغط على مشاركة ثم "إضافة إلى الشاشة الرئيسية" للتثبيت.',
  installHintClose: "إغلاق",
  roomCode: "رمز الغرفة",
  shareWhatsApp: "دعوة عبر واتساب",
  players: "اللاعبون",
  ready: "جاهز",
  notReady: "غير جاهز",
  youLabel: "أنت",
  hostLabel: "المضيف",
  startGame: "ابدأ اللعبة",
  waitingForPlayers: "في انتظار اللاعبين…",
  duelAnnounce: "{a} ضد {b}",
  tapToReady: "اضغط جاهز عندما تكون مستعداً!",
  waitingForOpponent: "في انتظار المنافس…",
  benchedThisDuel: "أنت على الدكة هذه الجولة. انتظر!",
  youWon: "فزت!",
  youLost: "خسرت",
  itsDraw: "تعادل!",
  pointsEarned: "+{n} نقطة",
  nextDuelIn: "الجولة القادمة قادمة…",
  championIs: "{name} هو البطل! 🏆",
  finalLeaderboard: "الترتيب النهائي",
  playAgain: "العب مجدداً",
  pts: "نقطة",
  err_name_required: "الاسم مطلوب.",
  err_invalid_code: "رمز الغرفة يجب أن يكون 4 أرقام.",
  err_not_found: "الغرفة غير موجودة.",
  err_full: "الغرفة ممتلئة (الحد الأقصى 12 لاعب).",
  err_unknown: "حدث خطأ ما.",
};

export function getT(lang: Lang): T {
  return lang === "ar" ? ar : en;
}
