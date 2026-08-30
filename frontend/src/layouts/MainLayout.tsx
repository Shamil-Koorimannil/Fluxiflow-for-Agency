import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { FluxiflowLogo } from '../components/common/FluxiflowLogo';
import { CheckSquare, Folder, Users, List, User as UserIcon, LogOut, Search, Menu as MenuIcon, BarChart3, BookOpen } from 'lucide-react';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { Drawer } from '@mui/material';
import { useWebSockets } from '../hooks/useWebSockets';


export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useWebSockets(); // Initialize real-time updates for authenticated session
  const [isExiting, setIsExiting] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  const handleLogout = async () => {
    setIsExiting(true);
    setTimeout(async () => {
      try {
        await logout();
      } catch (err) {
        // ignore
      }
      navigate('/login');
    }, 250);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className={`flex h-screen w-screen bg-white dark:bg-black overflow-hidden text-black dark:text-white font-sans transition-all duration-300 ${isExiting ? 'animate-fade-out' : ''}`}>
      {/* DESKTOP SIDEBAR - Hidden on Mobile */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black h-full shrink-0">
        {/* ── Logo ── */}
        <div className="flex items-center px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <FluxiflowLogo />
        </div>

        {/* Profile header */}
        {user && (
          <Link
            to="/app/profile"
            className="flex items-center gap-3 p-6 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-10 w-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold tracking-wider text-zinc-650 dark:text-zinc-400">
                {getInitials(user.name)}
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm truncate leading-tight">{user.name}</h2>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide uppercase">
                {user.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
              </span>
            </div>
          </Link>
        )}

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <NavLink
            to="/app/tasks"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
              }`
            }
          >
            <CheckSquare className="h-4 w-4" />
            Tasks
          </NavLink>

          <NavLink
            to="/app/projects"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
              }`
            }
          >
            <Folder className="h-4 w-4" />
            Projects
          </NavLink>

          <NavLink
            to="/app/keep"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
              }`
            }
          >
            <BookOpen className="h-4 w-4" />
            Keep
          </NavLink>

          {isAdmin && (
            <>
              <NavLink
                to="/app/team"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <Users className="h-4 w-4" />
                Team
              </NavLink>

              <NavLink
                to="/app/reports"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <BarChart3 className="h-4 w-4" />
                Reports
              </NavLink>

              <NavLink
                to="/app/activity"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <List className="h-4 w-4" />
                Activity Log
              </NavLink>
            </>
          )}

          <NavLink
            to="/app/search"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
              }`
            }
          >
            <Search className="h-4 w-4" />
            Global Search
          </NavLink>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden p-1 text-zinc-650 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            {/* Mobile header: show logo, hidden on desktop where sidebar handles it */}
            <div className="md:hidden">
              <FluxiflowLogo />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/20 dark:bg-black px-4 md:px-8 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* MOBILE BOTTOM NAVIGATION - Hidden on Desktop */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black flex items-center justify-around px-2 z-50">
          <NavLink
            to="/app/tasks"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors ${
                isActive ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`
            }
          >
            <CheckSquare className="h-5 w-5" />
            <span>Tasks</span>
          </NavLink>

          <NavLink
            to="/app/projects"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors ${
                isActive ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`
            }
          >
            <Folder className="h-5 w-5" />
            <span>Projects</span>
          </NavLink>

          <NavLink
            to="/app/search"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors ${
                isActive ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`
            }
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </NavLink>

          <NavLink
            to="/app/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors ${
                isActive ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`
            }
          >
            <UserIcon className="h-5 w-5" />
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>

      {/* MOBILE SIDEBAR DRAWER */}
      <Drawer
        anchor="left"
        open={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: '260px',
              bgcolor: 'background.paper',
              color: 'text.primary',
              display: 'flex',
              flexDirection: 'column',
            }
          }
        }}
      >
        <div className="flex-1 flex flex-col justify-between min-h-0 bg-white dark:bg-black text-black dark:text-white">
          <div className="flex flex-col">
            {/* ── Logo ── */}
            <div className="flex items-center px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <FluxiflowLogo />
            </div>

            {/* Profile header */}
            {user && (
              <Link
                to="/app/profile"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex items-center gap-3 p-6 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-10 w-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold tracking-wider text-zinc-650 dark:text-zinc-400">
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="overflow-hidden">
                  <h2 className="font-semibold text-sm truncate leading-tight">{user.name}</h2>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide uppercase">
                    {user.role === 'ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </div>
              </Link>
            )}

            {/* Navigation links */}
            <nav className="px-4 py-6 space-y-1.5">
              <NavLink
                to="/app/tasks"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <CheckSquare className="h-4 w-4" />
                Tasks
              </NavLink>

              <NavLink
                to="/app/projects"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <Folder className="h-4 w-4" />
                Projects
              </NavLink>

              <NavLink
                to="/app/keep"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <BookOpen className="h-4 w-4" />
                Keep
              </NavLink>

              {isAdmin && (
                <>
                  <NavLink
                    to="/app/team"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                          : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                      }`
                    }
                  >
                    <Users className="h-4 w-4" />
                    Team
                  </NavLink>

                  <NavLink
                    to="/app/reports"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                          : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                      }`
                    }
                  >
                    <BarChart3 className="h-4 w-4" />
                    Reports
                  </NavLink>

                  <NavLink
                    to="/app/activity"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                          : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                      }`
                    }
                  >
                    <List className="h-4 w-4" />
                    Activity Log
                  </NavLink>
                </>
              )}

              <NavLink
                to="/app/search"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-semibold'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <Search className="h-4 w-4" />
                Global Search
              </NavLink>
            </nav>
          </div>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
