# 🎬 Ullathorpe Rental — Sitio Web

Sitio web oficial de **Ullathorpe Rental**, emprendimiento de alquiler de equipos audiovisuales ubicado en Parque Chacabuco, CABA, Argentina.

📸 Instagram: [@ullathorpe.rental](https://instagram.com/ullathorpe.rental)  
💬 WhatsApp: [011-3030-1420](https://wa.me/5491130301420)  
📧 Email: ullathorperental@gmail.com

---

## 📋 Descripción

Landing page + catálogo de equipos para alquiler audiovisual. El sitio permite a los clientes:

- Explorar el catálogo completo de equipos (cámaras, lentes, iluminación, sonido, accesorios)
- Ver combos armados con precio
- Leer el contrato de locación antes de alquilar
- Contactar directamente por WhatsApp para reservar

---

## 🗂️ Estructura del proyecto

```
ullathorpe-rental/
│
├── index.html           # Archivo principal del sitio
├── img/
│   └── catalogo/        # Imágenes de los equipos
│       ├── sony-a6600.jpg
│       ├── canon-t5i.jpg
│       └── ...
└── README.md            # Este archivo
```

---

## 🛠️ Tecnologías

- **HTML5 / CSS3 / JavaScript** — sin frameworks, sitio estático puro
- **Google Fonts** — tipografías Cormorant Garamond + Outfit
- **Google Sheets** (opcional) — como fuente de datos del catálogo

---

## 🚀 Cómo correr el proyecto localmente

No necesitás instalar nada. Simplemente:

1. Cloná el repositorio:
   ```bash
   git clone https://github.com/TU_USUARIO/ullathorpe-rental.git
   ```

2. Abrí `index.html` en tu navegador.

Listo. No hay servidor, no hay dependencias.

---

## 🌐 Deploy

El sitio está publicado en **Netlify**:  
🔗 [ullathorperental.netlify.app](https://ullathorperental.netlify.app) *(actualizar con la URL real)*

Para actualizar el sitio: modificá `index.html` y hacé push a la rama `main`. Netlify lo publica automáticamente.

---

## 🖼️ Imágenes del catálogo

Las imágenes de los equipos deben estar en la carpeta `img/catalogo/`.  
El nombre de cada archivo debe coincidir exactamente con el campo `img` definido en `CATALOG_DATA` dentro del HTML.

**Formato recomendado:** JPG o WebP, tamaño máximo 200KB por imagen.

---

## 📄 Contrato de locación

El sitio incluye el contrato completo de **Locación de Bienes Muebles No Fungibles** (16 cláusulas), accesible desde la sección "Términos" de la web. Los clientes pueden leerlo antes de confirmar su alquiler.

---

## 📦 Catálogo de equipos

El catálogo está hardcodeado en el HTML (array `CATALOG_DATA`) e incluye:

| Categoría | Equipos |
|---|---|
| Cámaras | Sony A6600, Canon T5i, Canon T3i |
| Lentes | Sony, Canon, 7Artisans, Nikon |
| Iluminación | LED VISICO, paneles, tubos RGB, smart |
| Sonido | Grabadoras ZOOM, micrófonos BOYA y RODE |
| Accesorios | Gimbal DJI, trípodes, filtros, claqueta |
| Combos | Kits de grabación y sonido armados |

---

## 🔮 Roadmap futuro

- [ ] Conectar catálogo a Google Sheets (precios sin tocar código)
- [ ] Migrar a Next.js para soporte de usuarios
- [ ] Login con Google + historial de alquileres por cliente
- [ ] Sistema de reservas online

---

## 📝 Licencia

© 2026 Ullathorpe Rental. Todos los derechos reservados.  
Este código es privado y no puede ser reutilizado sin autorización.
