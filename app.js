/* ═══════════════════════════════════════════════════════════
   ULLATHORPE RENTAL — app.js
   Editá este archivo para cambios de lógica y datos.
   Para cambios visuales  → style.css
   Para cambios de layout → index.html
═══════════════════════════════════════════════════════════ */

/* ── CONFIGURACIÓN ──────────────────────────────────────── */
const IMG_BASE = 'img/catalogo/';
const MAX_COMBO_STOCK = 1; // Limite de stock para combos
const WSP_NUMBER = '5491130301420';

/* URLs públicas de Google Sheets (Archivo → Publicar en la web) */
const SHEET_CATALOGO_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv';

const SHEET_COMBOS_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv';

/* ── WhatsApp Genérico ─────────────────────────────────────────── */
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
function buildKeyMap(firstRow) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const map = {};
  Object.keys(firstRow).forEach(k => { map[norm(k)] = k; });
  return map;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escQuot(s) {
  return (s || '').replace(/'/g, "\\'");
}

function formatPrice(val) {
  if (!val) return '';
  return val.replace(/[,.]00$/, '').trim();
}

function parsePriceToInt(priceStr) {
  if (!priceStr) return 0;
  const digits = priceStr.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-AR').format(num);
}

const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:28px;height:28px;opacity:.35">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <path d="m21 15-5-5L5 21"/>
</svg>`;

function updateDateLabels() {
  const els = document.querySelectorAll('.last-update-label');
  const d = new Date(); 
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const text = `Actualizado a ${meses[d.getMonth()]} ${d.getFullYear()}`;
  els.forEach(el => el.innerHTML = text);
}


/* ══════════════════════════════════════════════════════════
   SISTEMA DE CARRITO DE COMPRAS
══════════════════════════════════════════════════════════ */
let cart = JSON.parse(localStorage.getItem('ullathorpe_cart')) || [];

function saveCart() {
  localStorage.setItem('ullathorpe_cart', JSON.stringify(cart));
  renderCartUI();
}

function toggleCart() {
  document.getElementById('cart-overlay').classList.toggle('open');
  document.getElementById('cart-modal').classList.toggle('open');
  renderCartUI();
}

function addToCart(name) {
  const item = catalogData.find(i => i.name === name);
  if (!item) return;

  const existing = cart.find(i => i.name === name);
  if (existing) {
    if (existing.qty < item.stock) {
      existing.qty++;
    } else {
      alert(`El stock máximo para este equipo es de ${item.stock} unidad(es).`);
      return; // Detener sin abrir el modal si no hay stock
    }
  } else {
    if (item.stock > 0) {
      cart.push({ ...item, qty: 1 });
    } else {
      alert("Sin stock disponible para este equipo.");
      return;
    }
  }
  
  saveCart();
  
  // Abrir el carrito automáticamente como feedback visual
  const modal = document.getElementById('cart-modal');
  if(!modal.classList.contains('open')) toggleCart();
}

function updateQty(index, delta) {
  const item = cart[index];
  const newQty = item.qty + delta;
  
  if (newQty <= 0) {
    cart.splice(index, 1); // Quitar si llega a 0
  } else if (newQty > item.stock) {
    alert(`El stock máximo para este equipo es de ${item.stock} unidad(es).`);
  } else {
    item.qty = newQty;
  }
  saveCart();
}

function renderCartUI() {
  const body = document.getElementById('cart-body');
  const badge = document.getElementById('cart-badge');
  const totalEl = document.getElementById('cart-total-price');

  let totalCount = 0;
  let totalPrice = 0;

  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty">Tu carrito está vacío.<br>Agregá equipos desde el catálogo.</div>';
    badge.innerText = '0';
    totalEl.innerText = '$0';
    badge.style.display = 'none';
    return;
  }

  badge.style.display = 'flex';
  let html = '';
  
  cart.forEach((item, idx) => {
    totalCount += item.qty;
    const itemPriceNum = parsePriceToInt(item.price);
    totalPrice += itemPriceNum * item.qty;

    // Foto para mostrar en el carrito (la primera si es combo, sino la normal)
    const displayImg = item.isCombo && item.images && item.images.length > 0 ? item.images[0] : item.img;
    const imgSrc = displayImg ? IMG_BASE + displayImg : '';

    html += `
    <div class="cart-item">
      <div class="cart-item-img">
         ${imgSrc ? `<img src="${imgSrc}" />` : `<svg width="20" height="20" opacity="0.3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">${escHtml(item.price)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty(${idx}, -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${idx}, 1)">+</button>
          <button class="cart-item-remove" onclick="updateQty(${idx}, -${item.qty})">Quitar</button>
        </div>
      </div>
    </div>`;
  });

  body.innerHTML = html;
  badge.innerText = totalCount;
  totalEl.innerText = `$${formatNumber(totalPrice)}`;
}

