// src/lib/fixedCostMiner.ts

export type Transaction = {
  date: string;   // "2026-05-25" または "2026/05/25"
  name: string;   // 明細のタイトル（店名など）
  amount: number; // 金額
};

export type Appearance = {
  date: string;
  amount: number;
  rawName: string;
};

export type FixedCostCandidate = {
  key: string;               // 前方一致の識別キー
  normalizedName: string;    // 代表する店名
  appearances: Appearance[];  // 発生した明細の履歴
  isConstantAmount: boolean;  // 金額が毎月完全一致しているか
  averageAmount: number;     // 平均金額
  typicalDay: number;        // 発生しやすい日（毎月何日頃か）
};

/**
 * 過去の明細データから、周期性とタイトル類似度を元に固定費候補を自動で抽出する
 */
export function mineFixedCosts(history: Transaction[]): FixedCostCandidate[] {
  const groups: { [key: string]: Transaction[] } = {};

  // 1. タイトルの前方の文字（スペース等を排除）でゆるくグルーピング
  history.forEach((tx) => {
    if (!tx.name) return;
    
    // 全角・半角スペースの除去、英字の変形によるブレの防止
    const cleanName = tx.name.replace(/[\s　]+/g, '').toUpperCase();
    // 最初の4文字をグルーピングのキーとする（前方一致のシミュレート）
    const key = cleanName.substring(0, 4);

    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const candidates: FixedCostCandidate[] = [];

  // 2. グループごとに周期性（月を跨いで複数回出ているか）を検証
  Object.keys(groups).forEach((key) => {
    const txs = groups[key];

    // 出現した「月」のユニーク数をカウント
    const months = new Set(
      txs.map((tx) => {
        const dateStr = tx.date.replace(/\//g, '-'); // スラッシュをハイフンに統一
        return new Date(dateStr).getMonth();
      })
    );

    // 【基準】過去データの中で「2ヶ月以上（または3ヶ月など）」にわたって出現しているものを固定費とみなす
    if (months.size >= 2) {
      // 金額のバリエーションをチェック（すべて同額なら完全固定サブスク）
      const amounts = txs.map((tx) => tx.amount);
      const isConstant = new Set(amounts).size === 1;

      // 平均金額の計算
      const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
      const avgAmount = Math.round(totalAmount / txs.length);

      // 登場日の傾向（毎月何日頃に引き落とされているか、平均日を算出）
      const days = txs.map((tx) => {
        const dateStr = tx.date.replace(/\//g, '-');
        return new Date(dateStr).getDate();
      });
      const avgDay = Math.round(days.reduce((sum, d) => sum + d, 0) / days.length);

      // 発生履歴を日付順にソート
      const sortedAppearances = txs
        .map((tx) => ({
          date: tx.date,
          amount: tx.amount,
          rawName: tx.name,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      candidates.push({
        key,
        normalizedName: txs[0].name, // 1つ目の名前を代表名にする
        appearances: sortedAppearances,
        isConstantAmount: isConstant,
        averageAmount: avgAmount,
        typicalDay: avgDay,
      });
    }
  });

  // 平均金額が高い順、あるいは履歴が多い順にソートして返却
  return candidates.sort((a, b) => b.averageAmount - a.averageAmount);
}