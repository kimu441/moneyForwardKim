// src/lib/localStorage.ts

import { HistoryItem } from './csvParser';
import { MonthlyReport } from '@/hooks/useDashboard';

const KEYS = {
  HISTORY: 'asset_history',
  ARCHIVED: 'asset_archived_monthly', // 圧縮済み月次データ
  BALANCE: 'asset_balance',
  SAVINGS: 'asset_total_savings',
  TARGET: 'asset_target_savings',
  SALARY_DAY: 'asset_salary_day',
  FIXED_COSTS: 'asset_fixed_costs',
  LAST_WEEK_RESET: 'asset_last_week_reset',
  SCHEMA_VERSION: 'asset_schema_version',
} as const;

const SCHEMA_VERSION = '1.0';
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

// 日付文字列をDateに安全に変換
const toDate = (dateStr: string): Date => {
  return new Date(dateStr.replace(/\//g, '-'));
};

/**
 * 直近6ヶ月より古い履歴を月次集計に圧縮してアーカイブする
 * 戻り値: 圧縮後の「直近6ヶ月以内」の履歴のみ
 */
export const compressOldHistory = (
  history: HistoryItem[],
  existingArchives: MonthlyReport[]
): { activeHistory: HistoryItem[]; archives: MonthlyReport[] } => {
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS);

  const activeHistory = history.filter(h => toDate(h.date) >= cutoff);
  const oldHistory = history.filter(h => toDate(h.date) < cutoff);

  if (oldHistory.length === 0) {
    return { activeHistory, archives: existingArchives };
  }

  // 古い履歴を月ごとにグループ化して集計
  const monthMap: Record<string, { spent: number; saved: number }> = {};
  oldHistory.forEach(h => {
    const d = toDate(h.date);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}期`;
    if (!monthMap[key]) monthMap[key] = { spent: 0, saved: 0 };
    monthMap[key].spent += h.amount;
  });

  // 既存アーカイブとマージ（同月があれば上書きせず加算）
  const archiveMap: Record<string, MonthlyReport> = {};
  existingArchives.forEach(a => { archiveMap[a.month] = a; });
  Object.entries(monthMap).forEach(([month, data]) => {
    if (archiveMap[month]) {
      archiveMap[month].spent += data.spent;
    } else {
      archiveMap[month] = { month, spent: data.spent, saved: data.saved };
    }
  });

  const archives = Object.values(archiveMap).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  console.log(`📦 ${oldHistory.length}件の古い履歴を${Object.keys(monthMap).length}ヶ月分に圧縮しました`);

  return { activeHistory, archives };
};

// ---- 保存関数 ----

export const saveHistory = (history: HistoryItem[], archives: MonthlyReport[]) => {
  try {
    const { activeHistory, archives: newArchives } = compressOldHistory(history, archives);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(activeHistory));
    localStorage.setItem(KEYS.ARCHIVED, JSON.stringify(newArchives));
    return { activeHistory, archives: newArchives };
  } catch (e) {
    console.error('履歴の保存に失敗:', e);
    return { activeHistory: history, archives };
  }
};

export const saveBalance = (balance: number) => {
  try { localStorage.setItem(KEYS.BALANCE, String(balance)); } catch (e) { console.error(e); }
};

export const saveTotalSavings = (savings: number) => {
  try { localStorage.setItem(KEYS.SAVINGS, String(savings)); } catch (e) { console.error(e); }
};

export const saveTargetSavings = (target: number) => {
  try { localStorage.setItem(KEYS.TARGET, String(target)); } catch (e) { console.error(e); }
};

export const saveSalaryDay = (day: number) => {
  try { localStorage.setItem(KEYS.SALARY_DAY, String(day)); } catch (e) { console.error(e); }
};

export const saveFixedCosts = (costs: unknown) => {
  try { localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs)); } catch (e) { console.error(e); }
};

export const saveLastWeekReset = (dateStr: string) => {
  try { localStorage.setItem(KEYS.LAST_WEEK_RESET, dateStr); } catch (e) { console.error(e); }
};

// ---- 読み込み関数 ----

export const loadAll = () => {
  try {
    // スキーマバージョンチェック（将来の破壊的変更対策）
    const version = localStorage.getItem(KEYS.SCHEMA_VERSION);
    if (version !== SCHEMA_VERSION) {
      localStorage.setItem(KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
    }

    return {
      history: JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]') as HistoryItem[],
      archives: JSON.parse(localStorage.getItem(KEYS.ARCHIVED) || '[]') as MonthlyReport[],
      balance: Number(localStorage.getItem(KEYS.BALANCE) ?? 30000),
      totalSavings: Number(localStorage.getItem(KEYS.SAVINGS) ?? 0),
      targetSavings: Number(localStorage.getItem(KEYS.TARGET) ?? 2000000),
      salaryDay: Number(localStorage.getItem(KEYS.SALARY_DAY) ?? 25),
      fixedCosts: JSON.parse(localStorage.getItem(KEYS.FIXED_COSTS) || 'null'),
      lastWeekReset: localStorage.getItem(KEYS.LAST_WEEK_RESET) || null,
    };
  } catch (e) {
    console.error('LocalStorageの読み込みに失敗:', e);
    return null;
  }
};

// LocalStorageの使用量をKB単位で返す
export const getStorageUsageKB = (): number => {
  let total = 0;
  Object.values(KEYS).forEach(key => {
    const val = localStorage.getItem(key);
    if (val) total += new Blob([val]).size;
  });
  return Math.round(total / 1024);
};