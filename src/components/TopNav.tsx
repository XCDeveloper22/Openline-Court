import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Clock3,
  HelpCircle,
  Hourglass,
  LogOut,
  Map as MapIcon,
  Menu,
  ReceiptText,
  User,
  X
} from 'lucide-react';
import { CLUB_INFO, formatPhilippineClock } from '../data/courts';
import { BrowserNotificationPermission } from '../lib/notifications';
import { TabId } from '../types';
import { FacebookLogo } from './FacebookLogo';
import { PickleballLogoMark, PickleballPaddleIcon } from './PickleballIcons';

interface TopNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onSignOut: () => void;
  currentCount: number;
  pendingCount: number;
  unpaidCount: number;
  notificationPermission: BrowserNotificationPermission;
  onEnableNotifications: () => void;
  playerName: string;
  playerPhotoUrl?: string;
}

const PRIMARY_TABS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'book', label: 'Book Court', icon: PickleballPaddleIcon },
  { id: 'current', label: 'Playing Now', icon: Clock3 },
  { id: 'pending', label: 'Up Next', icon: Hourglass },
  { id: 'transact', label: 'Receipts', icon: ReceiptText }
];

const SECONDARY_ITEMS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'map', label: 'Court Map', icon: MapIcon },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'faq', label: 'Help & FAQ', icon: HelpCircle }
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onSignOut,
  currentCount,
  pendingCount,
  unpaidCount,
  notificationPermission,
  onEnableNotifications,
  playerName,
  playerPhotoUrl
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [phtClock, setPhtClock] = useState(() => formatPhilippineClock());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhtClock(formatPhilippineClock());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const getCountText = (id: TabId): string | null => {
    if (id === 'current' && currentCount > 0) return String(currentCount);
    if (id === 'pending' && pendingCount > 0) return String(pendingCount);
    if (id === 'transact' && unpaidCount > 0) return String(unpaidCount);
    return null;
  };

  const handleChooseTab = (tab: TabId) => {
    onSelectTab(tab);
    setDrawerOpen(false);
    setMenuOpen(false);
  };

  const firstName = playerName.trim().split(' ')[0] || 'Player';
  const initials = (playerName || 'O')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const isSecondaryActive = activeTab === 'map' || activeTab === 'profile' || activeTab === 'faq';

  return (
    <>
      {/* Desktop Fresh Top Navigation Bar */}
      <header className="hidden lg:block sticky top-0 z-30 bg-white/92 backdrop-blur-xl border-b border-slate-200/80">
        <div className="container-4k px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand */}
          <button
            type="button"
            onClick={() => handleChooseTab('book')}
            className="flex items-center gap-2.5 group cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-[#BE185D] text-white flex items-center justify-center shadow-xs shrink-0">
              <PickleballLogoMark className="w-5 h-5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 group-hover:text-[#BE185D] transition-colors">
              {CLUB_INFO.name}
            </span>
          </button>

          {/* Center: Clean 4-Tab Track */}
          <nav
            aria-label="Main Navigation"
            className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/70"
          >
            {PRIMARY_TABS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const countText = getCountText(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChooseTab(item.id)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#BE185D] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#BE185D]'}`}
                  />
                  <span>{item.label}</span>
                  {countText && (
                    <span
                      className={`font-mono text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.id === 'transact'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-pink-100 text-[#BE185D]'
                      }`}
                    >
                      {countText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Friendly Player Dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account and more pages"
              className={`min-h-[40px] pl-1.5 pr-3 py-1 rounded-xl border inline-flex items-center gap-2 transition-colors cursor-pointer ${
                menuOpen || isSecondaryActive
                  ? 'bg-pink-50 border-[#BE185D] text-[#831843]'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {playerPhotoUrl && !avatarFailed ? (
                <img
                  src={playerPhotoUrl}
                  alt={playerName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-7 h-7 rounded-lg object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-lg bg-[#BE185D] text-white font-display text-xs font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
              )}
              <span className="text-xs font-semibold max-w-[100px] truncate">{firstName}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  menuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{playerName}</p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    PHT · {phtClock}
                  </p>
                </div>

                {SECONDARY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleChooseTab(item.id)}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#BE185D] text-white'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-[#BE185D]'}`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {notificationPermission === 'default' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEnableNotifications();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
                    <span>Turn On Court Alerts</span>
                  </button>
                )}

                <a
                  href={CLUB_INFO.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <FacebookLogo className="w-4 h-4 shrink-0" />
                  <span>@openlinecourt</span>
                </a>

                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Compact Header Bar (< lg) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleChooseTab('book')}
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2.5"
          >
            <span className="w-8 h-8 rounded-xl bg-[#BE185D] text-white inline-flex items-center justify-center shrink-0">
              <PickleballLogoMark className="w-4.5 h-4.5" />
            </span>
            <span>{CLUB_INFO.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Mobile Full Navigation Drawer */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 h-full cursor-default"
          />
          <aside className="w-[86%] max-w-sm h-full bg-white border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-[#BE185D] text-white inline-flex items-center justify-center shrink-0">
                    <PickleballLogoMark className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-slate-900 truncate">
                      {playerName}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      PHT · {phtClock}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-5">
                <div className="space-y-1.5">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Play &amp; Schedules
                  </p>
                  {PRIMARY_TABS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const countText = getCountText(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleChooseTab(item.id)}
                        className={`w-full min-h-[48px] px-4 py-3 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#BE185D] text-white'
                            : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#BE185D]'}`}
                          />
                          <span className="font-display text-sm font-semibold truncate">
                            {item.label}
                            {countText ? (
                              <span
                                className={`ml-1.5 font-mono text-xs tabular-nums ${
                                  isActive ? 'text-pink-100' : 'text-[#BE185D]'
                                }`}
                              >
                                ({countText})
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Club &amp; Account
                  </p>
                  {SECONDARY_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleChooseTab(item.id)}
                        className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#BE185D] text-white'
                            : 'bg-slate-50/70 border border-slate-200/80 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#BE185D]'}`}
                          />
                          <span className="font-display text-sm font-semibold truncate">
                            {item.label}
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onEnableNotifications();
                  }}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
                  <span>Turn On Court Alerts</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-2">
                <a
                  href={CLUB_INFO.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Openline Court Facebook Page"
                  className="min-h-[44px] px-2.5 py-2 rounded-xl hover:bg-slate-100 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800"
                >
                  <FacebookLogo className="w-4 h-4 shrink-0" />
                  <span>@openlinecourt</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onSignOut();
                  }}
                  className="min-h-[44px] px-4 py-2 bg-white hover:bg-red-50 border border-slate-200 text-red-700 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
