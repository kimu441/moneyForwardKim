import { Category } from './csvParser';

export const BASE_CATEGORIES: Category[] = [
  '食費', '日用品', '交通費', '旅行費', '株',
  '美容・衣服', '交際費', '趣味・娯楽', '不明', 'その他',
];

export const MAX_CUSTOM_TAGS = 20;

export const saveCustomTags = (tags: string[]) => {
  try { localStorage.setItem('asset_custom_tags', JSON.stringify(tags)); } catch (e) { console.error(e); }
};

export const loadCustomTags = (): string[] => {
  try {
    const saved = localStorage.getItem('asset_custom_tags');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

// ベースカテゴリ + カスタムタグを結合して返す
export const getAllCategories = (customTags: string[]): string[] => {
  return [...BASE_CATEGORIES, ...customTags];
};