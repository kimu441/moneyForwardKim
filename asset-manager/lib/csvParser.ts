// lib/csvParser.ts
export type Expense = { date: string; amount: number; name: string; category: string };

const categorize = (name: string): string => {
  if (name.includes('セブン') || name.includes('ファミマ') || name.includes('ローソン')) return '食費';
  if (name.includes('ドラッグ') || name.includes('薬')) return '日用品';
  if (name.includes('駅') || name.includes('交通') || name.includes('タクシー')) return '交通費';
  return 'その他';
};

export const parsePayPayCSV = (csvText: string, alreadyProcessedIds: string[]) => {
  const lines = csvText.split('\n').slice(1);
  let weeklyExpense = 0;
  const newProcessedIds: string[] = [];
  const newExpenses: Expense[] = [];

  const now = new Date();
  const day = now.getDay();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - day);
  startDate.setHours(0, 0, 0, 0);

  lines.forEach(line => {
    const columns = line.split(',');
    if (columns.length < 13) return;

    const transactionId = columns[12].trim();
    if (alreadyProcessedIds.includes(transactionId)) return;

    const dateStr = columns[0].split(' ')[0];
    const transactionDate = new Date(dateStr.replace(/\//g, '-'));

    if (transactionDate >= startDate) {
      const rawExpense = columns[1].replace(/["']/g, '').replace(/,/g, '');
      const expense = parseInt(rawExpense);
      const type = columns[7];
      const name = columns[8];

      if (!isNaN(expense) && (type === '支払い' || type === '送った金額')) {
        weeklyExpense += expense;
        newProcessedIds.push(transactionId);
        newExpenses.push({ date: dateStr, amount: expense, name, category: categorize(name) });
      }
    }
  });

  return { weeklyExpense, newProcessedIds, newExpenses };
};