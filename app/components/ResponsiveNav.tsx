import { NavLink } from 'react-router';
import { useEffect, useState } from 'react';

/**
 * Responsive navigation component.
 * Intent: show a bottom sticky footer nav on small screens, and a top header on md+ screens.
 * Contract: renders NavLinks for / and /topics and adapts styles responsively.
 */
export default function ResponsiveNav() {
  const items = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/answers', label: '検索', icon: SearchIcon },
    { to: '/topics', label: 'お題', icon: TopicIcon },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white/90 backdrop-blur-sm dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 md:fixed md:top-0 md:bottom-auto md:border-b"
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between md:py-3 md:gap-6">
          <div className="hidden md:flex items-center gap-4">
            <NavLink
              to="/"
              className="font-semibold text-gray-800 dark:text-gray-100"
            >
              Tsukkomi V2
            </NavLink>
          </div>

          <ul className="flex w-full md:w-auto md:items-center md:gap-4">
            {items.map(({ to, label, icon: Icon }) => (
              <li
                key={to}
                className={
                  `flex-1 md:flex-initial md:inline-flex ` +
                  (to === '/' ? 'md:hidden' : '')
                }
              >
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
            <li className={`flex-1 md:flex-initial md:hidden`}>
              <MobileUserButton />
            </li>
          </ul>
          <div className="hidden md:flex items-center">
            <UserBadge />
          </div>
        </div>
      </div>
    </nav>
  );
}

function UserBadge() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // prefer sub-user when present
      setName(
        localStorage.getItem('currentSubUserName') ??
          localStorage.getItem('currentUserName')
      );
    } catch {
      setName(null);
    }
  }, []);

  if (name) {
    return (
      <NavLink
        to="/me"
        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
      >
        <span>{name}</span>
      </NavLink>
    );
  }

  return (
    <NavLink to="/login" className="text-sm text-blue-600">
      ログイン
    </NavLink>
  );
}

function MobileUserButton() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // prefer sub-user when present
      setName(
        localStorage.getItem('currentSubUserName') ??
          localStorage.getItem('currentUserName')
      );
    } catch {
      setName(null);
    }
  }, []);

  if (name) {
    return (
      <NavLink
        to="/me"
        className="group flex flex-col items-center justify-center gap-1 py-2 px-3 text-sm leading-none w-full text-blue-600"
      >
        {/* render the selected sub-user's name in the SVG spot */}
        <div className="w-20 h-6 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-700 text-xs font-medium text-blue-700 dark:text-white truncate">
          {name}
        </div>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/login"
      className={({ isActive }) =>
        `group flex flex-col items-center justify-center gap-1 py-2 px-3 text-sm leading-none w-full ` +
        (isActive
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-700 dark:text-gray-200')
      }
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5v10z" />
      </svg>
      <span className="text-xs">ログイン</span>
    </NavLink>
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

// Search icon for the answers/search route
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="6" />
      <path d="M21 21l-4.35-4.35" />
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
