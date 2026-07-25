import { SettingsPanel } from '../components/SettingsPanel';
import type { AppSettings } from '../types/game';

type SettingsScreenProps = {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onResetScores: () => void;
  onBack: () => void;
  onOpenAdmin?: () => void;
  buildVersion?: string;
};

export function SettingsScreen({
  settings,
  onUpdate,
  onResetScores,
  onBack,
  onOpenAdmin,
  buildVersion,
}: SettingsScreenProps) {
  return (
    <section className="page-screen flow-screen settings-screen">
      <div className="flow-card settings-card">
        <header className="flow-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה">
            →
          </button>
          <div>
            <p className="flow-kicker">Couple Spin</p>
            <h1 className="flow-title">הגדרות</h1>
          </div>
        </header>
        <SettingsPanel
          settings={settings}
          onUpdate={onUpdate}
          onResetScores={onResetScores}
          onBack={onBack}
          onOpenAdmin={onOpenAdmin}
          buildVersion={buildVersion}
        />
      </div>
    </section>
  );
}
