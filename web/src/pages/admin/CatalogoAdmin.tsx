import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { CATEGORY_LABEL, ProductCard, STOCK_LABEL } from '../../components/Catalogo';
import type { Product, ProductCategory, ProductStock, Settings } from '../../lib/types';
import type { Runner } from './AdminShell';

const CATEGORIES: ProductCategory[] = ['magic', 'mesa', 'libros', 'manga', 'merch', 'otros'];
const STOCKS: ProductStock[] = ['disponible', 'pocas', 'agotado', 'encargo'];

const NUEVO = {
  name: '',
  category: 'magic' as ProductCategory,
  price: '',
  description: '',
  image: '',
  stock: 'disponible' as ProductStock,
  featured: 0
};

type Draft = typeof NUEVO;

/**
 * Encoge la foto en el propio navegador antes de mandarla: así una foto de
 * móvil de 5 MB viaja como 200 KB y la web carga rápida.
 */
async function prepararFoto(file: File, maxLado = 1200): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no puede preparar la foto.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = canvas.toDataURL('image/webp', 0.82);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

export function CatalogoAdmin({
  products,
  settings,
  run
}: {
  products: Product[];
  settings: Settings;
  run: Runner;
}) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);

  return (
    <>
      <div className="card panel" style={{ marginBottom: 20 }}>
        <h3>El escaparate de la web</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Cada tarjeta que crees aquí sale en la portada con su foto, su precio y su descripción. Es solo informativo:
          nadie compra por la web, la gente te escribe por Instagram.
          {settings.site_mode !== 'catalogo' && (
            <>
              {' '}
              <strong style={{ color: 'var(--reserved)' }}>
                Ahora mismo la web está en modo completo, así que el catálogo no se ve.
              </strong>{' '}
              Cámbialo en Ajustes.
            </>
          )}
        </p>
        <button className="btn btn--primary btn--sm" onClick={() => { setCreando((v) => !v); setEditando(null); }}>
          {creando ? 'Cancelar' : '+ Nueva tarjeta'}
        </button>
      </div>

      {creando && (
        <FormularioProducto
          run={run}
          onDone={() => setCreando(false)}
        />
      )}

      {products.length === 0 ? (
        <div className="empty">Todavía no hay ninguna tarjeta. Crea la primera con el botón de arriba.</div>
      ) : (
        <div className="admin-catalog">
          {products.map((p, i) => (
            <div key={p.id} className="admin-catalog__item">
              <ProductCard product={p} />

              <div className="admin-catalog__tools">
                <button className="mini-btn" onClick={() => { setEditando(editando === p.id ? null : p.id); setCreando(false); }}>
                  {editando === p.id ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  className="mini-btn"
                  disabled={i === 0}
                  title="Subir en la lista"
                  onClick={() => run(() => api.admin.products.move(p.id, 'arriba'), 'Movida')}
                >
                  ↑
                </button>
                <button
                  className="mini-btn"
                  disabled={i === products.length - 1}
                  title="Bajar en la lista"
                  onClick={() => run(() => api.admin.products.move(p.id, 'abajo'), 'Movida')}
                >
                  ↓
                </button>
                <button
                  className="mini-btn mini-btn--danger"
                  onClick={() => {
                    if (confirm(`¿Quitar "${p.name}" del escaparate?`)) run(() => api.admin.products.remove(p.id), 'Tarjeta borrada');
                  }}
                >
                  Borrar
                </button>
              </div>

              {editando === p.id && <FormularioProducto product={p} run={run} onDone={() => setEditando(null)} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FormularioProducto({
  product,
  run,
  onDone
}: {
  product?: Product;
  run: Runner;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    product
      ? {
          name: product.name,
          category: product.category,
          price: product.price,
          description: product.description,
          image: product.image,
          stock: product.stock,
          featured: product.featured
        }
      : { ...NUEVO }
  );
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) setDraft({ ...draft, image: product.image });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.image]);

  const elegirFoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      const dataUrl = await prepararFoto(file);
      const { url } = await api.admin.products.uploadImage(dataUrl);
      setDraft((d) => ({ ...d, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido subir la foto.');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = () =>
    run(
      () => (product ? api.admin.products.update(product.id, draft) : api.admin.products.create(draft)),
      product ? 'Tarjeta guardada' : 'Tarjeta creada'
    ).then(onDone);

  return (
    <div className="card panel" style={{ marginBottom: 18 }}>
      <h3>{product ? `Editar «${product.name}»` : 'Nueva tarjeta'}</h3>

      <div className="uploader">
        <div className="uploader__preview">
          {draft.image ? (
            <img src={draft.image} alt="" />
          ) : (
            <span>Sin foto</span>
          )}
        </div>

        <div className="uploader__actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => elegirFoto(e.target.files?.[0])}
          />
          <button className="btn btn--ghost btn--sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
            {subiendo ? 'Subiendo…' : draft.image ? 'Cambiar la foto' : 'Subir una foto'}
          </button>
          {draft.image && (
            <button className="mini-btn mini-btn--danger" onClick={() => setDraft({ ...draft, image: '' })}>
              Quitar la foto
            </button>
          )}
          <small style={{ color: 'var(--muted-2)', fontSize: '0.76rem' }}>
            Vale una foto del móvil: la encogemos aquí mismo antes de subirla.
          </small>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Nombre</label>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Mazo Commander · Edgar Markov"
          />
        </div>
        <div className="field">
          <label>Categoría</label>
          <select
            className="select"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as ProductCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Precio</label>
          <input
            className="input"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="49,95 €"
          />
        </div>
        <div className="field">
          <label>Disponibilidad</label>
          <select
            className="select"
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value as ProductStock })}
          >
            {STOCKS.map((s) => (
              <option key={s} value={s}>{STOCK_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Descripción</label>
        <textarea
          className="textarea"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Precon de vampiros, listo para jugar nada más abrirlo. Incluye 100 cartas y dado."
        />
      </div>

      <label className="switch-row">
        <input
          type="checkbox"
          checked={Boolean(draft.featured)}
          onChange={(e) => setDraft({ ...draft, featured: e.target.checked ? 1 : 0 })}
        />
        <span>
          <strong>Destacar</strong>
          <small>Sale de los primeros y con una etiqueta.</small>
        </span>
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--primary btn--sm" disabled={!draft.name.trim() || subiendo} onClick={guardar}>
          {product ? 'Guardar cambios' : 'Crear la tarjeta'}
        </button>
        <button className="mini-btn" onClick={onDone}>Cancelar</button>
      </div>

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
