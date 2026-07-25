const JOIN_PARAM = 'join';
const JOIN_CODE_LEN = 8;

export function buildInviteUrl(displayCode: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const url = new URL(base || 'https://double-game-black.vercel.app/');
  url.searchParams.set(JOIN_PARAM, displayCode.replace(/\D/g, '').slice(0, JOIN_CODE_LEN));
  return url.toString();
}

export function parseJoinCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const code = new URLSearchParams(window.location.search).get(JOIN_PARAM);
  if (!code) return null;
  const normalized = code.replace(/\D/g, '').slice(0, JOIN_CODE_LEN);
  return normalized.length === JOIN_CODE_LEN ? normalized : null;
}

export function clearJoinParamFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(JOIN_PARAM)) return;
  url.searchParams.delete(JOIN_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export function buildWhatsAppShareText(displayCode: string, hostName: string): string {
  const link = buildInviteUrl(displayCode);
  return `היי! ${hostName} מזמין/ה אותך לערב זוגי בספין זוגי 🎡\nקוד: ${displayCode}\nאו לחצו כאן: ${link}`;
}

export async function shareRoomInvite(displayCode: string, hostName: string): Promise<boolean> {
  const text = buildWhatsAppShareText(displayCode, hostName);
  const link = buildInviteUrl(displayCode);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'הזמנה לספין זוגי', text, url: link });
      return true;
    } catch {
      /* fall through */
    }
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, '_blank', 'noopener,noreferrer');
  return true;
}
