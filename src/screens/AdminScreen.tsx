import { useCallback, useEffect, useMemo, useState } from 'react';
import { builtInContent, getContentBankStats } from '../data/allContent';
import { getSoleAdminUid, isCurrentUserAdmin, SOLE_ADMIN_EMAIL } from '../utils/admin';
import {
  listAppUsers,
  setUserAdminNote,
  setUserBanned,
  type AdminUserRow,
} from '../utils/adminUsers';
import {
  builtInToEditable,
  deleteContentOverride,
  fetchContentOverrides,
  upsertContentItem,
  type ContentItemDoc,
} from '../utils/contentOverrides';
import { downloadQuestionsFile } from '../utils/exportQuestionsFile';
import { fetchSiteConfig, saveSiteConfig, type SiteConfig } from '../utils/siteConfig';
import type { ContentKind, TaskCategory, TaskLevel } from '../types/game';

type AdminScreenProps = {
  onBack: () => void;
};

type Tab = 'overview' | 'site' | 'content' | 'users' | 'export';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'overview', label: 'לוח בקרה', hint: 'סטטוס מערכת' },
  { id: 'site', label: 'עמוד כניסה', hint: 'הרשמה וטקסטים' },
  { id: 'content', label: 'מאגר תוכן', hint: 'שאלות ומשימות' },
  { id: 'users', label: 'משתמשים', hint: 'פרופילים וחסימות' },
  { id: 'export', label: 'ייצוא', hint: 'הורדת קבצים' },
];

