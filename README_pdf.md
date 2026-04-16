# Generador Automático de Catálogos PDF - Ullathorpe Rental 🎬

Este proyecto es una herramienta de automatización escrita en **Python** que convierte datos dinámicos alojados en **Google Sheets** en un catálogo PDF de alta gama. Cuenta con un diseño oscuro (dark mode) minimalista, índice interactivo, maquetación automática y procesamiento de imágenes en tiempo real.

Utiliza la lógica de Python para la extracción, manipulación de imágenes y agrupación de datos; **Jinja2** para inyectar esos datos en una plantilla HTML; y **WeasyPrint** como motor de renderizado para compilar el documento final en tamaño A4.

---

## 📂 Estructura del Proyecto

* `generar_pdf.py`: Script principal que funciona como motor del proyecto. Controla la lógica, descarga los datos, procesa las imágenes y genera el PDF.
* `template_pdf.html`: Plantilla base con el diseño visual, las fuentes tipográficas y las reglas CSS estructuradas específicamente para WeasyPrint.
* `img/`: Carpeta local que almacena los recursos visuales fijos (`logo.png`, `logo_horizontal.png`, `logo_leon.png`) y la subcarpeta `catalogo/` donde deben estar los PNGs de los equipos referenciados en el Excel.

---

## ⚙️ 1. Panel de Configuración (El Motor)

Al inicio del archivo `generar_pdf.py` existe un bloque de variables globales diseñadas para que cualquier persona del equipo pueda modificar el PDF sin saber programar.

### Variables de Control (Switches: True / False)
* `INCLUIR_INDICE`: Si está en `True`, genera una hoja inicial con el índice interactivo a una columna. Si es `False`, la omite.
* `INCLUIR_COMBOS`: Permite apagar por completo la pestaña de Kits Promocionales. Si es `False`, el script ignora los datos, no genera sus hojas y los oculta del índice.
* `MOSTRAR_SUBCAT_ITEMS`: Muestra u oculta la "Etiqueta" roja (Ej: *CÁMARAS | MIRRORLESS*) arriba del nombre de cada equipo en el catálogo.
* `MOSTRAR_BADGES_COMBOS`: Muestra u oculta las etiquetas de nivel (Ej: *NEWBIE*, *INTERMEDIO*) en las tarjetas de los combos.

### Textos Parametrizados
Para no tener que tocar el HTML, los textos clave se cambian desde el script:
* `TEXTO_SLOGAN`: Frase que aparece en la carátula y contraportada (Ej: *"Acompañando a los profesionales desde sus inicios"*).
* `TEXTO_CONTRAPORTADA`: Cita principal que cierra el catálogo de forma elegante.
* `TELEFONO_WHATSAPP`: Número de contacto para reservas.

### Configuración del Trazo de Imágenes
* `TRAZO_DORADO_PX` y `TRAZO_COLOR`: Controlan el grosor y color exacto de la línea que abrazará las siluetas de los equipos fotográficos.

---

## 🧠 2. La Magia del Script (Características Técnicas)

### 🖼️ Procesamiento de Imágenes "On the Fly"
WeasyPrint tiene limitaciones para renderizar efectos CSS complejos sobre transparencias. Para resolver esto, el script utiliza **Pillow (PIL)** y **NumPy** para leer cada `.png` del catálogo, analizar su canal Alfa (transparencia), dilatar la forma (`MaxFilter`) y dibujar matemáticamente un trazo dorado (`#C9A84C`) que sigue la silueta exacta de la cámara o lente.
Estas imágenes trazadas se guardan en una carpeta temporal (`_temp_trazadas`) que se elimina automáticamente al terminar de generar el PDF.

### 📚 Agrupación y Paginación Inteligente
El script no "escupe" los datos crudos, sino que cuenta y agrupa los equipos (4 ítems por página de catálogo, 2 para combos):
* **Subcategorías Grandes (≥ 3 ítems):** Tienen páginas exclusivas. El título adopta el formato compuesto (`CATEGORÍA | SUBCATEGORÍA`).
* **Subcategorías Chicas (< 3 ítems):** Se agrupan en una misma página para no desperdiciar papel. Si en esa hoja hay equipos de subcategorías distintas, el título de la página se limpia mostrando únicamente la `CATEGORÍA` madre.

### 🕵️‍♂️ Disfraz de Navegador (Bypass de Google)
Para evitar que Google Sheets bloquee la descarga o genere un "TimeoutError", la petición a través de `urllib` inyecta un `User-Agent` haciéndose pasar por el navegador Google Chrome. Esto asegura descargas de CSV instantáneas y sin fallos.

---

## 🎨 3. El Diseño y las Defensas Anti-WeasyPrint

El archivo `template_pdf.html` está maquetado en CSS/HTML puro, pero lleno de etiquetas de Jinja2 (`{{ variable }}`) y condicionales (`{% if %}`).
* **Tipografías:** Combina *Cormorant Garamond* (elegancia clásica para títulos/precios) y *Outfit* (modernidad y legibilidad para descripciones técnicas).
* **Blindaje Anti-Desbordes (Flexbox vs Absolute):** Las fotos originales pueden ser inmensas. Para evitar que rompan las cajas de diseño al renderizar, el contenedor negro usa posiciones relativas, y la imagen adentro es forzada con posición absoluta (`position: absolute; width: 100%; height: 100%; object-fit: contain;`). Así, la imagen obedece al diseño de forma obligatoria.
* **Cálculo Dinámico de Textos:** En el HTML se usa la sintaxis `{% raw %}{% if pagina.titulo_pagina|length > 32 %}{% endraw %}`. Si un título es excesivamente largo, Jinja achica dinámicamente su tamaño de fuente en rems antes de enviárselo a WeasyPrint, garantizando que nunca se rompa en dos renglones.

---

## 🚀 Cómo ejecutarlo

1.  Asegurate de tener tu entorno virtual de Python activado (ej. `.venv`).
2.  Instalá las dependencias requeridas (generalmente `weasyprint`, `jinja2`, `Pillow`, `numpy`).
3.  Verificá que los links públicos de Google Sheets en el `generar_pdf.py` sigan activos.
4.  Asegurate de que la carpeta `img/catalogo/` contenga todas las fotos con los nombres exactos que figuran en el Excel.
5.  Ejecutá el script:
    ```bash
    python generar_pdf.py
    ```
6.  El sistema procesará las imágenes temporales, renderizará la web y arrojará el archivo final listo para enviar al cliente: **`Lista_de_Precios_Ullathorpe.pdf`**.