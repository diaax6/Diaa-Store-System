import { Component } from 'react';

/**
 * ErrorBoundary — catches any unhandled React render error.
 * Without this, any crash shows a blank white screen to the user.
 * Wraps the entire app in App.jsx.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console — replace with Sentry.captureException(error) when ready
    console.error('[ErrorBoundary] Unhandled app error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          fontFamily: 'Cairo, sans-serif',
          direction: 'rtl',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '0.5rem',
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            حدث خطأ غير متوقع
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, maxWidth: '24rem' }}>
            حدث خطأ في النظام. يرجى تحديث الصفحة أو التواصل مع المسؤول إذا استمرت المشكلة.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: '0.5rem',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.6rem 1.5rem',
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            تحديث الصفحة
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '1rem',
              fontSize: '0.7rem',
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              maxWidth: '40rem',
              overflow: 'auto',
              textAlign: 'left',
              direction: 'ltr',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
