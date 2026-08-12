import React from 'react';
import { C } from '../utils';

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
          background: C.cream, color: C.espresso,
          fontFamily: '"Manrope", system-ui, sans-serif',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: C.terra, display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '20px', fontSize: '28px',
            color: C.white, fontWeight: 700,
          }}>
            !
          </div>
          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: '22px',
            fontStyle: 'italic', fontWeight: 600, color: C.forest,
            margin: '0 0 8px', textAlign: 'center',
          }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: '14px', color: C.muted, margin: '0 0 20px', textAlign: 'center', maxWidth: '360px' }}>
            La app encontró un error. Probá recargar la página.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '14px 32px', background: C.forest, border: 'none',
              borderRadius: '12px', color: C.cream, fontSize: '15px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Recargar app
          </button>
          <pre style={{
            marginTop: '20px', padding: '12px 16px', background: C.creamDeep,
            borderRadius: '8px', fontSize: '11px', color: C.muted,
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