export function AdminScreen({ onBack }: AdminScreenProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ContentKind>('all');
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [editedOnly, setEditedOnly] = useState(false);
  const [overrides, setOverrides] = useState<ContentItemDoc[]>([]);
  const [editing, setEditing] = useState<ContentItemDoc | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 40;

  const reload = useCallback(async () => {
    const isAdmin = await isCurrentUserAdmin();
    setAllowed(isAdmin);
    if (!isAdmin) return;
    setConfig(await fetchSiteConfig());
    setOverrides(await fetchContentOverrides());
    try {
      setUsers(await listAppUsers());
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : 'טעינת משתמשים נכשלה — בדקו Rules v30');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(0);
  }, [search, kindFilter, showHiddenOnly, editedOnly, tab]);

  const overrideMap = useMemo(() => {
    const m = new Map<string, ContentItemDoc>();
    for (const o of overrides) m.set(o.id, o);
    return m;
  }, [overrides]);

  const catalog = useMemo(() => {
    const rows = builtInContent.map((item) => {
      const o = overrideMap.get(item.id);
      return {
        base: item,
        effective: o ? { ...builtInToEditable(item), ...o } : builtInToEditable(item),
        overridden: Boolean(o),
        hidden: Boolean(o?.hidden),
      };
    });
    for (const o of overrides.filter((x) => x.source === 'custom')) {
      if (rows.some((r) => r.base.id === o.id)) continue;
      rows.push({
        base: {
          id: o.id,
          title: o.title,
          description: o.description,
          category: o.category,
          level: o.level,
          kind: o.kind,
          questionGroup: o.questionGroup,
        },
        effective: o,
        overridden: true,
        hidden: o.hidden,
      });
    }
    return rows.filter((r) => {
      if (kindFilter !== 'all' && (r.effective.kind ?? 'task') !== kindFilter) return false;
      if (showHiddenOnly && !r.hidden) return false;
      if (editedOnly && !r.overridden) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        r.effective.description.toLowerCase().includes(q) ||
        r.effective.title.toLowerCase().includes(q) ||
        r.base.id.toLowerCase().includes(q)
      );
    });
  }, [overrides, overrideMap, search, kindFilter, showHiddenOnly, editedOnly]);

  const paged = catalog.slice(page * pageSize, page * pageSize + pageSize);
  const stats = getContentBankStats();
  const hiddenCount = overrides.filter((o) => o.hidden).length;
  const customCount = overrides.filter((o) => o.source === 'custom').length;
  const bannedCount = users.filter((u) => u.banned).length;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        u.adminNote.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const flash = (msg: string) => {
    setMessage(msg);
    setError('');
  };

  const saveSite = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const next = await saveSiteConfig({
        registrationEnabled: config.registrationEnabled,
        welcomeTitle: config.welcomeTitle,
        welcomeSubtitle: config.welcomeSubtitle,
      });
      if (!next) throw new Error('שמירה נכשלה');
      setConfig(next);
      flash('הגדרות הכניסה נשמרו.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await upsertContentItem({
        id: editing.id,
        title: editing.title.trim() || 'בלי כותרת',
        description: editing.description.trim(),
        kind: editing.kind,
        category: editing.category,
        level: editing.level,
        questionGroup: editing.questionGroup,
        hidden: editing.hidden,
        source: editing.source,
      });
      setOverrides(await fetchContentOverrides());
      setEditing(null);
      flash('הפריט נשמר במאגר.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת פריט נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const restoreItem = async (id: string) => {
    setBusy(true);
    try {
      await deleteContentOverride(id);
      setOverrides(await fetchContentOverrides());
      flash('שוחזר לברירת מחדל.');
      if (editing?.id === id) setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שחזור נכשל');
    } finally {
      setBusy(false);
    }
  };

  const quickHide = async (row: (typeof catalog)[number]) => {
    setBusy(true);
    try {
      await upsertContentItem({
        ...row.effective,
        hidden: !row.hidden,
        source: row.effective.source ?? (row.overridden ? 'custom' : 'builtin'),
      });
      setOverrides(await fetchContentOverrides());
      flash(row.hidden ? 'הפריט הוצג מחדש.' : 'הפריט הוסתר מהמאגר.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'עדכון נכשל');
    } finally {
      setBusy(false);
    }
  };

  if (allowed === null) {
    return (
      <section className="page-screen admin-console" dir="rtl">
        <div className="admin-shell">
          <p className="admin-muted">טוען לוח ניהול...</p>
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="page-screen admin-console" dir="rtl">
        <div className="admin-shell">
          <h1 className="admin-title">אין הרשאת ניהול</h1>
          <p className="admin-muted">המסך הזה זמין רק למנהל המערכת המאומת.</p>
          <button type="button" className="primary-action pressable" onClick={onBack}>
            חזרה
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-screen admin-console" dir="rtl">
      <div className="admin-shell">
        <header className="admin-topbar">
          <button type="button" className="admin-back pressable" onClick={onBack} aria-label="חזרה">
            → חזרה
          </button>
          <div>
            <p className="admin-kicker">Couple Spin · Admin</p>
            <h1 className="admin-title">מרכז ניהול מערכת</h1>
          </div>
          <div className="admin-identity" dir="ltr">
            <span>{SOLE_ADMIN_EMAIL}</span>
            <small>{getSoleAdminUid()}</small>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="ניווט ניהול">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin-tab pressable ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </nav>

        {(error || message) && (
          <div className={`admin-banner ${error ? 'is-error' : 'is-ok'}`} role="status">
            {error || message}
          </div>
        )}

        {tab === 'overview' && (
          <div className="admin-panel">
            <div className="admin-stat-grid">
              <article className="admin-stat-card">
                <strong>{stats.total}</strong>
                <span>פריטים פעילים</span>
              </article>
              <article className="admin-stat-card">
                <strong>{stats.questions}</strong>
                <span>שאלות</span>
              </article>
              <article className="admin-stat-card">
                <strong>{stats.tasks}</strong>
                <span>משימות</span>
              </article>
              <article className="admin-stat-card">
                <strong>{users.length}</strong>
                <span>פרופילי משתמש</span>
              </article>
              <article className="admin-stat-card">
                <strong>{overrides.length}</strong>
                <span>שינויי מאגר</span>
              </article>
              <article className="admin-stat-card">
                <strong>{hiddenCount}</strong>
                <span>מוסתרים</span>
              </article>
              <article className="admin-stat-card">
                <strong>{customCount}</strong>
                <span>פריטים חדשים</span>
              </article>
              <article className="admin-stat-card">
                <strong>{bannedCount}</strong>
                <span>משתמשים חסומים</span>
              </article>
            </div>

            <div className="admin-actions-row">
              <button type="button" className="primary-action pressable" onClick={() => setTab('content')}>
                עריכת מאגר
              </button>
              <button type="button" className="secondary-action pressable" onClick={() => setTab('users')}>
                ניהול משתמשים
              </button>
              <button
                type="button"
                className="secondary-action pressable"
                onClick={() => {
                  const n = downloadQuestionsFile();
                  flash(`הורדת קובץ שאלות (${n} פריטים).`);
                }}
              >
                הורדת קובץ שאלות
              </button>
              <button type="button" className="secondary-action pressable" disabled={busy} onClick={() => void reload()}>
                רענון נתונים
              </button>
            </div>

            <div className="admin-card">
              <h2>מצב מערכת</h2>
              <ul className="admin-checklist">
                <li>הרשמה חדשה: {config?.registrationEnabled ? 'פתוחה' : 'סגורה'}</li>
                <li>כותרת כניסה: {config?.welcomeTitle || '—'}</li>
                <li>בסיס מובנה: {builtInContent.length} פריטים</li>
                <li>אדמין קשיח לפי אימייל/UID — אין מנהלים נוספים</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'site' && config && (
          <div className="admin-panel">
            <div className="admin-card">
              <h2>עמוד כניסה</h2>
              <label className="admin-field">
                <span>כותרת</span>
                <input
                  type="text"
                  maxLength={80}
                  value={config.welcomeTitle}
                  onChange={(e) => setConfig({ ...config, welcomeTitle: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>תיאור</span>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={config.welcomeSubtitle}
                  onChange={(e) => setConfig({ ...config, welcomeSubtitle: e.target.value })}
                />
              </label>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={config.registrationEnabled}
                  onChange={(e) => setConfig({ ...config, registrationEnabled: e.target.checked })}
                />
                <span>לאפשר הרשמת משתמשים חדשים</span>
              </label>
              <div className="admin-actions-row">
                <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void saveSite()}>
                  שמור הגדרות כניסה
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div className="admin-panel">
            <div className="admin-toolbar">
              <input
                type="search"
                className="admin-search"
                placeholder="חיפוש במאגר..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | ContentKind)}>
                <option value="all">הכול</option>
                <option value="question">שאלות</option>
                <option value="task">משימות</option>
              </select>
              <label className="admin-switch compact">
                <input type="checkbox" checked={editedOnly} onChange={(e) => setEditedOnly(e.target.checked)} />
                <span>רק ערוכים</span>
              </label>
              <label className="admin-switch compact">
                <input type="checkbox" checked={showHiddenOnly} onChange={(e) => setShowHiddenOnly(e.target.checked)} />
                <span>רק מוסתרים</span>
              </label>
              <button
                type="button"
                className="hub-btn hub-btn--primary pressable"
                onClick={() =>
                  setEditing({
                    id: `admin-${Date.now().toString(36)}`,
                    title: 'פריט חדש',
                    description: '',
                    kind: 'question',
                    category: 'funny',
                    level: 'normal',
                    hidden: false,
                    source: 'custom',
                    updatedAtMs: 0,
                  })
                }
              >
                + פריט חדש
              </button>
            </div>

            {editing && (
              <div className="admin-card admin-editor-card">
                <h2>עריכה · {editing.id}</h2>
                <label className="admin-field">
                  <span>כותרת</span>
                  <input
                    type="text"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>טקסט</span>
                  <textarea
                    rows={4}
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </label>
                <div className="admin-inline-fields">
                  <label>
                    סוג
                    <select
                      value={editing.kind}
                      onChange={(e) => setEditing({ ...editing, kind: e.target.value as ContentKind })}
                    >
                      <option value="question">שאלה</option>
                      <option value="task">משימה</option>
                    </select>
                  </label>
                  <label>
                    קטגוריה
                    <select
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value as TaskCategory })}
                    >
                      {['funny', 'romantic', 'challenge', 'calm', 'creative', 'movement', 'spicy'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    רמה
                    <select
                      value={editing.level}
                      onChange={(e) => setEditing({ ...editing, level: e.target.value as TaskLevel })}
                    >
                      <option value="easy">easy</option>
                      <option value="normal">normal</option>
                      <option value="advanced">advanced</option>
                    </select>
                  </label>
                  <label className="admin-switch compact">
                    <input
                      type="checkbox"
                      checked={editing.hidden}
                      onChange={(e) => setEditing({ ...editing, hidden: e.target.checked })}
                    />
                    <span>מוסתר</span>
                  </label>
                </div>
                <div className="admin-actions-row">
                  <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void saveEdit()}>
                    שמור
                  </button>
                  <button type="button" className="secondary-action pressable" onClick={() => setEditing(null)}>
                    ביטול
                  </button>
                  {editing.source === 'builtin' && (
                    <button
                      type="button"
                      className="secondary-action pressable"
                      disabled={busy}
                      onClick={() => void restoreItem(editing.id)}
                    >
                      שחזר מקור
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="admin-muted">
              מציג {paged.length} מתוך {catalog.length} · עמוד {page + 1}
            </p>
            <ul className="admin-table">
              {paged.map((row) => (
                <li key={row.base.id} className={row.hidden ? 'is-hidden' : ''}>
                  <div className="admin-table__main">
                    <div className="admin-table__tags">
                      <span>{row.effective.kind === 'question' ? 'שאלה' : 'משימה'}</span>
                      {row.overridden && <span className="tag-edit">ערוך</span>}
                      {row.hidden && <span className="tag-hide">מוסתר</span>}
                    </div>
                    <p>{row.effective.description}</p>
                    <small dir="ltr">{row.base.id}</small>
                  </div>
                  <div className="admin-table__actions">
                    <button type="button" className="hub-btn hub-btn--ghost pressable" onClick={() => setEditing({ ...row.effective })}>
                      ערוך
                    </button>
                    <button type="button" className="hub-btn hub-btn--ghost pressable" disabled={busy} onClick={() => void quickHide(row)}>
                      {row.hidden ? 'הצג' : 'הסתר'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="admin-actions-row">
              <button
                type="button"
                className="secondary-action pressable"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                הקודם
              </button>
              <button
                type="button"
                className="secondary-action pressable"
                disabled={(page + 1) * pageSize >= catalog.length}
                onClick={() => setPage((p) => p + 1)}
              >
                הבא
              </button>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="admin-panel">
            <div className="admin-toolbar">
              <input
                type="search"
                className="admin-search"
                placeholder="חיפוש משתמש לפי שם / UID / הערה..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <button type="button" className="secondary-action pressable" disabled={busy} onClick={() => void reload()}>
                רענון
              </button>
            </div>
            <p className="admin-muted">
              {filteredUsers.length} משתמשים · חסומים: {bannedCount}
            </p>
            <ul className="admin-user-list">
              {filteredUsers.map((u) => (
                <li key={u.uid} className={u.banned ? 'is-banned' : ''}>
                  <div>
                    <strong>{u.displayName || 'ללא שם'}</strong>
                    {u.banned && <span className="tag-hide">חסום</span>}
                    <p className="admin-muted">
                      ערבים: {u.gamesPlayed} · נראה לאחרונה:{' '}
                      {u.lastSeenMs ? new Date(u.lastSeenMs).toLocaleString('he-IL') : '—'}
                    </p>
                    <small dir="ltr">{u.uid}</small>
                    <label className="admin-field">
                      <span>הערת מנהל</span>
                      <input
                        type="text"
                        defaultValue={u.adminNote}
                        maxLength={200}
                        onBlur={(e) => {
                          const note = e.target.value;
                          if (note === u.adminNote) return;
                          void setUserAdminNote(u.uid, note)
                            .then(() => reload())
                            .then(() => flash('הערה נשמרה.'))
                            .catch((err) => setError(err instanceof Error ? err.message : 'שמירה נכשלה'));
                        }}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="secondary-action pressable"
                    disabled={busy}
                    onClick={() =>
                      void setUserBanned(u.uid, !u.banned)
                        .then(() => reload())
                        .then(() => flash(u.banned ? 'המשתמש שוחרר.' : 'המשתמש נחסם.'))
                        .catch((err) => setError(err instanceof Error ? err.message : 'עדכון נכשל'))
                    }
                  >
                    {u.banned ? 'בטל חסימה' : 'חסום משתמש'}
                  </button>
                </li>
              ))}
            </ul>
            {!filteredUsers.length && <p className="admin-muted">אין משתמשים להצגה (או שחסרים Rules v30).</p>}
          </div>
        )}

        {tab === 'export' && (
          <div className="admin-panel">
            <div className="admin-card">
              <h2>הורדת קובץ שאלות מרוכז</h2>
              <p className="admin-muted">
                מייצא את מאגר השאלות הפעיל כרגע (כולל עריכות והסתרות) לקובץ טקסט להורדה.
              </p>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="primary-action pressable"
                  onClick={() => {
                    const n = downloadQuestionsFile();
                    flash(`קובץ שאלות הורד (${n} שורות ממוספרות).`);
                  }}
                >
                  הורדת שאלות בלבד
                </button>
                <button
                  type="button"
                  className="secondary-action pressable"
                  onClick={() => {
                    const n = downloadQuestionsFile({
                      includeTasks: true,
                      filename: `שאלות-ומשימות-${new Date().toISOString().slice(0, 10)}.txt`,
                    });
                    flash(`קובץ מלא הורד (${n} שורות ממוספרות).`);
                  }}
                >
                  הורדת שאלות + משימות
                </button>
              </div>
            </div>
            <div className="admin-card">
              <h2>סטטיסטיקת ייצוא</h2>
              <ul className="admin-checklist">
                <li>שאלות פעילות לייצוא: {stats.questions}</li>
                <li>משימות פעילות לייצוא: {stats.tasks}</li>
                <li>פריטים מוסתרים לא ייכללו בייצוא</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
