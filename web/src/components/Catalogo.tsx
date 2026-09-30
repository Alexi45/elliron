import { useMemo, useState } from 'react';
import { Reveal } from './Reveal';
import { IconArrow, IconBook, IconDice, IconInstagram, IconManga, IconSparkles } from './Icons';
import type { Product, ProductCategory } from '../lib/types';

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  magic: 'Magic',
  mesa: 'Juegos de mesa',
  libros: 'Libros',
  manga: 'Manga y anime',
  merch: 'Merchandising',
  otros: 'Otros'
};

export const STOCK_LABEL: Record<string, string> = {
  disponible: 'En tienda',
  pocas: 'Quedan pocas',
  agotado: 'Agotado',
  encargo: 'Por encargo'
};

const ICONS: Record<ProductCategory, JSX.Element> = {
  magic: <IconSparkles size={18} />,
  mesa: <IconDice size={18} />,
  libros: <IconBook size={18} />,
  manga: <IconManga size={18} />,
  merch: <IconSparkles size={18} />,
  otros: <IconSparkles size={18} />
};

interface Props {
  products: Product[];
  intro?: string;
  instagram?: string;
}

export function Catalogo({ products, intro, instagram }: Props) {
  const [filter, setFilter] = useState<ProductCategory | 'todo'>('todo');

  /* Solo salen las pestañas de las categorías que tienen algo */
  const categories = useMemo(() => {
    const cuenta = new Map<ProductCategory, number>();
    for (const p of products) cuenta.set(p.category, (cuenta.get(p.category) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  }, [products]);

  const visibles = filter === 'todo' ? products : products.filter((p) => p.category === filter);

  return (
    <section id="catalogo">
      <div className="shell">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">En la estantería</span>
            <h2 className="section-title">
              Lo que tenemos <span className="gold-text">esperándote</span>
            </h2>
            {intro && <p className="lead">{intro}</p>}
          </div>
        </Reveal>

        {products.length === 0 ? (
          <div className="empty">Estamos subiendo los productos. Vuelve en un rato.</div>
        ) : (
          <>
            <Reveal delay={60}>
              <div className="filters" style={{ marginBottom: 26 }}>
                <button className={`chip ${filter === 'todo' ? 'is-active' : ''}`} onClick={() => setFilter('todo')}>
                  Todo <small style={{ opacity: 0.7 }}>{products.length}</small>
                </button>
                {categories.map(([cat, n]) => (
                  <button key={cat} className={`chip ${filter === cat ? 'is-active' : ''}`} onClick={() => setFilter(cat)}>
                    {CATEGORY_LABEL[cat]} <small style={{ opacity: 0.7 }}>{n}</small>
                  </button>
                ))}
              </div>
            </Reveal>

            <div className="catalog-grid">
              {visibles.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 6) * 60}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </>
        )}

        <Reveal delay={80}>
          <p className="board__note" style={{ marginTop: 28 }}>
            Los precios son los de tienda y pueden cambiar. ¿Te interesa algo o buscas otra cosa?
            {instagram && (
              <>
                {' '}
                <a href={instagram} target="_blank" rel="noreferrer noopener" className="link-gold">
                  Escríbenos por Instagram <IconInstagram size={14} />
                </a>{' '}
                y te lo guardamos.
              </>
            )}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const agotado = product.stock === 'agotado';

  return (
    <article className={`card product ${agotado ? 'is-out' : ''}`}>
      <div className="product__photo">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
        ) : (
          <div className="product__placeholder">{ICONS[product.category] ?? ICONS.otros}</div>
        )}
        {product.featured === 1 && <span className="product__flag">Destacado</span>}
      </div>

      <div className="product__body">
        <span className="product__cat">
          {ICONS[product.category] ?? ICONS.otros} {CATEGORY_LABEL[product.category]}
        </span>
        <h3 className="product__name">{product.name}</h3>
        {product.description && <p className="product__desc">{product.description}</p>}

        <div className="product__foot">
          {product.price && <span className="product__price">{product.price}</span>}
          <span className={`product__stock product__stock--${product.stock}`}>{STOCK_LABEL[product.stock]}</span>
        </div>
      </div>
    </article>
  );
}

/** El cartel de «estamos de obras» que abre la portada */
export function AvisoCierre({
  title,
  notice,
  reopen,
  instagram
}: {
  title: string;
  notice: string;
  reopen?: string;
  instagram?: string;
}) {
  return (
    <section className="closure">
      <div className="shell">
        <Reveal>
          <div className="card closure__card">
            <span className="eyebrow">Montequinto · Dos Hermanas</span>
            <h1 className="hero__title closure__title">{title}</h1>
            <p className="lead">{notice}</p>

            <div className="closure__actions">
              <a href="#catalogo" className="btn btn--primary">
                Ver los productos <IconArrow />
              </a>
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer noopener" className="btn btn--ghost">
                  <IconInstagram size={18} /> Seguirnos
                </a>
              )}
            </div>

            {reopen && (
              <p className="closure__reopen">
                Volvemos a abrir el <strong>{reopen}</strong>
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
