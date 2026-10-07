import {
  LayoutDashboard, MapPinned, Building2, Users, CalendarDays, ClipboardCheck, Footprints, ListChecks, Plane, BarChart3, Radio, Settings, Siren,
  BellRing, OctagonAlert, ScrollText, ArrowRightLeft, Timer, Wallet, NotebookPen, Send,
  type LucideIcon,
} from "lucide-react";

/** `preview`: the screen runs on sample data until its tables ship; the sidebar marks it. */
export type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean; preview?: boolean };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/live", label: "Live map", icon: MapPinned },
      { href: "/events", label: "Events", icon: Radio },
      { href: "/incidents", label: "Incidents", icon: Siren },
      { href: "/sos", label: "SOS", icon: OctagonAlert, preview: true },
      { href: "/alertness", label: "Alertness checks", icon: BellRing, preview: true },
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
      { href: "/post-orders", label: "Post orders", icon: ScrollText, preview: true },
      { href: "/handover", label: "Handover", icon: ArrowRightLeft, preview: true },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/overtime", label: "Overtime", icon: Timer, preview: true },
      { href: "/payroll", label: "Payroll", icon: Wallet, preview: true },
      { href: "/cashbook", label: "Cashbook", icon: NotebookPen, preview: true },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/client-reports", label: "Client reports", icon: Send, preview: true },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
