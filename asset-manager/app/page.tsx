'use client';
import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Category } from '@/lib/csvParser';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';

const LAST_MONTH_BASE_MAP: Record<Category, number> = {
    '生活費': 30000, '食費': 20000, '日用品': 10000, '交通費': 5000, '旅行費': 15000, '株': 10000,
  '美容・衣服': 5000, '交際費': 5000, '趣味・娯楽': 5000, '不明': 5000, 'その他': 5000,
};

const parseSafeDate = (dateStr: string): Date =>
  new Date(dateStr.replace(/\//g, '-'));

const formatYen = (value: number) => `¥${value.toLocaleString()}`;

const PieCustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs">
        <p className="font-bold text-slate-700">{payload[0].name}</p>
        <p className="text-blue-600 font-extrabold">¥{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const BarCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs space-y-1">
        <p className="font-bold text-slate-600">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }} className="font-extrabold">
            {p.name}: ¥{p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { state, actions } = useDashboard();

  const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
    '#06b6d4', '#f97316', '#a855f7', '#64748b', '#94a3b8'
  ];

  const daysLeft = 7 - new Date().getDay() || 7;
  const dailyLimit = Math.max(1, Math.round(state.balance / daysLeft));
  const isDanger = state.balance <= 0 || dailyLimit < 1500;

  const currentWeekCategoryData = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return state.CATEGORIES.map(cat => ({
      name: cat,
      value: state.history
        .filter(h => h.category === cat && parseSafeDate(h.date) >= oneWeekAgo)
        .reduce((sum, h) => sum + h.amount, 0),
    })).filter(d => d.value > 0);
  }, [state.history, state.CATEGORIES]);

  const weekTotal = useMemo(() =>
    currentWeekCategoryData.reduce((sum, d) => sum + d.value, 0),
    [currentWeekCategoryData]
  );

  const comparisonData = useMemo(() => {
    const cycleStartDate = state.currentCycle.start ?? new Date();
    return state.CATEGORIES.map(cat => ({
      name: cat,
      '先月基準': LAST_MONTH_BASE_MAP[cat] ?? 5000,
      '今月支出': state.history
        .filter(h => h.category === cat && parseSafeDate(h.date) >= cycleStartDate)
        .reduce((sum, h) => sum + h.amount, 0),
    }));
  }, [state.history, state.CATEGORIES, state.currentCycle.start]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-slate-50 min-h-screen text-slate-800 font-sans antialiased">

      {/* ヘッダー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
            🛡️ 資産形成プロ
            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold">v5.8</span>
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {state.currentCycle.label} ／ 給料日起点: {state.salaryDay}日
            <span className="ml-3 text-slate-300">💾 {state.storageUsageKB}KB</span>
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl text-sm">
          {(['dashboard', 'analytics', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => actions.setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${state.activeTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
              {tab === 'dashboard' ? '📊 ホーム' : tab === 'analytics' ? '📈 詳細分析' : '⚙️ 各種設定'}
            </button>
          ))}
        </div>
      </div>

      {/* ---- タブ1: ホーム ---- */}
      {state.activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">

          {/* マイニング通知 */}
          {state.minedCandidates.length > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl text-white shadow-md flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black">🧠 パターンマイニングエンジン稼働中</h4>
                <p className="text-xs opacity-90 mt-0.5">{state.minedCandidates.length}件の変動費パターンを検出しました。</p>
              </div>
              <button onClick={() => { actions.setActiveTab('settings'); actions.setOpenSettingSection('mining'); }}
                className="bg-white text-indigo-600 text-xs font-black px-4 py-2 rounded-xl shrink-0 hover:bg-slate-50 transition-colors">
                確認する
              </button>
            </div>
          )}

          {/* ★ 月次収支サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 月収 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">月収（手取り）</p>
              <p className="text-xl font-black text-slate-800 mt-1">
                {state.monthlyIncome > 0 ? `¥${state.monthlyIncome.toLocaleString()}` : <span className="text-sm text-slate-300">未設定</span>}
              </p>
            </div>
            {/* 楽天固定費合計 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💳 確定固定費（楽天）</p>
              <p className="text-xl font-black text-rose-500 mt-1">- ¥{state.monthlySummary.rakutenTotal.toLocaleString()}</p>
            </div>
            {/* 変動費予算残 */}
            <div className={`p-4 rounded-2xl border shadow-xs ${state.monthlySummary.variableOver ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📱 変動費残予算</p>
              <p className={`text-xl font-black mt-1 ${state.monthlySummary.variableOver ? 'text-red-500' : 'text-slate-800'}`}>
                {state.monthlySummary.variableOver ? '超過！' : `¥${state.monthlySummary.variableRemaining.toLocaleString()}`}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{state.monthlySummary.variableProgress}% 消化</p>
            </div>
            {/* 予定貯蓄 */}
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">💰 今月の予定貯蓄</p>
              <p className="text-xl font-black text-emerald-600 mt-1">¥{state.monthlySummary.plannedSavings.toLocaleString()}</p>
            </div>
          </div>

          {/* 変動費予算プログレスバー */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600">📱 今月の変動費予算消化率</span>
              <span className="font-bold text-slate-500">
                ¥{state.monthlySummary.actualVariable.toLocaleString()} / ¥{state.variableBudget.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  state.monthlySummary.variableOver ? 'bg-red-500' :
                  state.monthlySummary.variableProgress > 80 ? 'bg-amber-400' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, state.monthlySummary.variableProgress)}%` }}
              />
            </div>
            {state.monthlySummary.variableOver && (
              <p className="text-xs text-red-500 font-bold">
                ⚠️ ¥{(state.monthlySummary.actualVariable - state.variableBudget).toLocaleString()} 予算オーバーです
              </p>
            )}
          </div>

          {/* 貯蓄目標達成バー */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-bold text-slate-500">🏆 長期貯蓄目標 達成率</p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">
                  ¥{state.totalSavings.toLocaleString()}
                  <span className="text-sm font-bold text-slate-400 ml-1">/ ¥{state.targetSavings.toLocaleString()}</span>
                </p>
              </div>
              <span className="text-3xl font-black text-emerald-500">{state.savingsProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                style={{ width: `${state.savingsProgress}%` }} />
            </div>
            <p className="text-xs text-slate-400">目標まで残り ¥{Math.max(0, state.targetSavings - state.totalSavings).toLocaleString()}</p>
          </div>

          {/* メイン2カラム */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">

              {/* 残金カード */}
              <div className={`p-6 rounded-2xl text-white shadow-md border bg-gradient-to-br ${isDanger ? 'from-rose-500 to-red-600 border-red-400' : 'from-blue-500 to-indigo-600 border-blue-400'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <p className="text-xs opacity-80 font-bold">今週の残金</p>
                    <h2 className="text-3xl font-black mt-1">¥{state.balance.toLocaleString()}</h2>
                    <p className="text-xs opacity-60 mt-0.5">週予算 ¥30,000 から</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-80 font-bold">1日あたりの上限</p>
                    <p className="text-2xl font-extrabold mt-1">¥{dailyLimit.toLocaleString()}</p>
                    <p className="text-xs opacity-60 mt-0.5">残り {daysLeft}日で割った値</p>
                  </div>
                  <div className="text-center bg-white/15 p-3 rounded-xl text-xs">
                    {state.balance <= 0 ? '⚠️ 予算終了！' : dailyLimit < 1500 ? '🔴 節約が必要です' : '🟢 計画通りです'}
                  </div>
                </div>
              </div>

              {/* グラフエリア */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-sm font-black text-slate-700">📊 データ可視化</h3>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    <button onClick={() => actions.setGraphType('week')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'week' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}>
                      今週の支出内訳
                    </button>
                    <button onClick={() => actions.setGraphType('monthly')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'monthly' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}>
                      月次推移
                    </button>
                  </div>
                </div>

                {!state.isMounted ? (
                  <div className="w-full h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">グラフを読み込み中...</div>
                ) : state.graphType === 'week' ? (
                  <div>
                    <div className="flex justify-between mb-3 px-1 text-xs">
                      <p className="font-bold text-slate-500">
                        📅 直近7日間の支出合計:
                        <span className="text-slate-800 ml-1 font-black">¥{weekTotal.toLocaleString()}</span>
                      </p>
                      <p className="text-slate-400">消化率: {Math.min(100, Math.round((weekTotal / 30000) * 100))}%</p>
                    </div>
                    {currentWeekCategoryData.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center gap-4 h-64">
                        <div className="w-full md:w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={currentWeekCategoryData} dataKey="value" nameKey="name" outerRadius={85} innerRadius={40}>
                                {currentWeekCategoryData.map((d, i) => (
                                  <Cell key={i} fill={COLORS[state.CATEGORIES.indexOf(d.name as Category) % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<PieCustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 space-y-1.5 text-xs overflow-y-auto max-h-60">
                          {[...currentWeekCategoryData].sort((a, b) => b.value - a.value).map((d, i) => {
                            const colorIndex = state.CATEGORIES.indexOf(d.name as Category) % COLORS.length;
                            const pct = Math.round((d.value / weekTotal) * 100);
                            return (
                              <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[colorIndex] }} />
                                  <span className="font-bold text-slate-700 truncate">{d.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-slate-400">{pct}%</span>
                                  <span className="font-extrabold text-slate-800">¥{d.value.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : <p className="text-sm text-slate-400 text-center py-24">この週のデータがありません</p>}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 font-bold mb-3 px-1">📅 月次の支出と貯蓄の推移（直近6ヶ月）</p>
                    {state.monthlyReports.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={state.monthlyReports} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <YAxis tickFormatter={formatYen} tick={{ fontSize: 10 }} width={75} />
                            <Tooltip content={<BarCustomTooltip />} />
                            <Legend formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                            <Bar dataKey="spent" name="支出合計" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="spent" position="top"
                                formatter={(v) => { const n = parseFloat(String(v)); return isNaN(n) ? '' : `¥${(n / 10000).toFixed(0)}万`; }}
                                style={{ fontSize: 9, fontWeight: 'bold', fill: '#f43f5e' }} />
                            </Bar>
                            <Bar dataKey="saved" name="累計貯蓄" fill="#10b981" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="saved" position="top"
                                formatter={(v) => { const n = parseFloat(String(v)); return isNaN(n) ? '' : `¥${(n / 10000).toFixed(0)}万`; }}
                                style={{ fontSize: 9, fontWeight: 'bold', fill: '#10b981' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-sm text-slate-400 text-center py-24">データ蓄積中...</p>}
                  </div>
                )}
              </div>
            </div>

            {/* 右側サイドバー */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-700">⚡ クイック操作</h3>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => actions.executeWeeklyClose('save')} className="bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">💰 残金をすべて貯蓄へ回す</button>
                  <button onClick={() => actions.executeWeeklyClose('carryOver')} className="bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">🏃‍♂️ 来週へ繰り越す</button>
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-500 block">📱 PayPay明細（CSV）:</span>
                    <input type="file" onChange={actions.handleFileUpload} className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-700">💸 支出の手動入力</h3>
                <input type="number" value={state.amount} onChange={(e) => actions.setAmount(e.target.value)}
                  className="border p-2.5 rounded-xl w-full text-sm font-bold focus:border-blue-500 focus:outline-none" placeholder="金額を入力 ¥" />
                <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto border p-1 rounded-lg bg-slate-50">
                  {state.CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => actions.setCategory(cat)}
                      className={`py-1 rounded-md text-[10px] font-bold border transition-all ${state.category === cat ? 'bg-blue-50 text-blue-600 border-blue-400' : 'bg-white text-slate-500 border-transparent hover:bg-slate-100'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <button onClick={actions.handleSpend} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-black text-xs transition-colors">記録する</button>
              </div>
            </div>
          </div>

          {/* ★ 最新順ソート済み明細ログ */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-black text-slate-700">
                📜 最新の支出明細ログ
                <span className="ml-2 text-xs font-normal text-slate-400">（全{state.history.length}件 / 新しい順）</span>
              </h3>
            </div>
            {!state.isMounted || state.sortedHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">履歴がありません。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 max-h-60 overflow-y-auto pr-2">
                {state.sortedHistory.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-xs py-2.5 border-b border-slate-100 hover:bg-slate-50 px-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{h.date}</span>
                      <span className={`font-bold truncate max-w-[160px] ${h.id.startsWith('rakuten-monthly-') ? 'text-rose-500' : h.id.startsWith('fixed-') ? 'text-purple-600' : 'text-slate-800'}`}>
                        {h.name}
                      </span>
                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium shrink-0">{h.category}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-slate-800">¥{h.amount.toLocaleString()}</span>
                      <button onClick={() => actions.deleteHistory(h.id)} className="text-slate-300 hover:text-red-500 font-bold text-sm transition-colors px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- タブ2: 詳細分析 ---- */}
      {state.activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col justify-center space-y-2">
              <h3 className="text-xs opacity-80 uppercase font-bold tracking-wider">📈 {state.currentCycle.label} 貯蓄率</h3>
              <p className="text-4xl font-black text-emerald-400">{state.savingsRate}%</p>
              <p className="text-[11px] opacity-50">月収ベースの計算値</p>
              <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                <p className="opacity-70">月収: <span className="font-bold opacity-100">¥{state.monthlyIncome.toLocaleString()}</span></p>
                <p className="opacity-70">確定固定費: <span className="font-bold text-rose-400">- ¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span></p>
                <p className="opacity-70">変動費予算: <span className="font-bold text-amber-400">- ¥{state.variableBudget.toLocaleString()}</span></p>
                <p className="opacity-70">予定貯蓄: <span className="font-bold text-emerald-400">¥{state.monthlySummary.plannedSavings.toLocaleString()}</span></p>
                <p className="opacity-70">累計貯蓄: <span className="font-bold text-emerald-400">¥{state.totalSavings.toLocaleString()}</span></p>
              </div>
            </div>
            <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-black text-slate-700 mb-1">⚖️ カテゴリ別 前月比較</h3>
              <p className="text-xs text-slate-400 mb-4">灰色=先月の目安 / 青=今月の実績（円）</p>
              <div className="h-64">
                {state.isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                      <YAxis tickFormatter={formatYen} tick={{ fontSize: 9 }} width={75} />
                      <Tooltip content={<BarCustomTooltip />} />
                      <Legend formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                      <Bar dataKey="先月基準" name="先月の目安" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="今月支出" name="今月の実績" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">分析データを収集中...</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- タブ3: 設定 ---- */}
      {state.activeTab === 'settings' && (
        <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">

          {/* ストレージ */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-700 mb-3">💾 データ保存状況</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${state.storageUsageKB > 4000 ? 'bg-red-500' : state.storageUsageKB > 2000 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (state.storageUsageKB / 5120) * 100)}%` }} />
              </div>
              <span className="font-bold text-slate-600 shrink-0">{state.storageUsageKB}KB / 5MB</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">※ 6ヶ月以上前の明細は月次集計に自動圧縮されます。</p>
          </div>

          {/* ★ 収入・予算設定 */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'income' ? null : 'income')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100/80 transition-colors">
              <span>💴 収入・予算設定</span>
              <span>{state.openSettingSection === 'income' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'income' && (
              <div className="p-5 border-t border-slate-100 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1.5">月収（手取り）</label>
                    <input type="number" value={state.monthlyIncome || ''}
                      onChange={(e) => actions.setMonthlyIncome(parseInt(e.target.value) || 0)}
                      className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none"
                      placeholder="例: 250000" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1.5">月の変動費予算</label>
                    <input type="number" value={state.variableBudget || ''}
                      onChange={(e) => actions.setVariableBudget(parseInt(e.target.value) || 0)}
                      className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none"
                      placeholder="例: 120000" />
                  </div>
                </div>
                {/* 収支シミュレーション */}
                {state.monthlyIncome > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs border border-slate-100">
                    <p className="font-black text-slate-600 text-sm mb-2">📊 月次収支シミュレーション</p>
                    <div className="flex justify-between"><span className="text-slate-500">月収（手取り）</span><span className="font-bold">¥{state.monthlyIncome.toLocaleString()}</span></div>
                    <div className="flex justify-between text-rose-500"><span>- 確定固定費（楽天）</span><span className="font-bold">¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-amber-500"><span>- 変動費予算</span><span className="font-bold">¥{state.variableBudget.toLocaleString()}</span></div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between text-emerald-600 font-black">
                      <span>= 予定貯蓄額</span><span>¥{state.monthlySummary.plannedSavings.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ★ 楽天確定固定費 */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'rakuten' ? null : 'rakuten')}
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-black text-sm">
              <span>💳 楽天確定固定費（毎月25日に自動計上）</span>
              <span>{state.openSettingSection === 'rakuten' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'rakuten' && (
              <div className="p-5 border-t border-slate-100 space-y-4 text-xs">
                <p className="text-slate-500 text-xs leading-relaxed bg-rose-50 p-3 rounded-xl border border-rose-100">
                  💡 家賃・保険・定期サブスクなど<strong>毎月確定する支出</strong>をここに登録します。<br/>
                  毎月25日（給料日）に自動で支出履歴に計上されます。PayPayの変動費とは別管理です。
                </p>
                <div className="flex gap-2 bg-slate-50 p-2 rounded-xl flex-wrap">
                  <input type="text" value={state.newRakutenName} onChange={(e) => actions.setNewRakutenName(e.target.value)}
                    placeholder="例：家賃、Spotify、保険など" className="border p-2 rounded-xl bg-white flex-1 min-w-32 text-xs focus:outline-none" />
                  <input type="number" value={state.newRakutenAmount} onChange={(e) => actions.setNewRakutenAmount(e.target.value)}
                    placeholder="金額 ¥" className="border p-2 rounded-xl bg-white w-28 text-xs focus:outline-none" />
                  <select value={state.newRakutenCategory} onChange={(e) => actions.setNewRakutenCategory(e.target.value as Category)}
                    className="border p-2 rounded-xl bg-white text-xs focus:outline-none">
                    {state.CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={actions.addRakutenFixedCost} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl font-bold transition-colors">追加</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {state.rakutenFixedCosts.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-white shadow-2xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.category}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-slate-600">¥{c.amount.toLocaleString()}</span>
                        <button onClick={() => actions.removeRakutenFixedCost(c.id)} className="text-slate-300 hover:text-red-500 font-bold text-sm">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl flex justify-between items-center border border-slate-100">
                  <span className="font-bold text-slate-600">月次固定費 合計</span>
                  <span className="font-black text-rose-500 text-base">¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* AIマイニング */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'mining' ? null : 'mining')}
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm">
              <span>🧠 PayPay変動費パターン解析エンジン</span>
              <span>{state.openSettingSection === 'mining' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'mining' && (
              <div className="p-5 space-y-4 text-xs">
                <p className="text-slate-500 bg-purple-50 p-3 rounded-xl border border-purple-100">
                  💡 PayPay明細から検出した<strong>周期的な変動費パターン</strong>です。楽天の確定固定費とは別に管理されます。
                </p>
                {state.minedCandidates.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">候補データがまだ蓄積されていません</p>
                ) : (
                  <div className="space-y-4">
                    <button onClick={() => actions.setShowPromptModal(true)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                      🤖 AIコンサルティングプロンプトを生成
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                      {state.minedCandidates.map((cand, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-col justify-between space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <h5 className="font-bold text-slate-800 truncate">{cand.normalizedName}</h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">毎月{cand.typicalDay}日頃 ／ {cand.appearances.length}回</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold block text-sm">¥{cand.averageAmount.toLocaleString()}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${cand.isConstantAmount ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {cand.isConstantAmount ? '定額' : '変動'}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => actions.acceptAsFixedCost(cand)}
                            className="w-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-bold py-2 rounded-lg border border-slate-100 hover:border-purple-200 transition-all">
                            変動費パターンとして登録
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 基本設定 */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'target' ? null : 'target')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100/80 transition-colors">
              <span>🎯 基本設定（長期目標額・給料日）</span>
              <span>{state.openSettingSection === 'target' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'target' && (
              <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1.5">長期貯蓄目標総額</label>
                  <input type="number" value={state.targetSavings}
                    onChange={(e) => actions.setTargetSavings(parseInt(e.target.value) || 0)}
                    className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-500 block mb-1.5">給料日（サイクル起点日）</label>
                  <input type="number" min="1" max="28" value={state.salaryDay}
                    onChange={(e) => actions.setSalaryDay(parseInt(e.target.value) || 25)}
                    className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* AIプロンプトモーダル */}
      {state.showPromptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl p-5 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="text-sm font-black text-slate-800">📋 AIコンサルタント用プロンプト</h4>
              <button onClick={() => actions.setShowPromptModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <textarea readOnly value={state.generatedPrompt}
              className="w-full flex-1 border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50 text-slate-600 resize-none min-h-[300px] focus:outline-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => actions.setShowPromptModal(false)} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold text-slate-600">閉じる</button>
              <button onClick={() => { navigator.clipboard.writeText(state.generatedPrompt); alert('📋 コピーしました！'); actions.setShowPromptModal(false); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl transition-colors">コピー</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}