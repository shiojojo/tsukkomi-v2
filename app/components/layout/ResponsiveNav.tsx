import { NavLink } from 'react-router';
import { useEffect, useRef } from 'react';
import { memo } from 'react';
import { useIdentity } from '~/hooks/common/useIdentity';
import { ThemeToggle } from '~/components/ui/ThemeToggle';

/**
 * Responsive navigation component.
 * Intent: show a bottom sticky footer nav on small screens, and a top header on md+ screens.
 * Contract: renders NavLinks for / and /topics and adapts styles responsively.
 */
export default function ResponsiveNav() {
  const items = [
    { to: '/', label: 'Home', icon: MemoizedHomeIcon },
    { to: '/answers', label: '検索', icon: MemoizedSearchIcon },
    { to: '/answers/favorites', label: 'お気に', icon: MemoizedStarIcon },
    { to: '/topics', label: 'お題', icon: MemoizedTopicIcon },
  ];

  const identity = useIdentity(); // ← 一度だけ呼び出し

  const navRef = useRef<HTMLElement | null>(null);

  // Measure nav height and expose as CSS variable so routes can offset accordingly.
  useEffect(() => {
    if (!navRef.current || typeof window === 'undefined') return;
    const el = navRef.current;
    const mq = window.matchMedia('(min-width:48rem)');

    let rafId: number;
    const update = () => {
      // Cancel previous animation frame to avoid multiple updates
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const value = mq.matches ? `${el.offsetHeight}px` : '0px';
        document.documentElement.style.setProperty(
          '--app-header-height',
          value
        );
      });
    };

    // Initial update
    update();

    // Use ResizeObserver for efficient size monitoring
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    // Media query change listener
    mq.addEventListener('change', update);

    return () => {
      resizeObserver.disconnect();
      mq.removeEventListener('change', update);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white dark:bg-black border-t border-border md:fixed md:top-0 md:bottom-auto md:border-b md:h-16"
      role="navigation"
    >
      <div className="max-w-4xl mx-auto px-4 h-full">
        <div className="flex items-center justify-between md:gap-6 h-full">
          <div className="hidden md:flex items-center gap-4">
            <NavLink to="/" className="font-semibold text-foreground">
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
                    (isActive ? 'text-primary' : 'text-muted-foreground')
                  }
                >
                  <Icon className="w-5 h-5 stroke-current" />
                  <span className="md:ml-2">{label}</span>
                </NavLink>
              </li>
            ))}
            <li className={`flex-1 md:flex-initial md:hidden`}>
              <MobileUserButton {...identity} />
            </li>
          </ul>
          <div className="hidden md:flex items-center gap-4">
            <UserBadge {...identity} />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function UserBadge({
  effectiveName,
  subName,
  mainName,
}: {
  effectiveName: string | null;
  subName: string | null;
  mainName: string | null;
}) {
  if (effectiveName) {
    return (
      <NavLink
        to="/me"
        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <span>
          {subName ? (
            <>
              {subName}
              <span className="text-[10px] text-muted-foreground ml-1">
                ({mainName})
              </span>
            </>
          ) : (
            mainName
          )}
        </span>
      </NavLink>
    );
  }
  return (
    <NavLink to="/login" className="text-sm text-primary">
      ログイン
    </NavLink>
  );
}

function MobileUserButton({
  effectiveName,
  subName,
  mainName,
}: {
  effectiveName: string | null;
  subName: string | null;
  mainName: string | null;
}) {
  if (effectiveName) {
    const isSubUser = !!subName;
    return (
      <NavLink
        to="/me"
        className="group flex flex-col items-center justify-center gap-1 py-2 px-3 text-sm leading-none w-full text-primary"
      >
        <svg
          className={`w-5 h-5 stroke-current ${isSubUser ? 'text-orange-600' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span
          className={`text-xs truncate max-w-[60px] ${isSubUser ? 'text-orange-600' : ''}`}
        >
          {subName ? subName : mainName}
        </span>
      </NavLink>
    );
  }
  return (
    <NavLink
      to="/login"
      className={({ isActive }) =>
        `group flex flex-col items-center justify-center gap-1 py-2 px-3 text-sm leading-none w-full ` +
        (isActive ? 'text-primary' : 'text-muted-foreground')
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

const MemoizedHomeIcon = memo(HomeIcon);

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

const MemoizedSearchIcon = memo(SearchIcon);

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

const MemoizedTopicIcon = memo(TopicIcon);

function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}

const MemoizedStarIcon = memo(StarIcon);
