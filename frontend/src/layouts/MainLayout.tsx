import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { CheckSquare, Folder, Users, List, User as UserIcon, LogOut, Search } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = React.useState(false);

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
    <div className={`flex h-screen w-screen bg-white overflow-hidden text-black font-sans transition-all duration-300 ${isExiting ? 'animate-fade-out' : ''}`}>
      {/* DESKTOP SIDEBAR - Hidden on Mobile */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 bg-white h-full shrink-0">
        {/* Profile header */}
        {user && (
          <Link
            to="/app/profile"
            className="flex items-center gap-3 p-6 border-b border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-10 w-10 rounded-full object-cover border border-zinc-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold tracking-wider text-zinc-600">
                {getInitials(user.name)}
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm truncate leading-tight">{user.name}</h2>
              <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">
                {user.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
              </span>
            </div>
          </Link>
        )}

        {/* Branding header */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
            Fluxiflow for Agency
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <NavLink
            to="/app/tasks"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-zinc-100 text-black font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'
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
                  ? 'bg-zinc-100 text-black font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'
              }`
            }
          >
            <Folder className="h-4 w-4" />
            Projects
          </NavLink>

          {isAdmin && (
            <>
              <NavLink
                to="/app/team"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-black font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'
                  }`
                }
              >
                <Users className="h-4 w-4" />
                Team
              </NavLink>

              <NavLink
                to="/app/activity"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-black font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'
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
                  ? 'bg-zinc-100 text-black font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'
              }`
            }
          >
            <Search className="h-4 w-4" />
            Global Search
          </NavLink>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-black rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/20 px-4 md:px-8 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* MOBILE BOTTOM NAVIGATION - Hidden on Desktop */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-200 bg-white flex items-center justify-around px-2 z-50">
          <NavLink
            to="/app/tasks"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors ${
                isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
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
                isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
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
                isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
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
                isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
              }`
            }
          >
            <UserIcon className="h-5 w-5" />
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
};
