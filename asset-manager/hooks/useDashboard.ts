'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { parsePayPayCSV, HistoryItem, Category } from '@/lib/csvParser';
import {
  loadAll, saveHistory, saveBalance, saveTotalSavings,
  saveTargetSavings, saveSalaryDay, saveWeeklyBudget, saveFixedCosts,
  saveRakutenFixedCosts, saveMonthlyIncome, saveVariableBudget,
  saveTravelExpenses, saveLastWeekReset, saveLastRakutenCharge,
  saveLastTravelReset, getStorageUsageKB,
} from '@/lib/localStorage';

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface RakutenFixedCostItem {
  id: string;
  name: string;
  amount: number;
  category: Category;
}

export interface MinedCandidate {
  normalizedName: string;
  averageAmount: number;
  typicalDay: number;
  isConstantAmount: boolean;
  appearances: string[];
}

export interface MonthlyReport {
  month: string;
  spent: number;
  saved: number;
}

// 指定日が含まれる週の月曜〜日曜を返す
export const getWeekRange = (baseDate: Date): { start: Date; end: Date } => {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0=日
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const formatDate = (d: Date): string =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

const toDate = (s: string) => new Date(s.replace(/\//g, '-'));

const DEFAULT_RAKUTEN_FIXED: RakutenFixedCostItem[] = [
  { id: 'rf-1', name: '家賃・住宅', amount: 65000, category: 'その他' },
  { id: 'rf-2', name: '通信費',     amount: 9800,  category: 'その他' },
];

export function useDashboard() {
  const CATEGORIES: Category[] = [ 
    '生活費','食費', '日用品', '交通費', '旅行費', '株',
    '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他',
  ];

  // ---- UI State ----
  const [isMounted,          setIsMounted]          = useState(false);
  const [activeTab,          setActiveTab]          = useState<'dashboard'|'analytics'|'settings'>('dashboard');
  const [graphType,          setGraphType]          = useState<'week'|'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'mining'|'target'|'fixed'|'rakuten'|'income'|'travel'|null>(null);
  const [showPromptModal,    setShowPromptModal]    = useState(false);
  const [storageUsageKB,     setStorageUsageKB]     = useState(0);
  // 週ナビ: 0=今週, -1=先週, 1=来週
  const [weekOffset, setWeekOffset] = useState(0);

  // ---- Data State ----
  const [history,            setHistory]            = useState<HistoryItem[]>([]);
  const [archivedReports,    setArchivedReports]    = useState<MonthlyReport[]>([]);
  const [balance,            setBalance]            = useState(15000);
  const [totalSavings,       setTotalSavings]       = useState(0);
  const [targetSavings,      setTargetSavings]      = useState(2000000);
  const [salaryDay,          setSalaryDay]          = useState(25);
  const [weeklyBudget,       setWeeklyBudget]       = useState(15000);
  const [fixedCosts,         setFixedCosts]         = useState<FixedCostItem[]>([]);
  const [rakutenFixedCosts,  setRakutenFixedCosts]  = useState<RakutenFixedCostItem[]>(DEFAULT_RAKUTEN_FIXED);
  const [monthlyIncome,      setMonthlyIncome]      = useState(0);
  const [variableBudget,     setVariableBudget]     = useState(120000);
  // 旅行費（今月分のみ・24日リセット）
  const [travelExpenses,     setTravelExpenses]     = useState<HistoryItem[]>([]);
  const [minedCandidates,    setMinedCandidates]    = useState<MinedCandidate[]>([]);

  // ---- フォーム State ----
  const [amount,             setAmount]             = useState('');
  const [category,           setCategory]           = useState<Category>('食費');
  const [travelAmount,       setTravelAmount]       = useState('');
  const [travelName,         setTravelName]         = useState('');
  const [newFixedName,       setNewFixedName]       = useState('');
  const [newFixedAmount,     setNewFixedAmount]     = useState('');
  const [newRakutenName,     setNewRakutenName]     = useState('');
  const [newRakutenAmount,   setNewRakutenAmount]   = useState('');
  const [newRakutenCategory, setNewRakutenCategory] = useState<Category>('その他');

  // ---- 初期化 ----
  useEffect(() => {
    const saved = loadAll();
    if (saved) {
      setHistory(saved.history);
      setArchivedReports(saved.archives);
      setBalance(isNaN(saved.balance) ? 15000 : saved.balance);
      setTotalSavings(isNaN(saved.totalSavings) ? 0 : saved.totalSavings);
      setTargetSavings(isNaN(saved.targetSavings) ? 2000000 : saved.targetSavings);
      setSalaryDay(isNaN(saved.salaryDay) ? 25 : saved.salaryDay);
      setWeeklyBudget(isNaN(saved.weeklyBudget) ? 15000 : saved.weeklyBudget);
      if (saved.fixedCosts) setFixedCosts(saved.fixedCosts);
      if (saved.rakutenFixedCosts) setRakutenFixedCosts(saved.rakutenFixedCosts);
      if (!isNaN(saved.monthlyIncome)) setMonthlyIncome(saved.monthlyIncome);
      if (!isNaN(saved.variableBudget)) setVariableBudget(saved.variableBudget);
      setTravelExpenses(saved.travelExpenses || []);

      checkWeeklyAutoReset(saved.lastWeekReset, isNaN(saved.weeklyBudget) ? 15000 : saved.weeklyBudget);
      checkRakutenMonthlyCharge(saved.lastRakutenCharge, saved.rakutenFixedCosts ?? DEFAULT_RAKUTEN_FIXED, saved.history);
      checkTravelReset(saved.lastTravelReset);
    }
    setStorageUsageKB(getStorageUsageKB());
    setIsMounted(true);
  }, []);

  // ---- 週次自動リセット（毎週月曜 → weeklyBudgetにリセット）----
  // 【仕組み解説】
  // lastWeekResetに「前回リセットした日時」を保存。
  // 今週の月曜0:00と比較し、lastWeekResetがそれより古ければ今週未リセットと判断してリセット。
  const checkWeeklyAutoReset = (lastReset: string | null, budget: number) => {
    const { start: thisMonday } = getWeekRange(new Date());
    if (!lastReset || new Date(lastReset) < thisMonday) {
      setBalance(budget);
      saveBalance(budget);
      saveLastWeekReset(new Date().toISOString());
      console.log('📅 週次予算を自動リセットしました（¥' + budget + '）');
    }
  };

  // ---- 楽天固定費 月次自動計上（毎月25日）----
  const checkRakutenMonthlyCharge = (
    lastCharge: string | null,
    costs: RakutenFixedCostItem[],
    currentHistory: HistoryItem[]
  ) => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (lastCharge?.startsWith(thisMonthKey)) return;
    if (now.getDate() < 25) return;

    const chargeDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/25`;
    const newItems: HistoryItem[] = costs.map(c => ({
      id: `rakuten-monthly-${c.id}-${thisMonthKey}`,
      date: chargeDate,
      name: `💳 ${c.name}`,
      amount: c.amount,
      category: c.category,
    })).filter(item => !currentHistory.some(h => h.id === item.id));

    if (newItems.length === 0) return;
    const newHistory = [...newItems, ...currentHistory];
    setHistory(newHistory);
    saveHistory(newHistory, []);
    saveLastRakutenCharge(thisMonthKey);
  };

  // ---- 旅行費 毎月24日リセット ----
  const checkTravelReset = (lastReset: string | null) => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (lastReset?.startsWith(thisMonthKey)) return;
    if (now.getDate() < 24) return;
    // 24日以降で今月まだリセットしていなければ旅行費を0に
    setTravelExpenses([]);
    saveTravelExpenses([]);
    saveLastTravelReset(thisMonthKey);
    console.log('✈️ 旅行費を月次リセットしました');
  };

  // ---- 週ナビ計算 ----
  const viewingWeek = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const { start, end } = getWeekRange(base);
    const label = `${String(start.getMonth() + 1)}/${String(start.getDate())}（月）〜${String(end.getMonth() + 1)}/${String(end.getDate())}（日）`;
    return { start, end, label, isCurrentWeek: weekOffset === 0 };
  }, [weekOffset]);

  // ---- 表示中の週の変動費（楽天・旅行費を除く）----
  const viewingWeekVariable = useMemo(() => {
    return history.filter(h => {
      if (h.id.startsWith('rakuten-monthly-')) return false;
      const d = toDate(h.date);
      return d >= viewingWeek.start && d <= viewingWeek.end;
    });
  }, [history, viewingWeek]);

  const viewingWeekSpent = useMemo(() =>
    viewingWeekVariable.reduce((s, h) => s + h.amount, 0),
    [viewingWeekVariable]
  );

  // 来週の残金（予算 - 来週分のすでに記録された支出）
  const nextWeekBalance = useMemo(() => {
    if (weekOffset !== 0) return null;
    const base = new Date();
    base.setDate(base.getDate() + 7);
    const { start, end } = getWeekRange(base);
    const nextSpent = history.filter(h => {
      if (h.id.startsWith('rakuten-monthly-')) return false;
      const d = toDate(h.date);
      return d >= start && d <= end;
    }).reduce((s, h) => s + h.amount, 0);
    return weeklyBudget - nextSpent;
  }, [history, weeklyBudget, weekOffset]);

  // ---- 給料日サイクル ----
  const currentCycle = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const salaryDate = new Date(year, month, salaryDay);
    const start = now >= salaryDate ? salaryDate : new Date(year, month - 1, salaryDay);
    const label = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}期`;
    return { start, label };
  }, [salaryDay]);

  // ---- 今月の旅行費合計 ----
  const travelTotal = useMemo(() =>
    travelExpenses.reduce((s, t) => s + t.amount, 0),
    [travelExpenses]
  );

  // ---- 月次収支計算 ----
  const monthlySummary = useMemo(() => {
    const rakutenTotal = rakutenFixedCosts.reduce((s, c) => s + c.amount, 0);
    const plannedSavings = Math.max(0, monthlyIncome - rakutenTotal - variableBudget - travelTotal);
    const actualVariable = history.filter(h =>
      !h.id.startsWith('rakuten-monthly-') &&
      toDate(h.date) >= currentCycle.start
    ).reduce((s, h) => s + h.amount, 0);
    const variableProgress = variableBudget > 0
      ? Math.min(100, Math.round((actualVariable / variableBudget) * 100)) : 0;
    return {
      rakutenTotal,
      plannedSavings,
      actualVariable,
      variableProgress,
      variableRemaining: Math.max(0, variableBudget - actualVariable),
      variableOver: actualVariable > variableBudget,
    };
  }, [rakutenFixedCosts, monthlyIncome, variableBudget, travelTotal, history, currentCycle.start]);

  // ---- 月次レポート ----
  const monthlyReports: MonthlyReport[] = useMemo(() => {
    const currentSpent = history
      .filter(h => !h.id.startsWith('rakuten-monthly-') && toDate(h.date) >= currentCycle.start)
      .reduce((s, h) => s + h.amount, 0);
    const current: MonthlyReport = { month: currentCycle.label, spent: currentSpent, saved: totalSavings };
    return [...archivedReports, current].slice(-6);
  }, [history, archivedReports, currentCycle, totalSavings]);

  // ---- 週次分析データ（詳細分析タブ用）----
  const weeklyAnalytics = useMemo(() => {
    // 直近8週分の週ごとの変動費集計
    const weeks: { label: string; spent: number; budget: number; rate: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const base = new Date();
      base.setDate(base.getDate() - i * 7);
      const { start, end } = getWeekRange(base);
      const spent = history.filter(h => {
        if (h.id.startsWith('rakuten-monthly-')) return false;
        const d = toDate(h.date);
        return d >= start && d <= end;
      }).reduce((s, h) => s + h.amount, 0);
      weeks.push({
        label: `${String(start.getMonth() + 1)}/${String(start.getDate())}週`,
        spent,
        budget: weeklyBudget,
        rate: weeklyBudget > 0 ? Math.round((spent / weeklyBudget) * 100) : 0,
      });
    }
    return weeks;
  }, [history, weeklyBudget]);

  // ---- 永続化ヘルパー ----
  const persistHistory = useCallback((newHistory: HistoryItem[]) => {
    const { activeHistory, archives } = saveHistory(newHistory, archivedReports);
    if (activeHistory.length !== newHistory.length) {
      setHistory(activeHistory);
      setArchivedReports(archives);
    }
    setStorageUsageKB(getStorageUsageKB());
  }, [archivedReports]);

  // ---- アクション ----

  // 変動費 手動入力（現金タグ付き）
  const handleSpend = () => {
    const parsed = parseInt(amount, 10);
    if (isNaN(parsed) || parsed <= 0) return;
    const now = new Date();
    const newLog: HistoryItem = {
      id: `manual-cash-${Date.now()}`,
      date: formatDate(now),
      name: `💴 現金支出`,
      amount: parsed,
      category,
    };
    const newHistory = [newLog, ...history];
    const newBalance = balance - parsed;
    setHistory(newHistory);
    setBalance(newBalance);
    setAmount('');
    persistHistory(newHistory);
    saveBalance(newBalance);
  };

  // 旅行費 手動入力（変動費・週予算と完全別管理）
  const handleTravelSpend = () => {
    const parsed = parseInt(travelAmount, 10);
    if (isNaN(parsed) || parsed <= 0) return;
    const now = new Date();
    const newItem: HistoryItem = {
      id: `travel-${Date.now()}`,
      date: formatDate(now),
      name: travelName || '旅行支出',
      amount: parsed,
      category: '旅行費',
    };
    const newTravel = [newItem, ...travelExpenses];
    setTravelExpenses(newTravel);
    saveTravelExpenses(newTravel);
    setTravelAmount('');
    setTravelName('');
  };

  // 旅行費削除
  const deleteTravelExpense = (id: string) => {
    const newTravel = travelExpenses.filter(t => t.id !== id);
    setTravelExpenses(newTravel);
    saveTravelExpenses(newTravel);
  };

  const deleteHistory = (id: string) => {
    const item = history.find(h => h.id === id);
    if (!item) return;
    const newHistory = history.filter(h => h.id !== id);
    const newBalance = balance + item.amount;
    setHistory(newHistory);
    setBalance(newBalance);
    persistHistory(newHistory);
    saveBalance(newBalance);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsedItems = await parsePayPayCSV(file);
      if (parsedItems.length === 0) { alert('データが見つかりません。'); return; }
      setHistory(prev => {
        const newOnly = parsedItems.filter(n => !prev.some(o => o.id === n.id));
        if (newOnly.length === 0) { alert('⚠️ すべて登録済みです。'); return prev; }
        const totalSpent = newOnly.reduce((s, h) => s + h.amount, 0);
        const newBalance = balance - totalSpent;
        const newHistory = [...newOnly, ...prev];
        setBalance(newBalance);
        persistHistory(newHistory);
        saveBalance(newBalance);
        mineFixedCostsFromHistory(newHistory);
        alert(`🎉 新規 ${newOnly.length} 件をインポートしました！`);
        return newHistory;
      });
    } catch { alert('CSVのパースに失敗しました。'); }
  };

  const handleRakutenUpload = () => alert('楽天カードCSVインポート機能（現在調整中）');

  const executeWeeklyClose = (type: 'save' | 'carryOver') => {
    if (balance <= 0) { alert('残金がありません。'); return; }
    if (type === 'save') {
      const newSavings = totalSavings + balance;
      setTotalSavings(newSavings);
      saveTotalSavings(newSavings);
      alert(`💰 ¥${balance.toLocaleString()} を貯蓄に追加！累計: ¥${newSavings.toLocaleString()}`);
    } else {
      const newBalance = weeklyBudget + balance;
      setBalance(newBalance);
      saveBalance(newBalance);
      alert(`🏃‍♂️ ¥${balance.toLocaleString()} を来週へ繰り越し！来週予算: ¥${newBalance.toLocaleString()}`);
      return;
    }
    setBalance(weeklyBudget);
    saveBalance(weeklyBudget);
    saveLastWeekReset(new Date().toISOString());
  };

  // 楽天固定費
  const addRakutenFixedCost = () => {
    const amt = parseInt(newRakutenAmount, 10);
    if (!newRakutenName || isNaN(amt) || amt <= 0) return;
    const newCosts = [...rakutenFixedCosts, { id: `rf-${Date.now()}`, name: newRakutenName, amount: amt, category: newRakutenCategory }];
    setRakutenFixedCosts(newCosts);
    saveRakutenFixedCosts(newCosts);
    setNewRakutenName(''); setNewRakutenAmount('');
  };
  const removeRakutenFixedCost = (id: string) => {
    const c = rakutenFixedCosts.filter(f => f.id !== id);
    setRakutenFixedCosts(c); saveRakutenFixedCosts(c);
  };

  // PayPayマイニング由来の変動費パターン
  const addFixedCost = () => {
    const amt = parseInt(newFixedAmount, 10);
    if (!newFixedName || isNaN(amt) || amt <= 0) return;
    const c = [...fixedCosts, { id: `fc-${Date.now()}`, name: newFixedName, amount: amt }];
    setFixedCosts(c); saveFixedCosts(c);
    setNewFixedName(''); setNewFixedAmount('');
  };
  const removeFixedCost = (id: string) => {
    const c = fixedCosts.filter(f => f.id !== id);
    setFixedCosts(c); saveFixedCosts(c);
  };

  const mineFixedCostsFromHistory = (all: HistoryItem[]) => {
    const groups: Record<string, string[]> = {};
    all.filter(h => !h.id.startsWith('rakuten-monthly-')).forEach(h => {
      const key = h.name.split(' - ')[0].trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(h.date);
    });
    const candidates: MinedCandidate[] = [];
    Object.entries(groups).forEach(([name, dates]) => {
      if (dates.length < 2) return;
      const amounts = all.filter(h => h.name.startsWith(name)).map(h => h.amount);
      const avg = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
      const days = dates.map(d => parseInt(d.split('/')[2], 10));
      const typicalDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
      const isConstant = amounts.every(a => Math.abs(a - avg) < avg * 0.05);
      if (!fixedCosts.some(f => f.name.includes(name)) && avg > 0) {
        candidates.push({ normalizedName: name, averageAmount: avg, typicalDay, isConstantAmount: isConstant, appearances: dates });
      }
    });
    setMinedCandidates(candidates);
  };

  const acceptAsFixedCost = (c: MinedCandidate) => {
    const costs = [...fixedCosts, { id: `fm-${Date.now()}`, name: `🔄 ${c.normalizedName}`, amount: c.averageAmount }];
    setFixedCosts(costs); saveFixedCosts(costs);
    setMinedCandidates(prev => prev.filter(x => x.normalizedName !== c.normalizedName));
  };

  // 設定セーバー
  const handleSetMonthlyIncome  = (v: number) => { setMonthlyIncome(v);  saveMonthlyIncome(v); };
  const handleSetVariableBudget = (v: number) => { setVariableBudget(v); saveVariableBudget(v); };
  const handleSetTargetSavings  = (v: number) => { setTargetSavings(v);  saveTargetSavings(v); };
  const handleSetSalaryDay      = (v: number) => { setSalaryDay(v);      saveSalaryDay(v); };
  const handleSetWeeklyBudget   = (v: number) => { setWeeklyBudget(v);   saveWeeklyBudget(v); };

  // 最新順ソート済み（変動費のみ）
  const sortedVariableHistory = useMemo(() =>
    history
      .filter(h => !h.id.startsWith('rakuten-monthly-'))
      .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
    [history]
  );

  const savingsRate = useMemo(() =>
    monthlyIncome > 0 ? Math.round((monthlySummary.plannedSavings / monthlyIncome) * 100) : 0,
    [monthlyIncome, monthlySummary.plannedSavings]
  );

  const savingsProgress = Math.min(100, Math.round((totalSavings / targetSavings) * 100));

  // 残り日数と1日予算
  const daysLeft = useMemo(() => {
    const end = viewingWeek.end;
    const now = new Date();
    if (now > end) return 0;
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [viewingWeek]);

  const currentWeekBalance = useMemo(() => {
    if (weekOffset !== 0) return weeklyBudget - viewingWeekSpent;
    return balance;
  }, [weekOffset, balance, weeklyBudget, viewingWeekSpent]);

  const generatedPrompt = useMemo(() => `
# 資産形成コンサルタントへの依頼

## 基本ステータス
- サイクル: ${currentCycle.label} / 給料日: ${salaryDay}日
- 月収（手取り）: ¥${monthlyIncome.toLocaleString()}
- 累計貯蓄: ¥${totalSavings.toLocaleString()} / 目標: ¥${targetSavings.toLocaleString()}

## 確定固定費（楽天・月次）
${rakutenFixedCosts.map(c => `- ${c.name}: ¥${c.amount.toLocaleString()}`).join('\n')}
合計: ¥${monthlySummary.rakutenTotal.toLocaleString()}

## 今月の変動費
- 予算: ¥${variableBudget.toLocaleString()} / 実績: ¥${monthlySummary.actualVariable.toLocaleString()} (${monthlySummary.variableProgress}%)

## 今月の旅行費
¥${travelTotal.toLocaleString()}

## 直近20件の支出
${sortedVariableHistory.slice(0, 20).map(h => `- ${h.date} | ${h.name} | ¥${h.amount.toLocaleString()} (${h.category})`).join('\n')}
  `, [currentCycle, salaryDay, monthlyIncome, totalSavings, targetSavings,
      rakutenFixedCosts, monthlySummary, variableBudget, travelTotal,
      sortedVariableHistory]);

  return {
    state: {
      isMounted, activeTab, graphType, openSettingSection, showPromptModal,
      history, sortedVariableHistory, archivedReports,
      balance, currentWeekBalance, totalSavings, targetSavings, savingsProgress,
      salaryDay, weeklyBudget, fixedCosts, rakutenFixedCosts,
      monthlyIncome, variableBudget, monthlySummary,
      travelExpenses, travelTotal,
      amount, category, travelAmount, travelName,
      newFixedName, newFixedAmount, newRakutenName, newRakutenAmount, newRakutenCategory,
      minedCandidates, generatedPrompt, currentCycle, monthlyReports,
      CATEGORIES, savingsRate, storageUsageKB,
      weekOffset, viewingWeek, viewingWeekVariable, viewingWeekSpent,
      nextWeekBalance, daysLeft, weeklyAnalytics,
    },
    actions: {
      setActiveTab, setGraphType, setOpenSettingSection, setShowPromptModal,
      setAmount, setCategory, setTravelAmount, setTravelName,
      setNewFixedName, setNewFixedAmount,
      setNewRakutenName, setNewRakutenAmount, setNewRakutenCategory,
      setTargetSavings: handleSetTargetSavings,
      setSalaryDay: handleSetSalaryDay,
      setMonthlyIncome: handleSetMonthlyIncome,
      setVariableBudget: handleSetVariableBudget,
      setWeeklyBudget: handleSetWeeklyBudget,
      setWeekOffset,
      handleSpend, handleTravelSpend, deleteTravelExpense,
      deleteHistory, handleFileUpload, handleRakutenUpload,
      executeWeeklyClose, addFixedCost, removeFixedCost,
      addRakutenFixedCost, removeRakutenFixedCost, acceptAsFixedCost,
    },
  };
}