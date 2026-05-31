export type Category = '生活費' | '食費' | '日用品' | '交通費' | '旅行費' | '株' | '美容・衣服' | '交際費' | '趣味・娯楽' | '不明' | 'その他';

export interface HistoryItem {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: Category;
}

const parseSafeDate = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr.replace(/\//g, '-'));
};

export const parsePayPayCSV = (file: File): Promise<HistoryItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, 'Shift-JIS');
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { resolve([]); return; }

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) { resolve([]); return; }

      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const dateIdx     = header.indexOf('取引日');
      const expenseIdx  = header.indexOf('出金金額（円）');
      const typeIdx     = header.indexOf('取引内容');
      const shopIdx     = header.indexOf('取引先');
      const orderIdIdx  = header.indexOf('取引番号');

      if (dateIdx === -1 || expenseIdx === -1) {
        console.error('PayPay CSVのヘッダー形式が一致しません。');
        resolve([]);
        return;
      }

      const results: HistoryItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = line.split(',').map(r => r.replace(/"/g, '').trim());
        if (row.length <= Math.max(dateIdx, expenseIdx)) continue;

        const transactionType = typeIdx !== -1 ? row[typeIdx] : '支払い';
        if (transactionType !== '支払い') continue;

        const rawAmount = row[expenseIdx].replace(/[\",\-]/g, '');
        const amount = parseInt(rawAmount, 10);
        if (isNaN(amount) || amount <= 0) continue;

        const rawDate = row[dateIdx];
        const dateMatch = rawDate.match(/^(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
        const formattedDate = dateMatch ? dateMatch[1].replace(/-/g, '/') : rawDate;

        const shopName = shopIdx !== -1 && row[shopIdx] ? row[shopIdx] : 'PayPay決済';

        const rawOrderId = (orderIdIdx !== -1 && row[orderIdIdx]) ? row[orderIdIdx].trim() : '';
        const uniqueId = (rawOrderId && rawOrderId !== '-')
          ? rawOrderId
          : `fallback-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;

        results.push({
          id: uniqueId,
          date: formattedDate,
          name: shopName,
          amount,
          category: '食費', // デフォルト食費・ログ画面で変更可能
        });
      }

      console.log(`パース成功: ${results.length}件の支払いを抽出しました。`);
      resolve(results);
    };
    reader.onerror = () => reject(new Error('CSVファイルの読み込み中にエラーが発生しました。'));
  });
};