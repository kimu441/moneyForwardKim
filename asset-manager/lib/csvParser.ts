export type Category = '生活費' | '食費' | '日用品' | '交通費' | '旅行費' | '株' | '美容・衣服' | '交際費' | '趣味・娯楽' | '不明' | 'その他';

export interface HistoryItem {
  id: string;
  date: string; // YYYY/MM/DD
  name: string;
  amount: number; // マイナス値もありうる（受け取りの相殺）
  category: Category;
}

/**
 * 添付されたPayPay CSV (Transactions_...) をパースする専用関数
 *
 * 【仕分けルール】
 * - 「支払い」          → 出金金額をそのまま支出として計上（プラス）
 * - 「送った金額」      → 出金金額を支出として計上（プラス）※個人間送金も支出扱い
 * - 「受け取った金額」  → 入金金額をマイナスの支出として計上（支出合計から相殺）
 * - その他（チャージ等）→ 除外
 */
export const parsePayPayCSV = (file: File): Promise<HistoryItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // UTF-8 (BOM付き) で読み込む
    reader.readAsText(file, 'UTF-8');
    reader.onload = (e) => {
      let text = e.target?.result as string;
      if (!text) { resolve([]); return; }

      // BOM除去
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) { resolve([]); return; }

      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

      const dateIdx    = header.indexOf('取引日');
      const expenseIdx = header.indexOf('出金金額（円）');
      const incomeIdx  = header.indexOf('入金金額（円）');
      const typeIdx    = header.indexOf('取引内容');
      const shopIdx    = header.indexOf('取引先');
      const orderIdIdx = header.indexOf('取引番号');

      if (dateIdx === -1 || expenseIdx === -1 || incomeIdx === -1 || typeIdx === -1) {
        console.error('PayPay CSVのヘッダー形式が一致しません。');
        resolve([]);
        return;
      }

      const results: HistoryItem[] = [];

      // CSVの行を正しく分割する（ダブルクォーテーション内のカンマを考慮）
      const splitCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current);
        return result.map(s => s.trim());
      };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = splitCSVLine(line);
        if (row.length <= Math.max(dateIdx, expenseIdx, incomeIdx, typeIdx)) continue;

        const transactionType = row[typeIdx];

        let amount = 0;
        let displayPrefix = '';

        if (transactionType === '支払い') {
          // 通常の支払い → 出金金額を支出として計上
          const raw = row[expenseIdx].replace(/[",]/g, '');
          const parsed = parseInt(raw, 10);
          if (isNaN(parsed) || parsed <= 0) continue;
          amount = parsed;
        } else if (transactionType === '送った金額') {
          // 個人への送金 → 支出として計上
          const raw = row[expenseIdx].replace(/[",]/g, '');
          const parsed = parseInt(raw, 10);
          if (isNaN(parsed) || parsed <= 0) continue;
          amount = parsed;
          displayPrefix = '📤 送金: ';
        } else if (transactionType === '受け取った金額') {
          // 個人からの受け取り → マイナスの支出として相殺
          const raw = row[incomeIdx].replace(/[",]/g, '');
          const parsed = parseInt(raw, 10);
          if (isNaN(parsed) || parsed <= 0) continue;
          amount = -parsed; // マイナス値
          displayPrefix = '💰 受取: ';
        } else {
          // チャージ・その他は除外
          continue;
        }

        // 日付の整形
        const rawDate = row[dateIdx];
        const dateMatch = rawDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        const formattedDate = dateMatch
          ? `${dateMatch[1]}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`
          : rawDate;

        // 店名・取引先（送金/受取の場合は相手の名前が入る）
        let shopName = shopIdx !== -1 && row[shopIdx] ? row[shopIdx] : 'PayPay決済';
        // 「あきんどスシロー - 豊田インター店」のような表記から店名だけ抜く場合はそのまま使う
        shopName = `${displayPrefix}${shopName}`;

        // 取引番号からユニークIDを生成
        const rawOrderId = (orderIdIdx !== -1 && row[orderIdIdx]) ? row[orderIdIdx].trim() : '';
        const uniqueId = (rawOrderId && rawOrderId !== '-')
          ? rawOrderId
          : `fallback-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;

        results.push({
          id: uniqueId,
          date: formattedDate,
          name: shopName,
          amount,
          category: '食費', // デフォルト食費。明細ログでカテゴリ変更可能
        });
      }

      console.log(`パース成功: ${results.length}件の取引を抽出しました。`);
      resolve(results);
    };
    reader.onerror = () => reject(new Error('CSVファイルの読み込み中にエラーが発生しました。'));
  });
};