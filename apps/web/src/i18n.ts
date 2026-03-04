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
  // settings
  settings: string;
  gameSettings: string;
  winScoreLabel: string;     // "Win at"
  minGamesError: string;     // "Select at least 5 games"
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

/** Per-game display metadata for the settings UI (client-side only). */
export interface GameMeta {
  id: string;
  name: { en: string; ar: string };
  desc: { en: string; ar: string };
  experimental?: true;
}

export const GAME_META: GameMeta[] = [
  // ── Main games ──────────────────────────────────────────────────────────────
  { id: "quick_maths",         name: { en: "Quick Maths",         ar: "رياضيات سريعة"     }, desc: { en: "Solve arithmetic fast",               ar: "حل العمليات الحسابية بسرعة"     } },
  { id: "tapping_speed",       name: { en: "Tapping Speed",       ar: "سرعة النقر"        }, desc: { en: "Tap as fast as you can",              ar: "انقر بأسرع ما يمكن"              } },
  { id: "reaction_green",      name: { en: "Reaction Time",       ar: "زمن رد الفعل"      }, desc: { en: "Tap the moment the screen turns green",ar: "انقر فور تحوّل الشاشة للأخضر"   } },
  { id: "memory_grid",         name: { en: "Memory Grid",         ar: "شبكة الذاكرة"      }, desc: { en: "Remember the flashed pattern",        ar: "تذكّر النمط المُومض"              } },
  { id: "rock_paper_scissors", name: { en: "Rock Paper Scissors", ar: "حجر ورقة مقص"      }, desc: { en: "Classic best-of-three showdown",      ar: "المواجهة الكلاسيكية أفضل ثلاث"   } },
  { id: "higher_lower",        name: { en: "Higher or Lower",     ar: "أعلى أم أقل"       }, desc: { en: "Guess the secret number",             ar: "خمّن الرقم السري"                } },
  { id: "tic_tac_toe",         name: { en: "Tic-Tac-Toe",         ar: "إكس أو"            }, desc: { en: "Get three in a row",                  ar: "احصل على ثلاثة في صف"            } },
  { id: "emoji_odd_one_out",   name: { en: "Emoji Odd One Out",   ar: "الإيموجي الغريب"   }, desc: { en: "Find the different emoji",            ar: "جد الإيموجي المختلف"             } },
  { id: "stop_at_10s",         name: { en: "Stop at 10s",         ar: "أوقف عند 10 ثوانٍ" }, desc: { en: "Stop the timer as close to 10s as possible", ar: "أوقف المؤقت أقرب ما يمكن لـ10 ثوانٍ" } },
  { id: "whack_a_logo",        name: { en: "Whack-a-Logo",        ar: "اضرب اللوغو"       }, desc: { en: "Tap logos, dodge bombs",              ar: "انقر اللوغو وتجنّب القنابل"       } },
  // ── Experimental games (OFF by default; host must enable in Game Settings) ──
  { id: "paper_toss", experimental: true, name: { en: "Paper Toss",  ar: "رمي الورقة"  }, desc: { en: "Flick paper into the bin",           ar: "ارمِ الورقة في السلة"             } },
  { id: "darts",      experimental: true, name: { en: "Darts",       ar: "رمي السهام"  }, desc: { en: "Aim and throw 3 darts at the board", ar: "صوّب وارمِ 3 سهام على اللوحة"    } },
  { id: "mini_golf",  experimental: true, name: { en: "Mini Golf",   ar: "غولف مصغّر"  }, desc: { en: "Sink the ball in one shot",          ar: "أدخل الكرة في الحفرة بضربة واحدة" } },
];

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
  settings: "Settings",
  gameSettings: "Game Settings",
  winScoreLabel: "Win at",
  minGamesError: "Select at least 5 games",
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
  settings: "الإعدادات",
  gameSettings: "إعدادات الألعاب",
  winScoreLabel: "الفوز عند",
  minGamesError: "اختر 5 ألعاب على الأقل",
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
