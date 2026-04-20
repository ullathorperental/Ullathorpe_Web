import csv
import urllib.request
import os
import shutil
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from PIL import Image, ImageFilter
import numpy as np

# --- CONFIGURACIÓN ---
INCLUIR_INDICE = True   # <-- Cambiá a False para generar el PDF sin la hoja de Índice
INCLUIR_COMBOS = True  # <-- Cambiá esto a False para generar el PDF sin los combos
MOSTRAR_SUBCAT_ITEMS = False  # <-- Cambiá a False para ocultar "Categoria | Subcategoria" en el catálogo
MOSTRAR_BADGES_COMBOS = True # <-- Cambiá a False para ocultar las etiquetas (Ej: "NEWBIE") en los combos

ITEMS_POR_PAGINA = 4
COMBOS_POR_PAGINA = 2

# --- TEXTOS Y DATOS FIJOS ---
TEXTO_SLOGAN = "Acompañando a los profesionales desde sus inicios"
TEXTO_CONTRAPORTADA = "Que tengas un excelente rodaje"
TELEFONO_WHATSAPP = "011-7020-1017"

TRAZO_DORADO_PX = 3           # <-- Grosor del trazo en píxeles (recomendado: 2 a 4)
TRAZO_COLOR = (201, 168, 76)  # <-- Color dorado del proyecto (#C9A84C)

SHEET_CATALOGO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=972536254&single=true&output=csv'
SHEET_COMBOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrkO59tIJIoo4cWllZAv0DDmf0AhsMdo4Gl3xSD73zMQqF81K11yRihYrWJJN0T9vAwFk_LgWnYHLU/pub?gid=1902386512&single=true&output=tsv'

# --- PROCESAMIENTO DE IMÁGENES CON TRAZO DORADO ---

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DIR_ORIGINALES = os.path.join(BASE_DIR, 'img', 'catalogo')
DIR_TEMP = os.path.join(BASE_DIR, 'img', '_temp_trazadas')

def aplicar_trazo_dorado(nombre_archivo, grosor=TRAZO_DORADO_PX, color=TRAZO_COLOR):
    ruta_origen = os.path.join(DIR_ORIGINALES, nombre_archivo)
    ruta_destino = os.path.join(DIR_TEMP, nombre_archivo)

    if os.path.exists(ruta_destino):
        return nombre_archivo

    if not os.path.exists(ruta_origen):
        print(f"  [ADVERTENCIA] No se encontró la imagen: {nombre_archivo}")
        return nombre_archivo

    img = Image.open(ruta_origen).convert('RGBA')

    alpha = img.split()[3]
    alpha_dilatada = alpha.filter(ImageFilter.MaxFilter(size=grosor * 2 + 1))

    alpha_orig = np.array(alpha)
    alpha_dilat = np.array(alpha_dilatada)
    zona_trazo = (alpha_dilat > 10) & (alpha_orig <= 10)

    datos = np.array(img)
    datos[zona_trazo, 0] = color[0]
    datos[zona_trazo, 1] = color[1]
    datos[zona_trazo, 2] = color[2]
    datos[zona_trazo, 3] = 255

    Image.fromarray(datos, 'RGBA').save(ruta_destino, 'PNG')
    return nombre_archivo


def procesar_imagenes_catalogo(paginas_catalogo, paginas_combos):
    os.makedirs(DIR_TEMP, exist_ok=True)
    imagenes_procesadas = set()

    for pagina in paginas_catalogo:
        for item in pagina['items']:
            img = item.get('Imagen', '').strip()
            if img and img not in imagenes_procesadas:
                print(f"  Trazando: {img}")
                aplicar_trazo_dorado(img)
                imagenes_procesadas.add(img)

    for pagina in paginas_combos:
        for combo in pagina['items']:
            for img in combo.get('ListaImagenes', []):
                if img and img not in imagenes_procesadas:
                    print(f"  Trazando (combo): {img}")
                    aplicar_trazo_dorado(img)
                    imagenes_procesadas.add(img)

    print(f"  {len(imagenes_procesadas)} imagen(es) procesada(s).")


def limpiar_temporales():
    if os.path.exists(DIR_TEMP):
        shutil.rmtree(DIR_TEMP)
        print("  Archivos temporales eliminados.")


