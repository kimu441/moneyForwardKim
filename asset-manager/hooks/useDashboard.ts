// src/hooks/useDashboard.ts
import { useState, useEffect } from 'react';
import { parsePayPayCSV, Expense, Category, CategoryRule } from '@/lib/csvParser';
import { parseRakutenCSV } from '@/lib/fixedCostAnalyzer';
import { mineFixedCosts, FixedCostCandidate } from '@/lib/fixedCostMiner';

export type FixedCost = { id: string; name: string; amount: number; category: Category };

export function useDashboard() {
  const [balance, setBalance] = useState<number>(15000);
  const [savings, setSavings] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('食費');
  const [history, setHistory] = useState<Expense[]>([]);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<{month: string, saved: number, spent: number}[]>([]);
  const [lastSalaryUpdate, setLastSalaryUpdate] = useState<string>('');
  
  const [rules, setRules] = useState<CategoryRule[]>([
    { keyword: 'セブン', category: '食費' }, { keyword: 'ファミマ', category: '食費' },
    { keyword: '薬', category: '日用品' }, { keyword: '駅', category: '交通費' },
    { keyword: 'ＳＢＩ', category: '株' }, { keyword: '楽天証券', category: '株' },
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordCategory, setNewKeywordCategory] = useState<Category>('食費');
  const [salaryDay, setSalaryDay] = useState<number>(25);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [targetSavings, setTargetSavings] = useState<number>(100000);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([
    { id: '1', name: '家賃・家計固定費分', amount: 50000, category: 'その他' }
  ]);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newFixedCategory, setNewFixedCategory] = useState<Category>('その他');
  
  const [isMounted, setIsMounted] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [graphType, setGraphType] = useState<'week' | 'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'target' | 'keyword' | 'fixed' | 'mining' | null>('target');

  const [minedCandidates, setMinedCandidates] = useState<FixedCostCandidate[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);

  const CATEGORIES: Category[] = ['食費', '日用品', '交通費', '旅行費', '株', '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'];

  // 給料日サイクルの計算
  const getSalaryCycleRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let start = new Date(year, month, salaryDay);
    if (date < salaryDay) start = new Date(year, month - 1, salaryDay);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(salaryDay - 1);
    end.setHours(23, 59, 59, 999);

    return { start, end, label: `${((start.getMonth() + 1) % 12) + 1}月度` };
  };

  const currentCycle = getSalaryCycleRange();

  // 永続化データの読み込み
  useEffect(() => {
    setIsMounted(true);
    const data = localStorage.getItem('appData_v5.5_final');
    if (data) {
      const parsed = JSON.parse(data);
      setBalance(parsed.balance); setSavings(parsed.savings); setHistory(parsed.history || []); 
      setProcessedIds(parsed.processedIds || []); setMonthlyReports(parsed.monthlyReports || []);
      setLastSalaryUpdate(parsed.lastSalaryUpdate || ''); 
      if (parsed.rules) setRules(parsed.rules);
      if (parsed.salaryDay) setSalaryDay(parsed.salaryDay);
      if (parsed.targetSavings) setTargetSavings(parsed.targetSavings);
      if (parsed.fixedCosts) setFixedCosts(parsed.fixedCosts);
    }
  }, []);

  // 給料日判定（自動計上）
  useEffect(() => {
    if (!isMounted) return;
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${today.getMonth() + 1}`;
    
    if (today.getDate() >= salaryDay && lastSalaryUpdate !== currentYearMonth) {
      alert(`🎉 給料日サイクル【${currentCycle.label}】を開始します。\n固定費（計 ¥${fixedCosts.reduce((s,f)=>s+f.amount, 0).toLocaleString()}）を自動計上しました。`);
      
      const generatedFixedExpenses: Expense[] = fixedCosts.map(f => ({
        id: `fixed-${Date.now()}-${f.id}`,
        date: today.toLocaleDateString(),
        amount: f.amount,
        name: `[固定費自動] ${f.name}`,
        category: f.category
      }));

      setHistory(prev => [...generatedFixedExpenses, ...prev]);
      setMonthlyReports(prev => {
        if (prev.find(r => r.month === currentCycle.label)) return prev;
        return [...prev, { month: currentCycle.label, saved: 0, spent: fixedCosts.reduce((s,f)=>s+f.amount, 0) }];
      });
      setLastSalaryUpdate(currentYearMonth);
    }
  }, [isMounted, lastSalaryUpdate, salaryDay]);

  // 永続化データの保存
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('appData_v5.5_final', JSON.stringify({ 
        balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts, salaryDay 
      }));
    }
  }, [balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts, salaryDay, isMounted]);

  // 支出合計の月次同期
  const totalCycleExpense = history
    .filter(h => {
      const hDate = new Date(h.date.replace(/\//g, '-'));
      return hDate >= currentCycle.start && hDate <= currentCycle.end;
    })
    .reduce((sum, h) => sum + h.amount, 0);

  useEffect(() => {
    if (!isMounted || monthlyReports.length === 0) return;
    setMonthlyReports(prev => prev.map(r => r.month === currentCycle.label ? { ...r, spent: totalCycleExpense } : r));
  }, [totalCycleExpense, isMounted]);

  // ✨ 固定費自動マイニングエンジン
  useEffect(() => {
    if (history.length > 0) {
      const txData = history.map(h => ({ date: h.date, name: h.name, amount: h.amount }));
      const candidates = mineFixedCosts(txData);
      setMinedCandidates(candidates);

      const promptTemplate = `
あなたは優秀な個人の資産形成コンサルタントであり、家計簿データの分析エキスパートです。
ユーザーの明細から「毎月定期的に発生している固定費・サブスクの候補」をシステムが自動抽出しました。

店名（normalizedName）の文字列や金額パターンから、世の中のどのサービスかを推測し、ユーザーが気づいていない無駄をあぶり出して、具体的かつ実践的な「固定費削減アドバイス・レポート」をフランクに作成してください。

【自動検出された固定費データ】
${JSON.stringify(candidates, null, 2)}
`;
      setGeneratedPrompt(promptTemplate.trim());
    } else {
      setMinedCandidates([]);
      setGeneratedPrompt('');
    }
  }, [history]);

  // アクションハンドラー
  const handleSpend = () => {
    const expense = parseInt(amount);
    if (!isNaN(expense)) {
      setBalance(balance - expense);
      setHistory(prev => [{ id: Date.now().toString(), date: new Date().toLocaleDateString(), amount: expense, name: '手動入力', category }, ...prev]);
      setAmount(''); setIsInputOpen(false);
    }
  };

  const executeWeeklyClose = (mode: 'save' | 'carryOver') => {
    if (mode === 'save') {
      setSavings(prev => prev + balance);
      setMonthlyReports(prev => {
        const existing = prev.find(r => r.month === currentCycle.label);
        if (existing) return prev.map(r => r.month === currentCycle.label ? { ...r, saved: r.saved + balance } : r);
        return [...prev, { month: currentCycle.label, saved: balance, spent: totalCycleExpense }];
      });
      setBalance(15000);
      alert('💰 残金をすべて貯蓄口座へ移動し、新予算15,000円をチャージしました！');
    } else {
      setBalance(prev => prev + 15000);
      alert(`🏃‍♂️ 残金を来週に繰り越しました！新しい予算は ¥${(balance + 15000).toLocaleString()} です！`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { weeklyExpense, newProcessedIds, newExpenses } = parsePayPayCSV(text, processedIds, rules);
        setBalance(prev => prev - weeklyExpense);
        setProcessedIds(prev => [...prev, ...newProcessedIds]);
        setHistory(prev => [...newExpenses, ...prev]);
      };
      reader.readAsText(file);
    }
  };

  const handleRakutenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rakutenExpenses = parseRakutenCSV(text);
        const newHistoryExpenses: Expense[] = rakutenExpenses.map(r => ({
          id: r.id, date: r.date, name: r.name, amount: r.amount, category: '不明'
        }));
        setHistory(prev => [...newHistoryExpenses, ...prev]);
      };
      reader.readAsText(file);
    }
  };

  const deleteHistory = (id: string) => {
    const target = history.find(h => h.id === id);
    if (target) {
      if (!id.startsWith('fixed-')) setBalance(prev => prev + target.amount);
      setHistory(history.filter(h => h.id !== id));
    }
  };

  const addFixedCost = () => {
    const amt = parseInt(newFixedAmount);
    if (newFixedName && !isNaN(amt)) {
      setFixedCosts([...fixedCosts, { id: Date.now().toString(), name: newFixedName, amount: amt, category: newFixedCategory }]);
      setNewFixedName(''); setNewFixedAmount('');
    }
  };

  const addRule = () => {
    if (newKeyword.trim()) {
      setRules([...rules, { keyword: newKeyword.trim(), category: newKeywordCategory }]);
      setNewKeyword('');
    }
  };

  const acceptAsFixedCost = (candidate: FixedCostCandidate) => {
    if (!fixedCosts.some(f => f.name === candidate.normalizedName)) {
      setFixedCosts(prev => [...prev, { id: `fixed-mined-${Date.now()}`, name: candidate.normalizedName, amount: candidate.averageAmount, category: 'その他' }]);
      alert(`✅ 「${candidate.normalizedName}」を自動固定費に同期しました！`);
    }
  };

  return {
    state: { balance, savings, amount, category, history, monthlyReports, rules, newKeyword, newKeywordCategory, salaryDay, activeTab, targetSavings, fixedCosts, newFixedName, newFixedAmount, newFixedCategory, isMounted, isInputOpen, graphType, openSettingSection, minedCandidates, generatedPrompt, showPromptModal, currentCycle, totalCycleExpense, CATEGORIES },
    actions: { setAmount, setCategory, setNewKeyword, setNewKeywordCategory, setSalaryDay, setActiveTab, setTargetSavings, setNewFixedName, setNewFixedAmount, setNewFixedCategory, setIsInputOpen, setGraphType, setOpenSettingSection, setShowPromptModal, handleSpend, executeWeeklyClose, handleFileUpload, handleRakutenUpload, deleteHistory, addFixedCost, removeFixedCost: (id: string) => setFixedCosts(fixedCosts.filter(f => f.id !== id)), addRule, removeRule: (kw: string) => setRules(rules.filter(r => r.keyword !== kw)), acceptAsFixedCost }
  };
}