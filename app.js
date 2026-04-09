/* ═══════════════════════════════════════════════════════════
   ULLATHORPE RENTAL — app.js
   Editá este archivo para cambios de lógica y datos.
   Para cambios visuales  → style.css
   Para cambios de layout → index.html
═══════════════════════════════════════════════════════════ */

/* ── CONFIGURACIÓN ────────────────────────────────────────
   IMG_BASE: ruta a las fotos de los equipos.
   Cada ítem del sheet debe tener en la columna "img" el
   nombre de archivo exacto (ej: sony-a6600.jpg).

   Para usar GitHub raw:
   'https://raw.githubusercontent.com/ullathorperental/Ullathorpe_Web/main/img/catalogo/'
─────────────────────────────────────────────────────────── */
const IMG_BASE = 'img/catalogo/';

/* URLs públicas de Google Sheets (Archivo → Publicar en la web) */
const SHEET_CATALOGO_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv';

const SHEET_COMBOS_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv';

/* ── WhatsApp ─────────────────────────────────────────── */
const WSP_NUMBER = '5491130301420';

function openWsp(msg) {
  const text = encodeURIComponent(msg || 'Hola! Quiero consultar por equipos disponibles.');
  window.open(`https://wa.me/${WSP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
}

/* ══════════════════════════════════════════════════════════
   CSV / TSV PARSER  (RFC 4180 compliant)
══════════════════════════════════════════════════════════ */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
      return obj;
    })
    .filter(row => Object.values(row).some(v => v !== ''));
}

function parseTSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1)
    .map(line => {
      const vals = line.split('\t');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    })
    .filter(row => Object.values(row).some(v => v !== ''));
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/* ══════════════════════════════════════════════════════════
   UTILIDADES COMPARTIDAS
══════════════════════════════════════════════════════════ */
const CAT_LABELS = {
  camaras:    'Cámaras',
  lentes:     'Lentes',
  accesorios: 'Accesorios',
  video:      'Video & Foto',
  iluminacion:'Iluminación',
  sonido:     'Sonido',
};

function normalizeCategory(raw) {
  const map = {
    'camaras':'camaras','cámaras':'camaras','camara':'camaras','cámara':'camaras',
    'lentes':'lentes','lente':'lentes',
    'accesorios':'accesorios','accesorio':'accesorios',
    'video':'video','video & foto':'video','video&foto':'video','foto':'video',
    'iluminacion':'iluminacion','iluminación':'iluminacion',
    'sonido':'sonido',
  };
  return map[(raw || '').toLowerCase().trim()] || (raw || '').toLowerCase().trim();
}

/* Crea mapa { clave_normalizada → clave_real } insensible a tildes/mayúsculas */
function buildKeyMap(firstRow) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const map = {};
  Object.keys(firstRow).forEach(k => { map[norm(k)] = k; });
  return map;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:28px;height:28px;opacity:.35">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <path d="m21 15-5-5L5 21"/>
</svg>`;

/* ── Función para formatear e inyectar la fecha dinámica ── */
function updateDateLabels() {
  const els = document.querySelectorAll('.last-update-label');
  
  const d = new Date(); // Toma la fecha de hoy
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const text = `Actualizado a ${meses[d.getMonth()]} ${d.getFullYear()}`;
  
  els.forEach(el => el.innerHTML = text);
}

/* ══════════════════════════════════════════════════════════
   CATÁLOGO
   Columnas esperadas en el sheet (insensible a tildes/mayúsculas):
     categoria | nombre | descripcion | precio | img
══════════════════════════════════════════════════════════ */
let catalogData = [];

async function loadCatalog() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = `<div class="sheet-loading" style="grid-column:1/-1">
    <div class="sheet-spinner"></div><span>Cargando catálogo...</span>
  </div>`;

  try {
    const res = await fetch(SHEET_CATALOGO_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    // 1. Extraemos la fecha de la última modificación del Sheet desde los headers HTTP
    const lastMod = res.headers.get('Last-Modified');
    updateDateLabels(lastMod); // 2. Actualizamos los textos en HTML

    const rows = parseCSV(await res.text());
    if (!rows.length) throw new Error('El sheet está vacío.');

    const km = buildKeyMap(rows[0]);
    catalogData = rows.map(row => ({
      cat:   normalizeCategory(row[km.categoria] || row[km.cat] || ''),
      name:  row[km.nombre]      || row[km.name]        || '',
      desc:  row[km.descripcion] || row[km.description] || row[km.desc] || '',
      price: row[km.precio]      || row[km.price]       || '',
      img:   row[km.img]         || row[km.imagen]      || '',
    })).filter(r => r.name);

    renderCatalog('all');
    rebuildFilters();

  } catch (err) {
    grid.innerHTML = `<div class="sheet-error" style="grid-column:1/-1">
      <strong>No se pudo cargar el catálogo.</strong>
      Revisá que el Google Sheet esté publicado y sea de acceso público.<br/>
      <small style="opacity:.6;margin-top:.4rem;display:block">Error: ${err.message}</small>
    </div>`;
    console.error('[Catálogo]', err);
  }
}

function renderCatalog(filter) {
  const grid = document.getElementById('cat-grid');
  const items = filter === 'all' ? catalogData : catalogData.filter(i => i.cat === filter);

  if (!items.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1;text-align:center;padding:2rem">Sin equipos en esta categoría.</p>`;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="cat-card" data-cat="${item.cat}">
      <div class="cat-img">
        ${item.img
          ? `<img src="${IMG_BASE + item.img}" alt="${escHtml(item.name)}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
             <div class="cat-img-placeholder" style="display:none;">
               ${PLACEHOLDER_SVG}
               <span style="font-size:.58rem;opacity:.4;margin-top:.25rem">${escHtml(item.img)}</span>
             </div>`
          : `<div class="cat-img-placeholder">${PLACEHOLDER_SVG}<span style="font-size:.6rem;opacity:.35">sin imagen</span></div>`
        }
      </div>
      <div class="cat-body">
        <div class="cat-cat">${CAT_LABELS[item.cat] || item.cat}</div>
        <div class="cat-name">${escHtml(item.name)}</div>
        <div class="cat-desc">${escHtml(item.desc) || '&nbsp;'}</div>
        <div class="cat-price">${escHtml(item.price)}</div>
        <div class="cat-price-lbl">por jornada · sin IVA</div>
      </div>
    </div>`).join('');
}

function rebuildFilters() {
  const existing = new Set(catalogData.map(i => i.cat));
  document.querySelectorAll('.filter-btn[data-cat]').forEach(btn => {
    const cat = btn.dataset.cat;
    btn.style.display = (cat === 'all' || existing.has(cat)) ? '' : 'none';
  });
}

/* ══════════════════════════════════════════════════════════
   COMBOS
   Columnas esperadas en el sheet (TSV):
     tipo | nombre | items | precio | nivel
   - tipo   → VIDEO o SONIDO
   - items  → separados por "|"  (ej: "Cámara Sony|Lente Sony")
   - nivel  → badge (ej: Newbie, Intermedio…) — opcional
══════════════════════════════════════════════════════════ */
async function loadCombos() {
  const container = document.getElementById('combos-container');
  const loadingEl = document.getElementById('combos-loading');
  const errorEl   = document.getElementById('combos-error');

  try {
    const res = await fetch(SHEET_COMBOS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseTSV(await res.text());
    if (!rows.length) throw new Error('El sheet de combos está vacío.');

    const km = buildKeyMap(rows[0]);
    const combos = rows.map(row => ({
      tipo:   (row[km.tipo]    || row[km.type]      || row[km.categoria] || 'otro').trim(),
      nombre: (row[km.nombre]  || row[km.name]      || row[km.combo]     || '').trim(),
      items:  (row[km.items]   || row[km.contenido] || row[km.detalle]   || '').trim(),
      precio: (row[km.precio]  || row[km.price]     || '').trim(),
      nivel:  (row[km.nivel]   || row[km.badge]     || '').trim(),
    })).filter(c => c.nombre);

    // Agrupamos por tipo
    const grupos = {};
    combos.forEach(c => {
      const key = c.tipo.toUpperCase();
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    });

    loadingEl.style.display = 'none';

    // Orden: VIDEO primero, SONIDO segundo, resto al final
    const ORDER = ['VIDEO', 'SONIDO'];
    const keys = [
      ...ORDER.filter(k => grupos[k]),
      ...Object.keys(grupos).filter(k => !ORDER.includes(k)),
    ];

    keys.forEach((tipo, idx) => {
      const secEl = document.createElement('div');
      secEl.className = 'combos-section';
      if (idx > 0) secEl.style.cssText = 'margin-top:4rem;padding-top:3.5rem;border-top:1px solid rgba(201,168,76,.1)';
      const label = tipo.charAt(0) + tipo.slice(1).toLowerCase();
      secEl.innerHTML = `
        <div class="combos-section-title">
          <span class="combos-section-badge">${escHtml(label)}</span>
          Combos de ${escHtml(label)}
        </div>
        <div class="combos-grid">
          ${grupos[tipo].map(renderComboCard).join('')}
        </div>`;
      container.appendChild(secEl);
    });

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = '';
    errorEl.innerHTML = `<strong>No se pudieron cargar los combos.</strong>
      Revisá que el Google Sheet esté publicado y sea de acceso público.<br/>
      <small style="opacity:.6;margin-top:.4rem;display:block">Error: ${err.message}</small>`;
    console.error('[Combos]', err);
  }
}

function renderComboCard(c) {
  const wsp = `https://wa.me/${WSP_NUMBER}?text=${encodeURIComponent(`Hola! Me interesa el ${c.nombre}. ¿Tenés disponibilidad?`)}`;
  const badge = c.nivel || (c.tipo.charAt(0) + c.tipo.slice(1).toLowerCase());
  const itemList = c.items
    ? c.items.split('|').map(i => i.trim()).filter(Boolean)
        .map(i => `<li>${escHtml(i)}</li>`).join('')
    : '';
  return `
    <div class="combo-card">
      <span class="combo-badge">${escHtml(badge)}</span>
      <div class="combo-name">${escHtml(c.nombre)}</div>
      ${itemList ? `<ul class="combo-items">${itemList}</ul>` : ''}
      <div class="combo-footer">
        <div class="combo-price">${escHtml(c.precio)}<small>por jornada · sin IVA</small></div>
        <a class="combo-wsp" href="${wsp}" target="_blank" rel="noopener">Reservar</a>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   CONTACT BLOCK
   Se inyecta dinámicamente al pie de cada página.
══════════════════════════════════════════════════════════ */
function buildContactBlock() {
  return `
  <div class="contact-block">
    <div class="inner">
      <div class="section-header">
        <div class="eyebrow">Estamos para ayudarte</div>
        <h2>¿<em>Charlamos</em>?</h2>
        <div class="ornament"><span class="ornament-diamond"></span></div>
        <p class="section-desc">Reservas y pedidos exclusivamente por WhatsApp. También podés seguirnos en Instagram.</p>
      </div>
      <div class="contact-cards">
        <div class="contact-card" onclick="openWsp()">
          <div class="ci">💬</div><div class="cl">WhatsApp</div><div class="cv">011-3030-1420</div>
        </div>
        <a class="contact-card" href="https://www.instagram.com/ullathorpe.rental" target="_blank" rel="noopener">
          <div class="ci">📸</div><div class="cl">Instagram</div><div class="cv">@ullathorpe.rental</div>
        </a>
        <a class="contact-card" href="mailto:ullathorperental@gmail.com">
          <div class="ci">✉️</div><div class="cl">Email</div><div class="cv">ullathorperental@gmail.com</div>
        </a>
        <div class="contact-card" style="cursor:default;">
          <div class="ci">📍</div><div class="cl">Ubicación</div><div class="cv">Parque Chacabuco, CABA</div>
        </div>
      </div>
      <div class="contact-wsp-wrap">
        <button class="wsp-big" onclick="openWsp('Hola! Quiero consultar por equipos disponibles.')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          Escribinos por WhatsApp
        </button>
      </div>
    </div>
  </div>
  <footer class="site-footer">
    <div class="footer-logo"><img src="img/logo_leon.png" alt="Ullathorpe Rental" onerror="this.style.display='none'" /></div>
    <div class="footer-tagline">"Acompañando a los profesionales desde sus inicios"</div>
    <div class="footer-legal">© 2026 Ullathorpe Rental · Parque Chacabuco, CABA · Todos los precios en ARS sin IVA</div>
  </footer>`;
}

/* ══════════════════════════════════════════════════════════
   SPA ENGINE
══════════════════════════════════════════════════════════ */
const PAGES = ['home','catalogo','combos','estudio','como','contrato'];

function showPage(id) {
  PAGES.forEach(p => {
    document.getElementById('page-' + p).classList.remove('active');
    const n = document.getElementById('nav-' + p);
    if (n) n.classList.remove('active');
  });
  document.getElementById('page-' + id).classList.add('active');
  const navEl = document.getElementById('nav-' + id);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Inyectar contacto si todavía no fue inyectado en esta página
  const slot = document.getElementById('contact-slot-' + id);
  if (slot && !slot.dataset.filled) {
    slot.innerHTML = buildContactBlock();
    slot.dataset.filled = '1';
  }

  document.getElementById('nav-links').classList.remove('mob-open');
}

/* ── Filtros del catálogo ── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCatalog(btn.dataset.cat);
  });
});

/* ── Menú mobile ── */
function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('mob-open');
}

/* ── Efecto de scroll en el nav ── */
window.addEventListener('scroll', () => {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ══════════════════════════════════════════════════════════
   INIT — se ejecuta al cargar la página
══════════════════════════════════════════════════════════ */
loadCatalog();
loadCombos();

// Inyectar contacto en Home (activo al cargar)
const homeSlot = document.getElementById('contact-slot-home');
homeSlot.innerHTML = buildContactBlock();
homeSlot.dataset.filled = '1';
