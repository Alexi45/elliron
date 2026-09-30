import { useMemo, useState } from 'react';
import { Reveal } from './Reveal';
import { Logo } from './Logo';
import { IconArrow, IconBook, IconDice, IconInstagram, IconManga, IconMapPin, IconPhone, IconSparkles } from './Icons';
import type { Product, ProductCategory, Settings } from '../lib/types';

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

/** Orden en el que se enseñan las categorías cuando se ven todas */
const ORDEN: ProductCategory[] = ['magic', 'mesa', 'libros', 'manga', 'merch', 'otros'];

const ICONS: Record<ProductCategory, JSX.Element> = {
  magic: <IconSparkles size={18} />,
  mesa: <IconDice size={18} />,
  libros: <IconBook size={18} />,
  manga: <IconManga size={18} />,
  merch: <IconSparkles size={18} />,
  otros: <IconSparkles size={18} />
};

/* ------------------------------------------------------------- teléfono */

export const soloDigitos = (tel: string) => String(tel || '').replace(/\D/g, '');

/** 614060947 → 614 06 09 47 */
export function telefonoBonito(tel: string) {
  const d = soloDigitos(tel);
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : tel;
}

export const enlaceWhatsapp = (tel: string, texto: string) =>
  `https://wa.me/34${soloDigitos(tel)}?text=${encodeURIComponent(texto)}`;

/* ------------------------------------------------------------- cabecera */

