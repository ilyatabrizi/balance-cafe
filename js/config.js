// Everything about the business that isn't code. One place to edit.

export const BUSINESS = {
  name: "Balance",
  legal: "Balance Café",
  city: "Tabriz",
  district: "Roshdieh",
  address: "Roshdieh, Tabriz, East Azerbaijan",
  tagline: "Life is all about you",
  instagram: "balancecafe",
  instagramUrl: "https://instagram.com/balancecafe",
  phone: "",                       // fill in when the client confirms it
  // Roshdieh town centre — good enough to open the right neighbourhood in Maps.
  geo: { lat: 38.1069, lng: 46.3419 },
  currency: "T",                   // Toman
  // 0 = Sunday. Local time, 24h.
  hours: {
    0: ["08:00", "23:30"], 1: ["08:00", "23:30"], 2: ["08:00", "23:30"],
    3: ["08:00", "23:30"], 4: ["08:00", "23:30"], 5: ["08:00", "24:00"],
    6: ["08:00", "24:00"],
  },
  kitchenLastOrder: "22:30",
};

export const ORDER = {
  // Minutes the bar needs before a pickup slot is realistic.
  leadMinutes: 12,
  slotStepMinutes: 15,
  slotCount: 8,
  maxPerLine: 10,
  tables: ["1", "2", "3", "4", "5", "6", "7", "8", "Bar 1", "Bar 2", "Bar 3", "Terrace"],
};

export const CHECKIN = {
  // A check-in expires on its own so nobody is left showing as present overnight.
  expireHours: 3,
  // Presence is device-local until an endpoint is set. See README → Check-in.
  // Point this at a REST endpoint and the app switches to shared presence with
  // no other change. Never commit a key here.
  endpoint: "",
  // Populates the room with plausible regulars so the feature can be judged on
  // a single phone. Set false the moment the endpoint above is live.
  demoPresence: true,
  tags: ["Just coffee", "Working", "Meeting", "Reading", "With friends"],
};

export const STORAGE_PREFIX = "balance.v1.";
