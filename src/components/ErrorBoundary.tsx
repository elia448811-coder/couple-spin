import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CoupleSpin]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="site-gate" dir="rtl">
          <div className="site-gate__card">
            <h1 className="site-gate__title">משהו השתבש</h1>
            <p className="site-gate__desc">אפשר לרענן את העמוד ולהמשיך — הנתונים המקומיים נשמרים.</p>
            <button
              type="button"
              className="site-gate__submit pressable"
              onClick={() => window.location.reload()}
            >
              רענון העמוד
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
