import { Component } from 'react';
import { Sentry, sentryEnabled } from '../sentry.js';

// Without this, any single render error anywhere in the tree (e.g. a
// malformed field in one incident's data) white-screens the entire
// dashboard for whoever is looking at it — including during a live 2am
// incident. This catches it and shows a recoverable message instead.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, info);
    if (sentryEnabled) {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>This page hit an unexpected error. Try reloading — your other data is unaffected.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
