import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Andi] ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '32px',
          background: '#f5efe6', color: '#2a1f1a',
          fontFamily: '"Manrope", system-ui, sans-serif',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#c4602f', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '20px', fontSize: '28px',
          }}>
            !
          </div>
          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: '22px',
            fontStyle: 'italic', fontWeight: 600, color: '#7a3a1e',
            margin: '0 0 8px', textAlign: 'center',
          }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: '14px', color: '#8b7d6b', margin: '0 0 20px', textAlign: 'center', maxWidth: '360px' }}>
            La app encontró un error. Probá recargar la página.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '14px 32px', background: '#7a3a1e', border: 'none',
              borderRadius: '12px', color: '#f5efe6', fontSize: '15px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Recargar app
          </button>
          <pre style={{
            marginTop: '20px', padding: '12px 16px', background: '#ebe3d5',
            borderRadius: '8px', fontSize: '11px', color: '#8b7d6b',
            maxWidth: '400px', overflow: 'auto', whiteSpace: 'pre-wrap',
          }}>
            {this.state.error?.message || 'Error desconocido'}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