// Envío a WhatsApp
function checkout() {
  if (cart.length === 0) return alert("El carrito está vacío.");
  
  let msg = "Hola Ullathorpe! Quiero reservar lo siguiente:\n\n";
  let totalPrice = 0;
  
  cart.forEach(item => {
    const pNum = parsePriceToInt(item.price);
    totalPrice += pNum * item.qty;
    msg += `- ${item.qty}x ${item.name} (${item.price} c/u)\n`;
  });
  
  msg += `\n*Total est.: $${formatNumber(totalPrice)}* (sin IVA)\n\nEspero confirmación de disponibilidad.`;
  
  // Enviamos por WhatsApp codificando los saltos de línea (\n)
  openWsp(msg);
}


/* ══════════════════════════════════════════════════════════
   CARGA PRINCIPAL (CATÁLOGO + COMBOS + STOCK)
══════════════════════════════════════════════════════════ */
let catalogData = [];
let currentCat = 'all';
let currentSubcat = 'all';

async function loadData() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = `<div class="sheet-loading" style="grid-column:1/-1">
    <div class="sheet-spinner"></div><span>Cargando catálogo...</span>
  </div>`;

  try {
    const [resCat, resComb] = await Promise.all([
      fetch(SHEET_CATALOGO_URL),
      fetch(SHEET_COMBOS_URL)
    ]);

    if (!resCat.ok) throw new Error(`Catálogo HTTP ${resCat.status}`);
    if (!resComb.ok) throw new Error(`Combos HTTP ${resComb.status}`);

    updateDateLabels();

    // Procesar Catálogo
    const textCat = await resCat.text();
    const rowsCat = parseCSV(textCat);
    const kmCat = buildKeyMap(rowsCat[0] || {});

    // Procesar Combos 
    const textComb = await resComb.text();
    const firstLineComb = textComb.split('\n')[0] || '';
    const rowsComb = firstLineComb.includes('\t') ? parseTSV(textComb) : parseCSV(textComb);
    const kmComb = buildKeyMap(rowsComb[0] || {});

    // Mapear equipos estándar
    const parsedCatalog = rowsCat.map(row => ({
      isCombo: false,
      cat:    (row[kmCat.categoria] || row[kmCat.cat] || 'Otros').trim(),
      subcat: (row[kmCat.subcategoria] || row[kmCat.subcat] || '').trim(),
      name:   (row[kmCat.nombre] || row[kmCat.name] || '').trim(),
      desc:   (row[kmCat.descripcion] || row[kmCat.description] || row[kmCat.desc] || '').trim(),
      price:  formatPrice((row[kmCat.precio] || row[kmCat.price] || '').trim()),
      img:    (row[kmCat.imagen] || row[kmCat.img] || row[kmCat['ruta imagen']] || '').trim(),
      stock:  parseInt((row[kmCat.stc] || row[kmCat.stock] || row[kmCat.cantidad] || '1').trim(), 10) || 1,
    })).filter(r => r.name);

    // Mapear Combos
    const parsedCombos = rowsComb.map(row => {
      const imgStr = (row[kmComb.imagen] || row[kmComb.img] || row[kmComb['ruta imagen']] || '').trim();
      const images = imgStr ? imgStr.split(';').map(i => i.trim()).filter(Boolean) : [];

      return {
        isCombo: true,
        cat: (row[kmComb.categoria] || row[kmComb.cat] || 'Otros').trim(),
        subcat: 'Combos',
        badge: (row[kmComb.badge] || row[kmComb.nivel] || '').trim(),
        name: (row[kmComb.nombre] || row[kmComb.name] || row[kmComb.combo] || '').trim(),
        items: [
          (row[kmComb['item 1']] || row[kmComb['item 1']] || '').trim(),
          (row[kmComb['item 2']] || row[kmComb['item 2']] || '').trim(),
          (row[kmComb['item 3']] || row[kmComb['item 3']] || '').trim(),
          (row[kmComb['item 4']] || row[kmComb['item 4']] || '').trim(),
          (row[kmComb.items] || row[kmComb.contenido] || '').trim() 
        ].filter(Boolean),
        price: formatPrice((row[kmComb.precio] || row[kmComb.price] || '').trim()),
        images: images,
        stock: MAX_COMBO_STOCK
      };
    }).filter(r => r.name);

    // Unimos los dos mundos en la misma lista
    catalogData = [...parsedCatalog, ...parsedCombos];

    buildMainFilters();
    renderCatalog();
    renderCartUI(); // Inicializamos la burbuja del carrito si había datos guardados

  } catch (err) {
    grid.innerHTML = `<div class="sheet-error" style="grid-column:1/-1">
      <strong>No se pudo cargar el catálogo.</strong>
      Revisá que el Google Sheet esté publicado y sea de acceso público.<br/>
      <small style="opacity:.6;margin-top:.4rem;display:block">Error: ${err.message}</small>
    </div>`;
    console.error('[Catálogo]', err);
  }
}