export function CabeceraCatalogo({ settings }: { settings: Settings }) {
  const tel = settings.order_phone;

  return (
    <section className="catalog-hero">
      <div className="shell">
        <Reveal>
          <div className="catalog-hero__top">
            <Logo size={150} className="catalog-hero__mark" />
            <div>
              <span className="eyebrow">Montequinto · Dos Hermanas</span>
              <h1 className="hero__title catalog-hero__title">{settings.catalog_title}</h1>
              <p className="lead">{settings.catalog_intro}</p>
            </div>
          </div>
        </Reveal>

        {tel && (
          <Reveal delay={90}>
            <div className="card pedido">
              <div className="pedido__texto">
                <span className="eyebrow">Cómo se pide</span>
                <p className="pedido__frase">
                  {settings.order_notice}{' '}
                  <strong>
                    Escríbenos al {telefonoBonito(tel)}
                    {settings.order_area ? ` y te lo llevamos a ${settings.order_area}` : ''}.
                  </strong>
                </p>
              </div>

              <div className="pedido__botones">
                <a
                  className="btn btn--primary"
                  href={enlaceWhatsapp(tel, '¡Hola! Os escribo por el catálogo de la web de El Lirón.')}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Escribir por WhatsApp <IconArrow size={16} />
                </a>
                <a className="btn btn--ghost" href={`tel:+34${soloDigitos(tel)}`}>
                  <IconPhone size={17} /> {telefonoBonito(tel)}
                </a>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- catálogo */

export function Catalogo({ products, settings }: { products: Product[]; settings: Settings }) {
  const [filter, setFilter] = useState<ProductCategory | 'todo'>('todo');
  const [busca, setBusca] = useState('');

  const categorias = useMemo(() => {
    const cuenta = new Map<ProductCategory, number>();
    for (const p of products) cuenta.set(p.category, (cuenta.get(p.category) ?? 0) + 1);
    return ORDEN.filter((c) => cuenta.has(c)).map((c) => [c, cuenta.get(c)!] as const);
  }, [products]);

  /* Buscar por nombre o descripción, sin que las tildes molesten */
  const visibles = useMemo(() => {
    const texto = normalizar(busca);
    return products.filter((p) => {
      if (filter !== 'todo' && p.category !== filter) return false;
      if (!texto) return true;
      return normalizar(`${p.name} ${p.description}`).includes(texto);
    });
  }, [products, filter, busca]);

  /* Con «Todo» los agrupamos por categoría; filtrando, una sola rejilla */
  const grupos = useMemo(() => {
    if (filter !== 'todo') return [['', visibles] as const];
    return ORDEN.map((c) => [c, visibles.filter((p) => p.category === c)] as const).filter(([, l]) => l.length > 0);
  }, [visibles, filter]);

  return (
    <section id="catalogo">
      <div className="shell">
        <Reveal>
          <div className="catalog-bar">
            <div className="filters">
              <button className={`chip ${filter === 'todo' ? 'is-active' : ''}`} onClick={() => setFilter('todo')}>
                Todo <small>{products.length}</small>
              </button>
              {categorias.map(([cat, n]) => (
                <button key={cat} className={`chip ${filter === cat ? 'is-active' : ''}`} onClick={() => setFilter(cat)}>
                  {CATEGORY_LABEL[cat]} <small>{n}</small>
                </button>
              ))}
            </div>

            <label className="buscador">
              <input
                className="input"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar un producto…"
                aria-label="Buscar un producto"
              />
            </label>
          </div>
        </Reveal>

        {products.length === 0 ? (
          <div className="empty">Estamos subiendo los productos. Vuelve en un rato.</div>
        ) : visibles.length === 0 ? (
          <div className="empty">
            No encontramos nada con «{busca}». Prueba con otra palabra o pregúntanos: igual lo tenemos sin subir.
          </div>
        ) : (
          grupos.map(([cat, lista]) => (
            <div key={cat || 'todos'} className="catalog-group">
              {cat && (
                <h3 className="catalog-group__title">
                  {ICONS[cat as ProductCategory]} {CATEGORY_LABEL[cat as ProductCategory]}
                  <small>{lista.length}</small>
                </h3>
              )}
              <div className="catalog-grid">
                {lista.map((p, i) => (
                  <Reveal key={p.id} delay={Math.min(i, 5) * 50}>
                    <ProductCard product={p} phone={settings.order_phone} />
                  </Reveal>
                ))}
              </div>
            </div>
          ))
        )}

        <Reveal delay={80}>
          <p className="board__note" style={{ marginTop: 28 }}>
            Los precios son los de tienda y pueden cambiar. ¿Buscas algo que no está aquí?
            {settings.instagram && (
              <>
                {' '}
                <a href={settings.instagram} target="_blank" rel="noreferrer noopener" className="link-gold">
                  Pregúntanos por Instagram <IconInstagram size={14} />
                </a>
              </>
            )}{' '}
            o llámanos.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/* ---------------------------------------------------------------- tarjeta */

export function ProductCard({ product, phone }: { product: Product; phone?: string }) {
  const agotado = product.stock === 'agotado';
  const mensaje = `¡Hola! Me interesa «${product.name}»${product.price ? ` (${product.price})` : ''} que he visto en la web. ¿Me lo podéis llevar?`;

  return (
    <article className={`card product ${agotado ? 'is-out' : ''}`}>
      <div className="product__photo">
        {product.image ? (
          <>
            {/* La misma foto borrosa detrás: rellena sin recortar el producto */}
            <span className="product__blur" style={{ backgroundImage: `url("${product.image}")` }} aria-hidden="true" />
            <img src={product.image} alt={product.name} loading="lazy" />
          </>
        ) : (
          <div className="product__placeholder">{ICONS[product.category] ?? ICONS.otros}</div>
        )}
        {product.featured === 1 && <span className="product__flag">Destacado</span>}
        <span className={`product__stock product__stock--${product.stock}`}>{STOCK_LABEL[product.stock]}</span>
      </div>

      <div className="product__body">
        <span className="product__cat">
          {ICONS[product.category] ?? ICONS.otros} {CATEGORY_LABEL[product.category]}
        </span>
        <h3 className="product__name">{product.name}</h3>
        {product.description && <p className="product__desc">{product.description}</p>}

        <div className="product__foot">
          {product.price && <span className="product__price">{product.price}</span>}
          {phone && !agotado && (
            <a
              className="btn btn--primary btn--sm"
              href={enlaceWhatsapp(phone, mensaje)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Lo quiero
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* Barra fija en el móvil: el teléfono siempre a mano */
export function BarraPedido({ settings }: { settings: Settings }) {
  const tel = settings.order_phone;
  if (!tel) return null;

  return (
    <div className="barra-pedido">
      <span>
        <strong>¿Te llevamos algo?</strong>
        <small>
          <IconMapPin size={12} /> {settings.order_area || 'Montequinto'}
        </small>
      </span>
      <a
        className="btn btn--primary btn--sm"
        href={enlaceWhatsapp(tel, '¡Hola! Os escribo por el catálogo de la web de El Lirón.')}
        target="_blank"
        rel="noreferrer noopener"
      >
        {telefonoBonito(tel)}
      </a>
    </div>
  );
}
