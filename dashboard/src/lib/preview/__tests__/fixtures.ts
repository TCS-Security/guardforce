import type { Crew } from "../crew";

export const crew: Crew = {
  today: "2026-10-08",
  sites: [
    { id: "s1", name: "Prestige Tech Park", client_name: "Prestige Group", city: "Bengaluru", guards_required: 4 },
    { id: "s2", name: "Orion Mall", client_name: "Brigade", city: "Bengaluru", guards_required: 3 },
  ],
  guards: Array.from({ length: 12 }, (_, i) => ({
    id: `g${i}`,
    full_name: `Guard ${i}`,
    employee_code: i === 0 ? null : `SG-${100 + i}`,
    phone: `99000000${String(i).padStart(2, "0")}`,
    site_id: i % 2 ? "s1" : "s2",
    site_name: i % 2 ? "Prestige Tech Park" : "Orion Mall",
  })),
};
