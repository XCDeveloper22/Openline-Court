import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, HelpCircle, Search, X } from 'lucide-react';
import { CLUB_INFO, GCASH_ACCOUNT } from '../data/courts';
import { FacebookLogo } from './FacebookLogo';

type FaqCategory = 'all' | 'court-usage' | 'gcash-payment' | 'schedule-logic';

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
  categoryLabel: string;
  question: string;
  answer: string;
}

const CATEGORY_TABS: { id: FaqCategory; label: string }[] = [
  { id: 'all', label: 'All Topics' },
  { id: 'court-usage', label: 'Court Usage' },
  { id: 'gcash-payment', label: 'GCash Payment' },
  { id: 'schedule-logic', label: 'Current vs Pending' }
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'hours-rate',
    category: 'court-usage',
    categoryLabel: 'Court Usage',
    question: 'What are Openline Court operating hours and hourly court rates?',
    answer: `Both Court 1 and Court 2 are open daily from ${CLUB_INFO.operatingHours} (${CLUB_INFO.timezoneLabel}) at ₱250 per hour. You may book 1-hour or 2-hour sessions; the latest 2-hour booking starts at 8:00 PM PHT and concludes at 10:00 PM PHT.`
  },
  {
    id: 'court1-vs-court2',
    category: 'court-usage',
    categoryLabel: 'Court Usage',
    question: 'What is the difference between Court 1 and Court 2?',
    answer:
      'Court 1 (West Bay) is our Indoor Climate-Controlled court with a cushioned pro acrylic surface and 5000K linear arena lighting. Court 2 (East Bay) is our Outdoor Windscreen court featuring high-contrast acrylic, glare-free floodlights, and dark perimeter windscreens. Both courts cost ₱250/hr.'
  },
  {
    id: 'checkin-arrival',
    category: 'court-usage',
    categoryLabel: 'Court Usage',
    question: 'How early should we arrive and how do we check in at Soriano, Cabadbaran?',
    answer:
      'Arrive at least 5 to 10 minutes before your scheduled Philippine Time start hour. Proceed straight to the Watcher & Check-In Desk near the Soriano Road entrance and present your 6-character Entry Code (OLxxxx) or Official Receipt from Transact Log.'
  },
  {
    id: 'no-cancel-resched',
    category: 'court-usage',
    categoryLabel: 'Court Usage',
    question: 'Can a confirmed booking be cancelled or refunded?',
    answer:
      'No. Once paid via GCash QR, reservations are final with no cancellations or refunds. However, if your booking is still queued in Next Schedule, you may reschedule it to another open hour or update your partner names before your turn starts.'
  },
  {
    id: 'paddle-rental',
    category: 'court-usage',
    categoryLabel: 'Court Usage',
    question: 'Are pickleball paddles and balls available if I do not bring my own?',
    answer:
      'Yes. During Step 2 of Booked Here, you can add a Paddle & Ball Kit rental for a flat ₱100 add-on. The watcher at the check-in desk will hand over your paddles when verifying your entry code.'
  },
  {
    id: 'gcash-steps',
    category: 'gcash-payment',
    categoryLabel: 'GCash Payment',
    question: 'How does the GCash QR payment process work?',
    answer: `After selecting your court, date, and duration in Booked Here, a GCash QR modal opens for ${GCASH_ACCOUNT.accountName} (${GCASH_ACCOUNT.accountNumber}). Scan the QR code using your GCash app, pay the exact total, then enter your 13-digit GCash Reference Number and mobile sender number to confirm immediately.`
  },
  {
    id: 'unpaid-awaiting',
    category: 'gcash-payment',
    categoryLabel: 'GCash Payment',
    question: 'What happens if I close the GCash QR screen before completing payment?',
    answer:
      'Your draft slot is saved under Pending Payment in Transact Log so you can finish scanning and submitting your GCash reference without re-entering match details. Unpaid bookings do not enter Current Schedule or Next Schedule until GCash verification is submitted.'
  },
  {
    id: 'receipt-proof',
    category: 'gcash-payment',
    categoryLabel: 'GCash Payment',
    question: 'Where do I find my Official Receipt and Check-In Code after paying?',
    answer:
      'Open Transact Log in the navigation menu to view all paid GCash receipts, reference numbers, timestamps, and entry codes. You can tap Show Receipt at any time for the court watcher to verify.'
  },
  {
    id: 'current-vs-pending',
    category: 'schedule-logic',
    categoryLabel: 'Current vs Pending',
    question: 'How does the app decide between Current Schedule and Pending (Next Schedule)?',
    answer:
      'Every paid booking checks the live queue on that exact court and date. If there are 0 earlier paid bookings ahead of your start time, your booking enters Current Schedule right away. If another match is already ahead of your hour, your booking enters Pending (Next Schedule) in queue order (#2, #3, and so on).'
  },
  {
    id: 'auto-promotion',
    category: 'schedule-logic',
    categoryLabel: 'Current vs Pending',
    question: 'When does a Pending (Next Schedule) booking move to Current Schedule?',
    answer:
      'Promotion is automatic across all devices. As soon as the match ahead of you finishes or expires, your booking promotes from Pending to Current Schedule immediately and triggers a browser push + in-app notification.'
  },
  {
    id: 'timer-accuracy',
    category: 'schedule-logic',
    categoryLabel: 'Current vs Pending',
    question: 'When does the Current Schedule countdown timer start and finish?',
    answer:
      'Timers run strictly on Philippine Time (Asia/Manila). If you booked an 8:00 PM – 9:00 PM PHT slot early, the board counts down until start; at 8:00 PM PHT the 1-hour timer starts automatically, and at 9:00 PM PHT it automatically becomes a Finished Schedule and moves to Your Completed Match Log.'
  },
  {
    id: 'shared-visibility',
    category: 'schedule-logic',
    categoryLabel: 'Current vs Pending',
    question: 'Can other players see my court schedule on their phones and desktops?',
    answer:
      'Yes. Both Current Schedule and Next Schedule sync live across desktop and mobile devices so every player at the club can see which court is occupied and which turn is next—while private GCash numbers and receipts remain visible only to you.'
  }
];

