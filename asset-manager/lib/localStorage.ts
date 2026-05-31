import { HistoryItem } from './csvParser';
import { MonthlyReport } from '@/hooks/useDashboard';

const KEYS = {
  HISTORY: 'asset_history',
  ARCHIVED: 'asset_archived_monthly',
  BALANCE: 'asset_balance',
  SAVINGS: 'asset_total_savings',
  TARGET: 'asset_target_savings',
  SALARY_DAY: 'asset_salary_day',
  WEEKLY_BUDGET: 'asset_weekly_budget',
  FIXED_COSTS: 'asset_fixed_costs',
  RAKUTEN_FIXED_COSTS: 'asset_rakuten_fixed_costs',
  MONTHLY_INCOME: 'asset_monthly_income',
  VARIABLE_BUDGET: 'asset_variable_budget',
  TRAVEL_EXPENSES: 'asset_travel_expenses',       // 今月の旅行費履歴
  LAST_WEEK_RESET: 'asset_last_week_reset',
  LAST_RAKUTEN_CHARGE: 'asset_last_rakuten_charge',
  LAST_TRAVEL_RESET: 'asset_last_travel_reset',   // 旅行費リセット日
  SCHEMA_VERSION: 'asset_schema_version',
} as const;

const SCHEMA_VERSION = '1.2';
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

const toDate = (dateStr: string): Date =>
  new Date(dateStr.replace(/\//g, '-'));

export const compressOldHistory = (
  history: HistoryItem[],
  existingArchives: MonthlyReport[]
): { activeHistory: HistoryItem[]; archives: MonthlyReport[] } => {
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS);
  const activeHistory = history.filter(h => toDate(h.date) >= cutoff);
  const oldHistory = history.filter(h => toDate(h.date) < cutoff);
  if (oldHistory.length === 0) return { activeHistory, archives: existingArchives };

  const monthMap: Record<string, { spent: number; saved: number }> = {};
  oldHistory.forEach(h => {
    const d = toDate(h.date);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}期`;
    if (!monthMap[key]) monthMap[key] = { spent: 0, saved: 0 };
    monthMap[key].spent += h.amount;
  });

  const archiveMap: Record<string, MonthlyReport> = {};
  existingArchives.forEach(a => { archiveMap[a.month] = a; });
  Object.entries(monthMap).forEach(([month, data]) => {
    archiveMap[month] = archiveMap[month]
      ? { ...archiveMap[month], spent: archiveMap[month].spent + data.spent }
      : { month, spent: data.spent, saved: data.saved };
  });

  return {
    activeHistory,
    archives: Object.values(archiveMap).sort((a, b) => a.month.localeCompare(b.month)),
  };
};

export const saveHistory = (history: HistoryItem[], archives: MonthlyReport[]) => {
  try {
    const { activeHistory, archives: newArchives } = compressOldHistory(history, archives);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(activeHistory));
    localStorage.setItem(KEYS.ARCHIVED, JSON.stringify(newArchives));
    return { activeHistory, archives: newArchives };
  } catch (e) {
    console.error(e);
    return { activeHistory: history, archives };
  }
};

// 個別セーバー
export const saveBalance         = (v: number)  => { try { localStorage.setItem(KEYS.BALANCE, String(v)); } catch(e){} };
export const saveTotalSavings    = (v: number)  => { try { localStorage.setItem(KEYS.SAVINGS, String(v)); } catch(e){} };
export const saveTargetSavings   = (v: number)  => { try { localStorage.setItem(KEYS.TARGET, String(v)); } catch(e){} };
export const saveSalaryDay       = (v: number)  => { try { localStorage.setItem(KEYS.SALARY_DAY, String(v)); } catch(e){} };
export const saveWeeklyBudget    = (v: number)  => { try { localStorage.setItem(KEYS.WEEKLY_BUDGET, String(v)); } catch(e){} };
export const saveFixedCosts      = (v: unknown) => { try { localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(v)); } catch(e){} };
export const saveRakutenFixedCosts = (v: unknown) => { try { localStorage.setItem(KEYS.RAKUTEN_FIXED_COSTS, JSON.stringify(v)); } catch(e){} };
export const saveMonthlyIncome   = (v: number)  => { try { localStorage.setItem(KEYS.MONTHLY_INCOME, String(v)); } catch(e){} };
export const saveVariableBudget  = (v: number)  => { try { localStorage.setItem(KEYS.VARIABLE_BUDGET, String(v)); } catch(e){} };
export const saveTravelExpenses  = (v: unknown) => { try { localStorage.setItem(KEYS.TRAVEL_EXPENSES, JSON.stringify(v)); } catch(e){} };
export const saveLastWeekReset   = (v: string)  => { try { localStorage.setItem(KEYS.LAST_WEEK_RESET, v); } catch(e){} };
export const saveLastRakutenCharge = (v: string) => { try { localStorage.setItem(KEYS.LAST_RAKUTEN_CHARGE, v); } catch(e){} };
export const saveLastTravelReset = (v: string)  => { try { localStorage.setItem(KEYS.LAST_TRAVEL_RESET, v); } catch(e){} };

export const loadAll = () => {
  try {
    const version = localStorage.getItem(KEYS.SCHEMA_VERSION);
    if (version !== SCHEMA_VERSION) localStorage.setItem(KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
    return {
      history:           JSON.parse(localStorage.getItem(KEYS.HISTORY)   || '[]') as HistoryItem[],
      archives:          JSON.parse(localStorage.getItem(KEYS.ARCHIVED)  || '[]') as MonthlyReport[],
      balance:           Number(localStorage.getItem(KEYS.BALANCE)       ?? 15000),
      totalSavings:      Number(localStorage.getItem(KEYS.SAVINGS)       ?? 0),
      targetSavings:     Number(localStorage.getItem(KEYS.TARGET)        ?? 2000000),
      salaryDay:         Number(localStorage.getItem(KEYS.SALARY_DAY)    ?? 25),
      weeklyBudget:      Number(localStorage.getItem(KEYS.WEEKLY_BUDGET) ?? 15000),
      fixedCosts:        JSON.parse(localStorage.getItem(KEYS.FIXED_COSTS)         || 'null'),
      rakutenFixedCosts: JSON.parse(localStorage.getItem(KEYS.RAKUTEN_FIXED_COSTS) || 'null'),
      monthlyIncome:     Number(localStorage.getItem(KEYS.MONTHLY_INCOME)  ?? 0),
      variableBudget:    Number(localStorage.getItem(KEYS.VARIABLE_BUDGET) ?? 120000),
      travelExpenses:    JSON.parse(localStorage.getItem(KEYS.TRAVEL_EXPENSES) || '[]') as HistoryItem[],
      lastWeekReset:     localStorage.getItem(KEYS.LAST_WEEK_RESET)     || null,
      lastRakutenCharge: localStorage.getItem(KEYS.LAST_RAKUTEN_CHARGE) || null,
      lastTravelReset:   localStorage.getItem(KEYS.LAST_TRAVEL_RESET)   || null,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getStorageUsageKB = (): number => {
  let total = 0;
  Object.values(KEYS).forEach(key => {
    const val = localStorage.getItem(key);
    if (val) total += new Blob([val]).size;
  });
  return Math.round(total / 1024);
};