export type LineKind = "subscription" | "api" | "other";
export type LineSource = "hand" | "cost_api" | "ccusage_estimate" | "receipt" | "inbox";
export type LineCategory = "work" | "personal" | "billable";
export type ThemeName = "light" | "dark";
export type { Locale } from "./i18n/locales";

export type DailyUsd = {
  date: string;
  usd: number;
};

export type Line = {
  id: string;
  name: string;
  kind: LineKind;
  /** 计入合计时用。估算行必须为 0 或 includedInTotal=false */
  amountCny: number;
  amountUsd?: number;
  fxRate?: number;
  fxDate?: string;
  source: LineSource;
  includedInTotal: boolean;
  chargeDay?: number;
  note?: string;
  dailyUsd?: DailyUsd[];
  category?: LineCategory;
};

export type QuotaWindow = {
  label: string;
  percent?: number;
  remaining?: string;
  endsAt?: string;
  source: "ccusage" | "hand";
};

export type FxQuote = {
  rate: number;
  date: string;
};

export type Ledger = {
  totalCny: number;
  lines: Line[];
  window: QuotaWindow | null;
  fx: FxQuote | null;
  extrapolation: {
    cny: number;
    daysUsed: number;
    daysLeft: number;
  } | null;
  monthProjection: {
    cny: number;
    daysUsed: number;
    daysLeft: number;
  } | null;
};

export type UserSettings = {
  budgetCny: number | null;
  emailEnabled: boolean;
  plan: "free" | "pro";
  theme: ThemeName;
  cycleStartDay: number;
  locale: import("./i18n/locales").Locale;
};

export type UpcomingCharge = {
  name: string;
  amountCny: number;
  chargeDay: number;
  daysUntil: number;
  due: boolean;
};

export type BudgetStatus = {
  budgetCny: number;
  spentCny: number;
  remainingCny: number;
  ratio: number;
  over: boolean;
  weekOver: boolean;
  daysToEmpty: number | null;
};

export type MonthSnapshot = {
  id: string;
  month: string;
  totalCny: number;
  subscriptionCny: number;
  apiCny: number;
  otherCny: number;
  statement: string;
  createdAt: string;
};
