type TutorialScreenProps = {
  onStart: () => void;
  onBack: () => void;
};

const STEPS = [
  { emoji: '🎡', title: 'מסובבים', text: 'הגלגל בוחר את הרגע הבא: שאלה, משימה או הפתעה.' },
  { emoji: '💬', title: 'משתפים או מבצעים', text: 'עונים בכנות, עושים יחד — ורק במה שמרגיש לכם נכון.' },
  { emoji: '✨', title: 'צוברים רגעים', text: 'כל סיבוב מקרב אתכם ליעד, אבל החיבור הוא הניצחון האמיתי.' },
];

export function TutorialScreen({ onStart, onBack }: TutorialScreenProps) {
  return (
    <section className="page-screen tutorial-screen">
      <div className="game-card">
        <button type="button" className="back-btn" onClick={onBack} aria-label="חזרה">
          →
        </button>

        <header className="top-bar compact-top">
          <div>
            <p className="eyebrow">Couple Spin</p>
            <h1 className="page-heading">איך משחקים?</h1>
            <p className="subtitle">הסבר קצר לפני שמתחילים</p>
          </div>
        </header>

        <div className="tutorial-steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="tutorial-step">
              <span className="tutorial-step__num">{i + 1}</span>
              <span className="tutorial-step__emoji">{step.emoji}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="level-warning">בלי לחץ ובלי חובה — תמיד אפשר לדלג, להחליף או לעצור.</p>

        <button type="button" className="spin-button pressable" onClick={onStart}>
          הבנו — בואו נשחק!
        </button>
      </div>
    </section>
  );
}
