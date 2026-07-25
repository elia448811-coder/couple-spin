import { useCallback, useEffect, useMemo, useState } from 'react';
import { builtInContent, getContentBankStats } from '../data/allContent';
import {
  addAdminUsername,
  ensureAdminBootstrap,
  isCurrentUserAdmin,
  listAdmins,
  removeAdminUsername,
  type AdminRecord,
} from '../utils/admin';
import {
  builtInToEditable,
  deleteContentOverride,
  fetchContentOverrides,
  getCachedContentOverrides,
  upsertContentItem,
  type ContentItemDoc,
} from '../utils/contentOverrides';
import { fetchSiteConfig, saveSiteConfig, type SiteConfig } from '../utils/siteConfig';
import { emailToUsername, getAuthUser } from '../utils/userAuth';
import type { ContentKind, TaskCategory, TaskLevel } from '../types/game';

type AdminScreenProps = {
  onBack: () => void;
};

type Tab = 'site' | 'content' | 'admins';

export function AdminScreen({ onBack }: AdminScreenProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('site');
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [newAdmin, setNewAdmin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ContentKind>('all');
  const [overrides, setOverrides] = useState<ContentItemDoc[]>([]);
  const [editing, setEditing] = useState<ContentItemDoc | null>(null);
  const [actor, setActor] = useState('admin');

  const reload = useCallback(async () => {
    const ok = await isCurrentUserAdmin();
    if (!ok) {
      await ensureAdminBootstrap();
    }
    const isAdmin = await isCurrentUserAdmin();
    setAllowed(isAdmin);
    if (!isAdmin) return;
    const user = await getAuthUser();
    setActor(emailToUsername(user?.email) || user?.uid || 'admin');
    setConfig(await fetchSiteConfig());
    setAdmins(await listAdmins());
    setOverrides(await fetchContentOverrides());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        effective: o
          ? { ...builtInToEditable(item), ...o }
          : builtInToEditable(item),
        overridden: Boolean(o),
        hidden: Boolean(o?.hidden),
      };
    });
    const customCloud = overrides.filter((o) => o.source === 'custom');
    for (const o of customCloud) {
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
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        r.effective.description.toLowerCase().includes(q) ||
        r.effective.title.toLowerCase().includes(q) ||
        r.base.id.toLowerCase().includes(q)
      );
    });
  }, [overrides, overrideMap, search, kindFilter]);

  const stats = getContentBankStats();

  const saveSite = async () => {
    if (!config) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await saveSiteConfig(
        {
          registrationEnabled: config.registrationEnabled,
          welcomeTitle: config.welcomeTitle,
          welcomeSubtitle: config.welcomeSubtitle,
          adminUsernames: config.adminUsernames,
        },
        actor,
      );
      if (!next) throw new Error('שמירה נכשלה');
      setConfig(next);
      setMessage('הגדרות האתר נשמרו.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
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
      setOverrides(getCachedContentOverrides().length ? await fetchContentOverrides() : await fetchContentOverrides());
      setEditing(null);
      setMessage('הפריט נשמר.');
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
      setMessage('שוחזר לברירת מחדל.');
      if (editing?.id === id) setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שחזור נכשל');
    } finally {
      setBusy(false);
    }
  };

  const addNewItem = () => {
    const id = `admin-${Date.now().toString(36)}`;
    setEditing({
      id,
      title: 'פריט חדש',
      description: '',
      kind: 'question',
      category: 'funny',
      level: 'normal',
      hidden: false,
      source: 'custom',
      updatedAtMs: 0,
    });
  };

  if (allowed === null) {
    return (
      <section className="page-screen flow-screen" dir="rtl">
        <div className="flow-card">
          <p>טוען ניהול...</p>
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="page-screen flow-screen" dir="rtl">
        <div className="flow-card">
          <h1 className="flow-title">אין הרשאת ניהול</h1>
          <p className="hub-card__text">החשבון הנוכחי אינו מנהל מערכת.</p>
          <button type="button" className="primary-action pressable" onClick={onBack}>
            חזרה
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-screen flow-screen settings-screen admin-screen" dir="rtl">
      <div className="flow-card settings-card" style={{ maxWidth: 960 }}>
        <header className="flow-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה">
            →
          </button>
          <div>
            <p className="flow-kicker">ניהול מערכת</p>
            <h1 className="flow-title">לוח בקרה</h1>
          </div>
        </header>

        <p className="history-hint">
          מאגר פעיל: {stats.total} פריטים ({stats.questions} שאלות · {stats.tasks} משימות)
        </p>

        <div className="hub-actions-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {(
            [
              ['site', 'עמוד כניסה'],
              ['content', 'מאגר תוכן'],
              ['admins', 'מנהלים'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`hub-btn pressable ${tab === id ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="site-gate__error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="history-hint" role="status">
            {message}
          </p>
        )}

        {tab === 'site' && config && (
          <div className="settings-group">
            <h2 className="settings-label">עמוד כניסה</h2>
            <label className="settings-field">
              <span>כותרת</span>
              <input
                type="text"
                maxLength={80}
                value={config.welcomeTitle}
                onChange={(e) => setConfig({ ...config, welcomeTitle: e.target.value })}
              />
            </label>
            <label className="settings-field">
              <span>תיאור קצר</span>
              <input
                type="text"
                maxLength={200}
                value={config.welcomeSubtitle}
                onChange={(e) => setConfig({ ...config, welcomeSubtitle: e.target.value })}
              />
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={config.registrationEnabled}
                onChange={(e) => setConfig({ ...config, registrationEnabled: e.target.checked })}
              />
              <span>לאפשר הרשמה של משתמשים חדשים</span>
            </label>
            <div className="settings-actions">
              <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void saveSite()}>
                שמור הגדרות כניסה
              </button>
            </div>
          </div>
        )}

        {tab === 'admins' && config && (
          <div className="settings-group">
            <h2 className="settings-label">מנהלי מערכת</h2>
            <p className="custom-content-panel__hint">
              מנהל יכול לערוך שאלות, לשלוט בהרשמה, ולנהל מנהלים נוספים.
            </p>
            <ul className="admin-list">
              {config.adminUsernames.map((u) => (
                <li key={u} className="admin-list__item">
                  <span dir="ltr">{u}</span>
                  <button
                    type="button"
                    className="secondary-action pressable"
                    disabled={busy || config.adminUsernames.length <= 1}
                    onClick={() =>
                      void removeAdminUsername(u, actor).then((r) => {
                        if (!r.ok) setError(r.error ?? 'הסרה נכשלה');
                        else void reload();
                      })
                    }
                  >
                    הסר
                  </button>
                </li>
              ))}
            </ul>
            <p className="history-hint">מסמכי אדמין פעילים: {admins.length}</p>
            <label className="settings-field">
              <span>הוספת מנהל (שם משתמש קיים)</span>
              <input
                type="text"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="username"
                dir="ltr"
              />
            </label>
            <button
              type="button"
              className="primary-action pressable"
              disabled={busy || newAdmin.trim().length < 3}
              onClick={() =>
                void addAdminUsername(newAdmin, actor).then((r) => {
                  if (!r.ok) setError(r.error ?? 'הוספה נכשלה');
                  else {
                    setNewAdmin('');
                    void reload();
                    setMessage('המנהל נוסף — ייכנס לתוקף בהתחברות הבאה שלו.');
                  }
                })
              }
            >
              הוסף מנהל
            </button>
          </div>
        )}

        {tab === 'content' && (
          <div className="settings-group">
            <h2 className="settings-label">מאגר שאלות ומשימות</h2>
            <div className="hub-actions-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="search"
                className="site-gate__input"
                style={{ flex: 1, minWidth: 180 }}
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as 'all' | ContentKind)}
                aria-label="סינון סוג"
              >
                <option value="all">הכול</option>
                <option value="question">שאלות</option>
                <option value="task">משימות</option>
              </select>
              <button type="button" className="hub-btn hub-btn--primary pressable" onClick={addNewItem}>
                פריט חדש
              </button>
            </div>

            {editing && (
              <div className="admin-editor">
                <h3 className="settings-label">עריכה — {editing.id}</h3>
                <label className="settings-field">
                  <span>כותרת / קטגוריה</span>
                  <input
                    type="text"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span>טקסט</span>
                  <textarea
                    rows={4}
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </label>
                <div className="hub-actions-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <label>
                    סוג{' '}
                    <select
                      value={editing.kind}
                      onChange={(e) => setEditing({ ...editing, kind: e.target.value as ContentKind })}
                    >
                      <option value="question">שאלה</option>
                      <option value="task">משימה</option>
                    </select>
                  </label>
                  <label>
                    קטגוריה{' '}
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
                    רמה{' '}
                    <select
                      value={editing.level}
                      onChange={(e) => setEditing({ ...editing, level: e.target.value as TaskLevel })}
                    >
                      <option value="easy">easy</option>
                      <option value="normal">normal</option>
                      <option value="advanced">advanced</option>
                    </select>
                  </label>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={editing.hidden}
                      onChange={(e) => setEditing({ ...editing, hidden: e.target.checked })}
                    />
                    <span>מוסתר</span>
                  </label>
                </div>
                <div className="settings-actions">
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

            <ul className="admin-content-list">
              {catalog.slice(0, 80).map((row) => (
                <li key={row.base.id} className={`admin-content-list__item ${row.hidden ? 'is-hidden' : ''}`}>
                  <div>
                    <strong>{row.effective.kind === 'question' ? 'שאלה' : 'משימה'}</strong>
                    {row.overridden && <span className="history-hint"> · ערוך</span>}
                    {row.hidden && <span className="history-hint"> · מוסתר</span>}
                    <p>{row.effective.description}</p>
                    <p className="history-hint" dir="ltr">
                      {row.base.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="hub-btn hub-btn--ghost pressable"
                    onClick={() => setEditing({ ...row.effective })}
                  >
                    ערוך
                  </button>
                </li>
              ))}
            </ul>
            {catalog.length > 80 && (
              <p className="history-hint">מוצגים 80 מתוך {catalog.length} — צמצמו בחיפוש.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
