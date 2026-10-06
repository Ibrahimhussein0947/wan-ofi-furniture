import { Component } from 'react';
import { AlertOctagon } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

function ErrorFallback() {
  const t = useT();
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-center" role="alert" data-error-boundary>
      <AlertOctagon className="h-10 w-10 text-red-500" />
      <h2 className="mt-3 text-lg font-semibold">{t('Something went wrong on this page')}</h2>
      <p className="mt-1 max-w-md text-sm text-stone-500">{t('Please reload. If it keeps happening, let the administrator know what you were doing.')}</p>
      <button type="button" className="mt-4 rounded-lg bg-walnut-800 px-4 py-2 text-sm font-medium text-white" onClick={() => window.location.reload()}>
        {t('Reload page')}
      </button>
    </div>
  );
}

/** Catches rendering errors so one broken widget never blanks the whole app. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback />;
  }
}
