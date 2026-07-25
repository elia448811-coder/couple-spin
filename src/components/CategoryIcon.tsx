import type { TaskCategory } from '../types/game';
import { getCategoryIcon } from '../utils/adminCategories';

type CategoryIconProps = {
  category: TaskCategory;
  size?: 'sm' | 'md' | 'lg';
};

export function CategoryIcon({ category, size = 'md' }: CategoryIconProps) {
  return (
    <span className={`category-icon category-icon--${size}`} aria-hidden="true">
      {getCategoryIcon(category)}
    </span>
  );
}
