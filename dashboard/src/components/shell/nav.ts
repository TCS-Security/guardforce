import {
  LayoutDashboard, MapPinned, Building2, Users, CalendarDays, ClipboardCheck, Footprints, ListChecks, Plane, BarChart3, Radio, Settings, Siren,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/live", label: "Live map", icon: MapPinned },
      { href: "/events", label: "Events", icon: Radio },
      { href: "/incidents", label: "Incidents", icon: Siren },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/sites", label: "Sites", icon: Building2 },
      { href: "/guards", label: "Guards", icon: Users },
      { href: "/roster", label: "Roster", icon: CalendarDays },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/patrols", label: "Patrols", icon: Footprints },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/leave", label: "Leave", icon: Plane },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
