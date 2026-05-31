'use client';
import { useState, useEffect, useMemo } from 'react';
import { parsePayPayCSV, HistoryItem, Category } from '@/lib/csvParser';

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

export function useDashboard() {
  const CATEGORIES: Category[] = ['食費', '日用品', '交通費', '旅行費', '株', '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他'];

  // 状態管理 (State)
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [graphType, setGraphType] = useState<'week' | 'monthly'>('week');
  const [openSettingSection, setOpenSettingSection] = useState<'mining' | 'target' | 'fixed' | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [balance, setBalance] = useState<number>(30000); // 今週の残金初期値
  const [targetSavings, setTargetSavings] = useState<number>(2000000); // 長期貯蓄目標
  const [salaryDay, setSalaryDay] = useState<number>(25); // 給料日起点日
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([
    { id: 'f-1', name: '家賃・住宅', amount: 65000 },
    { id: 'f-2', name: '通信費・サブスク', amount: 9800 },
  ]);

  // 手動入力フォーム用
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<Category>('食費');

  // 設定フォーム用
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');

  // AI通知用・自動マイニング結果
  const [minedCandidates, setMinedCandidates] = useState<MinedCandidate[]>([]);

  // クライアントサイドでのマウント完了通知 (ハイドレーション対策)
  useEffect(() => {
    setIsMounted(true);
    // ローカルストレージからの復元処理をここに入れることも可能です
  }, []);

  // 給料日起点の現在のサイクル情報を計算
  const currentCycle = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // 今月の給料日
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

  // ダミーの月次レポートデータ (Analytics用)
  const monthlyReports: MonthlyReport[] = useMemo(() => {
    return [
      { month: '2026/03期', spent: 145000, saved: 45000 },
      { month: '2026/04期', spent: 132000, saved: 58000 },
      { month: currentCycle.label, spent: history.reduce((sum, h) => sum + h.amount, 0), saved: 35000 },
    ];
  }, [history, currentCycle.label]);

  // 🛠️ アクション・処理 (Actions)

  // 手動での支出登録
  const handleSpend = () => {
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const now = new Date();
    const newLog: HistoryItem = {
      id: `manual-${Date.now()}`,
      date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
      name: '手動入力支出',
      amount: parsedAmount,
      category: category,
    };

    setHistory(prev => [newLog, ...prev]);
    setBalance(prev => prev - parsedAmount);
    setAmount('');
  };

  // 履歴の削除
  const deleteHistory = (id: string) => {
    const item = history.find(h => h.id === id);
    if (!item) return;
    setHistory(prev => prev.filter(h => h.id !== id));
    setBalance(prev => prev + item.amount);
  };
  
  // PayPay CSVのアップロード処理
  // PayPay CSVのアップロード処理（重複排除ロジック入り）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedItems = await parsePayPayCSV(file);
      if (parsedItems.length === 0) {
        alert('支払いデータが見つからないか、形式が異なります。');
        return;
      }

      // ★ここが修正ポイント
      // 現在の history に「まだ含まれていない」データだけをフィルタリングする
      setHistory(prevHistory => {
        const newItemsOnly = parsedItems.filter(
          newItem => !prevHistory.some(oldItem => oldItem.id === newItem.id)
        );

        if (newItemsOnly.length === 0) {
          alert('⚠️ インポートされたデータはすべて登録済みです（重複はありません）。');
          return prevHistory;
        }

        // 新しく追加されるデータの合計金額だけを計算して減算する
        const totalNewSpent = newItemsOnly.reduce((sum, h) => sum + h.amount, 0);
        setBalance(prev => prev - totalNewSpent);

        // インポート後に自動固定費マイニングを実行
        mineFixedCosts([...newItemsOnly, ...prevHistory]);
        
        alert(`🎉 新規 ${newItemsOnly.length} 件の支出をインポートしました！`);
        return [...newItemsOnly, ...prevHistory];
      });

    } catch (err) {
      console.error(err);
      alert('CSVのパースに失敗しました。文字コードやファイルを確認してください。');
    }
  };

  // 楽天CSVアップロード用の仮関数 (エラー防止)
  const handleRakutenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    alert('楽天カードCSVインポート機能（現在調整中）');
  };

  // 週末の締め処理
  const executeWeeklyClose = (type: 'save' | 'carryOver') => {
    if (balance <= 0) {
      alert('残金がありません。締め処理は不要です。');
      return;
    }
    if (type === 'save') {
      alert(`💰 残金 ¥${balance.toLocaleString()} を今週の貯蓄用口座へ回しました！`);
    } else {
      alert(`🏃‍♂️ 残金 ¥${balance.toLocaleString()} を来週の予算へ繰り越しました！`);
    }
    setBalance(30000); // 翌週の基本予算としてリセット
  };

  // 固定費のカスタム追加
  const addFixedCost = () => {
    const amt = parseInt(newFixedAmount, 10);
    if (!newFixedName || isNaN(amt) || amt <= 0) return;
    setFixedCosts(prev => [...prev, { id: `fixed-custom-${Date.now()}`, name: newFixedName, amount: amt }]);
    setNewFixedName('');
    setNewFixedAmount('');
  };

  // 固定費の削除
  const removeFixedCost = (id: string) => {
    setFixedCosts(prev => prev.filter(f => f.id !== id));
  };

  // 🧠 周期データ解析型・固定費マイニングロジック
  const mineFixedCosts = (allHistory: HistoryItem[]) => {
    // 簡易的な名前の正規化と周期性の検出
    const groups: Record<string, string[]> = {};
    allHistory.forEach(h => {
      // 店名から「 - ○○店」のような個別表記をカットして共通化
      const normalized = h.name.split(' - ')[0].trim();
      if (!groups[normalized]) groups[normalized] = [];
      groups[normalized].push(h.date);
    });

    const candidates: MinedCandidate[] = [];
    Object.entries(groups).forEach(([name, dates]) => {
      if (dates.length >= 2) {
        // 出現頻度が高いものを固定費候補（サブスク等）として抽出
        const amounts = allHistory.filter(h => h.name.startsWith(name)).map(h => h.amount);
        const avgAmount = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
        
        // 日付から「何日頃」か推測
        const days = dates.map(d => parseInt(d.split('/')[2], 10));
        const typicalDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);

        // 金額の変動が少ないかチェック
        const isConstant = amounts.every(a => Math.abs(a - avgAmount) < avgAmount * 0.05);

        // 既に固定費として登録されている名前は除外
        const alreadyRegistered = fixedCosts.some(f => f.name.includes(name));

        if (!alreadyRegistered && avgAmount > 0) {
          candidates.push({
            normalizedName: name,
            averageAmount: avgAmount,
            typicalDay: typicalDay,
            isConstantAmount: isConstant,
            appearances: dates,
          });
        }
      }
    });
    setMinedCandidates(candidates);
  };

  // マイニングされた候補を固定費に承認・同期する
  const acceptAsFixedCost = (candidate: MinedCandidate) => {
    setFixedCosts(prev => [
      ...prev,
      {
        id: `fixed-mined-${Date.now()}`,
        name: `🔄 ${candidate.normalizedName}`,
        amount: candidate.averageAmount,
      },
    ]);
    setMinedCandidates(prev => prev.filter(c => c.normalizedName !== candidate.normalizedName));
  };

  // AIコンサルティング用のプロンプト自動生成
  const generatedPrompt = useMemo(() => {
    return `
# あなたは超一流の資産形成・家計改善コンサルタントです。
以下のリアルタイムな家計データと、固定費自動解析エンジンが検出したデータパターンを分析し、私に最適な「不労所得・長期貯蓄目標」を達成するための具体的な改善提案をしてください。

## 1. 基本ステータス
- 現在のサイクル: ${currentCycle.label} (給料日: ${salaryDay}日)
- 今週の自由残金: ¥${balance.toLocaleString()}
- 長期貯蓄目標額: ¥${targetSavings.toLocaleString()}

## 2. 毎月の固定費・サブスク一覧
${fixedCosts.map(f => `- ${f.name}: ¥${f.amount.toLocaleString()}`).join('\n')}

## 3. マイニングエンジンによる固定費・変動費の自動検出パターン
${minedCandidates.map(c => `- [${c.isConstantAmount ? '定額' : '変動'}] ${c.normalizedName}: 平均¥${c.averageAmount.toLocaleString()} (毎月${c.typicalDay}日頃、計${c.appearances.length}回出現)`).join('\n')}

## 4. 直近の支出ログ (上位20件)
${history.slice(0, 20).map(h => `- ${h.date} | ${h.name} | ¥${h.amount.toLocaleString()} (${h.category})`).join('\n')}

---
【出力要求】
1. 固定費の中で「解約または削減を検討すべき無駄」の指摘
2. 貯蓄目標額を達成するための、今期の具体的な予算配分のアドバイス
`;
  }, [balance, targetSavings, salaryDay, fixedCosts, minedCandidates, history, currentCycle]);

  return {
    state: {
      isMounted, activeTab, graphType, openSettingSection, showPromptModal,
      history, balance, targetSavings, salaryDay, fixedCosts,
      amount, category, newFixedName, newFixedAmount, minedCandidates,
      generatedPrompt, currentCycle, monthlyReports, CATEGORIES
    },
    actions: {
      setActiveTab, setGraphType, setOpenSettingSection, setShowPromptModal,
      setAmount, setCategory, setNewFixedName, setNewFixedAmount, setTargetSavings, setSalaryDay,
      handleSpend, deleteHistory, handleFileUpload, handleRakutenUpload, executeWeeklyClose, addFixedCost, removeFixedCost, acceptAsFixedCost
    }
  };
}