export const HelpFaqView: React.FC = () => {
  const [category, setCategory] = useState<FaqCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'hours-rate': true,
    'gcash-steps': true,
    'current-vs-pending': true
  });

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [category, searchQuery]);

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 sm:space-y-8 2xl:space-y-10">
      <div>
        <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.15rem)] font-semibold tracking-tight text-slate-900">
          Help &amp; FAQ
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
          Self-service answers on Court 1 &amp; Court 2 usage, GCash QR payments, and how Current vs.
          Pending schedules advance in Philippine Time.
        </p>
      </div>

      {/* Quick Schedule Mechanism Strip */}
      <section className="surface-2026 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-sm font-semibold text-[#831843]">
          How Booking &amp; Schedule Queuing Works
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <div className="p-4 rounded-2xl bg-[#FFF9FB] border border-pink-200/75 space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#BE185D] tabular-nums">
              01 · GCash QR Pay
            </span>
            <p className="text-sm font-semibold text-slate-900">Pick Court, Date &amp; Pay ₱250/hr</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Submit your 13-digit GCash reference number to lock the slot and receive your receipt.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#FFF9FB] border border-pink-200/75 space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#BE185D] tabular-nums">
              02 · Pending (Next Schedule)
            </span>
            <p className="text-sm font-semibold text-slate-900">Queued Behind Active Turn</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an earlier turn is scheduled on that court, your booking waits in queue order.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#FFF9FB] border border-pink-200/75 space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#BE185D] tabular-nums">
              03 · Current Schedule
            </span>
            <p className="text-sm font-semibold text-slate-900">Auto-Promotes &amp; Alerts</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Once 0 turns remain ahead, your status becomes Current with a 5-min pre-match alert.
            </p>
          </div>
        </div>
      </section>

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filter FAQ by topic"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.id)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#BE185D] text-white'
                    : 'bg-white border border-pink-200/80 text-[#831843] hover:bg-pink-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80 shrink-0">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or keywords..."
            aria-label="Search frequently asked questions"
            className="w-full min-h-[42px] pl-10 pr-9 py-2 text-sm text-slate-900 bg-white border border-pink-200/80 rounded-xl focus:outline-none focus:border-[#BE185D]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="w-8 h-8 flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* FAQ Accordion List */}
      <section className="surface-2026 rounded-3xl overflow-hidden divide-y divide-pink-100">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <HelpCircle className="w-7 h-7 text-pink-400 mx-auto" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-slate-900">
              No matching questions found
            </p>
            <p className="text-xs text-slate-600">
              Try a different keyword or reset the topic filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setSearchQuery('');
              }}
              className="mt-2 min-h-[40px] px-4 py-2 text-xs font-semibold text-[#831843] bg-pink-50 hover:bg-pink-100 rounded-xl cursor-pointer"
            >
              Show All Questions
            </button>
          </div>
        ) : (
          filteredFaqs.map((item) => {
            const isOpen = Boolean(openIds[item.id]);
            return (
              <div key={item.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleItem(item.id)}
                  className="w-full min-h-[56px] px-5 sm:px-7 py-4 text-left flex items-center justify-between gap-4 hover:bg-pink-50/40 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#BE185D]">{item.categoryLabel}</p>
                    <h3 className="mt-0.5 font-display text-sm sm:text-base font-semibold text-slate-900">
                      {item.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#831843] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-7 pb-5 pt-0.5 text-sm text-slate-600 leading-relaxed max-w-3xl">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Club Desk Contact */}
      <section className="surface-2026 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Still need court desk assistance?
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Message our club watcher desk directly via our official page or visit{' '}
            {CLUB_INFO.location}.
          </p>
        </div>
        <a
          href={CLUB_INFO.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Openline Court Facebook Page"
          className="min-h-[44px] px-4 py-2.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#831843] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
        >
          <FacebookLogo className="w-5 h-5 shrink-0" />
          <span>@openlinecourt</span>
          <ExternalLink className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
};
