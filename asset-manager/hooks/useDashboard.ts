'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { parsePayPayCSV, HistoryItem, Category } from '@/lib/csvParser';
import {
  loadAll, saveHistory, saveBalance, saveTotalSavings,
  saveTargetSavings, saveSalaryDay, saveFixedCosts, saveLastWeekReset,
  getStorageUsageKB,
} from '@/lib/localStorage';

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number;
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

const DEFAULT_FIXED_COSTS: FixedCostItem[] = [
  { id: 'f-1', name: '家賃・住宅', amount: 65000 },
  { id: 'f-2', name: '通信費・サブスク', amount: 9800 },
];

const WEEKLY_BUDGET = 30000;

export function useDashboard() {
  const CATEGORIES: Category[] = [
    '食費', '日用品', '交通費', '旅行費', '株',
    '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'
  ];

  // ---- State ----
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [graphType, setGraphType] = useState<'week' | 'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'mining' | 'target' | 'fixed' | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [storageUsageKB, setStorageUsageKB] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [archivedReports, setArchivedReports] = useState<MonthlyReport[]>([]);
  const [balance, setBalance] = useState<number>(WEEKLY_BUDGET);
  const [totalSavings, setTotalSavings] = useState<number>(0); // 累計貯蓄額
  const [targetSavings, setTargetSavings] = useState<number>(2000000);
  const [salaryDay, setSalaryDay] = useState<number>(25);
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>(DEFAULT_FIXED_COSTS);

  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<Category>('食費');
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [minedCandidates, setMinedCandidates] = useState<MinedCandidate[]>([]);

  // ---- 初期化: LocalStorageから復元 ----
  useEffect(() => {
    const saved = loadAll();
    if (saved) {
      setHistory(saved.history);
      setArchivedReports(saved.archives);
      // balanceが0の場合もきちんと復元（NaN対策）
      setBalance(isNaN(saved.balance) ? WEEKLY_BUDGET : saved.balance);
      setTotalSavings(isNaN(saved.totalSavings) ? 0 : saved.totalSavings);
      setTargetSavings(isNaN(saved.targetSavings) ? 2000000 : saved.targetSavings);
      setSalaryDay(isNaN(saved.salaryDay) ? 25 : saved.salaryDay);
      if (saved.fixedCosts) setFixedCosts(saved.fixedCosts);

      // 週次自動リセットチェック
      checkWeeklyAutoReset(saved.lastWeekReset, isNaN(saved.balance) ? WEEKLY_BUDGET : saved.balance);
    }
    setStorageUsageKB(getStorageUsageKB());
    setIsMounted(true);
  }, []);

  // 週次自動リセット: 前回リセット日が今週の月曜より前なら自動リセット
  const checkWeeklyAutoReset = (lastReset: string | null, currentBalance: number) => {
    const now = new Date();
    // 今週の月曜日を計算
    const dayOfWeek = now.getDay(); // 0=日, 1=月...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    if (!lastReset || new Date(lastReset) < thisMonday) {
      // 今週まだリセットしていない → 残金を0として新しい週の予算をセット
      // ※ 残金は0にせず「繰り越し」扱いにする（オプション: ここでは単純リセット）
      setBalance(WEEKLY_BUDGET);
      const resetDate = now.toISOString();
      saveLastWeekReset(resetDate);
      saveBalance(WEEKLY_BUDGET);
      console.log('📅 週次予算を自動リセットしました');
    }
  };

  // ---- 給料日サイクル計算 ----
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

  // ---- 月次レポート（実データ + アーカイブ）----
  const monthlyReports: MonthlyReport[] = useMemo(() => {
    // 現在サイクルの支出を実データから計算
    const cycleStart = currentCycle.start;
    const currentSpent = history
      .filter(h => new Date(h.date.replace(/\//g, '-')) >= cycleStart)
      .reduce((sum, h) => sum + h.amount, 0);

    const currentReport: MonthlyReport = {
      month: currentCycle.label,
      spent: currentSpent,
      saved: totalSavings, // 今期の累計貯蓄
    };

    // アーカイブ（圧縮済み過去月）+ 現在月を結合し、直近6ヶ月だけ表示
    const allReports = [...archivedReports, currentReport];
    return allReports.slice(-6); // 直近6ヶ月
  }, [history, archivedReports, currentCycle, totalSavings]);

  // ---- 保存ヘルパー（useCallbackでメモ化）----
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
        const totalNewSpent = newItemsOnly.reduce((sum, h) => sum + h.amount, 0);
        const newBalance = balance - totalNewSpent;
        const newHistory = [...newItemsOnly, ...prevHistory];
        setBalance(newBalance);
        persistHistory(newHistory);
        saveBalance(newBalance);
        mineFixedCostsFromHistory([...newItemsOnly, ...prevHistory]);
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
    if (balance <= 0) {
      alert('残金がありません。');
      return;
    }
    if (type === 'save') {
      const newSavings = totalSavings + balance;
      setTotalSavings(newSavings);
      saveTotalSavings(newSavings);
      alert(`💰 ¥${balance.toLocaleString()} を貯蓄に追加！累計貯蓄: ¥${newSavings.toLocaleString()}`);
    } else {
      // 繰り越し: 来週の予算に残金を加算
      const newBalance = WEEKLY_BUDGET + balance;
      setBalance(newBalance);
      saveBalance(newBalance);
      alert(`🏃‍♂️ ¥${balance.toLocaleString()} を来週へ繰り越し！来週予算: ¥${newBalance.toLocaleString()}`);
      return; // balanceリセットしない
    }
    const newBalance = WEEKLY_BUDGET;
    setBalance(newBalance);
    saveBalance(newBalance);
    saveLastWeekReset(new Date().toISOString());
  };

  const handleSetTargetSavings = (val: number) => {
    setTargetSavings(val);
    saveTargetSavings(val);
  };

  const handleSetSalaryDay = (val: number) => {
    setSalaryDay(val);
    saveSalaryDay(val);
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

  // 固定費マイニング
  const mineFixedCostsFromHistory = (allHistory: HistoryItem[]) => {
    const groups: Record<string, string[]> = {};
    allHistory.forEach(h => {
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
    const newCosts = [...fixedCosts, { id: `fixed-mined-${Date.now()}`, name: `🔄 ${candidate.normalizedName}`, amount: candidate.averageAmount }];
    setFixedCosts(newCosts);
    saveFixedCosts(newCosts);
    setMinedCandidates(prev => prev.filter(c => c.normalizedName !== candidate.normalizedName));
  };

  const estimatedIncome = useMemo(() =>
    fixedCosts.reduce((sum, f) => sum + f.amount, 0) + 60000,
    [fixedCosts]
  );

  const currentMonthReport = useMemo(() =>
    monthlyReports.find(r => r.month === currentCycle.label),
    [monthlyReports, currentCycle.label]
  );

  const savingsRate = useMemo(() =>
    estimatedIncome > 0 ? Math.round(((currentMonthReport?.saved || 0) / estimatedIncome) * 100) : 0,
    [estimatedIncome, currentMonthReport]
  );

  const generatedPrompt = useMemo(() => `
# あなたは超一流の資産形成・家計改善コンサルタントです。
以下のリアルタイムな家計データを分析し、「長期貯蓄目標」達成のための改善提案をしてください。

## 1. 基本ステータス
- 現在のサイクル: ${currentCycle.label} (給料日: ${salaryDay}日)
- 今週の自由残金: ¥${balance.toLocaleString()}
- 累計貯蓄額: ¥${totalSavings.toLocaleString()}
- 長期貯蓄目標額: ¥${targetSavings.toLocaleString()}

## 2. 毎月の固定費
${fixedCosts.map(f => `- ${f.name}: ¥${f.amount.toLocaleString()}`).join('\n')}

## 3. 自動検出された固定費候補
${minedCandidates.map(c => `- [${c.isConstantAmount ? '定額' : '変動'}] ${c.normalizedName}: 平均¥${c.averageAmount.toLocaleString()} (毎月${c.typicalDay}日頃)`).join('\n')}

## 4. 直近の支出ログ (上位20件)
${history.slice(0, 20).map(h => `- ${h.date} | ${h.name} | ¥${h.amount.toLocaleString()} (${h.category})`).join('\n')}
`, [balance, totalSavings, targetSavings, salaryDay, fixedCosts, minedCandidates, history, currentCycle]);

  return {
    state: {
      isMounted, activeTab, graphType, openSettingSection, showPromptModal,
      history, archivedReports, balance, totalSavings, targetSavings, salaryDay, fixedCosts,
      amount, category, newFixedName, newFixedAmount, minedCandidates,
      generatedPrompt, currentCycle, monthlyReports, CATEGORIES,
      estimatedIncome, savingsRate, storageUsageKB,
    },
    actions: {
      setActiveTab, setGraphType, setOpenSettingSection, setShowPromptModal,
      setAmount, setCategory, setNewFixedName, setNewFixedAmount,
      setTargetSavings: handleSetTargetSavings,
      setSalaryDay: handleSetSalaryDay,
      handleSpend, deleteHistory, handleFileUpload, handleRakutenUpload,
      executeWeeklyClose, addFixedCost, removeFixedCost, acceptAsFixedCost,
    }
  };
}