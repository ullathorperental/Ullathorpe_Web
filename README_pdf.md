# Generador Automático de Catálogos PDF - Ullathorpe Rental 🎬

Este proyecto es una herramienta de automatización escrita en Python que convierte datos dinámicos alojados en Google Sheets en un catálogo PDF de alta gama, con diseño oscuro (dark mode), índice interactivo y maquetación automática.

Utiliza **Python** para la lógica de extracción y agrupación de datos, **Jinja2** para inyectar esos datos en una plantilla, y **WeasyPrint** como motor de renderizado para convertir HTML/CSS en un documento PDF tamaño A4.

---

## 📂 Estructura del Proyecto

* `generar_pdf.py`: Script principal que ejecuta toda la lógica de negocio.
* `template_pdf.html`: Plantilla base con el diseño visual y las reglas CSS específicas para WeasyPrint.
* `img/`: Carpeta local que debe contener las imágenes de los equipos referenciadas en el Excel, además de `logo.png` y `logo_leon.png`.

---

## ⚙️ 1. El Motor: `generar_pdf.py`

Este script se encarga de descargar, limpiar, calcular y agrupar los datos antes de enviarlos al diseño.

### Variables de Configuración (Los "Switches")
Al inicio del archivo hay variables de control que permiten cambiar la estructura del PDF sin tocar código complejo:
* `INCLUIR_COMBOS (True/False)`: Permite apagar por completo la pestaña de Kits/Combos. Si es `False`, el script ignora esos datos y no los muestra ni en el catálogo ni en el índice interactivo.
* `MOSTRAR_SUBCAT_ITEMS (True/False)`: Controla si se imprime la "Etiqueta" roja (Ej: *CÁMARAS | MIRRORLESS*) arriba del nombre del equipo en el catálogo.
* `MOSTRAR_BADGES_COMBOS (True/False)`: Controla si se muestran los niveles (Ej: *NEWBIE*, *PRO*) en las tarjetas de combos.

### Lógica de Agrupación y Paginación
El script no tira los datos crudos, sino que los organiza de forma inteligente (4 ítems por página para catálogo, 2 para combos):
* **Subcategorías Grandes (≥ 3 ítems):** Si una subcategoría tiene muchos equipos, el script le otorga páginas exclusivas. El título de la página será compuesto (Ej: `VIDEO | CÁMARAS`).
* **Subcategorías Chicas (< 3 ítems):** Para no desperdiciar hojas con un solo ítem, el script junta ítems sueltos en una misma página. Si junta cosas mezcladas, el título de la página sube a la jerarquía padre (Ej: solo `VIDEO`).

### 💡 Trucos y Hacks en el Python
1.  **Disfraz de Navegador (User-Agent):** Google Sheets a veces bloquea o demora infinitamente (`TimeoutError`) las peticiones que vienen de scripts anónimos. El truco fue agregarle a la petición de `urllib` un encabezado (`headers`) haciéndose pasar por Google Chrome de Windows. Esto asegura que la descarga del CSV sea casi instantánea.
2.  **Cálculo Dinámico de Fuentes:** El script cuenta los caracteres (el `length`) del nombre y la descripción de los equipos. Si detecta nombres muy largos (ej. más de 60 caracteres), ajusta dinámicamente la variable de la fuente (`f_cat_nombre`) para que WeasyPrint la renderice más chica y evite desbordes visuales.

---

## 🎨 2. El Diseño: `template_pdf.html`

Es el esqueleto visual. Está escrito en HTML y CSS puro, pero está plagado de variables de Jinja2 (`{{ variable }}`) que Python reemplaza en tiempo real.

### Tipografía y Colores
* **Cormorant Garamond:** Fuente Serif usada para aportar elegancia (títulos, nombres de equipos, precios).
* **Outfit:** Fuente Sans-Serif usada para los datos técnicos y descripciones por su alta legibilidad.
* Usa un sistema de variables nativas de CSS (`:root`) para manejar la paleta de colores de la marca (dorado `#C9A84C`, bordó `#9b2525`, grises y negros).

### 💡 Trucos y Hacks Anti-WeasyPrint
WeasyPrint es un motor estricto y a veces se "rompe" al tratar de interpretar reglas web modernas (como Flexbox). Este template tiene "blindajes" específicos:

1.  **La Arquitectura Absoluta (Anti-Cortes de Imagen):** * *El problema:* Si un archivo `.png` original es de 3000x3000px, WeasyPrint ignora los contenedores e intenta dibujar la imagen gigante, cortándola y rompiendo los recuadros negros.
    * *La solución (El truco):* Se sacó a la imagen del flujo de `Flexbox`. El contenedor negro tiene medidas matemáticas rígidas. Adentro, un contenedor "fantasma" (`position: relative`) ancla a la imagen (`position: absolute; width: 100%; height: 100%; object-fit: contain;`). Así, la imagen está obligada a encerrarse en la caja, sin importar su tamaño de origen.
2.  **Prevención de Quiebre de Títulos (`white-space: nowrap`):** * Para evitar que títulos largos choquen y empujen los elementos hacia abajo desarmando la hoja, los encabezados tienen reglas estrictas que impiden que el texto pase a un segundo renglón. Además, mediante Jinja (`{% raw %}{% if pagina.titulo_pagina|length > 32 %}{% endraw %}`), el tamaño de la letra del título se achica automáticamente en el HTML si es muy largo.
3.  **Botones Inamovibles (`flex-shrink: 0`):** * Botones y logos tienen esta regla para indicar que, ante la falta de espacio, el motor *no tiene permitido* comprimirlos.
4.  **Trazo Dorado en PNGs Transparentes:**
    * En lugar de usar un `border` clásico (que haría un cuadrado feo), se configuró un `filter: drop-shadow(0 0 10px var(--gold))` en las imágenes. Esto lee el canal Alfa de la foto de la cámara/lente y dibuja un halo dorado exactamente por el borde del equipo. *(Nota: El soporte de este filtro visual depende de la versión exacta de WeasyPrint y sus librerías gráficas subyacentes, como Cairo/Pango).*

---

## 🚀 Cómo ejecutarlo

1.  Asegurate de tener tu entorno virtual activado (`.venv`).
2.  Verificá que los links públicos de Google Sheets en el `generar_pdf.py` estén activos y en formato CSV/TSV.
3.  Asegurate de que la carpeta `img/catalogo/` contenga las fotos referenciadas en el Excel.
4.  Ejecutá el script:
    ```bash
    python generar_pdf.py
    ```
5.  El sistema procesará la información y arrojará el archivo final: **`Lista_de_Precios_Ullathorpe.pdf`**.