'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { parsePayPayCSV, HistoryItem, Category } from '@/lib/csvParser';
import {
  loadAll, saveHistory, saveBalance, saveTotalSavings,
  saveTargetSavings, saveSalaryDay, saveFixedCosts,
  saveRakutenFixedCosts, saveMonthlyIncome, saveVariableBudget,
  saveLastWeekReset, saveLastRakutenCharge, getStorageUsageKB,
} from '@/lib/localStorage';

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number;
}

// ★ 楽天固定費（月次確定固定費）- PayPayマイニングとは別管理
export interface RakutenFixedCostItem {
  id: string;
  name: string;
  amount: number;
  category: Category; // どのカテゴリに分類するか
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

const DEFAULT_RAKUTEN_FIXED: RakutenFixedCostItem[] = [
  { id: 'rf-1', name: '家賃・住宅', amount: 65000, category: 'その他' },
  { id: 'rf-2', name: '通信費', amount: 9800, category: 'その他' },
];

const WEEKLY_BUDGET_DEFAULT = 30000;

export function useDashboard() {
  const CATEGORIES: Category[] = [
   '生活費','食費', '日用品', '交通費', '旅行費', '株',
    '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'
  ];

  // ---- State ----
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [graphType, setGraphType] = useState<'week' | 'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'mining' | 'target' | 'fixed' | 'rakuten' | 'income' | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [storageUsageKB, setStorageUsageKB] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [archivedReports, setArchivedReports] = useState<MonthlyReport[]>([]);
  const [balance, setBalance] = useState<number>(WEEKLY_BUDGET_DEFAULT);
  const [totalSavings, setTotalSavings] = useState<number>(0);
  const [targetSavings, setTargetSavings] = useState<number>(2000000);
  const [salaryDay, setSalaryDay] = useState<number>(25);

  // PayPayマイニング由来の変動費的固定費（週次管理）
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([]);
  // 楽天カード由来の確定固定費（月次・25日に一括計上）
  const [rakutenFixedCosts, setRakutenFixedCosts] = useState<RakutenFixedCostItem[]>(DEFAULT_RAKUTEN_FIXED);

  // 収入・予算設定
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);       // 月収（手取り）
  const [variableBudget, setVariableBudget] = useState<number>(120000); // 月の変動費予算

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('食費');
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newRakutenName, setNewRakutenName] = useState('');
  const [newRakutenAmount, setNewRakutenAmount] = useState('');
  const [newRakutenCategory, setNewRakutenCategory] = useState<Category>('その他');

  const [minedCandidates, setMinedCandidates] = useState<MinedCandidate[]>([]);

  // ---- 初期化 ----
  useEffect(() => {
    const saved = loadAll();
    if (saved) {
      setHistory(saved.history);
      setArchivedReports(saved.archives);
      setBalance(isNaN(saved.balance) ? WEEKLY_BUDGET_DEFAULT : saved.balance);
      setTotalSavings(isNaN(saved.totalSavings) ? 0 : saved.totalSavings);
      setTargetSavings(isNaN(saved.targetSavings) ? 2000000 : saved.targetSavings);
      setSalaryDay(isNaN(saved.salaryDay) ? 25 : saved.salaryDay);
      if (saved.fixedCosts) setFixedCosts(saved.fixedCosts);
      if (saved.rakutenFixedCosts) setRakutenFixedCosts(saved.rakutenFixedCosts);
      if (!isNaN(saved.monthlyIncome)) setMonthlyIncome(saved.monthlyIncome);
      if (!isNaN(saved.variableBudget)) setVariableBudget(saved.variableBudget);

      checkWeeklyAutoReset(saved.lastWeekReset);
      checkRakutenMonthlyCharge(saved.lastRakutenCharge, saved.rakutenFixedCosts ?? DEFAULT_RAKUTEN_FIXED, saved.history);
    }
    setStorageUsageKB(getStorageUsageKB());
    setIsMounted(true);
  }, []);

  // 週次自動リセット（月曜基準）
  const checkWeeklyAutoReset = (lastReset: string | null) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);
    if (!lastReset || new Date(lastReset) < thisMonday) {
      setBalance(WEEKLY_BUDGET_DEFAULT);
      saveBalance(WEEKLY_BUDGET_DEFAULT);
      saveLastWeekReset(now.toISOString());
    }
  };

  // ★ 楽天固定費の月次自動計上（給料日=25日 に一括計上）
  const checkRakutenMonthlyCharge = (
    lastCharge: string | null,
    costs: RakutenFixedCostItem[],
    currentHistory: HistoryItem[]
  ) => {
    const now = new Date();
    const salaryDayNum = 25; // 固定で25日

    // 今月の計上済みかチェック
    const thisMonthKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (lastCharge && lastCharge.startsWith(thisMonthKey)) return;

    // 今日が給料日以降なら計上
    if (now.getDate() < salaryDayNum) return;

    // 楽天固定費を履歴に一括追加
    const chargeDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(salaryDayNum).padStart(2, '0')}`;
    const newItems: HistoryItem[] = costs.map(c => ({
      id: `rakuten-monthly-${c.id}-${thisMonthKey}`,
      date: chargeDate,
      name: `💳 ${c.name}`,
      amount: c.amount,
      category: c.category,
    }));

    // 重複チェック（同月に既に計上済みの項目は除外）
    const filtered = newItems.filter(
      item => !currentHistory.some(h => h.id === item.id)
    );
    if (filtered.length === 0) return;

    const newHistory = [...filtered, ...currentHistory];
    setHistory(newHistory);
    saveHistory(newHistory, []);
    saveLastRakutenCharge(thisMonthKey);
    console.log(`💳 楽天固定費 ${filtered.length}件を${chargeDate}付けで計上しました`);
  };

  // ---- 給料日サイクル ----
  const currentCycle = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentSalaryDate = new Date(year, month, salaryDay);
    let start: Date;
    let label: string;
    if (now >= currentSalaryDate) {
      start = currentSalaryDate;
      label = `${year}/${String(month + 1).padStart(2, '0')}期`;
    } else {
      start = new Date(year, month - 1, salaryDay);
      label = `${year}/${String(month).padStart(2, '0')}期`;
    }
    return { start, label };
  }, [salaryDay]);

  // ---- 月次収支計算 ----
  const monthlySummary = useMemo(() => {
    const rakutenTotal = rakutenFixedCosts.reduce((s, c) => s + c.amount, 0);
    const plannedSavings = Math.max(0, monthlyIncome - rakutenTotal - variableBudget);
    // 今月の変動費実績（楽天固定費を除く）
    const cycleStart = currentCycle.start;
    const actualVariable = history
      .filter(h =>
        new Date(h.date.replace(/\//g, '-')) >= cycleStart &&
        !h.id.startsWith('rakuten-monthly-')
      )
      .reduce((s, h) => s + h.amount, 0);
    const variableProgress = variableBudget > 0
      ? Math.min(100, Math.round((actualVariable / variableBudget) * 100))
      : 0;
    const variableRemaining = Math.max(0, variableBudget - actualVariable);
    const variableOver = actualVariable > variableBudget;

    return {
      rakutenTotal,       // 楽天固定費合計
      plannedSavings,     // 予定貯蓄額
      actualVariable,     // 実績変動費
      variableProgress,   // 変動費消化率(%)
      variableRemaining,  // 変動費残額
      variableOver,       // 予算オーバーフラグ
    };
  }, [rakutenFixedCosts, monthlyIncome, variableBudget, history, currentCycle.start]);

  // ---- 月次レポート ----
  const monthlyReports: MonthlyReport[] = useMemo(() => {
    const currentSpent = history
      .filter(h => new Date(h.date.replace(/\//g, '-')) >= currentCycle.start)
      .reduce((s, h) => s + h.amount, 0);
    const currentReport: MonthlyReport = {
      month: currentCycle.label,
      spent: currentSpent,
      saved: totalSavings,
    };
    return [...archivedReports, currentReport].slice(-6);
  }, [history, archivedReports, currentCycle, totalSavings]);

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

  const handleSpend = () => {
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    const now = new Date();
    const newLog: HistoryItem = {
      id: `manual-${Date.now()}`,
      date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
      name: '手動入力支出',
      amount: parsedAmount,
      category,
    };
    const newHistory = [newLog, ...history];
    const newBalance = balance - parsedAmount;
    setHistory(newHistory);
    setBalance(newBalance);
    setAmount('');
    persistHistory(newHistory);
    saveBalance(newBalance);
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
      if (parsedItems.length === 0) {
        alert('支払いデータが見つからないか、形式が異なります。');
        return;
      }
      setHistory(prevHistory => {
        const newItemsOnly = parsedItems.filter(
          newItem => !prevHistory.some(old => old.id === newItem.id)
        );
        if (newItemsOnly.length === 0) {
          alert('⚠️ すべて登録済みです（重複なし）。');
          return prevHistory;
        }
        const totalNewSpent = newItemsOnly.reduce((s, h) => s + h.amount, 0);
        const newBalance = balance - totalNewSpent;
        const newHistory = [...newItemsOnly, ...prevHistory];
        setBalance(newBalance);
        persistHistory(newHistory);
        saveBalance(newBalance);
        mineFixedCostsFromHistory(newHistory);
        alert(`🎉 新規 ${newItemsOnly.length} 件をインポートしました！`);
        return newHistory;
      });
    } catch (err) {
      console.error(err);
      alert('CSVのパースに失敗しました。');
    }
  };

  const handleRakutenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    alert('楽天カードCSVインポート機能（現在調整中）');
  };

  const executeWeeklyClose = (type: 'save' | 'carryOver') => {
    if (balance <= 0) { alert('残金がありません。'); return; }
    if (type === 'save') {
      const newSavings = totalSavings + balance;
      setTotalSavings(newSavings);
      saveTotalSavings(newSavings);
      alert(`💰 ¥${balance.toLocaleString()} を貯蓄に追加！累計: ¥${newSavings.toLocaleString()}`);
      setBalance(WEEKLY_BUDGET_DEFAULT);
      saveBalance(WEEKLY_BUDGET_DEFAULT);
    } else {
      const newBalance = WEEKLY_BUDGET_DEFAULT + balance;
      setBalance(newBalance);
      saveBalance(newBalance);
      alert(`🏃‍♂️ ¥${balance.toLocaleString()} を来週へ繰り越し！来週予算: ¥${newBalance.toLocaleString()}`);
      return;
    }
    saveLastWeekReset(new Date().toISOString());
  };

  // 楽天固定費の追加・削除
  const addRakutenFixedCost = () => {
    const amt = parseInt(newRakutenAmount, 10);
    if (!newRakutenName || isNaN(amt) || amt <= 0) return;
    const newCosts = [
      ...rakutenFixedCosts,
      { id: `rf-${Date.now()}`, name: newRakutenName, amount: amt, category: newRakutenCategory }
    ];
    setRakutenFixedCosts(newCosts);
    saveRakutenFixedCosts(newCosts);
    setNewRakutenName('');
    setNewRakutenAmount('');
  };

  const removeRakutenFixedCost = (id: string) => {
    const newCosts = rakutenFixedCosts.filter(c => c.id !== id);
    setRakutenFixedCosts(newCosts);
    saveRakutenFixedCosts(newCosts);
  };

  const addFixedCost = () => {
    const amt = parseInt(newFixedAmount, 10);
    if (!newFixedName || isNaN(amt) || amt <= 0) return;
    const newCosts = [...fixedCosts, { id: `fixed-custom-${Date.now()}`, name: newFixedName, amount: amt }];
    setFixedCosts(newCosts);
    saveFixedCosts(newCosts);
    setNewFixedName('');
    setNewFixedAmount('');
  };

  const removeFixedCost = (id: string) => {
    const newCosts = fixedCosts.filter(f => f.id !== id);
    setFixedCosts(newCosts);
    saveFixedCosts(newCosts);
  };

  const handleSetMonthlyIncome = (v: number) => { setMonthlyIncome(v); saveMonthlyIncome(v); };
  const handleSetVariableBudget = (v: number) => { setVariableBudget(v); saveVariableBudget(v); };
  const handleSetTargetSavings = (v: number) => { setTargetSavings(v); saveTargetSavings(v); };
  const handleSetSalaryDay = (v: number) => { setSalaryDay(v); saveSalaryDay(v); };

  // PayPayマイニング
  const mineFixedCostsFromHistory = (allHistory: HistoryItem[]) => {
    const groups: Record<string, string[]> = {};
    allHistory
      .filter(h => !h.id.startsWith('rakuten-monthly-')) // 楽天固定費は除外
      .forEach(h => {
        const normalized = h.name.split(' - ')[0].trim();
        if (!groups[normalized]) groups[normalized] = [];
        groups[normalized].push(h.date);
      });
    const candidates: MinedCandidate[] = [];
    Object.entries(groups).forEach(([name, dates]) => {
      if (dates.length >= 2) {
        const amounts = allHistory.filter(h => h.name.startsWith(name)).map(h => h.amount);
        const avgAmount = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
        const days = dates.map(d => parseInt(d.split('/')[2], 10));
        const typicalDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
        const isConstant = amounts.every(a => Math.abs(a - avgAmount) < avgAmount * 0.05);
        const alreadyRegistered = fixedCosts.some(f => f.name.includes(name));
        if (!alreadyRegistered && avgAmount > 0) {
          candidates.push({ normalizedName: name, averageAmount: avgAmount, typicalDay, isConstantAmount: isConstant, appearances: dates });
        }
      }
    });
    setMinedCandidates(candidates);
  };

  const acceptAsFixedCost = (candidate: MinedCandidate) => {
    const newCosts = [...fixedCosts, {
      id: `fixed-mined-${Date.now()}`,
      name: `🔄 ${candidate.normalizedName}`,
      amount: candidate.averageAmount,
    }];
    setFixedCosts(newCosts);
    saveFixedCosts(newCosts);
    setMinedCandidates(prev => prev.filter(c => c.normalizedName !== candidate.normalizedName));
  };

  // ---- 派生値 ----
  const savingsProgress = Math.min(100, Math.round((totalSavings / targetSavings) * 100));

  const savingsRate = useMemo(() => {
    if (monthlyIncome <= 0) return 0;
    return Math.round((monthlySummary.plannedSavings / monthlyIncome) * 100);
  }, [monthlyIncome, monthlySummary.plannedSavings]);

  // ★ 最新順ソート済み履歴
  const sortedHistory = useMemo(() =>
    [...history].sort((a, b) =>
      new Date(b.date.replace(/\//g, '-')).getTime() -
      new Date(a.date.replace(/\//g, '-')).getTime()
    ),
    [history]
  );

  const generatedPrompt = useMemo(() => `
