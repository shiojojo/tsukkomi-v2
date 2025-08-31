import { NavLink } from 'react-router';
import React from 'react';

/**
 * Responsive navigation component.
 * Intent: show a bottom sticky footer nav on small screens, and a top header on md+ screens.
 * Contract: renders NavLinks for /, /answers, /test and adapts styles responsively.
 */
export default function ResponsiveNav() {
  const items = [
    { to: '/answers', label: 'Answers', icon: ListIcon },
    { to: '/topics', label: 'お題', icon: TopicIcon },
    { to: '/test', label: 'Test', icon: TestIcon },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white/90 backdrop-blur-sm dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 md:fixed md:top-0 md:bottom-auto md:border-b"
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between md:py-3 md:gap-6">
          <div className="hidden md:block">
            <NavLink
              to="/"
              className="font-semibold text-gray-800 dark:text-gray-100"
            >
              Tsukkomi V2
            </NavLink>
          </div>

          <ul className="flex w-full md:w-auto md:items-center md:gap-4">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to} className="flex-1 md:flex-initial md:inline-flex">
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `group flex flex-col items-center justify-center gap-1 py-2 px-3 text-sm leading-none w-full md:w-auto md:flex-row md:items-center md:px-2 md:py-3 ` +
                    (isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-200')
                  }
                >
                  <Icon className="w-5 h-5 stroke-current" />
                  <span className="md:ml-2">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 21V12h14v9" />
    </svg>
  );
}

function ListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function TestIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2 2" />
    </svg>
  );
}

function TopicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2v20" />
      <path d="M5 7h14" />
      <path d="M5 17h14" />
    </svg>
  );
}
