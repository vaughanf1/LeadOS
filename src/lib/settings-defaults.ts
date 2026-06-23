// Default editable settings — written on first seed; admin can override via UI.

export type ScoringThresholds = {
  highMin: number;
  midMin: number;
  ageBands: { min: number; max: number; points: number }[];
  mortgageBands: { maxPounds: number; points: number }[];
  urgencyPoints: Record<string, number>;
  propertyValueBands: { minPounds: number; points: number }[];
};

export type WorkingHours = {
  startHHmm: string;        // "09:00"
  endHHmm: string;          // "17:00"
  morningReleaseHHmm: string; // "08:30"
  timeZone: string;         // "Europe/London"
};

export type AfterHoursConfig = {
  mode: "CRAIG" | "HOLD" | "AI_CHATBOT";
  aiAfterHoursEnabled: boolean;
};

export type SettingsMap = {
  "scoring.thresholds": ScoringThresholds;
  "hours.working": WorkingHours;
  "afterHours.config": AfterHoursConfig;
};
export type SettingsKey = keyof SettingsMap;

export const DEFAULT_SETTINGS: SettingsMap = {
  "scoring.thresholds": {
    highMin: 70,
    midMin: 40,
    ageBands: [
      { min: 75, max: 200, points: 30 },
      { min: 65, max: 74, points: 25 },
      { min: 60, max: 64, points: 15 },
      { min: 55, max: 59, points: 5 },
      { min: 0, max: 54, points: -30 },
    ],
    mortgageBands: [
      { maxPounds: 15_000, points: 30 },
      { maxPounds: 50_000, points: 20 },
      { maxPounds: 100_000, points: 5 },
      { maxPounds: 150_000, points: -10 },
      { maxPounds: Number.MAX_SAFE_INTEGER, points: -25 },
    ],
    urgencyPoints: {
      immediately: 30,
      "1-3 months": 25,
      "3-6 months": 10,
      "just researching": -10,
      "no urgency": -15,
      unsure: -15,
    },
    propertyValueBands: [
      { minPounds: 500_000, points: 20 },
      { minPounds: 300_000, points: 15 },
      { minPounds: 200_000, points: 10 },
      { minPounds: 0, points: -10 },
    ],
  },

  "hours.working": {
    startHHmm: "09:00",
    endHHmm: "17:00",
    // Held leads release at business open so they land with on-shift advisers
    // rather than being re-held for being "out of hours".
    morningReleaseHHmm: "09:00",
    timeZone: "Europe/London",
  },

  "afterHours.config": {
    // Out-of-hours leads wait for the morning release instead of being forwarded.
    mode: "HOLD",
    aiAfterHoursEnabled: false,
  },
};
