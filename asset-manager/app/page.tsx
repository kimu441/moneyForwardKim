'use client';
import { useState, useEffect } from 'react';
import { parsePayPayCSV, Expense, Category, CategoryRule } from '@/lib/csvParser';
import { parseRakutenCSV } from '@/lib/fixedCostAnalyzer';
import { mineFixedCosts, FixedCostCandidate } from '@/lib/fixedCostMiner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type FixedCost = { id: string; name: string; amount: number; category: Category };

export default function Dashboard() {
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
    { keyword: 'ホテル', category: '旅行費' }, { keyword: '航空', category: '旅行費' }
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

  // UI/UX用State
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [graphType, setGraphType] = useState<'week' | 'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'target' | 'keyword' | 'fixed' | 'mining'>('target');

  // ✨ 固定費マイニング用State
  const [minedCandidates, setMinedCandidates] = useState<FixedCostCandidate[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7', '#64748b', '#94a3b8'];
  const CATEGORIES: Category[] = ['食費', '日用品', '交通費', '旅行費', '株', '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'];

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

    const displayMonth = ((start.getMonth() + 1) % 12) + 1;
    return { start, end, label: `${displayMonth}月度` };
  };

  const currentCycle = getSalaryCycleRange();

  const currentCycleHistory = history.filter(h => {
    const hDate = new Date(h.date.replace(/\//g, '-'));
    return hDate >= currentCycle.start && hDate <= currentCycle.end;
  });
  const totalCycleExpense = currentCycleHistory.reduce((sum, h) => sum + h.amount, 0);

  const getSmartAlert = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysLeft = 7 - dayOfWeek;
    const dailyLimit = Math.max(1, Math.round(balance / daysLeft));
    
    let status: 'safe' | 'warning' | 'danger' = 'safe';
    let message = `今週の締めまで残り ${daysLeft} 日。1日あたり ¥${dailyLimit.toLocaleString()} 使えます。`;

    if (balance <= 0) {
      status = 'danger';
      message = '⚠️ 予算を使い切りました！週の締め処理を行うか、繰り越し予算を調整してください。';
    } else if (dailyLimit < 1500) {
      status = 'danger';
      message = `🚨 ピンチ！1日あたり ¥${dailyLimit.toLocaleString()} 未満。超節約モードです！`;
    } else if (dailyLimit < 2500) {
      status = 'warning';
      message = `⚠️ 注意：1日あたり ¥${dailyLimit.toLocaleString()} ペース。少し支出を抑えましょう。`;
    }
    return { status, message, dailyLimit };
  };
  const smartAlert = getSmartAlert();

  const estimatedIncome = fixedCosts.reduce((sum, f) => sum + f.amount, 0) + 60000;
  const currentMonthReport = monthlyReports.find(r => r.month === currentCycle.label);
  const currentMonthSaved = currentMonthReport ? currentMonthReport.saved : 0;
  const savingsRate = estimatedIncome > 0 ? Math.round((currentMonthSaved / estimatedIncome) * 100) : 0;
  const targetAchievementRate = Math.min(100, Math.round((savings / targetSavings) * 100));

  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const currentWeekCategoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: history.filter(h => h.category === cat && new Date(h.date.replace(/\//g, '-')) >= oneWeekAgo).reduce((sum, h) => sum + h.amount, 0)
  })).filter(d => d.value > 0);

  const comparisonData = CATEGORIES.map(cat => ({
    name: cat, 
    先月基準: { '食費': 20000, '日用品': 10000, '交通費': 5000, '旅行費': 15000, '株': 10000, '美容・衣服': 8000, '交際費': 10000, '趣味・娯楽': 5000, '不明': 2000, 'その他': 5000 }[cat] || 5000,
    今月支出: currentCycleHistory.filter(h => h.category === cat).reduce((sum, h) => sum + h.amount, 0)
  }));

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

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('appData_v5.5_final', JSON.stringify({ 
        balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts, salaryDay 
      }));
    }
  }, [balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts, salaryDay, isMounted]);

  useEffect(() => {
    if (!isMounted || monthlyReports.length === 0) return;
    setMonthlyReports(prev => prev.map(r => r.month === currentCycle.label ? { ...r, spent: totalCycleExpense } : r));
  }, [totalCycleExpense, isMounted]);

  // ✨ 明細データが動くたびに、裏側で「自動固定費マイニング」と「プロンプト生成」を自動処理
  useEffect(() => {
    if (history.length > 0) {
      const txData = history.map(h => ({ date: h.date, name: h.name, amount: h.amount }));
      const candidates = mineFixedCosts(txData);
      setMinedCandidates(candidates);

      const promptTemplate = `
あなたは優秀な個人の資産形成コンサルタントであり、家計簿データの分析エキスパートです。
ユーザーの明細（楽天カードやPayPay等）から「毎月定期的に発生している固定費・サブスクの候補」をシステムが自動抽出しました。

店名（normalizedName）の文字列や金額パターンから、世の中のどのサービス（携帯キャリア、サブスク、インフラ、アプリ課金など）かを推測し、ユーザーが気づいていない無駄をあぶり出して、具体的かつ実践的な「固定費削減アドバイス・レポート」をフランクかつ親身に作成してください。

【自動検出された固定費データ】
${JSON.stringify(candidates, null, 2)}

■ レポート構成案：
1. **総評**: 定期支出の全体的な規模感と、削減のポテンシャル
2. **項目別の詳細診断**: サービス名の特定（推測）、見直しの余地（無駄度を★5段階で評価）、具体的な削減アクション（格安プラン、解約方法など）
3. **まとめ**: これらをすべて見直した場合に、月々どれくらいの浮いたお金（資産形成に回せるお金）が作れるか
`;
      setGeneratedPrompt(promptTemplate.trim());
    } else {
      setMinedCandidates([]);
      setGeneratedPrompt('');
    }
  }, [history]);

  const handleSpend = () => {
    const expense = parseInt(amount);
    if (!isNaN(expense)) {
      setBalance(balance - expense);
      setHistory(prev => [{ id: Date.now().toString(), date: new Date().toLocaleDateString(), amount: expense, name: '手動入力', category }, ...prev]);
      setAmount('');
      setIsInputOpen(false);
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
      alert(`🏃‍♂️ 残金を来週に繰り越しました！新しい来週の予算は ¥${(balance + 15000).toLocaleString()} です！`);
    }
  };

  // 📱 PayPay CSVインポート（復活）
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
        alert(`📱 PayPay明細の読み込みが完了しました！支出を反映しました。`);
      };
      reader.readAsText(file);
    }
  };

  // 💳 楽天カード CSVインポート（復活・統合処理）
  const handleRakutenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rakutenExpenses = parseRakutenCSV(text);
        
        const newHistoryExpenses: Expense[] = rakutenExpenses.map(r => ({
          id: r.id,
          date: r.date,
          name: r.name,
          amount: r.amount,
          category: '不明'
        }));

        setHistory(prev => [...newHistoryExpenses, ...prev]);
        alert(`💳 楽天カード明細から ${rakutenExpenses.length} 件を統合しました！自動固定費マイニングを実行します。`);
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
  const removeFixedCost = (id: string) => setFixedCosts(fixedCosts.filter(f => f.id !== id));

  const addRule = () => {
    if (newKeyword.trim()) {
      setRules([...rules, { keyword: newKeyword.trim(), category: newKeywordCategory }]);
      setNewKeyword('');
    }
  };
  const removeRule = (keyword: string) => setRules(rules.filter(r => r.keyword !== keyword));

  const acceptAsFixedCost = (candidate: FixedCostCandidate) => {
    const isExist = fixedCosts.some(f => f.name === candidate.normalizedName);
    if (!isExist) {
      setFixedCosts(prev => [...prev, {
        id: `fixed-mined-${Date.now()}`,
        name: candidate.normalizedName,
        amount: candidate.averageAmount,
        category: 'その他'
      }]);
      alert(`✅ 「${candidate.normalizedName}」を毎月の自動固定費リストに追加登録しました！`);
    } else {
      alert('すでに同じ名前の項目が固定費リストに存在します。');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-5 bg-slate-50 min-h-screen text-slate-800 pb-24 font-sans antialiased">
      
      {/* ヘッダー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
            🛡️ 資産形成プロ <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold">v5.5</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{currentCycle.label} / 起点 {salaryDay}日</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs shadow-inner">
          {(['dashboard', 'analytics', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              {tab === 'dashboard' ? 'ホーム' : tab === 'analytics' ? '分析' : '設定'}
            </button>
          ))}
        </div>
      </div>

      {/* アラート連動型カード */}
      {activeTab === 'dashboard' && (
        <div className={`p-5 rounded-2xl text-white shadow-md border transition-all duration-300 relative overflow-hidden ${
          smartAlert.dailyLimit < 1500 ? 'from-rose-500 to-red-600 border-red-400' :
          smartAlert.dailyLimit < 2500 ? 'from-amber-500 to-orange-600 border-orange-400' : 
          'from-blue-500 to-indigo-600 border-blue-400'
        } bg-gradient-to-br`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">今週の自由に使える残金</p>
              <h2 className="text-3xl font-black mt-0.5 tracking-tight">¥{balance.toLocaleString()}</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">1日あたりの上限</p>
              <p className="text-lg font-extrabold mt-0.5">¥{smartAlert.dailyLimit.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 bg-white/15 p-2.5 rounded-xl backdrop-blur-sm text-[11px] font-medium">
            {smartAlert.message}
          </div>
        </div>
      )}

      {/* --- 【タブ1】ホーム画面 --- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* マイニングエンジンからのサマリー通知 */}
          {minedCandidates.length > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl text-white shadow-md border border-purple-400">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1">🧠 パターンマイニング成功</h4>
                  <p className="text-[11px] opacity-95 mt-0.5">明細から **{minedCandidates.length}件の固定費候補** を自動検出しました！</p>
                </div>
                <button onClick={() => { setActiveTab('settings'); setOpenSettingSection('mining'); }} className="bg-white text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                  診断レポート
                </button>
              </div>
            </div>
          )}

          {/* 目標達成プログレス */}
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-500">🏆 長期貯蓄目標達成率</span>
              <span className="font-extrabold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{targetAchievementRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full" style={{ width: `${targetAchievementRate}%` }} />
            </div>
          </div>

          {/* グラフカード */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">📊 データビジュアル</h3>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                <button onClick={() => setGraphType('week')} className={`px-2.5 py-1 rounded-md font-bold ${graphType === 'week' ? 'bg-white text-slate-800' : 'text-slate-400'}`}>直近7日内訳</button>
                <button onClick={() => setGraphType('monthly')} className={`px-2.5 py-1 rounded-md font-bold ${graphType === 'monthly' ? 'bg-white text-slate-800' : 'text-slate-400'}`}>月次収支推移</button>
              </div>
            </div>
            <div className="h-44 flex items-center justify-center">
              {graphType === 'week' ? (
                isMounted && currentWeekCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={currentWeekCategoryData} dataKey="value" nameKey="name" outerRadius={40} label={{fontSize: 9, fontWeight:'bold'}}>
                        {currentWeekCategoryData.map((d, i) => <Cell key={i} fill={COLORS[CATEGORIES.indexOf(d.name as Category) % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 font-medium">期間内の支出データはありません</p>
              ) : (
                isMounted && monthlyReports.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyReports}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{fontSize: 9, fontWeight:'bold'}} />
                      <YAxis tick={{fontSize: 9}} />
                      <Tooltip />
                      <Bar dataKey="spent" name="支出" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="saved" name="貯蓄" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 font-medium">データがまだ蓄積されていません</p>
              )}
            </div>
          </div>

          {/* 週末の締め処理 ＆ ダブルCSVインポート */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div>
              <h4 className="text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">🏁 週末の締め処理選択</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => executeWeeklyClose('save')} className="bg-orange-500 text-white py-2.5 rounded-xl font-bold text-xs">💰 残金を全て貯蓄へ</button>
                <button onClick={() => executeWeeklyClose('carryOver')} className="bg-indigo-500 text-white py-2.5 rounded-xl font-bold text-xs">🏃‍♂️ 来週へ繰り越し</button>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">📱 PayPay(CSV):</span>
                <input type="file" onChange={handleFileUpload} className="text-xs text-slate-400 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 w-full" />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-2">
                <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">💳 楽天カード(CSV):</span>
                <input type="file" onChange={handleRakutenUpload} className="text-xs text-slate-400 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-red-50 file:text-red-700 w-full" />
              </div>
            </div>
          </div>

          {/* 履歴リスト */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <h3 className="text-xs font-black text-slate-700 border-b border-slate-50 pb-2 mb-2 uppercase tracking-wider">📜 直近の支出履歴</h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">まだ履歴はありません</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {history.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-xs border-b border-slate-50/60 py-2">
                    <div className="flex items-center gap-1.5 truncate mr-2">
                      <span className={`font-bold truncate max-w-[120px] ${h.id.startsWith('fixed-') ? 'text-purple-600' : 'text-slate-800'}`}>{h.name}</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold shrink-0">{h.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold text-slate-700">¥{h.amount.toLocaleString()}</span>
                      <button onClick={() => deleteHistory(h.id)} className="text-red-400 font-bold text-[10px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 【タブ2】詳細分析画面 --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-2xl text-white">
            <h3 className="text-xs font-bold opacity-80">📈 {currentCycle.label} 貯蓄率スコア</h3>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-3xl font-black">{savingsRate}%</span>
              <span className="text-[10px] opacity-60">(想定月収 ¥{estimatedIncome.toLocaleString()} 基準)</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">⚖️ カテゴリ別 支出比較</h3>
            {isMounted && currentCycleHistory.length > 0 ? (
              <div className="h-44 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                    <XAxis dataKey="name" tick={{fontSize: 9, fontWeight:'bold'}} />
                    <YAxis tick={{fontSize: 9}} />
                    <Tooltip />
                    <Bar dataKey="先月基準" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="今月支出" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-slate-400 text-center py-12">サイクル内のデータがありません</p>}
          </div>
        </div>
      )}

      {/* --- 【タブ3】各種設定画面（アコーディオン構造） --- */}
      {activeTab === 'settings' && (
        <div className="space-y-3 animate-fade-in">
          
          {/* 🧠 新機能：周期データ解析型・固定費自動あぶり出し */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button onClick={() => setOpenSettingSection(openSettingSection === 'mining' ? 'target' : 'mining')} className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs">
              <span>🧠 周期データ解析型・固定費自動あぶり出し</span>
              <span>{openSettingSection === 'mining' ? '▲' : '▼'}</span>
            </button>
            {openSettingSection === 'mining' && (
              <div className="p-4 border-t border-slate-100 space-y-4 bg-purple-50/10">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  文字のハードコードを一切使わず、全履歴データの**「出現周期」「日付の一致度」「金額のパターン」**だけをスキャンして抽出した定期支出候補です。
                </p>

                {minedCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 font-medium">
                    まだ定期的な支出パターンが検出されていません。PayPayや楽天カードのCSVをインポートすると自動抽出されます。
                  </p>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => setShowPromptModal(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-colors">
                      🤖 生成された「AIコンサル用プロンプト」をコピー
                    </button>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {minedCandidates.map((cand, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div className="max-w-[70%]">
                              <h5 className="font-bold text-slate-800 truncate">{cand.normalizedName}</h5>
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                周期性: 毎月 <span className="font-bold text-slate-600">{cand.typicalDay}日付近</span> / 履歴: {cand.appearances.length}回
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-slate-700 block">¥{cand.averageAmount.toLocaleString()}</span>
                              <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${cand.isConstantAmount ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {cand.isConstantAmount ? '定額サブスク型' : '金額変動インフラ型'}
                              </span>
                            </div>
                          </div>
                          
                          <button onClick={() => acceptAsFixedCost(cand)} className="w-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[9px] font-bold py-1.5 rounded-lg border border-transparent hover:border-purple-100 transition-colors">
                            この項目を「毎月の自動計上固定費リスト」に同期する
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* セクション1: 基本設定 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button onClick={() => setOpenSettingSection(openSettingSection === 'target' ? 'mining' : 'target')} className="w-full flex justify-between items-center p-4 bg-slate-50/50 hover:bg-slate-50 font-bold text-xs text-slate-700">
              <span>🎯 基本設定 (目標額・給料日起点)</span>
              <span>{openSettingSection === 'target' ? '▲' : '▼'}</span>
            </button>
            {openSettingSection === 'target' && (
              <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">長期貯蓄目標</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={targetSavings} onChange={(e) => setTargetSavings(parseInt(e.target.value) || 0)} className="border border-slate-200 p-2 rounded-xl text-xs w-full" />
                    <span className="self-center font-bold text-xs text-slate-400">円</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">給料日(起点日)</label>
                  <div className="flex gap-1.5">
                    <input type="number" min="1" max="28" value={salaryDay} onChange={(e) => setSalaryDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 25)))} className="border border-slate-200 p-2 rounded-xl text-xs w-full" />
                    <span className="self-center font-bold text-xs text-slate-400">日</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* セクション2: キーワード判定 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button onClick={() => setOpenSettingSection(openSettingSection === 'keyword' ? 'mining' : 'keyword')} className="w-full flex justify-between items-center p-4 bg-slate-50/50 hover:bg-slate-50 font-bold text-xs text-slate-700">
              <span>🔍 PayPay明細自動判定ルール</span>
              <span>{openSettingSection === 'keyword' ? '▲' : '▼'}</span>
            </button>
            {openSettingSection === 'keyword' && (
              <div className="p-4 border-t border-slate-100 space-y-3">
                <div className="flex gap-1.5 bg-slate-50 p-2 rounded-xl">
                  <input type="text" value={newKeyword} onChange={(e)=>setNewKeyword(e.target.value)} placeholder="店名・キーワード" className="border p-2 rounded-xl text-xs bg-white w-full" />
                  <select value={newKeywordCategory} onChange={(e)=>setNewKeywordCategory(e.target.value as Category)} className="border p-2 rounded-xl text-xs bg-white font-semibold text-slate-600">
                    {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                  <button onClick={addRule} className="bg-blue-600 text-white px-3 py-2 rounded-xl font-bold text-xs">追加</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/30 rounded-xl">
                  {rules.map(r => (
                    <div key={r.keyword} className="flex justify-between items-center text-[10px] bg-white border border-slate-100 p-2 rounded-lg">
                      <span className="font-bold text-slate-700 truncate max-w-[65px]">{r.keyword}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] px-1 bg-blue-50 text-blue-600 rounded-md font-bold">{r.category}</span>
                        <button onClick={() => removeRule(r.keyword)} className="text-red-400 font-bold ml-0.5">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* セクション3: 固定費自動登録 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button onClick={() => setOpenSettingSection(openSettingSection === 'fixed' ? 'mining' : 'fixed')} className="w-full flex justify-between items-center p-4 bg-slate-50/50 hover:bg-slate-50 font-bold text-xs text-slate-700">
              <span>🔄 毎月自動計上する固定費のカスタム設定</span>
              <span>{openSettingSection === 'fixed' ? '▲' : '▼'}</span>
            </button>
            {openSettingSection === 'fixed' && (
              <div className="p-4 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-1 gap-2 bg-slate-50 p-2.5 rounded-xl">
                  <div className="flex gap-1.5">
                    <input type="text" value={newFixedName} onChange={(e)=>setNewFixedName(e.target.value)} placeholder="固定費名(例: 家賃)" className="border p-2 rounded-xl text-xs bg-white w-full" />
                    <input type="number" value={newFixedAmount} onChange={(e)=>setNewFixedAmount(e.target.value)} placeholder="金額" className="border p-2 rounded-xl text-xs bg-white w-24" />
                  </div>
                  <div className="flex gap-1.5">
                    <select value={newFixedCategory} onChange={(e)=>setNewFixedCategory(e.target.value as Category)} className="border p-2 rounded-xl text-xs bg-white w-full font-semibold text-slate-600">
                      {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                    <button onClick={addFixedCost} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap">追加</button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {fixedCosts.map(f => (
                    <div key={f.id} className="flex justify-between items-center text-xs bg-white border border-slate-100 p-2 rounded-xl">
                      <div className="truncate mr-2">
                        <span className="font-bold text-slate-700 truncate">{f.name}</span>
                        <span className="ml-1.5 px-1 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[8px] font-bold">{f.category}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold text-slate-600">¥{f.amount.toLocaleString()}</span>
                        <button onClick={() => removeFixedCost(f.id)} className="text-red-400">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* フローティング「＋」ボタン */}
      <div className="fixed bottom-5 right-5 z-40">
        <button onClick={() => setIsInputOpen(!isInputOpen)} className={`w-12 h-12 ${isInputOpen ? 'bg-slate-700 rotate-45' : 'bg-blue-600'} text-white rounded-full flex items-center justify-center text-xl font-black shadow-lg transition-all transform active:scale-95`}>
          ＋
        </button>
      </div>

      {/* スライドイン入力パネル */}
      {isInputOpen && (
        <>
          <div onClick={() => setIsInputOpen(false)} className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs" />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl p-5 z-50 shadow-2xl border-t border-slate-100 animate-slide-up">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-black text-slate-800 mb-3 text-center uppercase tracking-wider">💸 支出を手動で記録</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">金額を入力</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-slate-200 p-3 rounded-2xl w-full text-base font-bold focus:border-blue-500 mt-1" placeholder="¥ 0" autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ジャンルを選択</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} className={`py-2 rounded-xl text-[10px] font-bold transition-all border ${category === cat ? 'bg-blue-50 text-blue-600 border-blue-400' : 'bg-slate-50 text-slate-500 border-transparent'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSpend} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-sm transition-colors mt-2">
                この支出を登録する
              </button>
            </div>
          </div>
        </>
      )}

      {/* AIプロンプトコピー用のモーダルウインドウ */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-xs font-black text-slate-800">📋 生成されたAIコンサル用プロンプト</h4>
              <button onClick={() => setShowPromptModal(false)} className="text-slate-400 font-bold text-xs">✕</button>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              下のテキストエリアを全選択してコピーし、お好きなAI（ChatGPT、Geminiなど）にそのまま貼り付けてください。柔軟な固定費削減コンサルレポートがその場で生成されます。
            </p>
            <textarea readOnly value={generatedPrompt} className="w-full flex-1 border border-slate-200 rounded-xl p-2 text-[9px] font-mono bg-slate-50 text-slate-600 focus:outline-none resize-none min-h-[250px]" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            <button onClick={() => {
              navigator.clipboard.writeText(generatedPrompt);
              alert('📋 プロンプトをクリップボードにコピーしました！AIに貼り付けてみてください。');
              setShowPromptModal(false);
            }} className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm">
              コピーして閉じる
            </button>
          </div>
        </div>
      )}

    </div>
  );
}