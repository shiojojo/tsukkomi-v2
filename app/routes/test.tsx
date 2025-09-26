import { Link } from 'react-router';
import { useEffect } from 'react';

export function meta() {
  return [
    { title: 'Test - Tsukkomi V2' },
    { name: 'description', content: 'Test route working' },
  ];
}

export default function TestRoute() {
  useEffect(() => {
    console.log('TestRoute mounted successfully');
    console.log('Current location:', window.location.href);
    console.log('React Router context available');

    // Check for overlay elements that might be blocking clicks
    const overlays = document.querySelectorAll(
      '[class*="fixed"], [class*="absolute"]'
    );
    console.log('Found overlay elements:', overlays.length);
    overlays.forEach((el, i) => {
      const styles = window.getComputedStyle(el);
      if (styles.zIndex !== 'auto' && parseInt(styles.zIndex) > 10) {
        console.log(
          `High z-index element ${i}:`,
          el,
          'z-index:',
          styles.zIndex
        );
      }
    });
  }, []);
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Test Route - Navigation Testing</h1>
      <p className="text-sm text-gray-500">File-based routing is active.</p>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Navigation Links Test:</h2>
        <div className="space-x-4">
          <Link
            to="/"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go to Home
          </Link>
          <Link
            to="/topics"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Go to Topics
          </Link>
          <Link
            to="/answers"
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Go to Answers
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Button Test:</h2>
        <button
          onClick={() => alert('Button clicked!')}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Test Button (Alert)
        </button>
        <button
          onClick={() => {
            console.log('Navigation button clicked');
            window.location.href = '/';
          }}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 ml-2"
        >
          Force Navigation to Home
        </button>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm">
          Current URL:{' '}
          {typeof window !== 'undefined' ? window.location.href : 'SSR'}
        </p>
        <p className="text-sm">
          User Agent:{' '}
          {typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'}
        </p>
      </div>
    </div>
  );
}
