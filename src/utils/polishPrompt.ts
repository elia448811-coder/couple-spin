const PROMPT_PREFIX =
  /^(?:חימום קצר|שאלה לפתיחת האווירה|במילה אחת כמעט|רגע לפני שמתחילים|בדיקת מצב|כניסה נעימה לערב|קליל ומהיר|שאלה של עכשיו|פותחים חיוך|מה קורה כרגע|שאלה צבעונית|רגע של המצאה|תרחיש זוגי|סגירה יפה|רגע לפני שמסיימים|מה לוקחים איתנו|שאלת סיכום|סוף מתוק|מבט קטן לאחור|לסיים בטוב|נקודה אחרונה|שאלה לדרך|חותמים את הערב)\s*[:,]\s*/u;

/** Strip editorial question prefixes and normalize punctuation for display. */
export function polishPrompt(text: string): string {
  const clean = text.replace(PROMPT_PREFIX, '').replace(/\s+([,.?!:])/g, '$1').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : text;
}
