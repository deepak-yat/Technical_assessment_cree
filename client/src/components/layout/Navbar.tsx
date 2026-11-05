import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Hotel,
  User,
  LogOut,
  Search,
  Calendar,
  ShieldCheck,
  LayoutDashboard,
  DoorOpen,
} from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { Button } from '../common/Button.js';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isStaffOrAdmin = hasRole(['STAFF', 'ADMIN']);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
    );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Hotel Brand */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                Grand Horizon
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                Hotel
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" className={navItemClass} end>
              <DoorOpen className="h-4 w-4" />
              <span>Rooms</span>
            </NavLink>

            <NavLink to="/search" className={navItemClass}>
              <Search className="h-4 w-4" />
              <span>Search Availability</span>
            </NavLink>

            {isAuthenticated && user?.role === 'GUEST' && (
              <NavLink to="/my-reservations" className={navItemClass}>
                <Calendar className="h-4 w-4" />
                <span>My Reservations</span>
              </NavLink>
            )}

            {isStaffOrAdmin && (
              <>
                <div className="h-5 w-px bg-slate-200 mx-2" />
                <NavLink to="/staff/dashboard" className={navItemClass}>
                  <LayoutDashboard className="h-4 w-4 text-indigo-600" />
                  <span>Dashboard</span>
                </NavLink>

                <NavLink to="/staff/front-desk" className={navItemClass}>
                  <DoorOpen className="h-4 w-4 text-indigo-600" />
                  <span>Front Desk</span>
                </NavLink>

                <NavLink to="/staff/reservations" className={navItemClass}>
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span>Reservations</span>
                </NavLink>

                <NavLink to="/staff/rooms" className={navItemClass}>
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>Room Management</span>
                </NavLink>
              </>
            )}
          </nav>

          {/* User actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800">{user.name}</span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-600">
                    {user.role}
                  </span>
                </div>

                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  icon={LogOut}
                  className="text-slate-500 hover:text-rose-600"
                >
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} icon={User}>
                  Sign In
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
