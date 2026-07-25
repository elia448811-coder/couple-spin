import { useCallback, useEffect, useMemo, useState } from 'react';
import { builtInContent, getContentBankStats } from '../data/allContent';
import { getSoleAdminUid, isCurrentUserAdmin, SOLE_ADMIN_EMAIL } from '../utils/admin';
import {
  asTaskCategory,
  fetchCategories,
  getCategoryIcon,
  getCategoryLabel,
  removeCustomCategory,
  sortCategoryIds,
  upsertCategory,
  type CategoryDef,
} from '../utils/adminCategories';
import {
  createAppUserByAdmin,
  listAppUsers,
  setUserAdminNote,
  setUserApproved,
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
import type { ContentKind, TaskLevel } from '../types/game';

type AdminScreenProps = {
  onBack: () => void;
};

type Tab = 'overview' | 'site' | 'content' | 'categories' | 'users' | 'export';
type UserFilter = 'all' | 'pending' | 'approved' | 'banned';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'overview', label: 'לוח בקרה', hint: 'סטטוס מערכת' },
  { id: 'site', label: 'עמוד כניסה', hint: 'הרשמה וטקסטים' },
  { id: 'content', label: 'מאגר שאלות', hint: 'לפי קטגוריות' },
  { id: 'categories', label: 'קטגוריות', hint: 'הוספה ועריכה' },
  { id: 'users', label: 'משתמשים', hint: 'אישור וניהול' },
  { id: 'export', label: 'ייצוא', hint: 'הורדת קבצים' },
];

type CatalogRow = {
  base: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: TaskLevel;
    kind?: ContentKind;
    questionGroup?: string;
  };
  effective: ContentItemDoc;
  overridden: boolean;
  hidden: boolean;
};

