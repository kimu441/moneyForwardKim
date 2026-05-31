'use client';
import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Category } from '@/lib/csvParser';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList,
  LineChart, Line, ReferenceLine,
} from 'recharts';

const LAST_MONTH_BASE_MAP: Record<Category, number> = {
  '生活費' : 30000,
  '食費': 20000, '日用品': 10000, '交通費': 5000, '旅行費': 15000, '株': 10000,
  '美容・衣服': 5000, '交際費': 5000, '趣味・娯楽': 5000, '不明': 5000, 'その他': 5000,
};
const toDate = (s: string) => new Date(s.replace(/\//g, '-'));
const formatYen = (v: number) => `¥${Number(v).toLocaleString()}`;

const PieTip = ({ active, payload }: any) => active && payload?.length ? (
  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs">
    <p className="font-bold text-slate-700">{payload[0].name}</p>
    <p className="text-blue-600 font-extrabold">¥{payload[0].value.toLocaleString()}</p>
  </div>
) : null;

const BarTip = ({ active, payload, label }: any) => active && payload?.length ? (
  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs space-y-1">
    <p className="font-bold text-slate-600">{label}</p>
    {payload.map((p: any) => (
      <p key={p.name} style={{ color: p.fill }} className="font-extrabold">
        {p.name}: ¥{Number(p.value).toLocaleString()}
      </p>
    ))}
  </div>
) : null;

export default function Dashboard() {
  const { state, actions } = useDashboard();

  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316','#a855f7','#64748b','#94a3b8'];

  const dailyLimit = Math.max(1, Math.round(state.currentWeekBalance / Math.max(1, state.daysLeft)));
  const isDanger = state.currentWeekBalance <= 0 || dailyLimit < 1000;

  // 表示中の週のカテゴリ別支出（変動費のみ）
  const weekCategoryData = useMemo(() =>
    state.CATEGORIES.filter(c => c !== '旅行費').map(cat => ({
      name: cat,
      value: state.viewingWeekVariable
        .filter(h => h.category === cat)
        .reduce((s, h) => s + h.amount, 0),
    })).filter(d => d.value > 0),
    [state.viewingWeekVariable, state.CATEGORIES]
  );

  const weekTotal = useMemo(() =>
    weekCategoryData.reduce((s, d) => s + d.value, 0),
    [weekCategoryData]
  );

  // カテゴリ比較（変動費のみ）
  const comparisonData = useMemo(() => {
    const start = state.currentCycle.start ?? new Date();
    return state.CATEGORIES.filter(c => c !== '旅行費').map(cat => ({
      name: cat,
      '先月基準': LAST_MONTH_BASE_MAP[cat] ?? 5000,
      '今月支出': state.history
        .filter(h => h.category === cat && !h.id.startsWith('rakuten-monthly-') && toDate(h.date) >= start)
        .reduce((s, h) => s + h.amount, 0),
    }));
  }, [state.history, state.CATEGORIES, state.currentCycle.start]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 bg-slate-50 min-h-screen text-slate-800 font-sans antialiased">

      {/* ヘッダー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-1.5">
            🛡️ 資産形成プロ
            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold">v6.0</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {state.currentCycle.label} ／ 給料日: {state.salaryDay}日
            <span className="ml-3 text-slate-300">💾 {state.storageUsageKB}KB</span>
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl text-sm">
          {(['dashboard','analytics','settings'] as const).map(tab => (
            <button key={tab} onClick={() => actions.setActiveTab(tab)}
              className={`px-3 md:px-4 py-2 rounded-lg font-bold transition-all ${state.activeTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
              {tab === 'dashboard' ? '📊 ホーム' : tab === 'analytics' ? '📈 分析' : '⚙️ 設定'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== タブ1: ホーム ===== */}
      {state.activeTab === 'dashboard' && (
        <div className="space-y-5">

          {/* マイニング通知 */}
          {state.minedCandidates.length > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl text-white flex justify-between items-center">
              <div>
                <p className="text-sm font-black">🧠 変動費パターンを{state.minedCandidates.length}件検出</p>
              </div>
              <button onClick={() => { actions.setActiveTab('settings'); actions.setOpenSettingSection('mining'); }}
                className="bg-white text-indigo-600 text-xs font-black px-3 py-1.5 rounded-xl shrink-0">確認</button>
            </div>
          )}

          {/* ★ 月次収支サマリー（4枚カード）*/}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase">月収（手取り）</p>
              <p className="text-lg font-black text-slate-800 mt-1">
                {state.monthlyIncome > 0 ? `¥${state.monthlyIncome.toLocaleString()}` : <span className="text-xs text-slate-300">未設定</span>}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase">💳 確定固定費</p>
              <p className="text-lg font-black text-rose-500 mt-1">-¥{state.monthlySummary.rakutenTotal.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-2xl border shadow-xs ${state.monthlySummary.variableOver ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase">📱 変動費残予算</p>
              <p className={`text-lg font-black mt-1 ${state.monthlySummary.variableOver ? 'text-red-500' : 'text-slate-800'}`}>
                {state.monthlySummary.variableOver ? '超過！' : `¥${state.monthlySummary.variableRemaining.toLocaleString()}`}
              </p>
              <p className="text-[10px] text-slate-400">{state.monthlySummary.variableProgress}% 消化</p>
            </div>
            {/* ★ 旅行費カード */}
            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 shadow-xs">
              <p className="text-[10px] font-bold text-sky-500 uppercase">✈️ 今月の旅行費</p>
              <p className="text-lg font-black text-sky-600 mt-1">¥{state.travelTotal.toLocaleString()}</p>
              <p className="text-[10px] text-sky-400 mt-0.5">24日にリセット</p>
            </div>
          </div>

          {/* 変動費予算バー */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-600">📱 今月の変動費消化率</span>
              <span className="text-slate-500">¥{state.monthlySummary.actualVariable.toLocaleString()} / ¥{state.variableBudget.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className={`h-2.5 rounded-full transition-all ${state.monthlySummary.variableOver ? 'bg-red-500' : state.monthlySummary.variableProgress > 80 ? 'bg-amber-400' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, state.monthlySummary.variableProgress)}%` }} />
            </div>
            {state.monthlySummary.variableOver && (
              <p className="text-xs text-red-500 font-bold">⚠️ ¥{(state.monthlySummary.actualVariable - state.variableBudget).toLocaleString()} 超過</p>
            )}
          </div>

          {/* 貯蓄目標バー */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-bold text-slate-500">🏆 長期貯蓄目標</p>
                <p className="text-xl font-black text-emerald-600">
                  ¥{state.totalSavings.toLocaleString()}
                  <span className="text-sm font-bold text-slate-400 ml-1">/ ¥{state.targetSavings.toLocaleString()}</span>
                </p>
              </div>
              <span className="text-2xl font-black text-emerald-500">{state.savingsProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                style={{ width: `${state.savingsProgress}%` }} />
            </div>
          </div>

          {/* メイン2カラム */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-5">

              {/* ★ 週ナビ付き 残金カード */}
              <div className="space-y-2">
                {/* 週ナビゲーション */}
                <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-xs text-sm">
                  <button onClick={() => actions.setWeekOffset(state.weekOffset - 1)}
                    className="text-slate-400 hover:text-slate-700 font-black px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">← 先週</button>
                  <div className="text-center">
                    <p className={`font-black text-xs ${state.weekOffset === 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                      {state.weekOffset === -1 ? '📅 先週' : state.weekOffset === 0 ? '📅 今週' : '📅 来週'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{state.viewingWeek.label}</p>
                  </div>
                  <button onClick={() => actions.setWeekOffset(Math.min(1, state.weekOffset + 1))}
                    className="text-slate-400 hover:text-slate-700 font-black px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">来週 →</button>
                </div>

                {/* 残金カード */}
                <div className={`p-5 rounded-2xl text-white shadow-md border bg-gradient-to-br ${
                  state.weekOffset !== 0 ? 'from-slate-500 to-slate-700 border-slate-400' :
                  isDanger ? 'from-rose-500 to-red-600 border-red-400' : 'from-blue-500 to-indigo-600 border-blue-400'
                }`}>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="text-xs opacity-80 font-bold">
                        {state.weekOffset === -1 ? '先週の支出' : state.weekOffset === 0 ? '今週の残金' : '来週の予測残金'}
                      </p>
                      <h2 className="text-3xl font-black mt-1">
                        {state.weekOffset === -1
                          ? `¥${state.viewingWeekSpent.toLocaleString()}`
                          : `¥${state.currentWeekBalance.toLocaleString()}`}
                      </h2>
                      <p className="text-xs opacity-60 mt-0.5">週予算 ¥{state.weeklyBudget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-80 font-bold">
                        {state.weekOffset === 0 ? '1日あたりの上限' : '週の合計支出'}
                      </p>
                      <p className="text-2xl font-extrabold mt-1">
                        {state.weekOffset === 0
                          ? `¥${dailyLimit.toLocaleString()}`
                          : `¥${state.viewingWeekSpent.toLocaleString()}`}
                      </p>
                      {state.weekOffset === 0 && <p className="text-xs opacity-60">残り{state.daysLeft}日</p>}
                    </div>
                    <div className="text-center bg-white/15 p-3 rounded-xl text-xs">
                      {state.weekOffset === -1 ? `予算比 ${Math.round((state.viewingWeekSpent / state.weeklyBudget) * 100)}%使用` :
                       state.weekOffset === 0 ? (state.currentWeekBalance <= 0 ? '⚠️ 予算終了！' : dailyLimit < 1000 ? '🔴 節約を！' : '🟢 計画通り') :
                       '来週の予測値'}
                    </div>
                  </div>
                </div>
              </div>

              {/* グラフエリア（変動費のみ）*/}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-700">📊 データ可視化（変動費のみ）</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">固定費・旅行費は含みません</p>
                  </div>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    <button onClick={() => actions.setGraphType('week')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'week' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}>
                      {state.weekOffset === 0 ? '今週' : state.weekOffset === -1 ? '先週' : '来週'}の内訳
                    </button>
                    <button onClick={() => actions.setGraphType('monthly')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'monthly' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}>
                      月次推移
                    </button>
                  </div>
                </div>

                {!state.isMounted ? (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">読み込み中...</div>
                ) : state.graphType === 'week' ? (
                  <div>
                    <div className="flex justify-between mb-3 px-1 text-xs">
                      <p className="font-bold text-slate-500">
                        支出合計: <span className="text-slate-800 font-black">¥{weekTotal.toLocaleString()}</span>
                      </p>
                      <p className="text-slate-400">予算消化: {Math.min(100, Math.round((weekTotal / state.weeklyBudget) * 100))}%</p>
                    </div>
                    {weekCategoryData.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center gap-4 h-60">
                        <div className="w-full md:w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={weekCategoryData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={35}>
                                {weekCategoryData.map((d, i) => (
                                  <Cell key={i} fill={COLORS[state.CATEGORIES.indexOf(d.name as Category) % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<PieTip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 space-y-1.5 text-xs overflow-y-auto max-h-56">
                          {[...weekCategoryData].sort((a, b) => b.value - a.value).map((d, i) => {
                            const ci = state.CATEGORIES.indexOf(d.name as Category) % COLORS.length;
                            const pct = weekTotal > 0 ? Math.round((d.value / weekTotal) * 100) : 0;
                            return (
                              <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[ci] }} />
                                  <span className="font-bold text-slate-700 truncate">{d.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-slate-400">{pct}%</span>
                                  <span className="font-extrabold">¥{d.value.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : <p className="text-sm text-slate-400 text-center py-20">この週のデータがありません</p>}
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={state.monthlyReports} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis tickFormatter={formatYen} tick={{ fontSize: 10 }} width={75} />
                        <Tooltip content={<BarTip />} />
                        <Legend formatter={v => <span className="text-xs font-bold text-slate-600">{v}</span>} />
                        <Bar dataKey="spent" name="変動費合計" fill="#f43f5e" radius={[4,4,0,0]}>
                          <LabelList dataKey="spent" position="top"
                            formatter={(v: any) => { const n = parseFloat(String(v)); return isNaN(n) ? '' : `¥${(n/10000).toFixed(0)}万`; }}
                            style={{ fontSize: 9, fontWeight: 'bold', fill: '#f43f5e' }} />
                        </Bar>
                        <Bar dataKey="saved" name="累計貯蓄" fill="#10b981" radius={[4,4,0,0]}>
                          <LabelList dataKey="saved" position="top"
                            formatter={(v: any) => { const n = parseFloat(String(v)); return isNaN(n) ? '' : `¥${(n/10000).toFixed(0)}万`; }}
                            style={{ fontSize: 9, fontWeight: 'bold', fill: '#10b981' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* 右サイドバー */}
            <div className="space-y-5">
              {/* クイック操作 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-700">⚡ クイック操作</h3>
                <div className="space-y-2">
                  <button onClick={() => actions.executeWeeklyClose('save')} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">💰 残金を貯蓄へ回す</button>
                  <button onClick={() => actions.executeWeeklyClose('carryOver')} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">🏃 来週へ繰り越す</button>
                </div>
                <div className="border-t pt-3 space-y-1 text-xs">
                  <span className="font-bold text-slate-500 block">📱 PayPay明細（CSV）:</span>
                  <input type="file" onChange={actions.handleFileUpload}
                    className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700" />
                </div>
              </div>

              {/* ★ 変動費 手動入力（現金タグ） */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-700">💴 変動費 手動入力
                  <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">現金タグ付き</span>
                </h3>
                <input type="number" value={state.amount} onChange={e => actions.setAmount(e.target.value)}
                  className="border p-2.5 rounded-xl w-full text-sm font-bold focus:border-blue-500 focus:outline-none"
                  placeholder="金額 ¥" />
                <div className="grid grid-cols-3 gap-1 max-h-20 overflow-y-auto border p-1 rounded-lg bg-slate-50">
                  {state.CATEGORIES.filter(c => c !== '旅行費').map(cat => (
                    <button key={cat} onClick={() => actions.setCategory(cat)}
                      className={`py-1 rounded-md text-[10px] font-bold border transition-all ${state.category === cat ? 'bg-blue-50 text-blue-600 border-blue-400' : 'bg-white text-slate-500 border-transparent hover:bg-slate-100'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <button onClick={actions.handleSpend} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-black text-xs transition-colors">記録する（今週残金から引く）</button>
              </div>

              {/* ★ 旅行費 手動入力 */}
              <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-sky-700">✈️ 旅行の支出
                  <span className="ml-1.5 text-[10px] bg-sky-100 text-sky-500 px-1.5 py-0.5 rounded font-bold">週予算とは別管理</span>
                </h3>
                <input type="text" value={state.travelName} onChange={e => actions.setTravelName(e.target.value)}
                  className="border border-sky-200 p-2.5 rounded-xl w-full text-sm focus:border-sky-400 focus:outline-none bg-white"
                  placeholder="旅行名・内容（任意）" />
                <input type="number" value={state.travelAmount} onChange={e => actions.setTravelAmount(e.target.value)}
                  className="border border-sky-200 p-2.5 rounded-xl w-full text-sm font-bold focus:border-sky-400 focus:outline-none bg-white"
                  placeholder="金額 ¥" />
                <button onClick={actions.handleTravelSpend} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-xl font-black text-xs transition-colors">旅行費として記録する</button>
                {state.travelExpenses.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto border-t border-sky-100 pt-2">
                    {state.travelExpenses.map(t => (
                      <div key={t.id} className="flex justify-between items-center text-xs py-1.5 px-1 hover:bg-sky-100 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-bold text-sky-700 truncate">{t.name}</p>
                          <p className="text-[10px] text-sky-400">{t.date}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold text-sky-600">¥{t.amount.toLocaleString()}</span>
                          <button onClick={() => actions.deleteTravelExpense(t.id)} className="text-sky-300 hover:text-red-400 font-bold">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 明細ログ（変動費のみ・最新順）*/}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-5">
            <div className="flex justify-between items-center border-b pb-3 mb-3">
              <h3 className="text-sm font-black text-slate-700">
                📜 変動費 明細ログ
                <span className="ml-2 text-xs font-normal text-slate-400">（{state.sortedVariableHistory.length}件 / 新しい順）</span>
              </h3>
            </div>
            {!state.isMounted || state.sortedVariableHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">履歴がありません。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 max-h-60 overflow-y-auto pr-2">
                {state.sortedVariableHistory.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-xs py-2.5 border-b border-slate-100 hover:bg-slate-50 px-1 rounded-lg">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{h.date}</span>
                      <span className="font-bold truncate max-w-[140px] text-slate-800">{h.name}</span>
                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{h.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold">¥{h.amount.toLocaleString()}</span>
                      <button onClick={() => actions.deleteHistory(h.id)} className="text-slate-300 hover:text-red-500 font-bold px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== タブ2: 詳細分析 ===== */}
      {state.activeTab === 'analytics' && (
        <div className="space-y-5">

          {/* 貯蓄率 + 月次収支 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col justify-center space-y-2">
              <h3 className="text-xs opacity-70 uppercase font-bold">📈 {state.currentCycle.label} 貯蓄率</h3>
              <p className="text-4xl font-black text-emerald-400">{state.savingsRate}%</p>
              <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                <p className="opacity-70">月収: <span className="font-bold opacity-100">¥{state.monthlyIncome.toLocaleString()}</span></p>
                <p className="opacity-70">固定費: <span className="font-bold text-rose-400">-¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span></p>
                <p className="opacity-70">変動費予算: <span className="font-bold text-amber-400">-¥{state.variableBudget.toLocaleString()}</span></p>
                <p className="opacity-70">旅行費: <span className="font-bold text-sky-400">-¥{state.travelTotal.toLocaleString()}</span></p>
                <p className="opacity-70 pt-1 border-t border-white/10">予定貯蓄: <span className="font-black text-emerald-400">¥{state.monthlySummary.plannedSavings.toLocaleString()}</span></p>
                <p className="opacity-70">累計貯蓄: <span className="font-bold text-emerald-400">¥{state.totalSavings.toLocaleString()}</span></p>
              </div>
            </div>

            {/* カテゴリ比較 */}
            <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-black text-slate-700 mb-1">⚖️ カテゴリ別 前月比較（変動費）</h3>
              <p className="text-xs text-slate-400 mb-3">灰=先月の目安 / 青=今月の実績</p>
              <div className="h-60">
                {state.isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 'bold' }} />
                      <YAxis tickFormatter={formatYen} tick={{ fontSize: 9 }} width={72} />
                      <Tooltip content={<BarTip />} />
                      <Legend formatter={v => <span className="text-xs font-bold text-slate-600">{v}</span>} />
                      <Bar dataKey="先月基準" name="先月の目安" fill="#e2e8f0" radius={[4,4,0,0]} />
                      <Bar dataKey="今月支出" name="今月の実績" fill="#3b82f6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ★ 週次変動費トレンド（直近8週）*/}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <h3 className="text-sm font-black text-slate-700 mb-1">📅 週次変動費トレンド（直近8週）</h3>
            <p className="text-xs text-slate-400 mb-4">赤線=週予算 ¥{state.weeklyBudget.toLocaleString()}</p>
            <div className="h-56">
              {state.isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.weeklyAnalytics} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis tickFormatter={formatYen} tick={{ fontSize: 9 }} width={72} />
                    <Tooltip content={<BarTip />} />
                    <ReferenceLine y={state.weeklyBudget} stroke="#f43f5e" strokeDasharray="4 4"
                      label={{ value: '週予算', position: 'right', fontSize: 9, fill: '#f43f5e' }} />
                    <Bar dataKey="spent" name="変動費支出" fill="#3b82f6" radius={[4,4,0,0]}>
                      <LabelList dataKey="rate" position="top"
                        formatter={(v: any) => { const n = parseFloat(String(v)); return isNaN(n) ? '' : `${n}%`; }}
                        style={{ fontSize: 8, fontWeight: 'bold', fill: '#64748b' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ★ 週次予算消化率ライングラフ */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <h3 className="text-sm font-black text-slate-700 mb-1">📈 週次予算消化率の推移</h3>
            <p className="text-xs text-slate-400 mb-4">100%を超えると予算オーバー</p>
            <div className="h-48">
              {state.isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={state.weeklyAnalytics} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9 }} domain={[0, 150]} />
                    <Tooltip formatter={(v: any) => [`${v}%`, '消化率']} />
                    <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="4 4"
                      label={{ value: '100%', position: 'right', fontSize: 9, fill: '#f43f5e' }} />
                    <Line type="monotone" dataKey="rate" name="消化率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ===== タブ3: 設定 ===== */}
      {state.activeTab === 'settings' && (
        <div className="space-y-4 max-w-3xl mx-auto">

          {/* ストレージ */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
            <h3 className="text-sm font-black text-slate-700 mb-3">💾 データ保存状況</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${state.storageUsageKB > 4000 ? 'bg-red-500' : state.storageUsageKB > 2000 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (state.storageUsageKB / 5120) * 100)}%` }} />
              </div>
              <span className="font-bold text-slate-600 shrink-0">{state.storageUsageKB}KB / 5MB</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">※ 6ヶ月以上前の明細は月次集計に自動圧縮</p>
          </div>

          {/* 収入・予算設定 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'income' ? null : 'income')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100 transition-colors">
              <span>💴 収入・予算設定</span><span>{state.openSettingSection === 'income' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'income' && (
              <div className="p-5 border-t border-slate-100 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1.5">月収（手取り）</label>
                    <input type="number" value={state.monthlyIncome || ''}
                      onChange={e => actions.setMonthlyIncome(parseInt(e.target.value) || 0)}
                      className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none"
                      placeholder="例: 250000" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1.5">月の変動費予算</label>
                    <input type="number" value={state.variableBudget || ''}
                      onChange={e => actions.setVariableBudget(parseInt(e.target.value) || 0)}
                      className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none"
                      placeholder="例: 120000" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1.5">週の変動費予算</label>
                    <input type="number" value={state.weeklyBudget || ''}
                      onChange={e => actions.setWeeklyBudget(parseInt(e.target.value) || 15000)}
                      className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none"
                      placeholder="例: 15000" />
                    <p className="text-[10px] text-slate-400 mt-1">毎週月曜にこの金額にリセット</p>
                  </div>
                </div>
                {state.monthlyIncome > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs border border-slate-100">
                    <p className="font-black text-slate-600 mb-2">📊 月次収支シミュレーション</p>
                    <div className="flex justify-between"><span className="text-slate-500">月収（手取り）</span><span className="font-bold">¥{state.monthlyIncome.toLocaleString()}</span></div>
                    <div className="flex justify-between text-rose-500"><span>- 確定固定費</span><span className="font-bold">¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-amber-500"><span>- 変動費予算</span><span className="font-bold">¥{state.variableBudget.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sky-500"><span>- 旅行費</span><span className="font-bold">¥{state.travelTotal.toLocaleString()}</span></div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between text-emerald-600 font-black">
                      <span>= 予定貯蓄額</span><span>¥{state.monthlySummary.plannedSavings.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 楽天確定固定費 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'rakuten' ? null : 'rakuten')}
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-black text-sm">
              <span>💳 楽天確定固定費（毎月25日に自動計上）</span><span>{state.openSettingSection === 'rakuten' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'rakuten' && (
              <div className="p-5 space-y-4 text-xs">
                <p className="text-slate-500 bg-rose-50 p-3 rounded-xl border border-rose-100 leading-relaxed">
                  💡 家賃・保険など毎月確定する支出を登録。毎月25日に自動計上されます。変動費・旅行費とは完全に別管理です。
                </p>
                <div className="flex gap-2 flex-wrap bg-slate-50 p-2 rounded-xl">
                  <input type="text" value={state.newRakutenName} onChange={e => actions.setNewRakutenName(e.target.value)}
                    placeholder="例：家賃、Spotify" className="border p-2 rounded-xl bg-white flex-1 min-w-28 text-xs focus:outline-none" />
                  <input type="number" value={state.newRakutenAmount} onChange={e => actions.setNewRakutenAmount(e.target.value)}
                    placeholder="金額 ¥" className="border p-2 rounded-xl bg-white w-28 text-xs focus:outline-none" />
                  <select value={state.newRakutenCategory} onChange={e => actions.setNewRakutenCategory(e.target.value as Category)}
                    className="border p-2 rounded-xl bg-white text-xs focus:outline-none">
                    {state.CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={actions.addRakutenFixedCost} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl font-bold transition-colors">追加</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {state.rakutenFixedCosts.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-white shadow-2xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.category}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-slate-600">¥{c.amount.toLocaleString()}</span>
                        <button onClick={() => actions.removeRakutenFixedCost(c.id)} className="text-slate-300 hover:text-red-500 font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl flex justify-between border border-slate-100">
                  <span className="font-bold text-slate-600 text-xs">合計</span>
                  <span className="font-black text-rose-500">¥{state.monthlySummary.rakutenTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* ★ 旅行費設定 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'travel' ? null : 'travel')}
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-black text-sm">
              <span>✈️ 旅行費の管理（毎月24日にリセット）</span><span>{state.openSettingSection === 'travel' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'travel' && (
              <div className="p-5 space-y-4 text-xs">
                <p className="text-slate-500 bg-sky-50 p-3 rounded-xl border border-sky-100 leading-relaxed">
                  💡 旅行・帰省など非日常の支出専用。変動費・固定費とは別に管理され、毎月24日に自動リセット（0）されます。今週の残金には影響しません。
                </p>
                <div className="bg-sky-50 p-3 rounded-xl border border-sky-100">
                  <p className="font-bold text-sky-700 mb-2">今月の旅行費 合計</p>
                  <p className="text-2xl font-black text-sky-600">¥{state.travelTotal.toLocaleString()}</p>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {state.travelExpenses.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">今月の旅行費はありません</p>
                  ) : state.travelExpenses.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-2.5 border border-sky-100 rounded-xl bg-white">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-400">{t.date}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-sky-600">¥{t.amount.toLocaleString()}</span>
                        <button onClick={() => actions.deleteTravelExpense(t.id)} className="text-slate-300 hover:text-red-500 font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AIマイニング */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'mining' ? null : 'mining')}
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm">
              <span>🧠 PayPay変動費パターン解析</span><span>{state.openSettingSection === 'mining' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'mining' && (
              <div className="p-5 space-y-4 text-xs">
                <p className="text-slate-500 bg-purple-50 p-3 rounded-xl border border-purple-100">
                  💡 PayPay明細から検出した変動費パターン。楽天確定固定費とは別管理。
                </p>
                {state.minedCandidates.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">候補データがまだありません</p>
                ) : (
                  <>
                    <button onClick={() => actions.setShowPromptModal(true)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors">
                      🤖 AIコンサルティングプロンプトを生成
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                      {state.minedCandidates.map((c, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs space-y-3">
                          <div className="flex justify-between">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{c.normalizedName}</p>
                              <p className="text-[10px] text-slate-400">毎月{c.typicalDay}日頃 / {c.appearances.length}回</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-extrabold text-sm">¥{c.averageAmount.toLocaleString()}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.isConstantAmount ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {c.isConstantAmount ? '定額' : '変動'}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => actions.acceptAsFixedCost(c)}
                            className="w-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-bold py-2 rounded-lg border border-slate-100 transition-all">
                            変動費パターンとして登録
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 基本設定 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'target' ? null : 'target')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100 transition-colors">
              <span>🎯 基本設定（長期目標・給料日）</span><span>{state.openSettingSection === 'target' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'target' && (
              <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1.5">長期貯蓄目標総額</label>
                  <input type="number" value={state.targetSavings}
                    onChange={e => actions.setTargetSavings(parseInt(e.target.value) || 0)}
                    className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-500 block mb-1.5">給料日（起点日）</label>
                  <input type="number" min="1" max="28" value={state.salaryDay}
                    onChange={e => actions.setSalaryDay(parseInt(e.target.value) || 25)}
                    className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* AIプロンプトモーダル */}
      {state.showPromptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-2xl p-5 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="text-sm font-black text-slate-800">📋 AIコンサルタント用プロンプト</h4>
              <button onClick={() => actions.setShowPromptModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <textarea readOnly value={state.generatedPrompt}
              className="w-full flex-1 border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50 resize-none min-h-[300px] focus:outline-none"
              onClick={e => (e.target as HTMLTextAreaElement).select()} />
            <div className="flex justify-end gap-2">
              <button onClick={() => actions.setShowPromptModal(false)} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold text-xs text-slate-600">閉じる</button>
              <button onClick={() => { navigator.clipboard.writeText(state.generatedPrompt); alert('📋 コピーしました！'); actions.setShowPromptModal(false); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors">コピー</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}