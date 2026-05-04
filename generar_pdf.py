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
INCLUIR_INDICE = True   
INCLUIR_COMBOS = True  
MOSTRAR_SUBCAT_ITEMS = False  
MOSTRAR_BADGES_COMBOS = True 

ITEMS_POR_PAGINA = 4
COMBOS_POR_PAGINA = 2

# --- TEXTOS Y DATOS FIJOS ---
TEXTO_SLOGAN = "Acompañando a los profesionales desde sus inicios"
TEXTO_CONTRAPORTADA = "Que tengas un excelente rodaje"
TELEFONO_WHATSAPP = "011-7020-1017"

TRAZO_DORADO_PX = 3           
TRAZO_COLOR = (201, 168, 76)  

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

def safe_float(val):
    if not val: return 0.0
    try:
        return float(str(val).replace('.', '').replace(',', '.'))
    except:
        return 0.0

def pluralizar_es(palabra):
    if not palabra:
        return palabra
    p = palabra.strip().upper()
    
    if p.endswith('S'): return p
    if p.endswith('Z'): return p[:-1] + 'CES'
    if p[-1] in 'AEIOUÁÉÍÓÚ': return p + 'S'
    if p[-1] in 'TPKDMG': return p + 'S'
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
base_cat_order = {}
base_subcat_order = {}

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

        cat_upper_original = categoria.upper()
        cat_str = categoria
        subcat_upper = subcat_limpia.upper()
        nombre_upper = nombre.upper()
        
        # ⚡ LÓGICA REFINADA: Interceptar Lentes y convertirlos en Subcategorías Maestras ⚡
        is_lente = ('LENTE' in cat_upper_original) or ('LENTE' in subcat_upper)
        if is_lente:
            brand = ''
            if '7ARTISANS' in subcat_upper or '7ARTISANS' in nombre_upper: brand = '7ARTISANS'
            elif 'SONY' in subcat_upper or 'SONY' in nombre_upper: brand = 'SONY'
            elif 'CANON' in subcat_upper or 'CANON' in nombre_upper: brand = 'CANON'
            elif 'NIKON' in subcat_upper or 'NIKON' in nombre_upper: brand = 'NIKON'
            
            if brand == 'SONY': subcat_upper = 'LENTES SONY'
            elif brand == '7ARTISANS': subcat_upper = 'LENTES 7ARTISANS (PARA SONY)'
            elif brand == 'CANON': subcat_upper = 'LENTES CANON'
            elif brand == 'NIKON': subcat_upper = 'LENTES NIKON'
            else: subcat_upper = f"LENTES {subcat_limpia.upper()}" if subcat_limpia else "LENTES"
            
            # Aseguramos que caiga en "Foto & Video" o en la categoría donde el cliente lo puso
            if cat_upper_original == 'LENTES':
                cat_str = 'FOTO & VIDEO'
                cat_upper_original = 'FOTO & VIDEO'

        else:
            # ⚡ REGLAS DE AISLAMIENTO: GRIPERÍA Y TELAS ⚡
            if cat_upper_original in ['GRIPERIA', 'GRIPERÍA']:
                subcat_upper = ''
                
            if cat_upper_original == 'TELAS' or subcat_upper == 'TELAS' or 'TELA' in subcat_upper:
                cat_str = 'TELAS'
                cat_upper_original = 'TELAS'
                subcat_upper = ''
            
            # ⚡ REGLAS DE SONIDO ⚡
            if cat_upper_original == 'SONIDO':
                if any(x in subcat_upper for x in ['BOOM', 'CAÑA']):
                    subcat_upper = 'BOOM'
                elif 'CORBATERO' in subcat_upper:
                    subcat_upper = 'CORBATEROS'
                elif any(x in subcat_upper for x in ['GRABADORA', 'CABLE']):
                    subcat_upper = 'BASE_SONIDO'

        # Registramos el orden de aparición para el Índice
        if cat_upper_original not in base_cat_order:
            base_cat_order[cat_upper_original] = len(base_cat_order)
            
        # Registramos el orden de aparición de las subcategorías (Para saber dónde cayó Lente original)
        if subcat_upper not in base_subcat_order:
            base_subcat_order[subcat_upper] = len(base_subcat_order)

        item['_Subcat_Calculada'] = subcat_upper

        if cat_str not in catalogo_jerarquico:
            catalogo_jerarquico[cat_str] = {}
        if subcat_upper not in catalogo_jerarquico[cat_str]:
            catalogo_jerarquico[cat_str][subcat_upper] = []

        catalogo_jerarquico[cat_str][subcat_upper].append(item)

