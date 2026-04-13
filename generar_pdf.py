import csv
import urllib.request
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# --- CONFIGURACIÓN ---
ITEMS_POR_PAGINA = 4
COMBOS_POR_PAGINA = 2
TEXTO_CONTRAPORTADA = "Que tengas un excelente rodaje" # <--- Texto variable

SHEET_CATALOGO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv'
SHEET_COMBOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv'

def leer_sheet_desde_web(url, separador=','):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        lineas = [linea.decode('utf-8') for linea in response.readlines()]
    lector = csv.DictReader(lineas, delimiter=separador)
    return list(lector)

def limpiar_precio(precio_raw):
    p = precio_raw.replace('$', '').strip()
    if ',' in p: p = p.split(',')[0]
    if p.endswith('.00'): p = p[:-3]
    return p

print("Descargando datos de Google Sheets...")
datos_catalogo = leer_sheet_desde_web(SHEET_CATALOGO_URL, separador=',')
datos_combos = leer_sheet_desde_web(SHEET_COMBOS_URL, separador='\t')

# --- CÁLCULO DINÁMICO DE TAMAÑO DE FUENTE Y EXTRACCIÓN ---
max_len_nombre_cat = 0
max_len_desc_cat = 0

catalogo_temp = {}
for item in datos_catalogo:
    categoria = item.get('Categoría', '').strip()
    nombre = item.get('Nombre', '').strip()
    desc = item.get('Descripción', '').strip()
    
    if categoria and nombre:
        item['Subcat_Limpia'] = item.get('Subcategoria', item.get('Subcategoría', '')).strip()
        item['PrecioLimpio'] = limpiar_precio(item.get('Precio', ''))
        
        if len(nombre) > max_len_nombre_cat: max_len_nombre_cat = len(nombre)
        if len(desc) > max_len_desc_cat: max_len_desc_cat = len(desc)
        
        if categoria not in catalogo_temp: catalogo_temp[categoria] = []
        catalogo_temp[categoria].append(item)

fuente_cat_nombre = "2rem"
fuente_cat_desc = "1.15rem"
if max_len_nombre_cat > 60: fuente_cat_nombre = "1.6rem"
elif max_len_nombre_cat > 45: fuente_cat_nombre = "1.8rem"
if max_len_desc_cat > 160: fuente_cat_desc = "0.9rem"
elif max_len_desc_cat > 120: fuente_cat_desc = "1rem"

max_len_nombre_combo = 0
combos_temp = {}
for combo in datos_combos:
    cat_combo = combo.get('Categoría', combo.get('Tipo', 'COMBOS')).strip().upper()
    nombre = combo.get('Nombre', '').strip()
    
    if nombre:
        if len(nombre) > max_len_nombre_combo: max_len_nombre_combo = len(nombre)
        combo['PrecioLimpio'] = limpiar_precio(combo.get('Precio', ''))
        imgs_raw = combo.get('Imagen', '').strip()
        combo['ListaImagenes'] = [img.strip() for img in imgs_raw.split(';') if img.strip()]
        
        badge = combo.get('Badge', combo.get('Nivel', '')).strip()
        combo['BadgeText'] = badge
        badge_lower = badge.lower()
        if 'newbie' in badge_lower: combo['BadgeClass'] = 'newbie'
        elif 'intermedio' in badge_lower: combo['BadgeClass'] = 'intermedio'
        elif 'avanzado' in badge_lower: combo['BadgeClass'] = 'avanzado'
        elif 'pro' in badge_lower: combo['BadgeClass'] = 'pro'
        else: combo['BadgeClass'] = 'default'
        
        if cat_combo not in combos_temp: combos_temp[cat_combo] = []
        combos_temp[cat_combo].append(combo)

fuente_combo_nombre = "2.2rem"
if max_len_nombre_combo > 40: fuente_combo_nombre = "1.8rem"

# --- FRAGMENTACIÓN E ÍNDICE ---
toc_catalogo = []
paginas_catalogo = []
cat_index = 0

for categoria, items in catalogo_temp.items():
    cat_id = f"cat-{cat_index}"
    toc_catalogo.append({'titulo': categoria.upper(), 'id': cat_id})
    cat_index += 1
    
    for i in range(0, len(items), ITEMS_POR_PAGINA):
        paginas_catalogo.append({
            'categoria': categoria.upper(),
            'items': items[i:i + ITEMS_POR_PAGINA],
            'id': cat_id if i == 0 else None  # Solo le damos ID a la primera página de esta categoría
        })

toc_combos = []
paginas_combos = []
for categoria, combos_list in combos_temp.items():
    cat_id = f"combo-{cat_index}"
    toc_combos.append({'titulo': f"COMBOS {categoria}", 'id': cat_id})
    cat_index += 1
    
    for i in range(0, len(combos_list), COMBOS_POR_PAGINA):
        paginas_combos.append({
            'categoria': f"COMBOS {categoria}",
            'items': combos_list[i:i + COMBOS_POR_PAGINA],
            'id': cat_id if i == 0 else None
        })

meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
fecha_actual = f"{meses[datetime.now().month - 1]} {datetime.now().year}"

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

print("Procesando plantilla HTML...")
env = Environment(loader=FileSystemLoader(BASE_DIR))
template = env.get_template('template_pdf.html')

html_renderizado = template.render(
    paginas_catalogo=paginas_catalogo,
    paginas_combos=paginas_combos,
    toc_catalogo=toc_catalogo,
    toc_combos=toc_combos,
    fecha_actual=fecha_actual,
    texto_contraportada=TEXTO_CONTRAPORTADA,
    f_cat_nombre=fuente_cat_nombre,
    f_cat_desc=fuente_cat_desc,
    f_combo_nombre=fuente_combo_nombre
)

print("Generando PDF con WeasyPrint...")
HTML(string=html_renderizado, base_url=BASE_DIR).write_pdf('Lista_de_Precios_Ullathorpe.pdf')
print("¡Listo! Archivo generado.")