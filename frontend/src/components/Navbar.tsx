import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Train, Shield, LogOut, Ticket, Search, PlusCircle, UserCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAdmin, logout, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Train className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-blue-400 bg-clip-text text-transparent">
                RailBuddy
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v2.0 Gateway
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-1 sm:gap-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isCurrent('/') || isCurrent('/search')
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search Trains</span>
            </Link>

            {user && (
              <Link
                to="/my-bookings"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent('/my-bookings')
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Ticket className="w-4 h-4" />
                <span>My Bookings</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isCurrent('/admin')
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-purple-950/40 text-purple-300 border border-purple-800/50 hover:bg-purple-900/60'
                }`}
              >
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Admin Dashboard</span>
              </Link>
            )}

            {/* User Auth Section */}
            {user ? (
              <div className="relative ml-2">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
                    {user.firstName ? user.firstName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-semibold text-white leading-tight">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      {isAdmin ? (
                        <span className="text-purple-400 font-bold flex items-center gap-0.5">
                          <UserCheck className="w-2.5 h-2.5" /> Admin User
                        </span>
                      ) : (
                        'Passenger Account'
                      )}
                    </p>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2.5 border-b border-slate-700/60">
                      <p className="text-sm font-semibold text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      {isAdmin && (
                        <span className="mt-1.5 inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          System Admin
                        </span>
                      )}
                    </div>

                    <Link
                      to="/my-bookings"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white flex items-center gap-2"
                    >
                      <Ticket className="w-4 h-4 text-blue-400" />
                      <span>My Ticket History</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full text-left px-4 py-2 text-sm text-purple-300 hover:bg-purple-950/40 flex items-center gap-2 font-medium"
                      >
                        <PlusCircle className="w-4 h-4 text-purple-400" />
                        <span>Manage Trains & Schedules</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-700/60 my-1"></div>

                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => openAuthModal('signin')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 transition-all"
                >
                  Create Account
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </nav>
  );
};
