'use client';
import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Category } from '@/lib/csvParser';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';

const LAST_MONTH_BASE_MAP: Record<Category, number> = {
  '食費': 20000, '日用品': 10000, '交通費': 5000, '旅行費': 15000, '株': 10000,
  '美容・衣服': 5000, '交際費': 5000, '趣味・娯楽': 5000, '不明': 5000, 'その他': 5000,
};

const parseSafeDate = (dateStr: string): Date =>
  new Date(dateStr.replace(/\//g, '-'));

// Y軸を ¥150,000 形式でフォーマット
const formatYen = (value: number) => `¥${value.toLocaleString()}`;

// カスタムTooltip（円グラフ用）
const PieCustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs">
        <p className="font-bold text-slate-700">{payload[0].name}</p>
        <p className="text-blue-600 font-extrabold">¥{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

// カスタムTooltip（棒グラフ用）
const BarCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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

  // 貯蓄目標達成率
  const savingsProgress = Math.min(100, Math.round((state.totalSavings / state.targetSavings) * 100));

  // 直近7日の支出内訳（円グラフ用）
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

  // 週合計支出
  const weekTotal = useMemo(() =>
    currentWeekCategoryData.reduce((sum, d) => sum + d.value, 0),
    [currentWeekCategoryData]
  );

  // カテゴリ比較グラフ用
  const comparisonData = useMemo(() => {
    const cycleStartDate = state.currentCycle.start
      ? new Date(state.currentCycle.start)
      : new Date();
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

      {/* ナビゲーションヘッダー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
            🛡️ 資産形成プロ
            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold">v5.7</span>
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {state.currentCycle.label} ／ 給料日起点: {state.salaryDay}日
            <span className="ml-3 text-slate-300">💾 {state.storageUsageKB}KB使用中</span>
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl text-sm">
          {(['dashboard', 'analytics', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => actions.setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${state.activeTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab === 'dashboard' ? '📊 ホーム' : tab === 'analytics' ? '📈 詳細分析' : '⚙️ 各種設定'}
            </button>
          ))}
        </div>
      </div>

      {/* ---- タブ1: ホーム ---- */}
      {state.activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">

          {/* AI自動マイニング通知 */}
          {state.minedCandidates.length > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl text-white shadow-md border border-purple-400 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black tracking-wider">🧠 パターンマイニングエンジン稼働中</h4>
                <p className="text-xs opacity-90 mt-0.5">{state.minedCandidates.length}件の固定費候補を自動検出しました。</p>
              </div>
              <button
                onClick={() => { actions.setActiveTab('settings'); actions.setOpenSettingSection('mining'); }}
                className="bg-white text-indigo-600 text-xs font-black px-4 py-2 rounded-xl shadow-xs shrink-0 hover:bg-slate-50 transition-colors"
              >
                固定費を確認する
              </button>
            </div>
          )}

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
              <span className="text-3xl font-black text-emerald-500">{savingsProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                style={{ width: `${savingsProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              目標まで残り ¥{Math.max(0, state.targetSavings - state.totalSavings).toLocaleString()}
            </p>
          </div>

          {/* メイン2カラム */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 左・中央 */}
            <div className="md:col-span-2 space-y-6">

              {/* 残金カード */}
              <div className={`p-6 rounded-2xl text-white shadow-md border bg-gradient-to-br ${isDanger ? 'from-rose-500 to-red-600 border-red-400' : 'from-blue-500 to-indigo-600 border-blue-400'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <p className="text-xs opacity-80 font-bold tracking-wider">今週の残金</p>
                    <h2 className="text-3xl font-black mt-1">¥{state.balance.toLocaleString()}</h2>
                    <p className="text-xs opacity-60 mt-0.5">週予算 ¥{(30000).toLocaleString()} から</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-80 font-bold tracking-wider">1日あたりの上限</p>
                    <p className="text-2xl font-extrabold mt-1">¥{dailyLimit.toLocaleString()}</p>
                    <p className="text-xs opacity-60 mt-0.5">残り {daysLeft}日で割った値</p>
                  </div>
                  <div className="text-center bg-white/15 p-3 rounded-xl backdrop-blur-xs text-xs">
                    {state.balance <= 0 ? '⚠️ 予算終了！' : dailyLimit < 1500 ? '🔴 注意: 節約が必要です' : '🟢 計画的に使えています'}
                  </div>
                </div>
              </div>

              {/* グラフエリア */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">📊 データ可視化</h3>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      onClick={() => actions.setGraphType('week')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'week' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}
                    >
                      今週の支出内訳
                    </button>
                    <button
                      onClick={() => actions.setGraphType('monthly')}
                      className={`px-3 py-1.5 rounded-md font-bold ${state.graphType === 'monthly' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400'}`}
                    >
                      月次推移
                    </button>
                  </div>
                </div>

                {!state.isMounted ? (
                  <div className="w-full h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">
                    グラフを読み込み中...
                  </div>
                ) : state.graphType === 'week' ? (
                  <div>
                    {/* 週合計サマリー */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-xs text-slate-500 font-bold">
                        📅 直近7日間の支出合計:
                        <span className="text-slate-800 ml-1 text-sm font-black">¥{weekTotal.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-slate-400">週予算消化率: {Math.min(100, Math.round((weekTotal / 30000) * 100))}%</p>
                    </div>
                    {currentWeekCategoryData.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center gap-4 h-64">
                        {/* 円グラフ */}
                        <div className="w-full md:w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={currentWeekCategoryData}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={85}
                                innerRadius={40}
                              >
                                {currentWeekCategoryData.map((d, i) => (
                                  <Cell
                                    key={i}
                                    fill={COLORS[state.CATEGORIES.indexOf(d.name as Category) % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<PieCustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 凡例テーブル（グラフ右側） */}
                        <div className="w-full md:w-1/2 space-y-1.5 text-xs overflow-y-auto max-h-60">
                          {currentWeekCategoryData
                            .sort((a, b) => b.value - a.value)
                            .map((d, i) => {
                              const colorIndex = state.CATEGORIES.indexOf(d.name as Category) % COLORS.length;
                              const pct = Math.round((d.value / weekTotal) * 100);
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-3 h-3 rounded-sm shrink-0"
                                      style={{ backgroundColor: COLORS[colorIndex] }}
                                    />
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
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-24">この週のデータがありません</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 font-bold mb-3 px-1">
                      📅 月次の支出と貯蓄の推移（直近6ヶ月）
                    </p>
                    {state.monthlyReports.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={state.monthlyReports} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <YAxis tickFormatter={formatYen} tick={{ fontSize: 10 }} width={75} />
                            <Tooltip content={<BarCustomTooltip />} />
                            <Legend
                              formatter={(value) => (
                                <span className="text-xs font-bold text-slate-600">{value}</span>
                              )}
                            />
                            <Bar dataKey="spent" name="支出合計" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                             <LabelList
  dataKey="spent"
  position="top"
  formatter={(v) => {
    const num = parseFloat(String(v));
    return isNaN(num) ? '' : `¥${(num / 10000).toFixed(0)}万`;
  }}
  style={{ fontSize: 9, fontWeight: 'bold', fill: '#f43f5e' }}
/>
                            </Bar>
                            <Bar dataKey="saved" name="累計貯蓄" fill="#10b981" radius={[4, 4, 0, 0]}>
                             <LabelList
  dataKey="saved"
  position="top"
  formatter={(v) => {
    const num = parseFloat(String(v));
    return isNaN(num) ? '' : `¥${(num / 10000).toFixed(0)}万`;
  }}
  style={{ fontSize: 9, fontWeight: 'bold', fill: '#10b981' }}
/>
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-24">データ蓄積中...</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 右側サイドバー */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-700 tracking-wider">⚡ クイック操作</h3>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => actions.executeWeeklyClose('save')} className="bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">💰 残金をすべて貯蓄へ回す</button>
                  <button onClick={() => actions.executeWeeklyClose('carryOver')} className="bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">🏃‍♂️ 来週へ繰り越す</button>
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-500 block">📱 PayPay明細（CSV）:</span>
                    <input type="file" onChange={actions.handleFileUpload} className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-50">
                    <span className="font-bold text-slate-500 block">💳 楽天カード明細（CSV）:</span>
                    <input type="file" onChange={actions.handleRakutenUpload} className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-700 tracking-wider">💸 支出の手動入力</h3>
                <input
                  type="number"
                  value={state.amount}
                  onChange={(e) => actions.setAmount(e.target.value)}
                  className="border p-2.5 rounded-xl w-full text-sm font-bold focus:border-blue-500 focus:outline-none"
                  placeholder="金額を入力 ¥"
                />
                <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto border p-1 rounded-lg bg-slate-50">
                  {state.CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => actions.setCategory(cat)}
                      className={`py-1 rounded-md text-[10px] font-bold border transition-all ${state.category === cat ? 'bg-blue-50 text-blue-600 border-blue-400' : 'bg-white text-slate-500 border-transparent hover:bg-slate-100'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <button onClick={actions.handleSpend} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-black text-xs transition-colors">記録する</button>
              </div>
            </div>
          </div>

          {/* 支出明細ログ */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-5">
            <h3 className="text-sm font-black text-slate-700 border-b border-slate-100 pb-3 mb-3 tracking-wider">
              📜 最新の支出明細ログ
              <span className="ml-2 text-xs font-normal text-slate-400">（全{state.history.length}件）</span>
            </h3>
            {!state.isMounted || state.history.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">履歴がありません。CSVをインポートするか手動入力してください。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 max-h-60 overflow-y-auto pr-2">
                {state.history.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-xs py-2.5 border-b border-slate-100 hover:bg-slate-50 px-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{h.date}</span>
                      <span className={`font-bold truncate max-w-[160px] ${h.id.startsWith('fixed-') ? 'text-purple-600' : 'text-slate-800'}`}>{h.name}</span>
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
              <p className="text-[11px] opacity-50">固定費＋想定基礎生活費（¥60,000）ベース</p>
              <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                <p className="opacity-70">想定月収: <span className="font-bold opacity-100">¥{state.estimatedIncome.toLocaleString()}</span></p>
                <p className="opacity-70">累計貯蓄: <span className="font-bold text-emerald-400">¥{state.totalSavings.toLocaleString()}</span></p>
              </div>
            </div>
            <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-black text-slate-700 mb-1 tracking-wider">⚖️ カテゴリ別 前月比較</h3>
              <p className="text-xs text-slate-400 mb-4">棒グラフ: 灰色=先月の目安 / 青=今月の実績支出（円）</p>
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
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">分析データを収集中...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- タブ3: 設定 ---- */}
      {state.activeTab === 'settings' && (
        <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">

          {/* ストレージ使用状況 */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-700 mb-3">💾 データ保存状況</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${state.storageUsageKB > 4000 ? 'bg-red-500' : state.storageUsageKB > 2000 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (state.storageUsageKB / 5120) * 100)}%` }}
                />
              </div>
              <span className="font-bold text-slate-600 shrink-0">{state.storageUsageKB}KB / 5MB</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              ※ 6ヶ月以上前の明細は自動的に月次集計に圧縮されます。直近6ヶ月の詳細は保持されます。
            </p>
          </div>

          {/* AIマイニング */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'mining' ? null : 'mining')} className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm">
              <span>🧠 固定費自動あぶり出しエンジン</span>
              <span>{state.openSettingSection === 'mining' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'mining' && (
              <div className="p-5 space-y-4 text-xs">
                {state.minedCandidates.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">候補データがまだ蓄積されていません</p>
                ) : (
                  <div className="space-y-4">
                    <button onClick={() => actions.setShowPromptModal(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">🤖 AIコンサルティングプロンプトを生成</button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                      {state.minedCandidates.map((cand, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-col justify-between space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <h5 className="font-bold text-slate-800 truncate">{cand.normalizedName}</h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">毎月{cand.typicalDay}日頃 ／ {cand.appearances.length}回出現</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold block text-sm">¥{cand.averageAmount.toLocaleString()}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${cand.isConstantAmount ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {cand.isConstantAmount ? '定額サブスク' : '変動費'}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => actions.acceptAsFixedCost(cand)} className="w-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-[10px] font-bold py-2 rounded-lg border border-slate-100 hover:border-purple-200 transition-all">固定費リストに追加</button>
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
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'target' ? null : 'target')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100/80 transition-colors">
              <span>🎯 基本設定（長期目標額・給料日）</span>
              <span>{state.openSettingSection === 'target' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'target' && (
              <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">長期貯蓄目標総額</label>
                  <input type="number" value={state.targetSavings} onChange={(e) => actions.setTargetSavings(parseInt(e.target.value) || 0)} className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">給料日（サイクル起点日）</label>
                  <input type="number" min="1" max="28" value={state.salaryDay} onChange={(e) => actions.setSalaryDay(parseInt(e.target.value) || 25)} className="border p-2.5 rounded-xl w-full text-sm font-semibold focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* 固定費編集 */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
            <button onClick={() => actions.setOpenSettingSection(state.openSettingSection === 'fixed' ? null : 'fixed')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-sm text-slate-700 hover:bg-slate-100/80 transition-colors">
              <span>🔄 毎月自動計上する固定費の編集</span>
              <span>{state.openSettingSection === 'fixed' ? '▲' : '▼'}</span>
            </button>
            {state.openSettingSection === 'fixed' && (
              <div className="p-5 border-t border-slate-100 space-y-4 text-xs">
                <div className="flex gap-2 bg-slate-50 p-2 rounded-xl">
                  <input type="text" value={state.newFixedName} onChange={(e) => actions.setNewFixedName(e.target.value)} placeholder="例：家賃、通信費など" className="border p-2 rounded-xl bg-white w-full text-xs focus:outline-none" />
                  <input type="number" value={state.newFixedAmount} onChange={(e) => actions.setNewFixedAmount(e.target.value)} placeholder="金額 ¥" className="border p-2 rounded-xl bg-white w-32 text-xs focus:outline-none" />
                  <button onClick={actions.addFixedCost} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition-colors">追加</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {state.fixedCosts.map(f => (
                    <div key={f.id} className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-white shadow-2xs">
                      <span className="font-bold text-slate-700 truncate">{f.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-slate-600">¥{f.amount.toLocaleString()}</span>
                        <button onClick={() => actions.removeFixedCost(f.id)} className="text-slate-300 hover:text-red-500 font-bold text-sm">✕</button>
                      </div>
                    </div>
                  ))}
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
            <textarea
              readOnly
              value={state.generatedPrompt}
              className="w-full flex-1 border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50 text-slate-600 resize-none min-h-[300px] focus:outline-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => actions.setShowPromptModal(false)} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold text-slate-600">閉じる</button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(state.generatedPrompt);
                  alert('📋 コピーしました！');
                  actions.setShowPromptModal(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl transition-colors"
              >
                コピー
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}