# --- FUNCIONES DE DATOS ---

def leer_sheet_desde_web(url, separador=','):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)

    with urllib.request.urlopen(req, timeout=60) as response:
        lineas = [linea.decode('utf-8') for linea in response.readlines()]

    lector = csv.DictReader(lineas, delimiter=separador)
    return list(lector)

def limpiar_precio(precio_raw):
    p = precio_raw.replace('$', '').strip()
    if ',' in p: p = p.split(',')[0]
    if p.endswith('.00'): p = p[:-3]
    return p

# Función robusta para pluralizar en español y términos audiovisuales
def pluralizar_es(palabra):
    if not palabra:
        return palabra
    p = palabra.strip().upper()
    
    # Si ya termina en S, asumimos que ya está en plural o no requiere cambio
    if p.endswith('S'):
        return p
    # Regla: Z -> CES (Ej: LUZ -> LUCES)
    if p.endswith('Z'):
        return p[:-1] + 'CES'
    # Regla: Termina en Vocal -> S (Ej: LENTE -> LENTES)
    if p[-1] in 'AEIOUÁÉÍÓÚ':
        return p + 'S'
    # Extranjerismos comunes del rubro: Terminan en T, P, K, D, M, G suman 'S' en vez de 'ES'
    # (Ej: KIT -> KITS, GRIP -> GRIPS, LED -> LEDS, BOOM -> BOOMS)
    if p[-1] in 'TPKDMG': 
        return p + 'S'
    # Por defecto, consonantes españolas suman 'ES' (Ej: MONITOR -> MONITORES, GIMBAL -> GIMBALES)
    return p + 'ES'


# --- DESCARGA DE DATOS ---
print("Descargando datos de Google Sheets...")
datos_catalogo = leer_sheet_desde_web(SHEET_CATALOGO_URL, separador=',')

if INCLUIR_COMBOS:
    datos_combos = leer_sheet_desde_web(SHEET_COMBOS_URL, separador='\t')
else:
    datos_combos = []

# --- EXTRACCIÓN Y AGRUPACIÓN JERÁRQUICA DEL CATÁLOGO ---
max_len_nombre_cat = 0
max_len_desc_cat = 0

catalogo_jerarquico = {}

for item in datos_catalogo:
    categoria = item.get('Categoría', '').strip()
    nombre = item.get('Nombre', '').strip()
    desc = item.get('Descripción', '').strip()

    if categoria and nombre:
        subcat_limpia = item.get('Subcategoria', item.get('Subcategoría', '')).strip()
        item['Subcat_Limpia'] = subcat_limpia
        item['PrecioLimpio'] = limpiar_precio(item.get('Precio', ''))

        if len(nombre) > max_len_nombre_cat: max_len_nombre_cat = len(nombre)
        if len(desc) > max_len_desc_cat: max_len_desc_cat = len(desc)

        cat_upper = categoria.upper()
        subcat_upper = subcat_limpia.upper()

        if cat_upper not in catalogo_jerarquico:
            catalogo_jerarquico[cat_upper] = {}
        if subcat_upper not in catalogo_jerarquico[cat_upper]:
            catalogo_jerarquico[cat_upper][subcat_upper] = []

        catalogo_jerarquico[cat_upper][subcat_upper].append(item)

fuente_cat_nombre = "2rem"
fuente_cat_desc = "1.15rem"
if max_len_nombre_cat > 60: fuente_cat_nombre = "1.6rem"
elif max_len_nombre_cat > 45: fuente_cat_nombre = "1.8rem"
if max_len_desc_cat > 160: fuente_cat_desc = "0.9rem"
elif max_len_desc_cat > 120: fuente_cat_desc = "1rem"

# --- EXTRACCIÓN DE COMBOS ---
max_len_nombre_combo = 0
combos_temp_data = {}

if INCLUIR_COMBOS:
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

            if cat_combo not in combos_temp_data: combos_temp_data[cat_combo] = []
            combos_temp_data[cat_combo].append(combo)

fuente_combo_nombre = "2.2rem"
if max_len_nombre_combo > 40: fuente_combo_nombre = "1.8rem"

# --- FRAGMENTACIÓN E ÍNDICE ---
toc_catalogo = []
paginas_catalogo = []
cat_index = 0

