import React, { useMemo, useState } from 'react';
import {
  Clock,
  Compass,
  DoorOpen,
  ExternalLink,
  Lightbulb,
  MapPin,
  Navigation,
  ShieldCheck,
  Users
} from 'lucide-react';
import {
  CLUB_INFO,
  COURTS,
  formatCurrency,
  formatHourRange,
  getCourtById,
  partitionActiveSchedules
} from '../data/courts';
import { CourtBooking, CourtId, CourtSchedule, CourtSlot } from '../types';
import { FacebookLogo } from './FacebookLogo';

interface FacilityMapViewProps {
  uid: string;
  bookings: CourtBooking[];
  sharedSchedules: CourtSchedule[];
  reservedSlots: CourtSlot[];
}

interface LandmarkNote {
  id: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FACILITY_LANDMARKS: LandmarkNote[] = [
  {
    id: 'gate',
    label: 'Soriano Main Gate & Parking',
    detail:
      'Enter from the main Soriano road frontage in Cabadbaran City. Dedicated motorcycle and car parking bays sit directly beside the entry awning.',
    icon: Navigation
  },
  {
    id: 'desk',
    label: 'Watcher & QR Check-In Desk',
    detail:
      'Located straight ahead of the entrance before the court bays. Show your OL entry code or GCash receipt from Transact Log before stepping on court.',
    icon: ShieldCheck
  },
  {
    id: 'gallery',
    label: 'Center Bench & Hydration Walkway',
    detail:
      'Shaded central corridor separating Court 1 (West Indoor Bay) and Court 2 (East Outdoor Bay), with paddle racks and player seating.',
    icon: Users
  },
  {
    id: 'restrooms',
    label: 'Rear Changing Rooms & Lockers',
    detail:
      'Accessible behind the central walkway beyond both baselines, stocked with clean benches and gear storage.',
    icon: DoorOpen
  }
];

const COURT_WAYFINDING: Record<
  CourtId,
  {
    bayLabel: string;
    dimensions: string;
    entryPath: string;
    highlights: string[];
  }
> = {
  'court-1': {
    bayLabel: 'West Bay · Indoor Covered Arena',
    dimensions: '20 ft × 44 ft Regulation · 7 ft Kitchen Zone',
    entryPath:
      'From the Watcher Check-In Desk, step immediately left through the acoustic indoor glass door into the West Bay.',
    highlights: [
      'Cushioned pro acrylic surface with zero sun glare',
      'Climate-controlled indoor ventilation and 5000K linear LED',
      'Direct sightline to the Center Bench & Hydration Walkway'
    ]
  },
  'court-2': {
    bayLabel: 'East Bay · Outdoor Windscreen Court',
    dimensions: '20 ft × 44 ft Regulation · Perimeter Windscreen',
    entryPath:
      'From the Watcher Check-In Desk, walk straight along the shaded Center Walkway and turn right through the East Bay windscreen gate.',
    highlights: [
      'High-contrast tournament acrylic framed by dark mesh windscreens',
      'Glare-free evening floodlights for 6:00 PM – 10:00 PM PHT play',
      'Wide run-off baseline space buffered by perimeter conifers'
    ]
  }
};

export const FacilityMapView: React.FC<FacilityMapViewProps> = ({
  uid,
  bookings,
  sharedSchedules,
  reservedSlots
}) => {
  const [selectedCourtId, setSelectedCourtId] = useState<CourtId>('court-1');

  const { currentSchedules, pendingSchedules } = useMemo(
    () => partitionActiveSchedules(sharedSchedules, bookings, reservedSlots, uid),
    [sharedSchedules, bookings, reservedSlots, uid]
  );

  const courtStats = useMemo(() => {
    const map: Record<CourtId, { current: CourtSchedule | null; pendingCount: number }> = {
      'court-1': { current: null, pendingCount: 0 },
      'court-2': { current: null, pendingCount: 0 }
    };

    currentSchedules.forEach((sch) => {
      if ((sch.courtId === 'court-1' || sch.courtId === 'court-2') && !map[sch.courtId].current) {
        map[sch.courtId].current = sch;
      }
    });

    pendingSchedules.forEach((sch) => {
      if (sch.courtId === 'court-1' || sch.courtId === 'court-2') {
        map[sch.courtId].pendingCount += 1;
      }
    });

    return map;
  }, [currentSchedules, pendingSchedules]);

  const selectedCourt = getCourtById(selectedCourtId);
  const selectedWayfinding = COURT_WAYFINDING[selectedCourtId];
  const selectedStatus = courtStats[selectedCourtId];

  return (
    <div className="space-y-6 sm:space-y-8 2xl:space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.15rem)] font-semibold tracking-tight text-slate-900">
            Soriano Facility Floor Plan
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Interactive layout of Court 1 and Court 2 at {CLUB_INFO.location}. Tap either court on
            the floor plan to inspect live match status, lighting specs, and walking directions from
            the main entrance.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 p-1 bg-pink-50 border border-pink-200/80 rounded-xl self-start"
          role="tablist"
          aria-label="Inspect court on floor plan"
        >
          {COURTS.map((court) => {
            const active = selectedCourtId === court.id;
            return (
              <button
                key={court.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCourtId(court.id)}
                className={`min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#BE185D] text-white shadow-xs'
                    : 'text-[#831843] hover:bg-white/70'
                }`}
              >
                {court.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Floor Plan + Selected Court Wayfinding Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Architectural SVG Floor Plan (7 cols) */}
        <section className="xl:col-span-7 surface-2026 rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium text-[#831843]">
              <Compass className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
              <span>Scale Blueprint · North Rear / Soriano Road South Frontage</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-500">
              {CLUB_INFO.operatingHours} PHT
            </span>
          </div>

          <div className="rounded-2xl border border-pink-200/80 bg-[#FFF9FB] p-3 sm:p-4 overflow-hidden">
            <svg
              viewBox="0 0 820 520"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Floor plan of Openline Court showing Main Entrance, Check-In Desk, Court 1 Indoor West Bay, Center Walkway, Court 2 Outdoor East Bay, and Restrooms"
              shapeRendering="geometricPrecision"
            >
              {/* Outer Facility Boundary */}
              <rect
                x="14"
                y="14"
                width="792"
                height="492"
                rx="22"
                fill="#FFFFFF"
                stroke="#FBCFE8"
                strokeWidth="2.5"
              />

              {/* Rear Zone: Restrooms & Gear Lockers (Top) */}
              <rect
                x="34"
                y="28"
                width="752"
                height="50"
                rx="10"
                fill="#FDF2F8"
                stroke="#F9A8D4"
                strokeWidth="1.25"
                strokeDasharray="6 4"
              />
              <text
                x="410"
                y="58"
                textAnchor="middle"
                fill="#831843"
                fontSize="13"
                fontWeight="600"
              >
                Rear Locker &amp; Restroom Corridor
              </text>

              {/* COURT 1 — West Indoor Bay (Interactive Group) */}
              <g
                onClick={() => setSelectedCourtId('court-1')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Select Court 1 on floor plan"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCourtId('court-1');
                  }
                }}
              >
                {/* Indoor Bay Enclosure */}
                <rect
                  x="34"
                  y="94"
                  width="320"
                  height="286"
                  rx="16"
                  fill={selectedCourtId === 'court-1' ? '#FDF2F8' : '#FFF9FB'}
                  stroke={selectedCourtId === 'court-1' ? '#BE185D' : '#F472B6'}
                  strokeWidth={selectedCourtId === 'court-1' ? '3' : '1.5'}
                />
                <text
                  x="194"
                  y="119"
                  textAnchor="middle"
                  fill="#831843"
                  fontSize="15"
                  fontWeight="700"
                >
                  COURT 1 · INDOOR BAY
                </text>

                {/* Pickleball Court Playing Surface */}
                <rect
                  x="84"
                  y="134"
                  width="220"
                  height="210"
                  rx="6"
                  fill="#BE185D"
                  fillOpacity={selectedCourtId === 'court-1' ? '0.94' : '0.82'}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                {/* Top & Bottom Service Courts */}
                <line x1="84" y1="205" x2="304" y2="205" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="84" y1="273" x2="304" y2="273" stroke="#FFFFFF" strokeWidth="2" />
                {/* Kitchen Centerlines */}
                <line x1="194" y1="134" x2="194" y2="205" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="194" y1="273" x2="194" y2="344" stroke="#FFFFFF" strokeWidth="2" />
                {/* Non-Volley Kitchen Tint */}
                <rect x="85" y="206" width="218" height="66" fill="#9D174D" fillOpacity="0.6" />
                {/* Net Line */}
                <line
                  x1="74"
                  y1="239"
                  x2="314"
                  y2="239"
                  stroke="#FCE7F3"
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />
                <text
                  x="194"
                  y="243"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="700"
                >
                  NET
                </text>
                <text
                  x="194"
                  y="366"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="12"
                  fontWeight="600"
                >
                  {courtStats['court-1'].current
                    ? `Active: ${formatHourRange(
                        courtStats['court-1'].current.startHour,
                        courtStats['court-1'].current.durationHours
                      )}`
                    : 'Open Now · ₱250/hr'}
                </text>
              </g>

              {/* Center Walkway & Spectator Bench */}
              <rect
                x="368"
                y="94"
                width="84"
                height="286"
                rx="12"
                fill="#FDF2F8"
                stroke="#FBCFE8"
                strokeWidth="1.5"
              />
              <text
                x="410"
                y="214"
                textAnchor="middle"
                fill="#831843"
                fontSize="12"
                fontWeight="700"
              >
                Center
              </text>
              <text
                x="410"
                y="231"
                textAnchor="middle"
                fill="#831843"
                fontSize="12"
                fontWeight="700"
              >
                Walkway
              </text>
              <text
                x="410"
                y="252"
                textAnchor="middle"
                fill="#64748B"
                fontSize="10.5"
                fontWeight="500"
              >
                Benches &amp;
              </text>
              <text
                x="410"
                y="266"
                textAnchor="middle"
                fill="#64748B"
                fontSize="10.5"
                fontWeight="500"
              >
                Hydration
              </text>

              {/* COURT 2 — East Outdoor Windscreen Bay (Interactive Group) */}
              <g
                onClick={() => setSelectedCourtId('court-2')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Select Court 2 on floor plan"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCourtId('court-2');
                  }
                }}
              >
                {/* Outdoor Windscreen Boundary */}
                <rect
                  x="466"
                  y="94"
                  width="320"
                  height="286"
                  rx="16"
                  fill={selectedCourtId === 'court-2' ? '#FDF2F8' : '#FFF9FB'}
                  stroke={selectedCourtId === 'court-2' ? '#BE185D' : '#F472B6'}
                  strokeWidth={selectedCourtId === 'court-2' ? '3' : '1.5'}
                  strokeDasharray={selectedCourtId === 'court-2' ? undefined : '8 4'}
                />
                <text
                  x="626"
                  y="119"
                  textAnchor="middle"
                  fill="#831843"
                  fontSize="15"
                  fontWeight="700"
                >
                  COURT 2 · OUTDOOR BAY
                </text>

                {/* Pickleball Court Playing Surface */}
                <rect
                  x="516"
                  y="134"
                  width="220"
                  height="210"
                  rx="6"
                  fill="#9D174D"
                  fillOpacity={selectedCourtId === 'court-2' ? '0.96' : '0.82'}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                <line x1="516" y1="205" x2="736" y2="205" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="516" y1="273" x2="736" y2="273" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="626" y1="134" x2="626" y2="205" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="626" y1="273" x2="626" y2="344" stroke="#FFFFFF" strokeWidth="2" />
                <rect x="517" y="206" width="218" height="66" fill="#831843" fillOpacity="0.58" />
                <line
                  x1="506"
                  y1="239"
                  x2="746"
                  y2="239"
                  stroke="#FCE7F3"
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />
                <text
                  x="626"
                  y="243"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="700"
                >
                  NET
                </text>
                <text
                  x="626"
                  y="366"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="12"
                  fontWeight="600"
                >
                  {courtStats['court-2'].current
                    ? `Active: ${formatHourRange(
                        courtStats['court-2'].current.startHour,
                        courtStats['court-2'].current.durationHours
                      )}`
                    : 'Open Now · ₱250/hr'}
                </text>
              </g>

              {/* Front Lobby, Watcher Desk & Soriano Road Entrance (Bottom) */}
              {/* Watcher / QR Check-in Desk */}
              <rect
                x="260"
                y="396"
                width="300"
                height="46"
                rx="12"
                fill="#831843"
              />
              <text
                x="410"
                y="423"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="13"
                fontWeight="700"
              >
                Watcher &amp; GCash QR Check-In Desk
              </text>

              {/* Parking & Entrance Strip */}
              <rect
                x="34"
                y="396"
                width="210"
                height="94"
                rx="12"
                fill="#F8FAFC"
                stroke="#E2E8F0"
                strokeWidth="1.5"
              />
              <text
                x="139"
                y="438"
                textAnchor="middle"
                fill="#334155"
                fontSize="12.5"
                fontWeight="600"
              >
                Motor &amp; Car Parking
              </text>
              <text
                x="139"
                y="456"
                textAnchor="middle"
                fill="#64748B"
                fontSize="11"
              >
                West Gate Drop-off
              </text>

              <rect
                x="576"
                y="396"
                width="210"
                height="94"
                rx="12"
                fill="#F8FAFC"
                stroke="#E2E8F0"
                strokeWidth="1.5"
              />
              <text
                x="681"
                y="438"
                textAnchor="middle"
                fill="#334155"
                fontSize="12.5"
                fontWeight="600"
              >
                Waiting Lounge
              </text>
              <text
                x="681"
                y="456"
                textAnchor="middle"
                fill="#64748B"
                fontSize="11"
              >
                Next Schedule Seating
              </text>

              {/* Soriano Main Entrance Gate */}
              <rect
                x="290"
                y="454"
                width="240"
                height="36"
                rx="10"
                fill="#FDF2F8"
                stroke="#BE185D"
                strokeWidth="1.5"
              />
              <text
                x="410"
                y="476"
                textAnchor="middle"
                fill="#BE185D"
                fontSize="12.5"
                fontWeight="700"
              >
                ▲ Main Entrance · Soriano Road
              </text>
            </svg>
          </div>
        </section>

        {/* Selected Court Wayfinding & Venue Details (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          <section className="surface-2026 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#BE185D]">
                  {selectedWayfinding.bayLabel}
                </p>
                <h2 className="mt-0.5 font-display text-xl font-semibold text-slate-900">
                  {selectedCourt.name}
                </h2>
              </div>
              <span className="font-mono text-base font-bold text-[#831843] tabular-nums shrink-0">
                {formatCurrency(selectedCourt.hourlyRate)}/hr
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span>{selectedCourt.surface}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedCourt.environment}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-[#BE185D]" aria-hidden="true" />
                {selectedCourt.lighting}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF6F9] border border-pink-200/80 space-y-1.5">
              <p className="text-xs font-semibold text-[#831843]">Live Court Availability</p>
              <p className="text-sm font-medium text-slate-900">
                {selectedStatus.current
                  ? `In session: ${formatHourRange(
                      selectedStatus.current.startHour,
                      selectedStatus.current.durationHours
                    )}`
                  : 'Currently open for immediate booking'}
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                {selectedStatus.pendingCount > 0
                  ? `${selectedStatus.pendingCount} turn${
                      selectedStatus.pendingCount > 1 ? 's' : ''
                    } waiting in Next Schedule`
                  : 'No queue waiting behind active slot'}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-900">Walk-In Route from Gate</p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {selectedWayfinding.entryPath}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                {selectedWayfinding.dimensions}
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-pink-100 text-xs text-slate-700">
              {selectedWayfinding.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#BE185D] font-bold" aria-hidden="true">
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-2026 rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Getting to Soriano, Cabadbaran City
            </h2>
            <p className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{CLUB_INFO.location}</span>
            </p>
            <p className="flex items-center gap-2.5 font-mono text-xs sm:text-sm text-slate-900 tabular-nums">
              <Clock className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
              <span>
                {CLUB_INFO.operatingHours} · {CLUB_INFO.timezoneLabel}
              </span>
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Accessible by tricycle, motorcycle, or private vehicle along Soriano Road. Message our
              official page if you need live landmark directions on arrival.
            </p>
            <div className="pt-2 border-t border-pink-100">
              <a
                href={CLUB_INFO.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Openline Court Facebook Page"
                className="w-full min-h-[44px] px-4 py-2.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#831843] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <FacebookLogo className="w-5 h-5 shrink-0" />
                <span>@openlinecourt</span>
                <ExternalLink className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* Facility Landmarks Directory */}
      <section className="surface-2026 rounded-3xl p-5 sm:p-7 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Facility Zones &amp; Check-In Flow
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Four key areas inside the Openline Court compound to help first-time players check in
            smoothly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {FACILITY_LANDMARKS.map((landmark, idx) => {
            const Icon = landmark.icon;
            return (
              <div
                key={landmark.id}
                className="p-4 rounded-2xl bg-[#FFF9FB] border border-pink-200/75 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#BE185D] tabular-nums">
                    0{idx + 1}
                  </span>
                  <Icon className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
                </div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {landmark.label}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">{landmark.detail}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