/* ── Generar botones principales ── */
function buildMainFilters() {
  const container = document.getElementById('main-filters');
  if (!container) return;

  const categories = [...new Set(catalogData.filter(i => !i.isCombo).map(item => item.cat))].filter(Boolean);
  if (catalogData.some(i => i.isCombo)) categories.push('Combos');

  let html = `<button class="filter-btn ${currentCat === 'all' ? 'active' : ''}" data-cat="all">Todos</button>`;
  
  categories.forEach(c => {
    html += `<button class="filter-btn ${currentCat === c ? 'active' : ''}" data-cat="${escHtml(c)}">${escHtml(c)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentCat = e.target.dataset.cat;
      currentSubcat = 'all'; 
      buildMainFilters();
      renderCatalog();
    });
  });

  buildSubFilters();
}

/* ── Generar botones de subcategoría ── */
function buildSubFilters() {
  const container = document.getElementById('subcat-filters');
  if (!container) return;

  if (currentCat === 'all') {
    container.style.display = 'none';
    return;
  }

  let subcats = [];

  if (currentCat === 'Combos') {
    subcats = [...new Set(catalogData.filter(i => i.isCombo).map(i => i.cat))].filter(Boolean);
  } else {
    subcats = [...new Set(catalogData.filter(i => i.cat === currentCat).map(i => i.subcat))].filter(Boolean);
    if (subcats.includes('Combos')) {
      subcats = subcats.filter(sc => sc !== 'Combos');
      subcats.push('Combos');
    }
  }

  if (subcats.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  let html = `<button class="subcat-btn ${currentSubcat === 'all' ? 'active' : ''}" data-subcat="all">Todas</button>`;
  
  subcats.forEach(sc => {
    html += `<button class="subcat-btn ${currentSubcat === sc ? 'active' : ''}" data-subcat="${escHtml(sc)}">${escHtml(sc)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.subcat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentSubcat = e.target.dataset.subcat;
      buildSubFilters();
      renderCatalog();
    });
  });
}