for cat, subcats_dict in catalogo_jerarquico.items():
    cat_id = f"cat-{cat_index}"
    toc_catalogo.append({'titulo': cat, 'id': cat_id})
    cat_index += 1

    large_subcats = {}
    small_subcats_items = []

    for subcat, items in subcats_dict.items():
        if len(items) >= 3:
            large_subcats[subcat] = items
        else:
            small_subcats_items.extend(items)

    first_page_of_cat = True

    # Bloque de subcategorías grandes (3 o más)
    for subcat, items in large_subcats.items():
        for i in range(0, len(items), ITEMS_POR_PAGINA):
            bloque = items[i:i + ITEMS_POR_PAGINA]
            
            # ⚡ ACÁ EL CAMBIO: Solo se muestra la subcategoría en plural (o la cat si viene vacío por error de carga)
            titulo_pagina = pluralizar_es(subcat) if subcat else cat

            paginas_catalogo.append({
                'titulo_pagina': titulo_pagina,
                'categoria': cat,
                'items': bloque,
                'id': cat_id if first_page_of_cat else None
            })
            first_page_of_cat = False

    # Bloque de subcategorías chicas (1 o 2 ítems) agrupadas
    for i in range(0, len(small_subcats_items), ITEMS_POR_PAGINA):
        bloque = small_subcats_items[i:i + ITEMS_POR_PAGINA]

        # ⚡ ACÁ EL CAMBIO: Siempre se muestra únicamente la Categoría para 1 o 2 ítems
        titulo_pagina = cat

        paginas_catalogo.append({
            'titulo_pagina': titulo_pagina,
            'categoria': cat,
            'items': bloque,
            'id': cat_id if first_page_of_cat else None
        })
        first_page_of_cat = False

toc_combos = []
paginas_combos = []

if INCLUIR_COMBOS:
    for categoria, combos_list in combos_temp_data.items():
        cat_id = f"combo-{cat_index}"
        toc_combos.append({'titulo': f"COMBOS {categoria}", 'id': cat_id})
        cat_index += 1

        for i in range(0, len(combos_list), COMBOS_POR_PAGINA):
            paginas_combos.append({
                'titulo_pagina': f"COMBOS {categoria}",
                'categoria': f"COMBOS {categoria}",
                'items': combos_list[i:i + COMBOS_POR_PAGINA],
                'id': cat_id if i == 0 else None
            })

# --- PROCESAMIENTO DE IMÁGENES CON TRAZO DORADO ---
print("Aplicando trazo dorado a las imágenes...")
procesar_imagenes_catalogo(paginas_catalogo, paginas_combos)

# Ruta relativa a DIR_TEMP que usará el template (relativa a BASE_DIR)
RUTA_IMG_CATALOGO = os.path.relpath(DIR_TEMP, BASE_DIR).replace('\\', '/')

meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
fecha_actual = f"{meses[datetime.now().month - 1]} {datetime.now().year}"

print("Procesando plantilla HTML...")
env = Environment(loader=FileSystemLoader(BASE_DIR))
template = env.get_template('template_pdf.html')

html_renderizado = template.render(
    incluir_indice=INCLUIR_INDICE,
    texto_slogan=TEXTO_SLOGAN,
    telefono_whatsapp=TELEFONO_WHATSAPP,
    paginas_catalogo=paginas_catalogo,
    paginas_combos=paginas_combos,
    toc_catalogo=toc_catalogo,
    toc_combos=toc_combos,
    fecha_actual=fecha_actual,
    texto_contraportada=TEXTO_CONTRAPORTADA,
    f_cat_nombre=fuente_cat_nombre,
    f_cat_desc=fuente_cat_desc,
    f_combo_nombre=fuente_combo_nombre,
    mostrar_subcat_items=MOSTRAR_SUBCAT_ITEMS,
    mostrar_badges_combos=MOSTRAR_BADGES_COMBOS,
    ruta_img_catalogo=RUTA_IMG_CATALOGO,
)

print("Generando PDF con WeasyPrint...")
HTML(string=html_renderizado, base_url=BASE_DIR).write_pdf('Lista_de_Precios_Ullathorpe.pdf')

print("Limpiando archivos temporales...")
limpiar_temporales()

print("¡Listo! Archivo generado.")