export function AdminScreen({ onBack }: AdminScreenProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ContentKind>('question');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [editedOnly, setEditedOnly] = useState(false);
  const [overrides, setOverrides] = useState<ContentItemDoc[]>([]);
  const [editing, setEditing] = useState<ContentItemDoc | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [catDraft, setCatDraft] = useState({ id: '', label: '', icon: '✦' });
  const [editingCat, setEditingCat] = useState<CategoryDef | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', approved: true });

  const reload = useCallback(async () => {
    const isAdmin = await isCurrentUserAdmin();
    setAllowed(isAdmin);
    if (!isAdmin) return;
    setConfig(await fetchSiteConfig());
    setOverrides(await fetchContentOverrides());
    setCategories(await fetchCategories());
    try {
      setUsers(await listAppUsers());
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : 'טעינת משתמשים נכשלה — בדקו Rules v31');
    }
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
    const rows: CatalogRow[] = builtInContent.map((item) => {
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
    return rows
      .filter((r) => {
        if (kindFilter !== 'all' && (r.effective.kind ?? 'task') !== kindFilter) return false;
        if (categoryFilter !== 'all' && r.effective.category !== categoryFilter) return false;
        if (showHiddenOnly && !r.hidden) return false;
        if (editedOnly && !r.overridden) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          r.effective.description.toLowerCase().includes(q) ||
          r.effective.title.toLowerCase().includes(q) ||
          r.base.id.toLowerCase().includes(q) ||
          getCategoryLabel(r.effective.category).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const cats = sortCategoryIds([a.effective.category, b.effective.category]);
        if (a.effective.category !== b.effective.category) {
          return cats.indexOf(a.effective.category) - cats.indexOf(b.effective.category);
        }
        return a.effective.description.localeCompare(b.effective.description, 'he');
      });
  }, [overrides, overrideMap, search, kindFilter, categoryFilter, showHiddenOnly, editedOnly]);

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, CatalogRow[]>();
    for (const row of catalog) {
      const key = row.effective.category || 'funny';
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return sortCategoryIds(groups.keys()).map((id) => ({
      id,
      label: getCategoryLabel(id),
      icon: getCategoryIcon(id),
      rows: groups.get(id) ?? [],
    }));
  }, [catalog]);

  const stats = getContentBankStats();
  const hiddenCount = overrides.filter((o) => o.hidden).length;
  const customCount = overrides.filter((o) => o.source === 'custom').length;
  const bannedCount = users.filter((u) => u.banned).length;
  const pendingCount = users.filter((u) => u.pending).length;
  const questionCount = catalog.filter((r) => (r.effective.kind ?? 'task') === 'question').length;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilter === 'pending' && !u.pending) return false;
      if (userFilter === 'approved' && (!u.approved || u.banned)) return false;
      if (userFilter === 'banned' && !u.banned) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        u.adminNote.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, userFilter]);

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
        category: asTaskCategory(editing.category),
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

  const quickHide = async (row: CatalogRow) => {
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

  const addCategory = async () => {
    setBusy(true);
    try {
      setCategories(
        await upsertCategory({
          id: catDraft.id,
          label: catDraft.label,
          icon: catDraft.icon,
        }),
      );
      setCatDraft({ id: '', label: '', icon: '✦' });
      flash('קטגוריה חדשה נוספה.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת קטגוריה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const saveEditedCategory = async () => {
    if (!editingCat) return;
    setBusy(true);
    try {
      setCategories(
        await upsertCategory({
          id: editingCat.id,
          label: editingCat.label,
          icon: editingCat.icon,
          order: editingCat.order,
        }),
      );
      setEditingCat(null);
      flash('הקטגוריה עודכנה.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת קטגוריה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    setBusy(true);
    try {
      const approvedNow = newUser.approved;
      const created = await createAppUserByAdmin(newUser);
      setNewUser({ username: '', password: '', displayName: '', approved: true });
      setUsers(await listAppUsers());
      flash(`המשתמש ${created.username} נוצר${approvedNow ? ' ואושר' : ' (ממתין)'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'יצירת משתמש נכשלה');
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
      <div className="admin-shell admin-shell--wide">
        <header className="admin-topbar">
          <button type="button" className="admin-back pressable" onClick={onBack} aria-label="חזרה">
            → חזרה
          </button>
          <div>
            <p className="admin-kicker">Couple Spin · Admin Console</p>
            <h1 className="admin-title">מרכז ניהול מערכת</h1>
          </div>
          <div className="admin-identity" dir="ltr">
            <span>{SOLE_ADMIN_EMAIL}</span>
            <small>{getSoleAdminUid()}</small>
          </div>
        </header>

        <nav className="admin-tabs admin-tabs--6" aria-label="ניווט ניהול">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin-tab pressable ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <strong>
                {t.label}
                {t.id === 'users' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </nav>

        {(error || message) && (
          <div className={`admin-banner ${error ? 'is-error' : 'is-ok'}`} role="status">
            {error || message}
            <button type="button" className="admin-banner__close" onClick={() => { setError(''); setMessage(''); }}>
              ✕
            </button>
          </div>
        )}

        {tab === 'overview' && (
          <div className="admin-panel">
            <div className="admin-stat-grid admin-stat-grid--dense">
              <article className="admin-stat-card">
                <strong>{stats.questions}</strong>
                <span>שאלות פעילות</span>
              </article>
              <article className="admin-stat-card">
                <strong>{stats.tasks}</strong>
                <span>משימות פעילות</span>
              </article>
              <article className="admin-stat-card">
                <strong>{categories.length}</strong>
                <span>קטגוריות</span>
              </article>
              <article className="admin-stat-card">
                <strong>{users.length}</strong>
                <span>משתמשים</span>
              </article>
              <article className="admin-stat-card is-warn">
                <strong>{pendingCount}</strong>
                <span>ממתינים לאישור</span>
              </article>
              <article className="admin-stat-card">
                <strong>{bannedCount}</strong>
                <span>חסומים</span>
              </article>
              <article className="admin-stat-card">
                <strong>{customCount}</strong>
                <span>פריטים חדשים</span>
              </article>
              <article className="admin-stat-card">
                <strong>{hiddenCount}</strong>
                <span>מוסתרים</span>
              </article>
            </div>

            <div className="admin-actions-row">
              <button type="button" className="primary-action pressable" onClick={() => setTab('content')}>
                מאגר שאלות
              </button>
              <button type="button" className="secondary-action pressable" onClick={() => { setTab('users'); setUserFilter('pending'); }}>
                אישור ממתינים ({pendingCount})
              </button>
              <button type="button" className="secondary-action pressable" onClick={() => setTab('categories')}>
                ניהול קטגוריות
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
                רענון
              </button>
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
                <span>לאפשר הרשמה עצמית (משתמשים חדשים ימתינו לאישור)</span>
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
                placeholder="חיפוש שאלה / משימה / קטגוריה..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | ContentKind)}>
                <option value="question">שאלות</option>
                <option value="task">משימות</option>
                <option value="all">הכול</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">כל הקטגוריות</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <label className="admin-switch compact">
                <input type="checkbox" checked={editedOnly} onChange={(e) => setEditedOnly(e.target.checked)} />
                <span>ערוכים</span>
              </label>
              <label className="admin-switch compact">
                <input type="checkbox" checked={showHiddenOnly} onChange={(e) => setShowHiddenOnly(e.target.checked)} />
                <span>מוסתרים</span>
              </label>
              <button
                type="button"
                className="hub-btn hub-btn--primary pressable"
                onClick={() =>
                  setEditing({
                    id: `admin-${Date.now().toString(36)}`,
                    title: 'שאלה חדשה',
                    description: '',
                    kind: 'question',
                    category: asTaskCategory(categories[0]?.id ?? 'funny'),
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
                      onChange={(e) => setEditing({ ...editing, category: asTaskCategory(e.target.value) })}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.label}
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
                      <option value="easy">קליל</option>
                      <option value="normal">רגיל</option>
                      <option value="advanced">מתקדם</option>
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

            <div className="admin-content-meta">
              <p className="admin-muted">
                מציג {catalog.length} פריטים · {groupedCatalog.length} קטגוריות
                {kindFilter === 'question' ? ` · ${questionCount} שאלות` : ''}
              </p>
              <button
                type="button"
                className="hub-btn hub-btn--ghost pressable"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  for (const g of groupedCatalog) next[g.id] = true;
                  setCollapsedCats(next);
                }}
              >
                כווץ הכול
              </button>
              <button type="button" className="hub-btn hub-btn--ghost pressable" onClick={() => setCollapsedCats({})}>
                פתח הכול
              </button>
            </div>

            <div className="admin-cat-groups">
              {groupedCatalog.map((group) => {
                const collapsed = Boolean(collapsedCats[group.id]);
                return (
                  <section key={group.id} className="admin-cat-group">
                    <button
                      type="button"
                      className="admin-cat-group__head pressable"
                      onClick={() => setCollapsedCats((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                    >
                      <span className="admin-cat-group__title">
                        <span aria-hidden>{group.icon}</span>
                        <strong>{group.label}</strong>
                        <small>{group.rows.length}</small>
                      </span>
                      <span className="admin-cat-group__chev">{collapsed ? '▾' : '▴'}</span>
                    </button>
                    {!collapsed && (
                      <ul className="admin-table">
                        {group.rows.map((row) => (
                          <li key={row.base.id} className={row.hidden ? 'is-hidden' : ''}>
                            <div className="admin-table__main">
                              <div className="admin-table__tags">
                                <span>{row.effective.kind === 'question' ? 'שאלה' : 'משימה'}</span>
                                <span className="tag-cat">{getCategoryLabel(row.effective.category)}</span>
                                {row.overridden && <span className="tag-edit">ערוך</span>}
                                {row.hidden && <span className="tag-hide">מוסתר</span>}
                              </div>
                              <p>{row.effective.description}</p>
                              <small dir="ltr">{row.base.id}</small>
                            </div>
                            <div className="admin-table__actions">
                              <button
                                type="button"
                                className="hub-btn hub-btn--ghost pressable"
                                onClick={() => setEditing({ ...row.effective })}
                              >
                                ערוך
                              </button>
                              <button
                                type="button"
                                className="hub-btn hub-btn--ghost pressable"
                                disabled={busy}
                                onClick={() => void quickHide(row)}
                              >
                                {row.hidden ? 'הצג' : 'הסתר'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {!groupedCatalog.length && <p className="admin-muted">אין פריטים לפי הסינון הנוכחי.</p>}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="admin-panel">
            <div className="admin-card">
              <h2>הוספת קטגוריה חדשה</h2>
              <div className="admin-inline-fields">
                <label className="admin-field">
                  <span>מזהה (אנגלית)</span>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="date_night"
                    value={catDraft.id}
                    onChange={(e) => setCatDraft({ ...catDraft, id: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>שם בעברית</span>
                  <input
                    type="text"
                    placeholder="ערב זוגי"
                    value={catDraft.label}
                    onChange={(e) => setCatDraft({ ...catDraft, label: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>אייקון</span>
                  <input
                    type="text"
                    value={catDraft.icon}
                    onChange={(e) => setCatDraft({ ...catDraft, icon: e.target.value })}
                    maxLength={8}
                  />
                </label>
              </div>
              <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void addCategory()}>
                הוסף קטגוריה
              </button>
            </div>

            {editingCat && (
              <div className="admin-card admin-editor-card">
                <h2>עריכת קטגוריה · {editingCat.id}</h2>
                <div className="admin-inline-fields">
                  <label className="admin-field">
                    <span>שם</span>
                    <input
                      type="text"
                      value={editingCat.label}
                      onChange={(e) => setEditingCat({ ...editingCat, label: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>אייקון</span>
                    <input
                      type="text"
                      value={editingCat.icon}
                      onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                      maxLength={8}
                    />
                  </label>
                  <label className="admin-field">
                    <span>סדר</span>
                    <input
                      type="number"
                      value={editingCat.order}
                      onChange={(e) => setEditingCat({ ...editingCat, order: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
                <div className="admin-actions-row">
                  <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void saveEditedCategory()}>
                    שמור קטגוריה
                  </button>
                  <button type="button" className="secondary-action pressable" onClick={() => setEditingCat(null)}>
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <ul className="admin-user-list">
              {categories.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>
                      <span aria-hidden>{c.icon}</span> {c.label}
                    </strong>
                    {c.builtin && <span className="tag-edit">מובנית</span>}
                    <p className="admin-muted" dir="ltr">
                      {c.id} · order {c.order}
                    </p>
                  </div>
                  <div className="admin-table__actions">
                    <button type="button" className="hub-btn hub-btn--ghost pressable" onClick={() => setEditingCat({ ...c })}>
                      ערוך
                    </button>
                    {!c.builtin && (
                      <button
                        type="button"
                        className="hub-btn hub-btn--ghost pressable"
                        disabled={busy}
                        onClick={() =>
                          void removeCustomCategory(c.id)
                            .then(setCategories)
                            .then(() => flash('הקטגוריה הוסרה.'))
                            .catch((err) => setError(err instanceof Error ? err.message : 'מחיקה נכשלה'))
                        }
                      >
                        מחק
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'users' && (
          <div className="admin-panel">
            <div className="admin-card">
              <h2>יצירת משתמש חדש</h2>
              <div className="admin-inline-fields">
                <label className="admin-field">
                  <span>שם משתמש</span>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="admin-field">
                  <span>סיסמה</span>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    autoComplete="new-password"
                  />
                </label>
                <label className="admin-field">
                  <span>שם לתצוגה</span>
                  <input
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  />
                </label>
              </div>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={newUser.approved}
                  onChange={(e) => setNewUser({ ...newUser, approved: e.target.checked })}
                />
                <span>אשר מיד (אחרת יופיע כממתין)</span>
              </label>
              <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void createUser()}>
                צור משתמש
              </button>
            </div>

            <div className="admin-toolbar">
              <input
                type="search"
                className="admin-search"
                placeholder="חיפוש לפי שם משתמש / תצוגה / UID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <div className="admin-chip-row">
                {(
                  [
                    ['all', 'הכול'],
                    ['pending', `ממתינים (${pendingCount})`],
                    ['approved', 'מאושרים'],
                    ['banned', 'חסומים'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`admin-chip pressable ${userFilter === id ? 'is-active' : ''}`}
                    onClick={() => setUserFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="secondary-action pressable" disabled={busy} onClick={() => void reload()}>
                רענון
              </button>
            </div>

            <p className="admin-muted">
              {filteredUsers.length} משתמשים · ממתינים: {pendingCount} · חסומים: {bannedCount}
            </p>

            <ul className="admin-user-list">
              {filteredUsers.map((u) => (
                <li key={u.uid} className={u.banned ? 'is-banned' : u.pending ? 'is-pending' : ''}>
                  <div>
                    <strong>{u.displayName || u.username || 'ללא שם'}</strong>
                    {u.pending && <span className="tag-pending">ממתין לאישור</span>}
                    {u.banned && <span className="tag-hide">חסום</span>}
                    {u.approved && !u.banned && <span className="tag-ok">מאושר</span>}
                    <p className="admin-muted">
                      {u.username ? `@${u.username} · ` : ''}
                      ערבים: {u.gamesPlayed} · נראה:{' '}
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
                  <div className="admin-table__actions">
                    {u.pending && (
                      <button
                        type="button"
                        className="primary-action pressable"
                        disabled={busy}
                        onClick={() =>
                          void setUserApproved(u.uid, true)
                            .then(() => reload())
                            .then(() => flash(`${u.displayName || u.username} אושר.`))
                            .catch((err) => setError(err instanceof Error ? err.message : 'אישור נכשל'))
                        }
                      >
                        אשר משתמש
                      </button>
                    )}
                    {u.approved && !u.banned && (
                      <button
                        type="button"
                        className="hub-btn hub-btn--ghost pressable"
                        disabled={busy}
                        onClick={() =>
                          void setUserApproved(u.uid, false)
                            .then(() => reload())
                            .then(() => flash('האישור בוטל — המשתמש ממתין.'))
                            .catch((err) => setError(err instanceof Error ? err.message : 'עדכון נכשל'))
                        }
                      >
                        בטל אישור
                      </button>
                    )}
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
                      {u.banned ? 'בטל חסימה' : 'חסום'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {!filteredUsers.length && <p className="admin-muted">אין משתמשים לפי הסינון (או שחסרים Rules v31).</p>}
          </div>
        )}

        {tab === 'export' && (
          <div className="admin-panel">
            <div className="admin-card">
              <h2>הורדת קובץ שאלות מרוכז</h2>
              <p className="admin-muted">
                מייצא את מאגר השאלות הפעיל (כולל עריכות, בלי מוסתרים) לקובץ טקסט.
              </p>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="primary-action pressable"
                  onClick={() => {
                    const n = downloadQuestionsFile();
                    flash(`קובץ שאלות הורד (${n} שורות).`);
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
                    flash(`קובץ מלא הורד (${n} שורות).`);
                  }}
                >
                  הורדת שאלות + משימות
                </button>
              </div>
            </div>
            <div className="admin-card">
              <h2>סטטיסטיקת ייצוא</h2>
              <ul className="admin-checklist">
                <li>שאלות פעילות: {stats.questions}</li>
                <li>משימות פעילות: {stats.tasks}</li>
                <li>קטגוריות במערכת: {categories.length}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
