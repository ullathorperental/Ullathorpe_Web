import csv
import urllib.request
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# --- CONFIGURACIÓN ---
ITEMS_POR_PAGINA = 4  # Ajustá esto si querés más o menos ítems por hoja

# URLs de Google Sheets
SHEET_CATALOGO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv'
SHEET_COMBOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv'

def leer_sheet_desde_web(url, separador=','):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        lineas = [linea.decode('utf-8') for linea in response.readlines()]
    lector = csv.DictReader(lineas, delimiter=separador)
    return list(lector)

print("Descargando datos de Google Sheets...")
datos_catalogo = leer_sheet_desde_web(SHEET_CATALOGO_URL, separador=',')
datos_combos = leer_sheet_desde_web(SHEET_COMBOS_URL, separador='\t')

# 1. Agrupar el catálogo por categoría y rescatar subcategoría
catalogo_temp = {}
for item in datos_catalogo:
    categoria = item.get('Categoría', '').strip()
    nombre = item.get('Nombre', '').strip()
    
    # Rescatamos la subcategoría considerando que pueda o no tener tilde en el sheet
    subcat = item.get('Subcategoria', item.get('Subcategoría', '')).strip()
    item['Subcat_Limpia'] = subcat
    
    if categoria and nombre:
        if categoria not in catalogo_temp:
            catalogo_temp[categoria] = []
        catalogo_temp[categoria].append(item)

# 2. FRAGMENTAR EN PÁGINAS
paginas_catalogo = []
for categoria, items in catalogo_temp.items():
    for i in range(0, len(items), ITEMS_POR_PAGINA):
        bloque = items[i:i + ITEMS_POR_PAGINA]
        paginas_catalogo.append({
            'categoria': categoria.upper(),
            'items': bloque
        })

# 3. FRAGMENTAR LOS COMBOS
combos_records = [c for c in datos_combos if c.get('Nombre', '').strip()]
paginas_combos = []
for i in range(0, len(combos_records), ITEMS_POR_PAGINA):
    bloque = combos_records[i:i + ITEMS_POR_PAGINA]
    paginas_combos.append({
        'categoria': 'COMBOS PROMOCIONALES',
        'items': bloque
    })

# Calcular fecha actual
meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
fecha_actual = f"{meses[datetime.now().month - 1]} {datetime.now().year}"

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

print("Procesando plantilla HTML...")
env = Environment(loader=FileSystemLoader(BASE_DIR))
template = env.get_template('template_pdf.html')

html_renderizado = template.render(
    paginas_catalogo=paginas_catalogo,
    paginas_combos=paginas_combos,
    fecha_actual=fecha_actual
)

print("Generando PDF con WeasyPrint...")
HTML(string=html_renderizado, base_url=BASE_DIR).write_pdf('Lista_de_Precios_Ullathorpe.pdf')

print("¡Listo! Archivo generado.")