# ⚡ ORDEN DE CATEGORÍAS PRINCIPALES (TELAS EXACTAMENTE ANTES DE GRIPERÍA) ⚡
def cat_sort_key(item_tuple):
    cat = item_tuple[0].upper()
    
    if cat == 'TELAS':
        fv_order = base_cat_order.get('FOTO & VIDEO', base_cat_order.get('FOTO Y VIDEO', 0))
        return fv_order + 0.99 
        
    return base_cat_order.get(cat, 50)

catalogo_jerarquico = dict(sorted(catalogo_jerarquico.items(), key=cat_sort_key))

# ⚡ ORDENAMIENTO INTERNO (SUBCATEGORIAS Y PRECIOS) ⚡
for cat in catalogo_jerarquico:
    def subcat_sort_key(item_tuple):
        sub = item_tuple[0].upper()
        
        # Encontramos la posición original del primer lente en el Excel
        lente_anchor = 50
        for k in base_subcat_order:
            if k.startswith('LENTE'):
                lente_anchor = base_subcat_order[k]
                break
                
        # Forzamos las marcas exactas a posicionarse matemáticamente sobre ese ancla
        if sub == 'LENTES SONY': return lente_anchor + 0.1
        if sub == 'LENTES 7ARTISANS (PARA SONY)': return lente_anchor + 0.2
        if sub == 'LENTES CANON': return lente_anchor + 0.3
        if sub == 'LENTES NIKON': return lente_anchor + 0.4
        if sub.startswith('LENTE'): return lente_anchor + 0.5
        
        return base_subcat_order.get(sub, 50)
        
    catalogo_jerarquico[cat] = dict(sorted(catalogo_jerarquico[cat].items(), key=subcat_sort_key))

    for sub in catalogo_jerarquico[cat]:
        if sub.startswith('LENTE'):
            catalogo_jerarquico[cat][sub].sort(key=lambda x: safe_float(x['PrecioLimpio']), reverse=True)

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
added_to_toc = set()

for cat, subcats_dict in catalogo_jerarquico.items():
    cat_id = f"cat-{cat_index}"
    
    # ⚡ ÍNDICE LIMPIO: Solo la categoría de Excel en MAYÚSCULAS ⚡
    base_toc_name = cat.upper()
    if base_toc_name not in added_to_toc:
        toc_catalogo.append({'titulo': base_toc_name, 'id': cat_id})
        added_to_toc.add(base_toc_name)
        
    cat_index += 1

    large_subcats = {}
    small_subcats_items = []

    for subcat, items in subcats_dict.items():
        # Los lentes forzosamente van a large_subcats para tener su propio salto de página
        if len(items) >= 3 or subcat.startswith('LENTE'):
            large_subcats[subcat] = items
        else:
            small_subcats_items.extend(items)

    first_page_of_cat = True

    # Bloque de subcategorías grandes
    for subcat, items in large_subcats.items():
        for i in range(0, len(items), ITEMS_POR_PAGINA):
            bloque = items[i:i + ITEMS_POR_PAGINA]
            
            if subcat.startswith('LENTE'):
                titulo_pagina = subcat 
            elif cat.upper() == "SONIDO":
                if subcat == 'BASE_SONIDO': titulo_pagina = "SONIDO"
                else: titulo_pagina = f"SONIDO - {subcat}" if subcat else "SONIDO"
            elif cat.upper() == "TELAS":
                titulo_pagina = "TELAS"
            else:
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

        subcats_in_block = []
        for item in bloque:
            sub = item.get('_Subcat_Calculada', '')
            if sub and sub not in subcats_in_block:
                subcats_in_block.append(sub)

        if cat.upper() == "SONIDO":
            real_subcats = [s for s in subcats_in_block if s != 'BASE_SONIDO']
            if not real_subcats:
                titulo_pagina = "SONIDO"
            elif len(real_subcats) == 1:
                titulo_pagina = f"SONIDO - {real_subcats[0]}"
            else:
                titulo_pagina = f"SONIDO - {' / '.join(real_subcats)}"
        elif not large_subcats:
            titulo_pagina = cat
        elif len(subcats_in_block) > 1:
            titulo_pagina = f"{cat} - ACCESORIOS"
        else:
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
    added_combos_to_toc = False
    for categoria, combos_list in combos_temp_data.items():
        cat_id = f"combo-{cat_index}"
        
        # ⚡ ÍNDICE LIMPIO: Solo la palabra COMBOS una vez ⚡
        if not added_combos_to_toc:
            toc_combos.append({'titulo': 'COMBOS', 'id': cat_id})
            added_combos_to_toc = True
            
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