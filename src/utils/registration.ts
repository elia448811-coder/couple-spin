import { gameApiPath } from './gameApi';

export async function createRegisteredAccount(
  input: { username: string; password: string; displayName?: string; approved?: boolean },
  adminToken?: string,
): Promise<{ uid: string; username: string }> {
  const response = await fetch(gameApiPath('accounts'), {
    method: 'POST', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: 'Bearer ' + adminToken } : {}),
    },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && typeof result.uid === 'string' && typeof result.username === 'string') return result;
  switch (result.error) {
    case 'registration_closed': throw new Error('ההרשמה סגורה כעת.');
    case 'username_taken': throw new Error('שם המשתמש כבר תפוס.');
    case 'invalid_account': throw new Error('שם המשתמש או הסיסמה אינם תקינים.');
    case 'permission_denied': throw new Error('אין הרשאת מנהל.');
    case 'rate_limited': throw new Error('בוצעו יותר מדי ניסיונות הרשמה. נסו שוב מאוחר יותר.');
    default: throw new Error('שירות ההרשמה אינו זמין כרגע.');
  }
}
