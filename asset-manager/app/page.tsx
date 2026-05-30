'use client';
import { useState, useEffect } from 'react';
import { parsePayPayCSV, Expense } from '@/lib/csvParser';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function Dashboard() {
  const [balance, setBalance] = useState<number>(15000);
  const [savings, setSavings] = useState<number>(0);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<Expense[]>([]);

  // カテゴリ別集計の計算
  const categoryData = ['食費', '日用品', '交通費', 'その他'].map(cat => ({
    name: cat,
    value: history.filter(h => h.category === cat).reduce((sum, h) => sum + h.amount, 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6b7280'];

  useEffect(() => {
    const savedBalance = localStorage.getItem('currentBalance');
    const savedSavings = localStorage.getItem('totalSavings');
    const savedIds = localStorage.getItem('processedIds');
    const savedHistory = localStorage.getItem('expenseHistory');
    
    if (savedBalance) setBalance(parseInt(savedBalance));
    if (savedSavings) setSavings(parseInt(savedSavings));
    if (savedIds) setProcessedIds(JSON.parse(savedIds));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem('currentBalance', balance.toString());
    localStorage.setItem('totalSavings', savings.toString());
    localStorage.setItem('processedIds', JSON.stringify(processedIds));
    localStorage.setItem('expenseHistory', JSON.stringify(history));
  }, [balance, savings, processedIds, history]);

  const handleWeeklyClose = () => {
    const confirmMove = confirm(`残高 ¥${balance.toLocaleString()} を貯蓄へ回し、次週予算(¥15,000)にリセットしますか？`);
    if (confirmMove) {
      setSavings(prev => prev + balance);
      setBalance(15000);
      setHistory([]);
      setProcessedIds([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { weeklyExpense, newProcessedIds, newExpenses } = parsePayPayCSV(text, processedIds);
        if (weeklyExpense > 0) {
          setBalance(prev => prev - weeklyExpense);
          setProcessedIds(prev => [...prev, ...newProcessedIds]);
          setHistory(prev => [...newExpenses, ...prev]);
          alert(`${weeklyExpense.toLocaleString()}円を反映しました！`);
        } else {
          alert('新しいデータはありませんでした。');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">資産形成ダッシュボード</h1>
      
      {/* 残高・貯蓄エリア */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-lg border">
          <p className="text-sm text-gray-500">今週の利用可能残金</p>
          <h2 className="text-3xl font-bold text-blue-600">¥{balance.toLocaleString()}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border">
          <p className="text-sm text-gray-500">累計貯蓄額</p>
          <h2 className="text-3xl font-bold text-green-600">¥{savings.toLocaleString()}</h2>
        </div>
      </div>

      {/* グラフ表示エリア */}
      <div className="bg-white p-6 rounded-xl shadow border h-64">
        <h3 className="font-bold mb-2">支出の内訳</h3>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {categoryData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 mt-16">支出データがありません</p>
        )}
      </div>

      <button onClick={handleWeeklyClose} className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold">
        週の締め処理（残高を貯蓄へ移動）
      </button>

      <div className="bg-white p-6 rounded-xl shadow border">
        <h3 className="font-bold mb-4">最近の支出履歴</h3>
        {history.slice(0, 5).map((h, i) => (
          <div key={i} className="flex justify-between py-2 border-b text-sm">
            <span>{h.name}</span>
            <span className="font-bold">¥{h.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="text-sm font-semibold mb-2 text-gray-700">CSVデータを取り込む</h3>
        <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-gray-500" />
      </div>
    </div>
  );
}