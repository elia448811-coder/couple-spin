export type RoomErrorCode =
  | 'firebase_not_configured'
  | 'auth_failed'
  | 'invalid_code'
  | 'room_not_found'
  | 'room_expired'
  | 'room_full'
  | 'join_rate_limited'
  | 'code_collision'
  | 'create_failed'
  | 'join_failed'
  | 'permission_denied'
  | 'sync_failed'
  | 'partner_offline'
  | 'not_ready'
  | 'version_conflict';

export type RoomErrorInfo = {
  title: string;
  message: string;
  retryable: boolean;
  internalCode: RoomErrorCode;
};

const ERROR_MAP: Record<RoomErrorCode, Omit<RoomErrorInfo, 'internalCode'>> = {
  firebase_not_configured: {
    title: 'ענן לא זמין',
    message: 'חיבור Firebase לא מוגדר. אפשר לשחק מקומית בינתיים.',
    retryable: false,
  },
  auth_failed: {
    title: 'שגיאת התחברות',
    message: 'לא הצלחנו להתחבר לענן. נסו לרענן את הדף.',
    retryable: true,
  },
  invalid_code: {
    title: 'קוד לא תקין',
    message: 'הקוד צריך להיות בן 8 ספרות.',
    retryable: true,
  },
  room_not_found: {
    title: 'חדר לא נמצא',
    message: 'הקוד לא קיים או שפג תוקפו. בקשו קוד חדש מהשותף/ה.',
    retryable: true,
  },
  room_expired: {
    title: 'החדר פג תוקף',
    message: 'חדרים תקפים לשעתיים. צרו חדר חדש והתחילו מחדש.',
    retryable: false,
  },
  room_full: {
    title: 'החדר מלא',
    message: 'כבר יש שני שחקנים בחדר הזה.',
    retryable: false,
  },
  join_rate_limited: {
    title: 'יותר מדי ניסיונות',
    message: 'נחסמתם זמנית אחרי ניסיונות הצטרפות כושלים. המתינו דקה ונסו שוב.',
    retryable: true,
  },
  code_collision: {
    title: 'שגיאה זמנית',
    message: 'לא הצלחנו ליצור חדר. נסו שוב.',
    retryable: true,
  },
  create_failed: {
    title: 'יצירת חדר נכשלה',
    message: 'משהו השתבש ביצירת החדר. נסו שוב.',
    retryable: true,
  },
  join_failed: {
    title: 'הצטרפות נכשלה',
    message: 'לא הצלחנו להצטרף לחדר. בדקו את הקוד ונסו שוב.',
    retryable: true,
  },
  permission_denied: {
    title: 'אין הרשאה',
    message: 'אין לכם גישה לחדר הזה.',
    retryable: false,
  },
  sync_failed: {
    title: 'סנכרון נכשל',
    message: 'העדכון לא הגיע לשותף/ה. המשחק המקומי נשמר.',
    retryable: true,
  },
  partner_offline: {
    title: 'השותף/ה לא מחובר/ת',
    message: 'נראה שהשותף/ה התנתק/ה. ממתינים לחיבור מחדש.',
    retryable: true,
  },
  not_ready: {
    title: 'עדיין לא מוכנים',
    message: 'שני השחקנים צריכים לסמן "מוכן/ה" לפני שמתחילים.',
    retryable: true,
  },
  version_conflict: {
    title: 'התנגשות סנכרון',
    message: 'התקבל עדכון ישן. טוענים את הגרסה האחרונה.',
    retryable: false,
  },
};

export function getRoomError(code: string | null | undefined): RoomErrorInfo | null {
  if (!code) return null;
  const key = code as RoomErrorCode;
  const entry = ERROR_MAP[key];
  if (!entry) {
    return {
      title: 'שגיאה',
      message: 'משהו השתבש. נסו שוב.',
      retryable: true,
      internalCode: 'join_failed',
    };
  }
  return { ...entry, internalCode: key };
}
