'use client';
import { useState, useEffect } from 'react';
import { parsePayPayCSV, Expense, Category, CategoryRule } from '@/lib/csvParser';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [targetSavings, setTargetSavings] = useState<number>(100000);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([
    { id: '1', name: '家賃・家計固定費分', amount: 50000, category: 'その他' },
    { id: '2', name: 'サブスク(Spotify等)', amount: 10000, category: 'その他' }
  ]);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newFixedCategory, setNewFixedCategory] = useState<Category>('その他');
  
  const [isMounted, setIsMounted] = useState(false);

  // 🎨 ジャンルが増えたため、グラフのカラーパレットを鮮やかな7色＋グレー系に拡張
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7', '#64748b', '#94a3b8'];
  
  // 🏷️ 拡張されたジャンル一覧
  const CATEGORIES: Category[] = ['食費', '日用品', '交通費', '旅行費', '株', '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'];

  const getSalaryCycleRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let start = new Date(year, month, 25);
    if (date < 25) start = new Date(year, month - 1, 25);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(24);
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
      message = '⚠️ 予算を使い切りました！週の締め処理を行うか節約してください。';
    } else if (dailyLimit < 1500) {
      status = 'danger';
      message = `🚨 ピンチ！1日あたり ¥${dailyLimit.toLocaleString()} 未満しか使えません。超節約モードです！`;
    } else if (dailyLimit < 2500) {
      status = 'warning';
      message = `⚠️ 注意：1日あたり ¥${dailyLimit.toLocaleString()} ペース。少し支出を抑えましょう。`;
    }
    return { status, message };
  };
  const smartAlert = getSmartAlert();

  const estimatedIncome = fixedCosts.reduce((sum, f) => sum + f.amount, 0) + 60000;
  const currentMonthReport = monthlyReports.find(r => r.month === currentCycle.label);
  const currentMonthSaved = currentMonthReport ? currentMonthReport.saved : 0;
  const savingsRate = estimatedIncome > 0 ? Math.round((currentMonthSaved / estimatedIncome) * 100) : 0;

  const targetAchievementRate = Math.min(100, Math.round((savings / targetSavings) * 100));

  // グラフデータ抽出（動的対応）
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const currentWeekCategoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: history.filter(h => h.category === cat && new Date(h.date.replace(/\//g, '-')) >= oneWeekAgo).reduce((sum, h) => sum + h.amount, 0)
  })).filter(d => d.value > 0);

  const portfolioData = CATEGORIES.map(cat => {
    const amount = currentCycleHistory.filter(h => h.category === cat).reduce((sum, h) => sum + h.amount, 0);
    return { name: cat, value: amount, percentage: totalCycleExpense > 0 ? Math.round((amount / totalCycleExpense) * 100) : 0 };
  }).filter(d => d.value > 0);

  // 比較用データ（過去基準は仮置き）
  const comparisonData = CATEGORIES.map(cat => ({
    name: cat, 
    先月基準: { '食費': 20000, '日用品': 10000, '交通費': 5000, '旅行費': 15000, '株': 10000, '美容・衣服': 8000, '交際費': 10000, '趣味・娯楽': 5000, '不明': 2000, 'その他': 5000 }[cat] || 5000,
    今月支出: currentCycleHistory.filter(h => h.category === cat).reduce((sum, h) => sum + h.amount, 0)
  }));

  useEffect(() => {
    setIsMounted(true);
    const data = localStorage.getItem('appData_v2');
    if (data) {
      const parsed = JSON.parse(data);
      setBalance(parsed.balance); setSavings(parsed.savings); setHistory(parsed.history || []); 
      setProcessedIds(parsed.processedIds || []); setMonthlyReports(parsed.monthlyReports || []);
      setLastSalaryUpdate(parsed.lastSalaryUpdate || ''); if (parsed.rules) setRules(parsed.rules);
      if (parsed.targetSavings) setTargetSavings(parsed.targetSavings);
      if (parsed.fixedCosts) setFixedCosts(parsed.fixedCosts);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${today.getMonth() + 1}`;
    
    if (today.getDate() >= 25 && lastSalaryUpdate !== currentYearMonth) {
      alert(`🎉 25日給料日になりました！【${currentCycle.label}】を開始します。\n設定された固定費（計 ¥${fixedCosts.reduce((s,f)=>s+f.amount, 0).toLocaleString()}）を自動計上しました。`);
      
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
  }, [isMounted, lastSalaryUpdate]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('appData_v2', JSON.stringify({ 
        balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts 
      }));
    }
  }, [balance, savings, history, processedIds, monthlyReports, rules, lastSalaryUpdate, targetSavings, fixedCosts, isMounted]);

  useEffect(() => {
    if (!isMounted || monthlyReports.length === 0) return;
    setMonthlyReports(prev => prev.map(r => r.month === currentCycle.label ? { ...r, spent: totalCycleExpense } : r));
  }, [totalCycleExpense, isMounted]);

  const handleSpend = () => {
    const expense = parseInt(amount);
    if (!isNaN(expense)) {
      setBalance(balance - expense);
      setHistory(prev => [{ id: Date.now().toString(), date: new Date().toLocaleDateString(), amount: expense, name: '手動入力', category }, ...prev]);
      setAmount('');
    }
  };

  const handleWeeklyClose = () => {
    if (confirm(`残高 ¥${balance.toLocaleString()} を貯蓄へ回し、次週予算にリセットしますか？`)) {
      setSavings(prev => prev + balance);
      setMonthlyReports(prev => {
        const existing = prev.find(r => r.month === currentCycle.label);
        if (existing) return prev.map(r => r.month === currentCycle.label ? { ...r, saved: r.saved + balance } : r);
        return [...prev, { month: currentCycle.label, saved: balance, spent: totalCycleExpense }];
      });
      setBalance(15000);
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 bg-gray-50 min-h-screen text-gray-800">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-4 gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">🛡️ 資産形成プロ Ver3.1</h1>
          <p className="text-xs text-gray-400 mt-0.5">運用中: {currentCycle.label}</p>
        </div>
        <div className="flex bg-gray-200 p-1 rounded-xl text-xs sm:text-sm shadow-inner self-start sm:self-center">
          {(['dashboard', 'analytics', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg font-medium transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab === 'dashboard' ? 'ホーム' : tab === 'analytics' ? '詳細分析' : '各種設定'}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-3 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
        smartAlert.status === 'danger' ? 'bg-red-50 border-red-200 text-red-700' :
        smartAlert.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-100 text-blue-700'
      }`}>
        {smartAlert.message}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <p className="text-xs text-gray-400 font-medium">今週の残金</p>
              <h2 className="text-2xl font-bold text-blue-600 mt-1">¥{balance.toLocaleString()}</h2>
              <div className="absolute bottom-0 left-0 h-1 bg-blue-500" style={{ width: `${Math.min(100, (balance/15000)*100)}%` }} />
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <p className="text-xs text-gray-400 font-medium">目標達成率 ({targetAchievementRate}%)</p>
              <h2 className="text-2xl font-bold text-green-600 mt-1">¥{savings.toLocaleString()} <span className="text-xs text-gray-400 font-normal">/ ¥{targetSavings.toLocaleString()}</span></h2>
              <div className="absolute bottom-0 left-0 h-1 bg-green-500" style={{ width: `${targetAchievementRate}%` }} />
            </div>
          </div>

          <div className="flex gap-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-gray-200 p-2 rounded-lg w-full text-sm focus:outline-none focus:border-blue-500" placeholder="手動支出の金額" />
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="border border-gray-200 p-2 rounded-lg text-sm bg-white focus:outline-none">
              {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
            </select>
            <button onClick={handleSpend} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors">登録</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-60">
              <h3 className="text-xs font-bold text-gray-500 mb-2">直近7日間の内訳</h3>
              {isMounted && currentWeekCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie data={currentWeekCategoryData} dataKey="value" nameKey="name" outerRadius={45} label>
                      {currentWeekCategoryData.map((d, i) => <Cell key={i} fill={COLORS[CATEGORIES.indexOf(d.name as Category) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-gray-400 text-center pt-20">期間内の支出はありません</p>}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-60">
              <h3 className="text-xs font-bold text-gray-500 mb-2">月次収支推移</h3>
              {isMounted && monthlyReports.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={monthlyReports}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend wrapperStyle={{fontSize: 10}} />
                    <Bar dataKey="spent" name="支出" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saved" name="貯蓄" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-gray-400 text-center pt-20">データ未蓄積</p>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleWeeklyClose} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-colors">週の締め処理を行う</button>
            <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between flex-1 gap-2">
              <span className="text-xs text-gray-500 font-bold whitespace-nowrap">PayPay明細:</span>
              <input type="file" onChange={handleFileUpload} className="text-xs text-gray-500 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-700 border-b pb-2 mb-2">直近の支出履歴</h3>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">履歴なし</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-xs border-b border-gray-50 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${h.id.startsWith('fixed-') ? 'text-purple-600' : 'text-gray-800'}`}>{h.name}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full scale-90">{h.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">¥{h.amount.toLocaleString()}</span>
                      <button onClick={() => deleteHistory(h.id)} className="text-red-500 hover:text-red-700 font-medium">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl text-white shadow-md">
            <h3 className="text-sm font-semibold opacity-90">【{currentCycle.label}】現在の家計貯蓄率スコア</h3>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold">{savingsRate}%</span>
              <span className="text-xs opacity-75">(今月の目安収入 ¥{estimatedIncome.toLocaleString()} に基づく)</span>
            </div>
            <p className="text-xs mt-3 bg-white/20 p-2 rounded-lg font-medium">
              {savingsRate >= 40 ? '👑 超エリート家計！素晴らしい資産形成ペースです。' :
               savingsRate >= 20 ? '👍 優良家計！理想的な財政バランスを維持できています。' :
               '🌱 これから！週の締め処理をして貯蓄額を増やしていきましょう。'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-1">【{currentCycle.label}】カテゴリ別 支出比較</h3>
            {isMounted && currentCycleHistory.length > 0 ? (
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend wrapperStyle={{fontSize: 11}} />
                    <Bar dataKey="先月基準" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="今月支出" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-gray-400 text-center py-16">このサイクルの支出データがまだありません</p>}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-1">【{currentCycle.label}】支出ポートフォリオ分析</h3>
            {isMounted && currentCycleHistory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center mt-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={portfolioData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={45} label>
                        {portfolioData.map((d, i) => <Cell key={i} fill={COLORS[CATEGORIES.indexOf(d.name as Category) % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  <h4 className="text-xs font-bold text-gray-600 mb-1">構成比率の実績値</h4>
                  {portfolioData.map((d) => {
                    const catIndex = CATEGORIES.indexOf(d.name as Category);
                    return (
                      <div key={d.name} className="flex justify-between items-center text-xs border-b border-gray-50 pb-1">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[catIndex % COLORS.length]}} />
                          {d.name}
                        </span>
                        <span className="font-bold text-gray-700">{d.percentage}% <span className="text-gray-400 font-normal">(¥{d.value.toLocaleString()})</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <p className="text-xs text-gray-400 text-center py-16">データ蓄積後に生成されます</p>}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-2">🏁 長期貯蓄目標の設定</h3>
            <div className="flex gap-2">
              <input type="number" value={targetSavings} onChange={(e) => setTargetSavings(parseInt(e.target.value) || 0)} className="border border-gray-200 p-2 rounded-lg text-sm w-full focus:outline-none focus:border-blue-500" placeholder="目標金額" />
              <span className="self-center font-bold text-sm text-gray-500">円</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1">🔄 毎月25日適用：固定費自動登録</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg mb-4">
              <input type="text" value={newFixedName} onChange={(e)=>setNewFixedName(e.target.value)} placeholder="固定費名" className="border p-2 rounded-lg text-xs bg-white" />
              <input type="number" value={newFixedAmount} onChange={(e)=>setNewFixedAmount(e.target.value)} placeholder="金額" className="border p-2 rounded-lg text-xs bg-white" />
              <div className="flex gap-2">
                <select value={newFixedCategory} onChange={(e)=>setNewFixedCategory(e.target.value as Category)} className="border p-2 rounded-lg text-xs bg-white w-full">
                  {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                </select>
                <button onClick={addFixedCost} className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-xs whitespace-nowrap">追加</button>
              </div>
            </div>

            <div className="space-y-2">
              {fixedCosts.map(f => (
                <div key={f.id} className="flex justify-between items-center text-xs bg-white border border-gray-100 p-2.5 rounded-lg">
                  <div>
                    <span className="font-bold text-gray-700">{f.name}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">{f.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">¥{f.amount.toLocaleString()}</span>
                    <button onClick={() => removeFixedCost(f.id)} className="text-red-400 hover:text-red-600">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}