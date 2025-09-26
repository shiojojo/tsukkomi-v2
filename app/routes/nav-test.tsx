import { Link } from 'react-router';
import { logger } from '~/lib/logger';

export function meta() {
  return [{ title: 'Simple Navigation Test' }];
}

export default function SimpleNavTest() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Simple Navigation Test</h1>

      <p>
        This is a minimal test page to check if React Router navigation works.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <h2>Navigation Links:</h2>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            margin: '5px',
            border: 'none',
          }}
        >
          Go to Home
        </Link>

        <Link
          to="/topics"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            textDecoration: 'none',
            margin: '5px',
            border: 'none',
          }}
        >
          Go to Topics
        </Link>

        <Link
          to="/answers"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#6f42c1',
            color: 'white',
            textDecoration: 'none',
            margin: '5px',
            border: 'none',
          }}
        >
          Go to Answers
        </Link>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Button Tests:</h2>
        <button
          onClick={() => alert('Button works!')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            margin: '5px',
            cursor: 'pointer',
          }}
        >
          Test Alert
        </button>

        <button
          onClick={() => {
            logger.log('Programmatic navigation test');
            window.location.href = '/';
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            margin: '5px',
            cursor: 'pointer',
          }}
        >
          Force Navigate to Home
        </button>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
        }}
      >
        <h3>Debug Info:</h3>
        <p>
          Current URL:{' '}
          {typeof window !== 'undefined' ? window.location.href : 'SSR'}
        </p>
        <p>Page loaded at: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
