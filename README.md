# GriBeer · Contratos

Web para formalizar con el cliente el **contrato / albarán de entrega / albarán de recogida** de GriBeer, paso a paso (mismo flujo que EventPro), con **firma del cliente y del técnico**. Al firmar:

1. Se genera el PDF firmado en el propio móvil/tablet.
2. Se guarda en la carpeta de Google Drive `1NaxUw39CSHdRdpqXXLByLcBVElU7U8p_`.
3. Se envía por email a **rmartin@gribeer.com** (y, si se marca, copia al cliente).

Si no hay conexión, el documento queda **pendiente** en el dispositivo y se reenvía con «Reintentar»; además se puede descargar el PDF.

## Pasos del asistente
Tipo de documento → tipo de cliente → fecha/hora de entrega → empresa y CIF → nombre y apellidos → DNI/NIE (valida la letra) o pasaporte → *(IFEMA)* feria, pabellón y stand → email y teléfono → dirección → fecha/hora de recogida → equipos con cantidades → bandeja de goteo → barriles en servicio y reserva → fianza (300 € IFEMA / 150 € resto por defecto) → *(recogida)* estado del material → fotos → observaciones → aceptación de condiciones → firma del cliente → técnico + firma → resumen y envío.

## Rellenar datos desde un enlace
Se pueden precargar campos por URL, p. ej. desde EventPro:
`https://<usuario>.github.io/gribeer-contratos/?empresa=Bujaldon%20SL&nombre=Elena%20Ruiz&email=elena@bujaldon-sl.es&telefono=601615933&tipoCliente=IFEMA&feria=FITUR&pabellon=10&stand=B11&fechaEntrega=2027-01-19&fechaRecogida=2027-01-23`

## Puesta en marcha
### 1. Backend (Google Apps Script) — con la cuenta dueña de la carpeta de Drive
1. Abrir <https://script.google.com> → **Nuevo proyecto** → nombre «GriBeer Contratos».
2. Pegar el contenido de `Code.gs`.
3. Ejecutar una vez la función `autorizar` y aceptar los permisos (Drive + Gmail).
4. **Implementar → Nueva implementación → Aplicación web**: *Ejecutar como: Yo* · *Acceso: Cualquier usuario*.
5. Copiar la URL que termina en `/exec`.

### 2. Web (GitHub Pages)
1. Pegar esa URL en `config.js` → `APPS_SCRIPT_URL`.
2. Settings → Pages → *Deploy from a branch* → `main` / root.

## Archivos
| Archivo | Qué hace |
|---|---|
| `index.html` | Interfaz y estilos (tema oscuro EventPro) |
| `app.js` | Pasos, validaciones, firma en canvas, PDF y envío |
| `config.js` | URL del Apps Script, secreto y técnicos |
| `jspdf.umd.min.js` | Generación de PDF (sin CDN) |
| `Code.gs` | Guarda en Drive y envía el email |

> El secreto de `config.js` es visible en el navegador: solo frena envíos casuales. Para cambiarlo, cámbialo a la vez en `config.js` y en `Code.gs`.
