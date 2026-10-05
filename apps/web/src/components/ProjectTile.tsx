import { Link } from 'react-router-dom';
import type { Product } from '../lib/api';
import { productImage } from '../lib/api';
import { useRealtime } from '../realtime/RealtimeProvider';
import './ProjectTile.scss';

type Props = {
  product: Product;
  index?: number;
};

export function ProjectTile({ product, index = 0 }: Props) {
  const { revision } = useRealtime();
  const category = product.category?.name ?? 'Installation';
  return (
    <Link to={`/projets/${product.slug}`} className={`project-tile project-tile--${(index % 3) + 1}`}>
      <div className="project-tile__media">
        <img src={productImage(product, index, revision)} alt={product.name} loading="lazy" />
      </div>
      <div className="project-tile__meta">
        <span>{category}</span>
        <h3>{product.name}</h3>
      </div>
    </Link>
  );
}
