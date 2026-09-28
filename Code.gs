/**
 * GriBeer · Contratos — backend en Google Apps Script
 * Recibe el PDF firmado desde la web, lo guarda en la carpeta de Drive
 * y lo envía por email a rmartin@gribeer.com (y opcionalmente al cliente).
 *
 * Implementar: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo (la cuenta dueña de la carpeta de Drive)
 *   - Quién tiene acceso: Cualquier usuario
 */

const CONFIG = {
  SECRET: 'gribeer-contratos-2026',                 // igual que en config.js
  FOLDER_ID: '1NaxUw39CSHdRdpqXXLByLcBVElU7U8p_',   // carpeta de Drive de contratos
  EMAIL_TO: 'rmartin@gribeer.com',
  SENDER_NAME: 'GriBeer Eventos',
  SUBFOLDER_BY_YEAR: false,                          // true = crea subcarpeta por año (2026, 2027…)
};

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.secret !== CONFIG.SECRET) return json({ ok: false, error: 'No autorizado' });
    if (!p.pdfBase64 || !p.fileName) return json({ ok: false, error: 'Faltan datos' });

    // 1) Guardar en Drive
    const bytes = Utilities.base64Decode(p.pdfBase64);
    const fileName = String(p.fileName).replace(/[\\/:*?"<>|]/g, '_');
    const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
    let folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
    if (CONFIG.SUBFOLDER_BY_YEAR) {
      const y = String(new Date().getFullYear());
      const it = folder.getFoldersByName(y);
      folder = it.hasNext() ? it.next() : folder.createFolder(y);
    }
    // Evitar duplicados si la web reintenta el envío
    const existing = folder.getFilesByName(fileName);
    const file = existing.hasNext() ? existing.next() : folder.createFile(blob);

    // 2) Email interno
    const rows = (p.resumen || []).map(function (r) {
      return '<tr><td style="padding:6px 10px;color:#777;border-bottom:1px solid #eee;white-space:nowrap">' + esc(r[0]) +
             '</td><td style="padding:6px 10px;border-bottom:1px solid #eee">' + esc(r[1]) + '</td></tr>';
    }).join('');
    const subject = (p.tipo || 'Contrato') + ' firmado · ' + (p.empresa || p.nombre || '') + ' · ' + (p.fechaEntrega || '') + ' · ' + (p.id || '');
    const html =
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
      '<h2 style="color:#F5A623;margin:0 0 8px">' + esc(p.tipo || 'Contrato') + ' firmado</h2>' +
      '<p>Se ha firmado un nuevo documento. Va adjunto en PDF y guardado en Drive: <a href="' + file.getUrl() + '">' + esc(fileName) + '</a></p>' +
      '<table style="border-collapse:collapse;font-size:13px">' + rows + '</table></div>';
    MailApp.sendEmail({ to: CONFIG.EMAIL_TO, subject: subject, htmlBody: html, attachments: [blob], name: CONFIG.SENDER_NAME });

    // 3) Copia al cliente (opcional)
    let clientSent = false;
    if (p.copiaCliente && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.emailCliente || '')) {
      MailApp.sendEmail({
        to: p.emailCliente, replyTo: CONFIG.EMAIL_TO, name: CONFIG.SENDER_NAME,
        subject: 'Tu ' + String(p.tipo || 'contrato').toLowerCase() + ' con GriBeer · ' + (p.id || ''),
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px">Buenas,<br><br>Te adjuntamos el documento firmado del servicio de GriBeer.<br><br>Muchas gracias,<br>Un saludo,<br>GriBeer Eventos · 649 053 366</div>',
        attachments: [blob],
      });
      clientSent = true;
    }

    return json({ ok: true, fileId: file.getId(), fileUrl: file.getUrl(), emailTo: CONFIG.EMAIL_TO, clientSent: clientSent });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'GriBeer Contratos', folder: CONFIG.FOLDER_ID });
}

/** Ejecuta esta función una vez desde el editor para conceder permisos de Drive y Gmail. */
function autorizar() {
  DriveApp.getFolderById(CONFIG.FOLDER_ID).getName();
  MailApp.getRemainingDailyQuota();
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
