import React, { useEffect, useState } from 'react';
import {
  Bell,
  CalendarCheck2,
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

const NAV_ITEMS: {
  id: TabId;
  desktopLabel: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'book',
    desktopLabel: 'Book Court',
    mobileLabel: 'Book',
    icon: CalendarCheck2
  },
  {
    id: 'current',
    desktopLabel: 'Current Schedule',
    mobileLabel: 'Current',
    icon: Clock3
  },
  {
    id: 'pending',
    desktopLabel: 'Next Schedule',
    mobileLabel: 'Next',
    icon: Hourglass
  },
  {
    id: 'transact',
    desktopLabel: 'Receipts & Pay',
    mobileLabel: 'Receipts',
    icon: ReceiptText
  },
  {
    id: 'map',
    desktopLabel: 'Court Map',
    mobileLabel: 'Map',
    icon: MapIcon
  },
  {
    id: 'profile',
    desktopLabel: 'Profile',
    mobileLabel: 'Profile',
    icon: User
  },
  {
    id: 'faq',
    desktopLabel: 'Help & FAQ',
    mobileLabel: 'FAQ',
    icon: HelpCircle
  }
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
  const [phtClock, setPhtClock] = useState(() => formatPhilippineClock());
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhtClock(formatPhilippineClock());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const getCountText = (id: TabId): string | null => {
    if (id === 'current' && currentCount > 0) return String(currentCount);
    if (id === 'pending' && pendingCount > 0) return String(pendingCount);
    if (id === 'transact' && unpaidCount > 0) return `${unpaidCount} due`;
    return null;
  };

  const handleChooseTab = (tab: TabId) => {
    onSelectTab(tab);
    setDrawerOpen(false);
  };

  const initials = (playerName || 'O')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      {/* Desktop Sticky Right Sidebar */}
      <aside
        aria-label="Desktop Navigation"
        className="hidden lg:flex lg:order-2 lg:flex-col lg:justify-between lg:w-68 xl:w-72 lg:sticky lg:top-0 lg:h-dvh bg-white border-l border-pink-200/75 shrink-0 z-30 overflow-y-auto"
      >
        <div className="p-5 space-y-6">
          {/* Brand Header */}
          <button
            type="button"
            onClick={() => handleChooseTab('book')}
            className="w-full text-left flex items-center gap-3 group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] rounded-xl"
          >
            <div className="w-9 h-9 rounded-xl bg-[#BE185D] text-white flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                shapeRendering="geometricPrecision"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
                <line x1="12" y1="5" x2="12" y2="19" stroke="#FBCFE8" strokeWidth="1.75" />
                <line x1="8" y1="5" x2="8" y2="19" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
                <line x1="16" y1="5" x2="16" y2="19" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold tracking-tight text-[#831843] truncate group-hover:text-[#BE185D] transition-colors">
                {CLUB_INFO.name}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums truncate">
                PHT · {phtClock}
              </p>
            </div>
          </button>

          {/* Primary Feature Navigation */}
          <nav className="space-y-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const countText = getCountText(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChooseTab(item.id)}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] ${
                    isActive
                      ? 'bg-[#BE185D] text-white'
                      : 'text-slate-700 hover:bg-pink-50 hover:text-[#831843]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#BE185D]'}`}
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm font-medium truncate">
                      {item.desktopLabel}
                    </span>
                  </div>
                  {countText && (
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                        isActive ? 'text-white' : 'text-[#BE185D]'
                      }`}
                    >
                      {countText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Player, Venue & Sign Out */}
        <div className="p-5 pt-4 border-t border-pink-100 space-y-3 bg-[#FFF9FB]">
          <button
            type="button"
            onClick={() => handleChooseTab('profile')}
            className="w-full flex items-center gap-2.5 text-left rounded-xl hover:bg-pink-50 p-1.5 -m-1.5 transition-colors cursor-pointer"
          >
            {playerPhotoUrl && !avatarFailed ? (
              <img
                src={playerPhotoUrl}
                alt={playerName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-lg object-cover border border-pink-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#BE185D] text-white font-display text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{playerName}</p>
              <p className="text-[11px] text-slate-500 truncate">Soriano, Cabadbaran</p>
            </div>
          </button>

          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={onEnableNotifications}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-xs font-medium text-[#831843] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-[#BE185D]" aria-hidden="true" />
              <span>Enable Alerts</span>
            </button>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <a
              href={CLUB_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Openline Court Facebook Page"
              className="min-h-[38px] px-2 py-1.5 rounded-xl hover:bg-pink-50 inline-flex items-center gap-1.5 text-xs font-semibold text-[#831843] transition-colors truncate"
            >
              <FacebookLogo className="w-4 h-4 shrink-0" />
              <span className="truncate">@openlinecourt</span>
            </a>

            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign Out"
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#831843] bg-pink-50 hover:bg-pink-100 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header Bar (< lg) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/92 backdrop-blur-xl border-b border-pink-200/75">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleChooseTab('book')}
            className="font-display text-base font-bold tracking-tight text-[#831843] whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-7 h-7 rounded-lg bg-[#BE185D] text-white inline-flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                shapeRendering="geometricPrecision"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
                <line x1="12" y1="5" x2="12" y2="19" stroke="#FBCFE8" strokeWidth="1.75" />
              </svg>
            </span>
            <span>{CLUB_INFO.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-semibold text-[#831843] bg-pink-50 hover:bg-pink-100 border border-pink-200/80 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Mobile Full Navigation Drawer */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[#500724]/50 backdrop-blur-xs flex justify-end"
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
          <aside className="w-[86%] max-w-sm h-full bg-white border-l border-pink-200 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="px-5 py-4 border-b border-pink-100 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-bold text-[#831843]">
                    Openline Court Menu
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    PHT · {phtClock}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#831843] hover:bg-pink-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-1.5">
                {NAV_ITEMS.map((item) => {
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
                          : 'bg-white border border-pink-200/70 text-slate-800 hover:bg-pink-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#BE185D]'}`}
                          aria-hidden="true"
                        />
                        <span className="font-display text-sm font-semibold truncate">
                          {item.desktopLabel}
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
            </div>

            <div className="p-4 border-t border-pink-100 bg-[#FFF9FB] space-y-2.5">
              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onEnableNotifications();
                  }}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-xs font-semibold text-[#831843] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
                  <span>Enable Court Alerts</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-2">
                <a
                  href={CLUB_INFO.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Openline Court Facebook Page"
                  className="min-h-[44px] px-2.5 py-2 rounded-xl hover:bg-pink-50 inline-flex items-center gap-1.5 text-xs font-semibold text-[#831843]"
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
                  className="min-h-[44px] px-4 py-2 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#831843] text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
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
