import { Category } from './csvParser';

export interface CategoryRule {
  id: string;
  keyword: string;   // 店名に含まれるキーワード（部分一致・大文字小文字無視）
  category: Category;
}

// デフォルトルール
export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  // 食費
  { id: 'dr-01', keyword: 'スターバックス',    category: '食費' },
  { id: 'dr-02', keyword: 'マクドナルド',      category: '食費' },
  { id: 'dr-03', keyword: 'すき家',            category: '食費' },
  { id: 'dr-04', keyword: 'セブン-イレブン',   category: '食費' },
  { id: 'dr-05', keyword: 'ファミリーマート',  category: '食費' },
  { id: 'dr-06', keyword: 'ローソン',          category: '食費' },
  { id: 'dr-07', keyword: 'ミニストップ',      category: '食費' },
  { id: 'dr-08', keyword: 'メグリア',          category: '食費' },
  { id: 'dr-09', keyword: 'イオン',            category: '食費' },
  { id: 'dr-10', keyword: 'はま寿司',          category: '食費' },
  { id: 'dr-11', keyword: 'スシロー',          category: '食費' },
  { id: 'dr-12', keyword: 'Coke ON',           category: '食費' },
  { id: 'dr-13', keyword: 'ミスタードーナツ',  category: '食費' },
  { id: 'dr-14', keyword: 'カフェ',            category: '食費' },
  { id: 'dr-15', keyword: 'コーヒー',          category: '食費' },
  // 日用品
  { id: 'dr-20', keyword: 'スギ薬局',          category: '日用品' },
  { id: 'dr-21', keyword: 'マツキヨ',          category: '日用品' },
  { id: 'dr-22', keyword: 'ドラッグ',          category: '日用品' },
  { id: 'dr-23', keyword: 'ダイソー',          category: '日用品' },
  { id: 'dr-24', keyword: 'セリア',            category: '日用品' },
  { id: 'dr-25', keyword: 'キャンドゥ',        category: '日用品' },
  { id: 'dr-26', keyword: 'ウエルシア',        category: '日用品' },
  { id: 'dr-27', keyword: 'V・ドラッグ',       category: '日用品' },
  { id: 'dr-28', keyword: '無印良品',          category: '日用品' },
  { id: 'dr-29', keyword: 'ニトリ',            category: '日用品' },
  // 交通費
  { id: 'dr-30', keyword: 'Suica',             category: '交通費' },
  { id: 'dr-31', keyword: 'モバイルＳｕｉｃａ', category: '交通費' },
  { id: 'dr-32', keyword: 'モバイルSuica',     category: '交通費' },
  { id: 'dr-33', keyword: 'JR',                category: '交通費' },
  { id: 'dr-34', keyword: '電車',              category: '交通費' },
  { id: 'dr-35', keyword: 'バス',              category: '交通費' },
  // 趣味・娯楽
  { id: 'dr-40', keyword: 'Spotify',           category: '趣味・娯楽' },
  { id: 'dr-41', keyword: 'Netflix',           category: '趣味・娯楽' },
  { id: 'dr-42', keyword: 'Apple',             category: '趣味・娯楽' },
  { id: 'dr-43', keyword: 'YouTube',           category: '趣味・娯楽' },
  { id: 'dr-44', keyword: 'Amazon',            category: '趣味・娯楽' },
  { id: 'dr-45', keyword: 'ゲーム',            category: '趣味・娯楽' },
  // 美容・衣服
  { id: 'dr-50', keyword: 'ユニクロ',          category: '美容・衣服' },
  { id: 'dr-51', keyword: 'GU',                category: '美容・衣服' },
  { id: 'dr-52', keyword: 'ZARA',              category: '美容・衣服' },
  { id: 'dr-53', keyword: '美容',              category: '美容・衣服' },
  { id: 'dr-54', keyword: 'サロン',            category: '美容・衣服' },
  // 交際費
  { id: 'dr-60', keyword: '📤 送金',           category: '交際費' },
];

/**
 * 店名からカテゴリを自動判定する
 * ルールは上から順に評価し、最初にマッチしたものを返す
 */
export const detectCategory = (
  shopName: string,
  rules: CategoryRule[]
): Category => {
  const upper = shopName.toUpperCase();
  for (const rule of rules) {
    if (upper.includes(rule.keyword.toUpperCase())) {
      return rule.category;
    }
  }
  return '食費'; // マッチしなければデフォルト食費
};

// LocalStorage保存用
export const saveCategoryRules = (rules: CategoryRule[]) => {
  try {
    localStorage.setItem('asset_category_rules', JSON.stringify(rules));
  } catch (e) {
    console.error(e);
  }
};

export const loadCategoryRules = (): CategoryRule[] => {
  try {
    const saved = localStorage.getItem('asset_category_rules');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_RULES;
  } catch (e) {
    return DEFAULT_CATEGORY_RULES;
  }
};