// lib/fixedCostAnalyzer.ts

export type RakutenExpense = {
  id: string;
  date: string;
  name: string;
  amount: number;
};

export type ReductionProposal = {
  id: string;
  fixedCostName: string;
  currentAmount: number;
  expectedSavings: number;
  advice: string;
  suggestedCategory: '食費' | '日用品' | '交通費' | '旅行費' | '株' | '美容・衣服' | '交際費' | '趣味・娯楽' | '不明' | 'その他';
};

export function parseRakutenCSV(text: string): RakutenExpense[] {
  const lines = text.split('\n');
  const expenses: RakutenExpense[] = [];

  // 楽天カードのCSVフォーマット（通常、カンマ区切り、ダブルクォーテーション囲みあり）
  // 1列目: 利用日, 2列目: 利用店名・商品名, ..., 7列目: 利用金額
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // クォーテーションを考慮した簡易カンマ区切りパース
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 7) {
      // マッチしない場合は通常のカンマ分割を試す
      const parts = line.split(',');
      if (parts.length >= 7) {
        const date = parts[0].replace(/"/g, '');
        const name = parts[1].replace(/"/g, '');
        const amount = parseInt(parts[6].replace(/"/g, ''));
        if (date && name && !isNaN(amount)) {
          expenses.push({ id: `rakuten-${i}-${Date.now()}`, date, name, amount });
        }
      }
      continue;
    }

    const date = matches[0].replace(/"/g, '');
    const name = matches[1].replace(/"/g, '');
    const amount = parseInt(matches[6].replace(/"/g, '').replace(/,/g, ''));

    if (date && name && !isNaN(amount)) {
      expenses.push({
        id: `rakuten-${i}-${Date.now()}`,
        date,
        name,
        amount
      });
    }
  }
  return expenses;
}

export function analyzeRakutenFixedCosts(rows: RakutenExpense[]): ReductionProposal[] {
  const proposals: ReductionProposal[] = [];
  const seenNames = new Set<string>();

  rows.forEach((row, index) => {
    const cleanName = row.name.toUpperCase();
    
    // 重複検知（1つの明細ファイル内に複数月ある場合などを考慮して同じ項目は1つに絞る）
    if (seenNames.has(cleanName)) return;

    // 1. 通信費（キャリア決済・大手キャリア）
    if (cleanName.includes('ﾄﾞｺﾓ') || cleanName.includes('KDDI') || cleanName.includes('ｿﾌﾄﾊﾞﾝｸ') || cleanName.includes('DOCOMO')) {
      seenNames.add(cleanName);
      if (row.amount > 4000) {
        proposals.push({
          id: `prop-${index}-${Date.now()}`,
          fixedCostName: row.name,
          currentAmount: row.amount,
          expectedSavings: row.amount - 2980,
          advice: '📱 大手プランは高めです。ahamo、LINEMO、楽天モバイル等の格安プランへ切り替えるだけで、毎月この差額がまるまる浮きます！',
          suggestedCategory: 'その他'
        });
      }
    }

    // 2. 電気・ガス代
    else if (cleanName.includes('電力') || cleanName.includes('ｶﾞｽ') || cleanName.includes('ﾃﾞﾝﾘｮｸ')) {
      seenNames.add(cleanName);
      proposals.push({
        id: `prop-${index}-${Date.now()}`,
        fixedCostName: row.name,
        currentAmount: row.amount,
        expectedSavings: Math.round(row.amount * 0.1),
        advice: '⚡ 電気とガスのセット割への集約や、新電力会社への切り替えシミュレーションを行うことで、約10%の基本料金削減が見込めます。',
        suggestedCategory: 'その他'
      });
    }

    // 3. 主要サブスクリプション
    else if (cleanName.includes('NETFLIX') || cleanName.includes('APPLE.COM/BILL') || cleanName.includes('SPOTIFY') || cleanName.includes('AMAZON PRIME') || cleanName.includes('ｱﾏｿﾞﾝﾌﾟﾗｲﾑ') || cleanName.includes('HULU') || cleanName.includes('YT PREMIUM')) {
      seenNames.add(cleanName);
      proposals.push({
        id: `prop-${index}-${Date.now()}`,
        fixedCostName: row.name,
        currentAmount: row.amount,
        expectedSavings: row.amount,
        advice: '🎬 毎月定額のサブスクです。直近1ヶ月間で本当に使い倒しましたか？一度解約（断捨離）し、観たい時だけ再契約するのが最も賢い節約です。',
        suggestedCategory: '趣味・娯楽'
      });
    }

    // 4. 保険代
    else if (cleanName.includes('生命') || cleanName.includes('ﾎｹﾝ') || cleanName.includes('損害')) {
      seenNames.add(cleanName);
      proposals.push({
        id: `prop-${index}-${Date.now()}`,
        fixedCostName: row.name,
        currentAmount: row.amount,
        expectedSavings: Math.round(row.amount * 0.3),
        advice: '🏥 ネット型保険への見直しや特約の整理を行うことで、保障内容をほぼ変えずに3割ほどプレミアム（保険料）を下げられるケースが多いです。',
        suggestedCategory: 'その他'
      });
    }
  });

  return proposals;
}