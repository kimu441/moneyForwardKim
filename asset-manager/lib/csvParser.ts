// lib/csvParser.ts
export type Category = '食費' | '日用品' | '交通費' | '旅行費' | '株' | '美容・衣服' | '交際費' | '趣味・娯楽' | '不明' | 'その他';
export type Expense = { id: string; date: string; amount: number; name: string; category: Category };
export type CategoryRule = { keyword: string; category: Category };

export const categorize = (name: string, rules: CategoryRule[]): Category => {
  const rule = rules.find(r => name.includes(r.keyword));
  return rule ? rule.category : 'その他';
};

export const parsePayPayCSV = (csvText: string, alreadyProcessedIds: string[], rules: CategoryRule[]) => {
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
      const name = columns[8];

      if (!isNaN(expense) && (columns[7] === '支払い' || columns[7] === '送った金額')) {
        weeklyExpense += expense;
        newProcessedIds.push(transactionId);
        newExpenses.push({ 
            id: transactionId,
            date: dateStr, 
            amount: expense, 
            name, 
            category: categorize(name, rules) 
        });
      }
    }
  });
  return { weeklyExpense, newProcessedIds, newExpenses };
};