/* ── Renderizar las Cards ── */
function renderCatalog() {
  const grid = document.getElementById('cat-grid');
  
  let items = catalogData;

  if (currentCat === 'Combos') {
    items = items.filter(i => i.isCombo);
    if (currentSubcat !== 'all') items = items.filter(i => i.cat === currentSubcat);
  } else if (currentCat !== 'all') {
    items = items.filter(i => i.cat === currentCat);
    if (currentSubcat !== 'all') items = items.filter(i => i.subcat === currentSubcat);
  }

  if (!items.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1;text-align:center;padding:2rem">Sin equipos en esta sección.</p>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    if (item.isCombo) {
      const imgCount = item.images.length;
      let layoutClass = 'combo-layout-2'; 
      if (imgCount === 3) layoutClass = 'combo-layout-3';
      if (imgCount >= 4) layoutClass = 'combo-layout-4';

      const imagesHtml = item.images.map(img => `<img src="${IMG_BASE + img}" alt="${escHtml(item.name)}" onerror="this.style.display='none'" />`).join('');
      const badgeHtml = item.badge ? `<span class="combo-badge">${escHtml(item.badge)}</span>` : '';
      const listHtml = item.items.map(i => `<li>${escHtml(i)}</li>`).join('');

      return `
        <div class="cat-card combo-style">
          <div class="cat-img">
            ${imgCount > 0 
              ? `<div class="combo-img-collage ${layoutClass}">${imagesHtml}</div>` 
              : `<div class="cat-img-placeholder">${PLACEHOLDER_SVG}<span style="font-size:.6rem;opacity:.35">sin imagen</span></div>`}
          </div>
          <div class="cat-body">
            <div class="cat-cat">
              <span>${escHtml(item.cat)} <span style="color:var(--gold); opacity: 0.6; margin: 0 4px;">|</span> COMBO</span>
              ${badgeHtml}
            </div>
            <div class="cat-name">${escHtml(item.name)}</div>
            ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul>` : ''}
            <div class="card-action-bar">
              <div>
                <div class="cat-price">${escHtml(item.price)}</div>
                <div class="cat-price-lbl">por jornada · sin IVA</div>
              </div>
              <button class="btn-add-cart" onclick="addToCart('${escQuot(item.name)}')">Agregar</button>
            </div>
          </div>
        </div>`;
    } else {
      return `
        <div class="cat-card">
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
            <div class="cat-cat">
              <span>
                ${escHtml(item.cat)} 
                ${item.subcat ? `<span style="color:var(--gold); opacity: 0.6; margin: 0 4px;">|</span> ${escHtml(item.subcat)}` : ''}
              </span>
            </div>
            <div class="cat-name">${escHtml(item.name)}</div>
            <div class="cat-desc">${escHtml(item.desc) || '&nbsp;'}</div>
            <div class="card-action-bar">
              <div>
                <div class="cat-price">${escHtml(item.price)}</div>
                <div class="cat-price-lbl">por jornada · sin IVA</div>
              </div>
              <button class="btn-add-cart" onclick="addToCart('${escQuot(item.name)}')">Agregar</button>
            </div>
          </div>
        </div>`;
    }
  }).join('');
}


/* ══════════════════════════════════════════════════════════
   CONTACT BLOCK
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
   SPA ENGINE Y NAVEGACIÓN
══════════════════════════════════════════════════════════ */
const PAGES = ['home','catalogo','estudio','como','contrato']; 

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

  const slot = document.getElementById('contact-slot-' + id);
  if (slot && !slot.dataset.filled) {
    slot.innerHTML = buildContactBlock();
    slot.dataset.filled = '1';
  }

  document.getElementById('nav-links').classList.remove('mob-open');
}

function goToCombos() {
  showPage('catalogo');
  currentCat = 'Combos';
  currentSubcat = 'all';
  buildMainFilters();
  renderCatalog();
}

function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('mob-open');
}

window.addEventListener('scroll', () => {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
loadData();

const homeSlot = document.getElementById('contact-slot-home');
homeSlot.innerHTML = buildContactBlock();
homeSlot.dataset.filled = '1';