# あなたは超一流の資産形成・家計改善コンサルタントです。

## 1. 基本ステータス
- サイクル: ${currentCycle.label} / 給料日: ${salaryDay}日
- 月収（手取り）: ¥${monthlyIncome.toLocaleString()}
- 今週の残金: ¥${balance.toLocaleString()}
- 累計貯蓄: ¥${totalSavings.toLocaleString()} / 目標: ¥${targetSavings.toLocaleString()}

## 2. 楽天カード確定固定費（月次）
${rakutenFixedCosts.map(c => `- ${c.name}: ¥${c.amount.toLocaleString()}`).join('\n')}
合計: ¥${monthlySummary.rakutenTotal.toLocaleString()}

## 3. 今月の変動費状況
- 予算: ¥${variableBudget.toLocaleString()}
- 実績: ¥${monthlySummary.actualVariable.toLocaleString()} (${monthlySummary.variableProgress}%)

## 4. 直近の支出ログ (上位20件)
${sortedHistory.slice(0, 20).map(h => `- ${h.date} | ${h.name} | ¥${h.amount.toLocaleString()} (${h.category})`).join('\n')}
`, [balance, totalSavings, targetSavings, salaryDay, monthlyIncome, variableBudget,
    rakutenFixedCosts, monthlySummary, sortedHistory, currentCycle]);

  return {
    state: {
      isMounted, activeTab, graphType, openSettingSection, showPromptModal,
      history, sortedHistory, archivedReports, balance, totalSavings, targetSavings,
      salaryDay, fixedCosts, rakutenFixedCosts,
      monthlyIncome, variableBudget, monthlySummary,
      amount, category, newFixedName, newFixedAmount,
      newRakutenName, newRakutenAmount, newRakutenCategory,
      minedCandidates, generatedPrompt, currentCycle, monthlyReports,
      CATEGORIES, savingsProgress, savingsRate, storageUsageKB,
    },
    actions: {
      setActiveTab, setGraphType, setOpenSettingSection, setShowPromptModal,
      setAmount, setCategory, setNewFixedName, setNewFixedAmount,
      setNewRakutenName, setNewRakutenAmount, setNewRakutenCategory,
      setTargetSavings: handleSetTargetSavings,
      setSalaryDay: handleSetSalaryDay,
      setMonthlyIncome: handleSetMonthlyIncome,
      setVariableBudget: handleSetVariableBudget,
      handleSpend, deleteHistory, handleFileUpload, handleRakutenUpload,
      executeWeeklyClose, addFixedCost, removeFixedCost,
      addRakutenFixedCost, removeRakutenFixedCost, acceptAsFixedCost,
    }
  };
}