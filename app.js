/* ═══════════════════════════════════════════════════════════
   ULLATHORPE RENTAL — app.js
   Editá este archivo para cambios de lógica y datos.
   Para cambios visuales  → style.css
   Para cambios de layout → index.html
═══════════════════════════════════════════════════════════ */

/* ── CONFIGURACIÓN ──────────────────────────────────────── */
const IMG_BASE = 'img/catalogo/';
const MAX_COMBO_STOCK = 1; // Limite de stock para combos
const WSP_NUMBER = '5491170201017';

/* URLs públicas de Google Sheets (Archivo → Publicar en la web) */
const SHEET_CATALOGO_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv';

const SHEET_COMBOS_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv';

/* ── WhatsApp Genérico ─────────────────────────────────────────── */
function openWsp(msg) {
  // Filtramos el mensaje para asegurar que sea texto plano antes de codificar
  const cleanMsg = msg ? msg.trim() : '';
  const encodedMsg = encodeURIComponent(cleanMsg);
  window.open(`https://wa.me/${WSP_NUMBER}?text=${encodedMsg}`, '_blank', 'noopener,noreferrer');
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

// Nueva función para quitar tildes y pasar a minúsculas
function normalizeText(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function formatPrice(val) {
  if (!val) return '';
  // Quitamos el ",00" del final y cualquier espacio extra
  return val.split(',')[0].replace(/[^0-9.]/g, '').trim();
}

function parsePriceToInt(priceStr) {
  if (!priceStr) return 0;
  const digits = priceStr.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

function formatNumber(num) {
  // es-AR usa el punto (.) para miles. 
  // .format() sin opciones no agrega decimales si el número es entero.
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
  document.body.classList.toggle('no-scroll'); // Bloquea/desbloquea el scroll del fondo
  renderCartUI();
}

function clearCart() {
  if (cart.length === 0) return;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

function executeClearCart() {
  cart = [];
  saveCart();
  closeConfirm();
  showToast("Carrito vaciado", "success");
}

/* ── Notificaciones Toast ── */
function showToast(msg, type = 'warning') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'warning' 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
  toast.innerHTML = `${icon} <span>${msg}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function addToCart(name) {
  const item = catalogData.find(i => i.name === name);
  if (!item) return;

  const existing = cart.find(i => i.name === name);
  if (existing) {
    if (existing.qty < item.stock) {
      existing.qty++;
      showToast(`Añadiste otro "${item.name}" al carrito`, 'success');
    } else {
      showToast(`Stock máximo alcanzado (${item.stock}) para este equipo.`);
      return; 
    }
  } else {
    if (item.stock > 0) {
      cart.push({ ...item, qty: 1 });
      showToast(`"${item.name}" añadido al carrito`, 'success');
    } else {
      showToast("Sin stock disponible para este equipo.");
      return;
    }
  }
  
  saveCart();
}

function updateQty(index, delta) {
  const item = cart[index];
  const newQty = item.qty + delta;
  
  if (newQty <= 0) {
    cart.splice(index, 1); 
  } else if (newQty > item.stock) {
    showToast(`El límite de stock es de ${item.stock} unidad(es).`);
  } else {
    item.qty = newQty;
  }
  saveCart();
}

function renderCartUI() {
  const body = document.getElementById('cart-body');
  const badge = document.getElementById('cart-badge');
  const totalEl = document.getElementById('cart-total-price');
  
  // Obtenemos los días actuales para la multiplicación
  const daysInput = document.getElementById('cart-days');
  const days = daysInput ? (parseInt(daysInput.value) || 1) : 1;
  
  // Actualizamos el texto del label dinámicamente
  const daysLabel = document.getElementById('cart-days-label');
  if (daysLabel) {
    const hours = (days * 24) - 1;
    daysLabel.innerText = `Jornadas (${hours}hs)`;
  }

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
    const subtotal = itemPriceNum * item.qty * days;
    totalPrice += subtotal;

    let imgHtml = '';
    if (item.isCombo && item.images.length > 0) {
      const firstImg = `<img src="${IMG_BASE + item.images[0]}" class="combo-first-img">`;
      const imgCount = item.images.length;
      
      let loopHtml = '';
      if (imgCount > 1) {
        const dur = imgCount * 1.2; 
        const translatePct = -((imgCount - 1) / imgCount) * 100;
        const loopImgsHtml = item.images.map(img => `<img src="${IMG_BASE + img}">`).join('');
        
        loopHtml = `
          <div class="cart-combo-loop">
            <div class="cart-combo-track" style="animation: comboPingPong ${dur}s ease-in-out infinite alternate; --slide-target: ${translatePct}%;">
              ${loopImgsHtml}
            </div>
          </div>`;
      }

      imgHtml = `
        <div class="cart-combo-container">
          <div class="cart-combo-static">
            ${firstImg}
          </div>
          <div class="combo-kit-badge">KIT</div>
          ${loopHtml}
        </div>`;
    } else {
      const imgSrc = item.img ? IMG_BASE + item.img : '';
      imgHtml = imgSrc ? `<img src="${imgSrc}" />` : PLACEHOLDER_SVG;
    }

    html += `
    <div class="cart-item">
      <div class="cart-item-img">${imgHtml}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-bottom">
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="updateQty(${idx}, -1)">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty(${idx}, 1)">+</button>
            <button class="cart-item-remove" onclick="updateQty(${idx}, -${item.qty})" title="Quitar item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
          <div class="cart-item-price">$${formatNumber(subtotal)}</div>
        </div>
      </div>
    </div>`;
  });

  body.innerHTML = html;
  badge.innerText = totalCount;
  totalEl.innerText = `$${formatNumber(totalPrice)}`;
}

function initCartDefaults() {
  const dateInput = document.getElementById('cart-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
  
  const daysInput = document.getElementById('cart-days');
  if (daysInput) {
    daysInput.addEventListener('input', renderCartUI);
  }
}
initCartDefaults();

function checkout() {
  if (cart.length === 0) return showToast("El carrito está vacío.");
  
  const dateVal = document.getElementById('cart-date').value;
  const daysVal = parseInt(document.getElementById('cart-days').value) || 1;
  const [y, m, d] = dateVal.split('-');
  
  let dateFormatted = 'A confirmar';
  if (d && m && y) {
    // Calculamos el día de la semana (restando 1 al mes porque en JS empiezan en 0)
    const dateObj = new Date(y, m - 1, d);
    const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const dayName = daysOfWeek[dateObj.getDay()];
    dateFormatted = `${dayName} ${d}/${m}/${y}`;
  }

  let msg = "Hola Ullathorpe! Quiero reservar lo siguiente:\n\n";
  let totalPrice = 0;
  
  cart.forEach(item => {
    const pNum = parsePriceToInt(item.price);
    const subtotal = pNum * item.qty * daysVal;
    totalPrice += subtotal;
    msg += `- ${item.qty}x ${item.name} _$${formatNumber(subtotal)}_\n`;
  });
  
  msg += `\n*Total: $${formatNumber(totalPrice)}*\n\n`;
  
  // Detección de dispositivo para evitar los símbolos  en WhatsApp Web
  const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  // Se usan los códigos Unicode puros para que ningún servidor ni navegador pueda romper el emoji
  // \uD83D\uDCC6 = 📆 | \uD83D\uDCC5 = 📅
  // \u23F1\uFE0F = ⏱️ | \u23F3 = ⏳
  const iconDate = isMobile ? '\uD83D\uDCC6' : '-'; 
  const iconTime = isMobile ? '\u23F1\uFE0F' : '-'; 

  msg += `${iconDate} Fecha de retiro: ${dateFormatted}\n`;
  msg += `${iconTime} Jornadas: ${daysVal}\n\n`;
  msg += "Espero confirmación de disponibilidad.";
  
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

    const textCat = await resCat.text();
    const rowsCat = parseCSV(textCat);
    const kmCat = buildKeyMap(rowsCat[0] || {});

    const textComb = await resComb.text();
    const firstLineComb = textComb.split('\n')[0] || '';
    const rowsComb = firstLineComb.includes('\t') ? parseTSV(textComb) : parseCSV(textComb);
    const kmComb = buildKeyMap(rowsComb[0] || {});

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

    catalogData = [...parsedCatalog, ...parsedCombos];

    buildMainFilters();

    const searchInput = document.getElementById('cat-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        buildMainFilters();
        renderCatalog();
      });
    }

    const sortInput = document.getElementById('cat-sort');
    const sortWrapper = document.querySelector('.cat-sort-wrapper');

    function updateSortLabel() {
      if (sortInput && sortWrapper) {
        const text = sortInput.options[sortInput.selectedIndex].text;
        sortWrapper.setAttribute('data-label', 'ORDEN: ' + text);
      }
    }

    if (sortInput) {
      sortInput.addEventListener('change', () => {
        updateSortLabel(); 
        renderCatalog();   
      });
      updateSortLabel(); 
    }

    renderCatalog();
    renderCartUI();

  } catch (err) {
    grid.innerHTML = `<div class="sheet-error" style="grid-column:1/-1">
      <strong>No se pudo cargar el catálogo.</strong>
      Revisá que el Google Sheet esté publicado y sea de acceso público.<br/>
      <small style="opacity:.6;margin-top:.4rem;display:block">Error: ${err.message}</small>
    </div>`;
    console.error('[Catálogo]', err);
  }
}

function getSearchedItems() {
  const searchInput = document.getElementById('cat-search');
  const query = normalizeText(searchInput ? searchInput.value : '');
  
  if (!query) return catalogData;

  const words = query.split(/\s+/).filter(w => w.length > 0);

  return catalogData.filter(item => {
    const comboItemsText = item.items ? item.items.join(' ') : '';
    const searchTarget = normalizeText(`${item.name} ${item.cat} ${item.subcat} ${item.desc || ''} ${comboItemsText}`);
    return words.every(word => searchTarget.includes(word));
  });
}

function buildMainFilters() {
  const container = document.getElementById('main-filters');
  if (!container) return;

  const searchedData = getSearchedItems();

  const categories = [...new Set(searchedData.filter(i => !i.isCombo).map(item => item.cat))].filter(Boolean);
  if (searchedData.some(i => i.isCombo)) categories.push('Combos');

  if (currentCat !== 'all' && !categories.includes(currentCat)) {
    currentCat = 'all';
  }

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

  buildSubFilters(searchedData);
}

function buildSubFilters(searchedData = getSearchedItems()) {
  const container = document.getElementById('subcat-filters');
  if (!container) return;

  if (currentCat === 'all') {
    container.style.display = 'none';
    return;
  }

  let subcats = [];

  if (currentCat === 'Combos') {
    subcats = [...new Set(searchedData.filter(i => i.isCombo).map(i => i.cat))].filter(Boolean);
  } else {
    subcats = [...new Set(searchedData.filter(i => i.cat === currentCat).map(i => i.subcat))].filter(Boolean);
    if (subcats.includes('Combos')) {
      subcats = subcats.filter(sc => sc !== 'Combos');
      subcats.push('Combos');
    }
  }

  if (currentSubcat !== 'all' && !subcats.includes(currentSubcat)) {
    currentSubcat = 'all';
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
      buildSubFilters(searchedData);
      renderCatalog();
    });
  });
}

function renderCatalog() {
  const grid = document.getElementById('cat-grid');
  
  let baseItems = getSearchedItems(); 
  let items = [...baseItems];

  if (currentCat === 'Combos') {
    items = items.filter(i => i.isCombo);
    if (currentSubcat !== 'all') items = items.filter(i => i.cat === currentSubcat);
  } else if (currentCat !== 'all') {
    items = items.filter(i => i.cat === currentCat);
    if (currentSubcat !== 'all') items = items.filter(i => i.subcat === currentSubcat);
  }

  const sortVal = document.getElementById('cat-sort')?.value || 'default';
  
  if (sortVal !== 'default') {
    items.sort((a, b) => {
      if (sortVal === 'category-asc' || sortVal === 'category-desc') {
        const fullA = normalizeText(a.cat + (a.subcat || ''));
        const fullB = normalizeText(b.cat + (b.subcat || ''));
        return sortVal === 'category-asc' 
          ? fullA.localeCompare(fullB) 
          : fullB.localeCompare(fullA);
      }
      if (sortVal === 'price-asc') {
        return parsePriceToInt(a.price) - parsePriceToInt(b.price);
      }
      if (sortVal === 'price-desc') {
        return parsePriceToInt(b.price) - parsePriceToInt(a.price);
      }
      if (sortVal === 'name-asc' || sortVal === 'name-desc') {
        const nameA = normalizeText(a.name);
        const nameB = normalizeText(b.name);
        return sortVal === 'name-asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      }
      return 0;
    });
  }

  if (!items.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1;text-align:center;padding:2rem">No se encontraron equipos para esta búsqueda o sección.</p>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    if (item.isCombo) {
      const imgCount = item.images.length;
      let layoutClass = 'combo-layout-2'; 
      if (imgCount === 3) layoutClass = 'combo-layout-3';
      if (imgCount === 4) layoutClass = 'combo-layout-4';
      if (imgCount >= 5) layoutClass = 'combo-layout-5';

      const imagesHtml = item.images.map(img => `<img src="${IMG_BASE + img}" alt="${escHtml(item.name)}" onerror="this.style.display='none'" />`).join('');
      
      const badgeSafe = (item.badge || '').toLowerCase();
      let badgeClass = 'badge-default';
      if(badgeSafe.includes('pro')) badgeClass = 'badge-pro';
      else if(badgeSafe.includes('avanzado')) badgeClass = 'badge-avanzado';
      else if(badgeSafe.includes('intermedio')) badgeClass = 'badge-intermedio';
      else if(badgeSafe.includes('newbie')) badgeClass = 'badge-newbie';

      const badgeHtml = item.badge ? `<span class="combo-badge ${badgeClass}">${escHtml(item.badge)}</span>` : '';
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
                <div class="cat-price">$${escHtml(item.price)}</div>
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
                <div class="cat-price">$${escHtml(item.price)}</div>
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
        <p class="section-desc">Reservas y pedidos exclusivamente por WhatsApp.<br>También podés seguirnos en Instagram.</p>
      </div>
      <div class="contact-wsp-wrap" style="display:flex; flex-direction:column; gap:1rem; align-items:center; padding-bottom: 4rem;">
        <button class="wsp-big" style="width: 100%; max-width: 330px; justify-content: center; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); box-shadow: 0 8px 24px rgba(225, 48, 108, 0.3);" onclick="window.open('https://www.instagram.com/ullathorpe.rental', '_blank')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          Seguinos en @Ullathorpe.rental
        </button>
        <button class="wsp-big" style="width: 100%; max-width: 330px; justify-content: center;" onclick="openWsp('Hola! Quiero consultar por equipos disponibles.')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  Escribinos por WhatsApp
                </button>
      </div>
    </div>
  </div>
  <footer class="site-footer">
    <div class="footer-logo"><img src="img/logo_leon.png" alt="Ullathorpe Rental" onerror="this.style.display='none'" /></div>
    <div class="footer-tagline">Acompañando a los profesionales desde sus inicios</div>
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