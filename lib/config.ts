/**
 * Single source of truth for the conference calendar, pricing, contact, and
 * the payment authorization text. Everything else derives from this file.
 * Change a date here and the form, the cron, the emails, and the admin
 * dashboard all follow.
 */

export const CONFERENCE = {
  name: "One21 Conference",
  shortName: "One21 Conference",
  startsOn: "2027-02-27", // Saturday
} as const;

export const DATES = {
  /** Registration form goes live. */
  registrationOpens: "2026-07-01",

  /**
   * Last day an agent may CHOOSE the 3-payment plan.
   * Set so installment #3 clears with a 13-day buffer before the deadline.
   * After this date the form offers Pay in Full only. Enforced as a date
   * check, not by a human remembering.
   */
  installmentCutoff: "2026-11-15",

  installment2: "2026-12-16",
  installment3: "2027-01-15",

  /** Hard deadline. Paid in full or no seat. 30 days before the conference. */
  registrationDeadline: "2027-01-28",
} as const;

export const PRICING = {
  fullAmount: 690.0,
  installmentAmount: 230.0,
  installmentCount: 3, // 230 x 3 = 690. No premium for paying over time.
} as const;

/** ONE designated contact. Footer of every page, every email. */
export const CONTACT = {
  name: "Rebecca Williams",
  title: "Executive Assistant",
  /** How she is introduced to agents — by function, not by title. */
  role: "your single point of contact for conference registration",
  mobile: "214.446.2641",
  office: "214.920.9611",
  email: "rebeccawilliams@judgefite.com",
} as const;

/** What the fee covers. Stated affirmatively. Used verbatim across the app. */
export const INCLUSIONS = {
  covers: "Conference registration only.",
  notCovered:
    "Hotel, travel, and meals are booked and paid separately by each agent.",
} as const;

/** Dunning: retry a failed installment at these day-offsets from the due date. */
export const DUNNING = {
  retryDays: [3, 7],
  escalateAfterAttempts: 2, // Rebecca calls
  cancelAfterDays: 14, // cancel + release the seat
} as const;

/**
 * Office → Regional Sales Manager. Picking an office auto-fills the RSM on the
 * form, so agents can't mistype it. Single source of truth for both.
 */
export const OFFICE_RSM: Record<string, string> = {
  "Arlington Regional Office": "Jim Jackson",
  "Cedar Hill Regional Office": "Jon Buck",
  "Dallas - Bishop Arts": "Kevin Robinson",
  "Flower Mound/Irving Regional Office": "Brad Horak",
  "Fort Worth Regional Office": "Cassy Nutt",
  "Grand Prairie Regional Office": "Joe Picardo",
  "Southlake/Colleyville Regional Office": "Tim Gauntt",
  "Dallas - Lake Highlands Regional Office": "Betty DeVinney",
  "Decatur/Bridgeport Regional Office": "Allie Hendricks",
  "Denton Regional Office": "Lindsey Grissette",
  "Frisco/McKinney Regional Office": "Frances Cruz",
  "North Fort Worth - Alliance Regional Office": "Allie Hendricks",
  "Plano Regional Office": "Lynn Carlton",
  "Rockwall Regional Office": "Robert Kennedy",
  "Ennis Regional Office": "Carla Smith",
  "Granbury/Glen Rose Office": "Kristi Hiller",
  "Mansfield Regional Office": "Kris Johnson",
  "Midlothian Regional Office": "DeAnne Fite",
  "Springtown Regional Office": "Ragan Carr",
  "Waco Regional Office": "Mike Sims",
  "Waxahachie Regional Office": "Carla Smith",
  "Weatherford Regional Office": "Ragan Carr",
  "Choctaw/Harrah Regional Office": "Jennifer Grimes",
  "Edmond Regional Office": "Natalie Hardin",
  "Guthrie Regional Office": "Jennifer Grimes",
  "Norman Regional Office": "Amy Bladow",
  "CSC": "Ashley Conlon",
};

export const OFFICES = Object.keys(OFFICE_RSM);
// ---------------------------------------------------------------------------
// Payment authorization — stored verbatim in consents.consent_text.
// MUST match the Registration Packet word for word. If they drift, the
// chargeback defense weakens.
// ---------------------------------------------------------------------------

export const CONSENT_INSTALLMENT = `Installment payment authorization. I authorize CENTURY 21 Judge Fite Company to charge the card I have provided $230.00 today, $230.00 on December 16, 2026, and $230.00 on January 15, 2027, for a total of $690.00. I understand my registration is Reserved until my final payment clears, and is Confirmed only when the full $690.00 has been received. I understand my $690.00 covers conference registration only — hotel, travel, and meals are booked and paid separately by me. I understand that if a scheduled payment fails and is not cured within 14 days, my registration will be cancelled and my seat released.`;

export const CONSENT_FULL = `Payment authorization. I authorize CENTURY 21 Judge Fite Company to charge the card I have provided $690.00 today. I understand my $690.00 covers conference registration only — hotel, travel, and meals are booked and paid separately by me.`;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Is the 3-pay plan still available? This is the option-A guardrail. */
export function installmentsAvailable(asOf: string = today()): boolean {
  return asOf <= DATES.installmentCutoff;
}

export function registrationOpen(asOf: string = today()): boolean {
  return asOf >= DATES.registrationOpens && asOf <= DATES.registrationDeadline;
}

/** Due dates for a 3-pay plan started today. #1 is charged immediately. */
export function installmentSchedule(signupDate: string = today()): string[] {
  return [signupDate, DATES.installment2, DATES.installment3];
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function longDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
