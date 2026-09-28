/* GriBeer · Contratos — asistente paso a paso con firma y envío
   Sin dependencias salvo jsPDF (vendor/). Estado guardado como borrador en el navegador. */
(function () {
  "use strict";
  const CFG = window.GB_CONFIG || {};
  const EMP = CFG.EMPRESA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS_DRAFT = "gb_contrato_borrador_v1";
  const LS_PEND = "gb_contrato_pendientes_v1";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  // ── Catálogos (mismos que EventPro) ─────────────────────────
  const TIPOS_DOC = [
    ["Contrato", "📝", "Contrato de alquiler con condiciones"],
    ["Albarán de entrega", "🚚", "Entrega del equipo al cliente"],
    ["Albarán de recogida", "↩️", "Recogida y revisión del equipo"],
  ];
  const TIPOS_CLIENTE = ["IFEMA", "EMPRESA", "PARTICULAR", "CATERING"];
  const FERIAS = ["FITUR", "EXPODENTAL", "SICUR", "INFARMA", "SALON GOURMETS", "SIMA", "ALIMENTARIA", "PROPET", "ASLAN", "WindEurope", "INTEROCIO", "EXPOOPTICA", "PROMOGIFT", "HIP", "SRR", "OTRA"];
  const EQUIPOS = ["Grifo LINDR 25K", "Grifo LINDR 40K Individual", "Grifo LINDR 40K Doble", "Grifo LINDR 55 (2 columnas)", "Grifo LINDR 70K Doble", "Grifo LINDR 155K Doble", "Grifo V100", "Nevera 118L", "Nevera 237L", "Columna Bar", "Máquina Café Nespresso", "Máquina Café L'Or", "Máquina Café Dolce Gusto", "Fuente de Agua"];
  const MARCAS = ["Mahou Clásica", "Mahou 5 Estrellas", "Estrella Galicia", "Alhambra", "Pilsner Urquell", "1906", "Mahou Sin", "Otra"];
  const IFEMA_DIR = "IFEMA Madrid, Av. del Partenón 5, 28042 Madrid";

  const CONDICIONES = `El receptor del equipo se compromete a hacer buen uso de los materiales.
Si los equipos resultaran dañados, se hará uso de la fianza para su reparación.
El receptor ha sido informado del uso correcto por el instalador de GriBeer.
En caso de no devolución del grifo, el receptor asumirá el coste de reposición.
El cliente confirma estar de acuerdo con las Condiciones Particulares.

CONDICIONES PARTICULARES
1. Los presentes términos serán de aplicación a todos los contratos con GriBeer Eventos S.L.
2. El precio incluye transporte, instalación e IVA, expresado en euros, salvo que el presupuesto indique lo contrario.
3. La recogida será en la franja horaria acordada. Si el material no se devuelve el día pactado se cobrarán 10 € por día de retraso.
4. Devolución con daños: el cargo se realizará en un plazo de 5 días naturales desde la entrega.
5. Si el cliente está ausente en la entrega, el segundo intento tendrá un coste adicional de 40 €.
6. El grifo y el resto de equipos son siempre propiedad de GriBeer Eventos S.L.
7. La fianza se devolverá tras la recogida y revisión del material, descontando en su caso los daños o faltas.
8. Los datos personales se tratan según la política de privacidad publicada en www.gribeer.com.`;

  // ── Estado ───────────────────────────────────────────────────
  const today = () => new Date().toISOString().slice(0, 10);
  const blank = () => ({
    tipo: "", tipoCliente: "", feria: "", pabellon: "", stand: "",
    fechaEntrega: today(), horaEntrega: "", empresa: "", cif: "", nombre: "", docTipo: "DNI/NIE", dni: "",
    email: "", telefono: "", ubicacion: "", fechaRecogida: "", horaRecogida: "",
    equipos: [], bandeja: "", barrilesServicio: [{ cantidad: 1, marca: "Mahou Clásica" }], barrilesReserva: [],
    fianza: "", fianzaPagada: "", fianzaMetodo: "", estadoMaterial: "", danos: "",
    fotos: [], observaciones: "", acepta: false, firmaCli: null, tecnico: "", firmaTec: null,
    copiaCliente: false, step: 0, id: "", enviado: null,
  });
  let S = Object.assign(blank(), store.get(LS_DRAFT, {}));

  // Prefill desde la URL (?empresa=..&nombre=..&email=..&tipoCliente=IFEMA&fechaEntrega=2026-10-01 ...)
  (function prefill() {
    const q = new URLSearchParams(location.search);
    if (![...q.keys()].length) return;
    const keys = ["empresa", "cif", "nombre", "email", "telefono", "tipoCliente", "feria", "pabellon", "stand", "ubicacion", "fechaEntrega", "fechaRecogida", "tipo", "fianza"];
    const fresh = blank();
    keys.forEach((k) => { if (q.get(k)) fresh[k] = q.get(k); });
    S = fresh;
    history.replaceState(null, "", location.pathname);
  })();

  const save = () => { if (!store.set(LS_DRAFT, S)) { const c = Object.assign({}, S, { fotos: [] }); store.set(LS_DRAFT, c); } };
  const set = (k, v) => { S[k] = v; save(); };
  const isIfema = () => S.tipoCliente === "IFEMA";
  const isRecogida = () => S.tipo === "Albarán de recogida";
  const fmtDate = (d) => (d ? d.split("-").reverse().join("/") : "—");

  // ── Validaciones ────────────────────────────────────────────
  function validDNI(v) {
    const s = String(v || "").toUpperCase().replace(/[\s-]/g, "");
    const L = "TRWAGMYFPDXBNJZSQVHLCKE";
    let m = s.match(/^(\d{8})([A-Z])$/);
    if (m) return L[+m[1] % 23] === m[2];
    m = s.match(/^([XYZ])(\d{7})([A-Z])$/);
    if (m) return L[+(("XYZ".indexOf(m[1])) + m[2]) % 23] === m[3];
    return false;
  }
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
  const validTel = (v) => String(v || "").replace(/\D/g, "").length >= 9;

  // ── Definición de pasos ─────────────────────────────────────
  const STEPS = [
    { id: "tipo", title: "¿Qué documento vas a generar?", hint: "Elige el tipo. Todos llevan firma del cliente y del técnico.",
      html: () => TIPOS_DOC.map(([t, ic, d]) => `<button class="opt ${S.tipo === t ? "on" : ""}" data-pick="tipo" data-v="${esc(t)}"><span class="ic">${ic}</span><span>${esc(t)}<small>${esc(d)}</small></span></button>`).join(""),
      valid: () => !!S.tipo, auto: true },

    { id: "cliente", title: "Tipo de cliente", hint: "Si es en IFEMA te pediremos feria, pabellón y stand.",
      html: () => TIPOS_CLIENTE.map((t) => `<button class="opt ${S.tipoCliente === t ? "on" : ""}" data-pick="tipoCliente" data-v="${esc(t)}">${t === "IFEMA" ? "🏛️" : t === "EMPRESA" ? "🏢" : t === "CATERING" ? "🍽️" : "👤"} ${esc(t)}</button>`).join(""),
      valid: () => !!S.tipoCliente, auto: true,
      after: () => { if (isIfema() && !S.ubicacion) set("ubicacion", IFEMA_DIR); if (!S.fianza) set("fianza", isIfema() ? "300" : "150"); } },

    { id: "entrega", title: "📅 Fecha de entrega", hint: "Día (y franja horaria si la hay) en que se entrega el material.",
      html: () => field("Fecha de entrega", "fechaEntrega", "date") + field("Hora / franja (opcional)", "horaEntrega", "text", "Ej: 9:00 – 10:00"),
      valid: () => !!S.fechaEntrega },

    { id: "empresa", title: "🏢 Empresa", hint: "Razón social de quien contrata. Si es un particular, pon su nombre.",
      html: () => field("Empresa / Razón social", "empresa", "text", "Ej: Empresa S.L.") + field("CIF (opcional)", "cif", "text", "Ej: B12345678"),
      valid: () => S.empresa.trim().length > 1 },

    { id: "nombre", title: "👤 Nombre y apellidos", hint: "Persona que recibe el material y firma el documento.",
      html: () => field("Nombre completo del receptor", "nombre", "text", "Ej: Juan García López", "name"),
      valid: () => S.nombre.trim().split(/\s+/).length >= 2 ? true : "Escribe nombre y al menos un apellido" },

    { id: "dni", title: "🪪 DNI / NIE", hint: "Documento identificativo del firmante.",
      html: () => `<div class="chips">${["DNI/NIE", "Pasaporte / otro"].map((t) => `<button class="chip ${S.docTipo === t ? "on" : ""}" data-pick="docTipo" data-v="${esc(t)}" data-stay="1">${esc(t)}</button>`).join("")}</div>` +
        field("Número de documento", "dni", "text", S.docTipo === "DNI/NIE" ? "Ej: 12345678Z" : "Nº de pasaporte"),
      valid: () => { if (!S.dni.trim()) return false; if (S.docTipo !== "DNI/NIE") return S.dni.trim().length >= 5 ? true : "Documento demasiado corto"; return validDNI(S.dni) ? true : "El DNI/NIE no es válido (revisa la letra)"; },
      live: true },

    { id: "ifema", title: "🏛️ Feria, pabellón y stand", hint: "Ubicación exacta dentro de IFEMA.", show: isIfema,
      html: () => `<div class="f"><label class="l">Feria</label><select data-k="feria"><option value="">Selecciona…</option>${FERIAS.map((f) => `<option ${S.feria === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select></div>` +
        `<div class="row">${field("Pabellón", "pabellon", "text", "Ej: 7")}${field("Stand", "stand", "text", "Ej: 7C12")}</div>`,
      valid: () => !!S.pabellon.trim() && !!S.stand.trim() },

    { id: "contacto", title: "✉️ Email y teléfono", hint: "Para enviarle copia y contactar el día de la recogida.",
      html: () => field("Correo electrónico", "email", "email", "cliente@empresa.com", "email") + field("Teléfono", "telefono", "tel", "600 000 000", "tel"),
      valid: () => !validEmail(S.email) ? "Email no válido" : !validTel(S.telefono) ? "Teléfono no válido" : true, live: true },

    { id: "direccion", title: "📍 Dirección de entrega", hint: "Dónde se instala el equipo.",
      html: () => field("Dirección completa", "ubicacion", "text", "Calle, número, CP, ciudad", "street-address"),
      valid: () => S.ubicacion.trim().length > 4 },

    { id: "recogida", title: "↩️ Fecha de recogida", hint: "Día y franja en que GriBeer recoge el material.",
      html: () => field("Fecha de recogida", "fechaRecogida", "date") + field("Hora / franja (opcional)", "horaRecogida", "text", "Ej: 18:00 – 20:00"),
      valid: () => !S.fechaRecogida ? false : S.fechaRecogida < S.fechaEntrega ? "La recogida no puede ser antes de la entrega" : true, live: true },

    { id: "equipos", title: "🔧 Equipos en alquiler", hint: "Toca para añadir y ajusta la cantidad.",
      html: () => {
        const sel = S.equipos.map((e) => e.nombre);
        return `<div class="chips">${EQUIPOS.map((e) => `<button class="chip ${sel.includes(e) ? "on" : ""}" data-eq="${esc(e)}">${esc(e)}</button>`).join("")}</div>
        <div class="row f"><input type="text" id="eqNew" placeholder="Otro equipo…"><button class="btn-s" id="eqAdd" style="flex:none">+ Añadir</button></div>
        ${S.equipos.length ? `<div class="sec">Seleccionados</div>` : ""}
        ${S.equipos.map((e, i) => `<div class="eqrow"><span class="n">${esc(e.nombre)}</span><div class="qty"><button data-eqq="${i}" data-d="-1">−</button><span>${e.cant}</span><button data-eqq="${i}" data-d="1">+</button></div><button class="x" data-eqx="${i}">✕</button></div>`).join("")}`;
      },
      valid: () => S.equipos.length > 0 },

    { id: "bandeja", title: "🪣 Bandeja de goteo", hint: "¿Se entrega bandeja de goteo?",
      html: () => ["Sí", "No"].map((o) => `<button class="opt ${S.bandeja === o ? "on" : ""}" data-pick="bandeja" data-v="${o}" style="justify-content:center">${o}</button>`).join(""),
      valid: () => !!S.bandeja, auto: true },

    { id: "barriles", title: "🍺 Barriles", hint: "Barriles pinchados en servicio y barriles de reserva que se dejan.",
      html: () => `<div class="sec">En servicio</div>${barrilList("barrilesServicio")}<div class="sec" style="margin-top:16px">De reserva</div>${barrilList("barrilesReserva")}`,
      valid: () => true },

    { id: "fianza", title: isRecogida() ? "💶 Fianza" : "💶 Fianza", hint: "Importe de la fianza y si ya está abonada.",
      html: () => field("Importe fianza (€)", "fianza", "number", "0") +
        `<label class="l">¿Está pagada?</label><div class="chips">${["Sí", "No", "Sin fianza"].map((o) => `<button class="chip ${S.fianzaPagada === o ? "on" : ""}" data-pick="fianzaPagada" data-v="${o}" data-stay="1">${o}</button>`).join("")}</div>` +
        (S.fianzaPagada === "Sí" ? `<label class="l">Forma de pago</label><div class="chips">${["Transferencia", "Tarjeta", "Efectivo", "Bizum", "Incluida en factura"].map((o) => `<button class="chip ${S.fianzaMetodo === o ? "on" : ""}" data-pick="fianzaMetodo" data-v="${o}" data-stay="1">${o}</button>`).join("")}</div>` : ""),
      valid: () => !!S.fianzaPagada && (S.fianzaPagada === "Sin fianza" || S.fianza !== "") },

    { id: "estado", title: "🔍 Estado del material", hint: "Revisión en el momento de la recogida.", show: isRecogida,
      html: () => ["Correcto, sin daños", "Con daños o faltas"].map((o) => `<button class="opt ${S.estadoMaterial === o ? "on" : ""}" data-pick="estadoMaterial" data-v="${o}" data-stay="1">${o === "Correcto, sin daños" ? "✅" : "⚠️"} ${o}</button>`).join("") +
        (S.estadoMaterial === "Con daños o faltas" ? `<div class="f"><label class="l">Describe los daños / faltas</label><textarea data-k="danos" placeholder="Ej: falta 1 barril de reserva, manguera dañada…">${esc(S.danos)}</textarea></div>` : ""),
      valid: () => !!S.estadoMaterial && (S.estadoMaterial !== "Con daños o faltas" || S.danos.trim().length > 2) },

    { id: "fotos", title: "📷 Fotos del equipo", hint: "Opcional. Hasta 4 fotos del equipo instalado o recogido.",
      html: () => `${S.fotos.length ? `<div class="photos">${S.fotos.map((f, i) => `<figure><img src="${f}" alt=""><button data-fx="${i}">✕</button></figure>`).join("")}</div>` : ""}
        ${S.fotos.length < 4 ? `<label class="upl">📷 Hacer / subir foto<input type="file" accept="image/*" capture="environment" id="foto" hidden multiple></label>` : ""}`,
      valid: () => true, nextLabel: () => (S.fotos.length ? "Siguiente →" : "Saltar →") },

    { id: "obs", title: "📝 Observaciones", hint: "Opcional. Cualquier acuerdo especial con el cliente.",
      html: () => `<div class="f"><textarea data-k="observaciones" placeholder="Ej: el cliente devuelve el material en el stand a las 18:00">${esc(S.observaciones)}</textarea></div>`,
      valid: () => true },

    { id: "condiciones", title: "📄 Condiciones", hint: "El cliente debe leer y aceptar las condiciones antes de firmar.",
      html: () => `<div class="cond">${esc(CONDICIONES)}</div><label class="check"><input type="checkbox" id="acepta" ${S.acepta ? "checked" : ""}><span>El cliente <b>${esc(S.nombre || "")}</b> ha leído y acepta las condiciones generales y particulares.</span></label>`,
      valid: () => !!S.acepta },

    { id: "firmaCli", title: "✍️ Firma del cliente", hint: () => `${esc(S.nombre)} · ${esc(S.dni.toUpperCase())}`,
      html: () => sigHTML("firmaCli", "Firma aquí con el dedo"), valid: () => !!S.firmaCli, sig: "firmaCli" },

    { id: "firmaTec", title: "👷 Firma del técnico GriBeer", hint: "Selecciona quién entrega/recoge y firma.",
      html: () => `<div class="chips">${(CFG.TECNICOS || []).map((t) => `<button class="chip ${S.tecnico === t ? "on" : ""}" data-pick="tecnico" data-v="${esc(t)}" data-stay="1">${esc(t)}</button>`).join("")}</div>` +
        field("Nombre del técnico", "tecnico", "text", "Nombre") + sigHTML("firmaTec", "Firma del técnico"),
      valid: () => !S.tecnico.trim() ? "Indica el nombre del técnico" : !S.firmaTec ? false : true, sig: "firmaTec", live: true },

    { id: "resumen", title: "✅ Revisar y enviar", hint: "Comprueba los datos. Al pulsar el botón se genera el PDF firmado, se guarda en Drive y se envía por email.",
      html: () => summaryHTML(), valid: () => true, final: true },
  ];

  const visible = () => STEPS.filter((s) => !s.show || s.show());

  // ── Helpers de HTML ─────────────────────────────────────────
  function field(label, k, type = "text", ph = "", ac = "") {
    return `<div class="f"><label class="l">${esc(label)}</label><input type="${type}" data-k="${k}" value="${esc(S[k])}" placeholder="${esc(ph)}" ${ac ? `autocomplete="${ac}"` : ""} ${type === "number" ? 'inputmode="decimal" min="0"' : ""}></div>`;
  }
  function barrilList(k) {
    return S[k].map((b, i) => `<div class="brow"><input type="number" min="0" inputmode="numeric" value="${b.cantidad}" data-bk="${k}" data-bi="${i}" data-bf="cantidad"><select data-bk="${k}" data-bi="${i}" data-bf="marca">${MARCAS.map((m) => `<option ${b.marca === m ? "selected" : ""}>${m}</option>`).join("")}</select><button class="x" data-bx="${k}" data-bi="${i}">✕</button></div>`).join("") +
      `<button class="btn-s" data-badd="${k}">+ Añadir barril</button>`;
  }
  function sigHTML(k, ph) {
    return `<div class="sig ${S[k] ? "has" : ""}" id="sig-${k}"><canvas></canvas><div class="ph">${esc(ph)}</div></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn-s btn-red" data-sigclear="${k}">Borrar firma</button>${S[k] ? '<span class="ok-msg">✓ Firma registrada</span>' : ""}</div>`;
  }
  function rows() {
    const eq = S.equipos.map((e) => `${e.cant}× ${e.nombre}`).join(", ");
    const bs = S.barrilesServicio.filter((b) => b.cantidad > 0).map((b) => `${b.cantidad}× ${b.marca}`).join(", ");
    const br = S.barrilesReserva.filter((b) => b.cantidad > 0).map((b) => `${b.cantidad}× ${b.marca}`).join(", ");
    const r = [
      ["Documento", S.tipo], ["Tipo de cliente", S.tipoCliente], ["Empresa", S.empresa + (S.cif ? ` (${S.cif.toUpperCase()})` : "")],
      ["Receptor", S.nombre], [S.docTipo === "DNI/NIE" ? "DNI/NIE" : "Documento", S.dni.toUpperCase()], ["Email", S.email], ["Teléfono", S.telefono],
    ];
    if (isIfema()) r.push(["Feria", S.feria || "—"], ["Pabellón / Stand", `${S.pabellon} / ${S.stand}`]);
    r.push(["Dirección", S.ubicacion], ["Entrega", fmtDate(S.fechaEntrega) + (S.horaEntrega ? ` · ${S.horaEntrega}` : "")],
      ["Recogida", fmtDate(S.fechaRecogida) + (S.horaRecogida ? ` · ${S.horaRecogida}` : "")], ["Equipos", eq || "—"], ["Bandeja de goteo", S.bandeja],
      ["Barriles en servicio", bs || "—"], ["Barriles de reserva", br || "—"],
      ["Fianza", S.fianzaPagada === "Sin fianza" ? "Sin fianza" : `${Number(S.fianza || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} € · ${S.fianzaPagada === "Sí" ? "Pagada" + (S.fianzaMetodo ? " (" + S.fianzaMetodo + ")" : "") : "Pendiente de pago"}`]);
    if (isRecogida()) r.push(["Estado del material", S.estadoMaterial + (S.danos ? ` — ${S.danos}` : "")]);
    if (S.observaciones.trim()) r.push(["Observaciones", S.observaciones.trim()]);
    r.push(["Técnico GriBeer", S.tecnico], ["Fotos", S.fotos.length ? `${S.fotos.length}` : "—"]);
    return r;
  }
  function summaryHTML() {
    return `<div class="sum">${rows().map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}</div>
      <label class="check"><input type="checkbox" id="copia" ${S.copiaCliente ? "checked" : ""}><span>Enviar también una copia al cliente (${esc(S.email)})</span></label>
      <div id="sendArea" style="margin-top:18px">
        <button class="big a" id="sendBtn">Firmar y enviar contrato</button>
        <button class="big c" data-back="1">← Atrás</button>
      </div>`;
  }

  // ── Render ──────────────────────────────────────────────────
  const app = $("#app");
  function render() {
    if (S.enviado) return renderDone();
    const vs = visible();
    if (S.step >= vs.length) S.step = vs.length - 1;
    const st = vs[S.step];
    const pct = Math.round((S.step / (vs.length - 1)) * 100);
    const hint = typeof st.hint === "function" ? st.hint() : st.hint;
    app.innerHTML = `
      <div class="meta"><span><b>${esc(S.tipo || "Nuevo documento")}</b></span><span>Paso ${S.step + 1} de ${vs.length}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <h2>${esc(st.title)}</h2>${hint ? `<p class="hint">${hint}</p>` : ""}
      <div id="body">${st.html()}</div>
      <div class="err" id="err"></div>
      ${st.final ? "" : `<div class="nav">${S.step > 0 ? '<button class="back" data-back="1">← Atrás</button>' : ""}<button class="next" id="next">${st.nextLabel ? st.nextLabel() : "Siguiente →"}</button></div>`}`;
    if (st.sig) setupSig(st.sig);
    refreshNext();
    const first = app.querySelector("input[type=text],input[type=email],input[type=tel],input[type=number]");
    if (first && !first.value && window.matchMedia("(pointer:fine)").matches) first.focus();
    window.scrollTo({ top: 0 });
  }
  function refreshNext(showErr) {
    const st = visible()[S.step];
    const v = st.valid();
    const n = $("#next");
    if (n) n.disabled = v !== true;
    const e = $("#err");
    if (e) e.textContent = typeof v === "string" && (showErr || st.live) && hasInput(st) ? v : "";
  }
  function hasInput(st) {
    if (st.id === "dni") return !!S.dni;
    if (st.id === "contacto") return !!(S.email || S.telefono);
    if (st.id === "recogida") return !!S.fechaRecogida;
    if (st.id === "nombre") return S.nombre.length > 3;
    if (st.id === "firmaTec") return !!S.firmaTec;
    return true;
  }
  function go(d) {
    const st = visible()[S.step];
    if (d > 0) { const v = st.valid(); if (v !== true) { refreshNext(true); return; } if (st.after) st.after(); }
    S.step = Math.max(0, S.step + d);
    save(); render();
  }

  // ── Eventos (delegados) ─────────────────────────────────────
  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.k) { set(t.dataset.k, t.value); if (t.dataset.k === "tecnico") syncChips("tecnico"); refreshNext(); }
    if (t.dataset.bk) { const L = S[t.dataset.bk]; L[+t.dataset.bi][t.dataset.bf] = t.dataset.bf === "cantidad" ? Math.max(0, parseInt(t.value) || 0) : t.value; save(); }
  });
  app.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "acepta") { set("acepta", t.checked); refreshNext(); }
    if (t.id === "copia") set("copiaCliente", t.checked);
    if (t.id === "foto" && t.files.length) {
      for (const f of [...t.files].slice(0, 4 - S.fotos.length)) S.fotos.push(await compress(f, 1280, 0.72));
      save(); render();
    }
  });
  app.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (b.id === "next") return go(1);
    if (d.back) return go(-1);
    if (d.pick) {
      const prev = S[d.pick];
      set(d.pick, d.v);
      if (d.pick === "tipoCliente" && prev && prev !== d.v) { if (S.ubicacion === IFEMA_DIR && d.v !== "IFEMA") set("ubicacion", ""); set("fianza", ""); }
      if (d.pick === "fianzaPagada" && d.v !== "Sí") set("fianzaMetodo", "");
      const st = visible()[S.step];
      if (st.auto && !d.stay) return go(1);
      return renderKeep();
    }
    if (d.eq) { const i = S.equipos.findIndex((x) => x.nombre === d.eq); i >= 0 ? S.equipos.splice(i, 1) : S.equipos.push({ nombre: d.eq, cant: 1 }); save(); return renderKeep(); }
    if (b.id === "eqAdd") { const v = $("#eqNew").value.trim(); if (v && !S.equipos.some((x) => x.nombre === v)) { S.equipos.push({ nombre: v, cant: 1 }); save(); } return renderKeep(); }
    if (d.eqq) { const it = S.equipos[+d.eqq]; it.cant = Math.max(1, it.cant + +d.d); save(); return renderKeep(); }
    if (d.eqx) { S.equipos.splice(+d.eqx, 1); save(); return renderKeep(); }
    if (d.badd) { S[d.badd].push({ cantidad: 1, marca: "Mahou Clásica" }); save(); return renderKeep(); }
    if (d.bx) { S[d.bx].splice(+d.bi, 1); save(); return renderKeep(); }
    if (d.fx) { S.fotos.splice(+d.fx, 1); save(); return renderKeep(); }
    if (d.sigclear) { set(d.sigclear, null); return renderKeep(); }
    if (b.id === "sendBtn") return enviar();
  });
  app.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "eqNew") { e.preventDefault(); $("#eqAdd").click(); }
    else if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); go(1); }
  });
  function renderKeep() { const y = window.scrollY; render(); window.scrollTo({ top: y }); }
  function syncChips(k) { app.querySelectorAll(`[data-pick="${k}"]`).forEach((c) => c.classList.toggle("on", c.dataset.v === S[k])); }

  $("#resetBtn").addEventListener("click", () => {
    if (!S.enviado && S.step > 0 && !confirm("¿Borrar los datos y empezar un documento nuevo?")) return;
    S = blank(); store.del(LS_DRAFT); render();
  });

  // ── Firma en canvas ─────────────────────────────────────────
  function setupSig(k) {
    const box = $("#sig-" + k), cv = box.querySelector("canvas");
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    if (S[k]) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, h); im.src = S[k]; }
    let drawing = false, last = null, dirty = false;
    const p = (ev) => { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    cv.addEventListener("pointerdown", (ev) => { ev.preventDefault(); cv.setPointerCapture(ev.pointerId); drawing = true; last = p(ev); ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, 7); ctx.fillStyle = "#111"; ctx.fill(); dirty = true; });
    cv.addEventListener("pointermove", (ev) => {
      if (!drawing) return; ev.preventDefault();
      const pts = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      for (const pe of pts) { const q = p(pe); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x, q.y); ctx.stroke(); last = q; }
      dirty = true;
    });
    const end = () => {
      if (!drawing) return; drawing = false;
      if (dirty) {
        // exportar a tamaño fijo (con fondo transparente)
        const out = document.createElement("canvas"); out.width = 600; out.height = Math.round(600 * h / w);
        out.getContext("2d").drawImage(cv, 0, 0, out.width, out.height);
        S[k] = out.toDataURL("image/png"); save();
        box.classList.add("has"); refreshNext();
      }
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
  }

  // ── Fotos ───────────────────────────────────────────────────
  function compress(file, max, q) {
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => { const im = new Image(); im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q));
      }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }

  // ── Logo como dataURL ───────────────────────────────────────
  let LOGO = null;
  fetch("logo.jpg").then((r) => r.blob()).then((b) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); })).then((d) => (LOGO = d)).catch(() => {});

  // ── PDF ─────────────────────────────────────────────────────
  function imgSize(src) { return new Promise((ok) => { const im = new Image(); im.onload = () => ok({ w: im.width, h: im.height }); im.onerror = () => ok({ w: 1, h: 1 }); im.src = src; }); }

  async function buildPDF(meta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const W = 210, M = 15, CW = W - 2 * M, BOTTOM = 280;
    const ORANGE = [245, 166, 35], GREY = [110, 110, 110], TXT = [25, 25, 25];
    let y = M;
    const need = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };

    // Cabecera
    if (LOGO) doc.addImage(LOGO, "JPEG", M, y, 22, 22);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...ORANGE);
    doc.text(S.tipo.toUpperCase(), W - M, y + 7, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY);
    doc.text(`${EMP.nombre} · CIF ${EMP.cif}`, W - M, y + 12.5, { align: "right" });
    doc.text(`${EMP.email} · ${EMP.tel} · ${EMP.web}`, W - M, y + 16.5, { align: "right" });
    doc.text(`Nº ${meta.id} · ${meta.fechaHora}`, W - M, y + 20.5, { align: "right" });
    y += 26; doc.setDrawColor(...ORANGE); doc.setLineWidth(0.7); doc.line(M, y, W - M, y); y += 7;

    const section = (t) => { y += 2.5; need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...ORANGE); doc.text(t.toUpperCase(), M, y); y += 1.8; doc.setDrawColor(230); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5; };
    const kv = (pairs, cols = 2) => {
      const cw = CW / cols;
      for (let i = 0; i < pairs.length; i += cols) {
        const chunk = pairs.slice(i, i + cols);
        const lines = chunk.map(([k, v]) => doc.setFontSize(9.5) && doc.splitTextToSize(String(v || "—"), cw - 4));
        const h = Math.max(...lines.map((l) => l.length)) * 4.1 + 4.6;
        need(h);
        chunk.forEach(([k], j) => {
          const x = M + j * cw;
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(k.toUpperCase(), x, y);
          doc.setFontSize(9.5); doc.setTextColor(...TXT); doc.text(lines[j], x, y + 4.3);
        });
        y += h;
      }
    };
    const para = (t, size = 9.5, color = TXT) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color); const ls = doc.splitTextToSize(t, CW); ls.forEach((l) => { need(size * 0.45); doc.text(l, M, y); y += size * 0.42; }); y += 2; };

    section("Datos del cliente");
    const cli = [["Empresa / Razón social", S.empresa], ["CIF", S.cif ? S.cif.toUpperCase() : "—"], ["Nombre del receptor", S.nombre], [S.docTipo === "DNI/NIE" ? "DNI / NIE" : "Documento", S.dni.toUpperCase()], ["Email", S.email], ["Teléfono", S.telefono], ["Tipo de cliente", S.tipoCliente]];
    if (isIfema()) cli.push(["Feria", S.feria || "—"], ["Pabellón", S.pabellon], ["Stand", S.stand]);
    kv(cli);

    section("Servicio");
    kv([["Fecha de entrega", fmtDate(S.fechaEntrega) + (S.horaEntrega ? ` · ${S.horaEntrega}` : "")], ["Fecha de recogida", fmtDate(S.fechaRecogida) + (S.horaRecogida ? ` · ${S.horaRecogida}` : "")], ["Dirección de entrega", S.ubicacion]], 2);

    section("Equipos en alquiler");
    kv([["Equipos", S.equipos.map((e) => `${e.cant} x ${e.nombre}`).join("\n") || "—"], ["Bandeja de goteo", S.bandeja]]);
    const bs = S.barrilesServicio.filter((b) => b.cantidad > 0).map((b) => `${b.cantidad} x ${b.marca}`).join("\n");
    const br = S.barrilesReserva.filter((b) => b.cantidad > 0).map((b) => `${b.cantidad} x ${b.marca}`).join("\n");
    kv([["Barriles en servicio", bs || "—"], ["Barriles de reserva", br || "—"]]);

    section("Fianza");
    kv([["Importe", S.fianzaPagada === "Sin fianza" ? "Sin fianza" : `${Number(S.fianza || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`], ["Estado", S.fianzaPagada === "Sí" ? "Pagada" + (S.fianzaMetodo ? ` (${S.fianzaMetodo})` : "") : S.fianzaPagada === "No" ? "Pendiente de pago" : "—"]]);

    if (isRecogida()) { section("Estado del material en la recogida"); kv([["Estado", S.estadoMaterial], ["Daños / faltas", S.danos || "—"]]); }
    if (S.observaciones.trim()) { section("Observaciones"); para(S.observaciones.trim()); }

    if (S.fotos.length) {
      section("Fotos del equipo");
      const ph = 45; let x = M;
      need(ph + 4);
      for (const f of S.fotos) {
        const s = await imgSize(f); const w = Math.min(60, ph * s.w / s.h);
        if (x + w > W - M) { x = M; y += ph + 4; need(ph + 4); }
        doc.addImage(f, "JPEG", x, y, w, ph); x += w + 4;
      }
      y += ph + 6;
    }

    section("Condiciones");
    para(CONDICIONES, 8, [80, 80, 80]);

    // Firmas (se mantienen juntas con la declaración)
    need(66);
    section("Firmas");
    para(`El cliente ${S.nombre} (${S.dni.toUpperCase()}) declara haber leído y aceptado las condiciones anteriores y recibe el material descrito.`, 8.5, TXT);
    y += 1;
    const sw = (CW - 10) / 2, sh = 32;
    const sigBox = async (x, label, img, l1, l2) => {
      doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(label.toUpperCase(), x, y);
      doc.setDrawColor(210); doc.setLineWidth(0.3); doc.roundedRect(x, y + 2, sw, sh, 2, 2);
      if (img) { const s = await imgSize(img); let w = sw - 6, h = w * s.h / s.w; if (h > sh - 4) { h = sh - 4; w = h * s.w / s.h; } doc.addImage(img, "PNG", x + (sw - w) / 2, y + 4, w, h); }
      doc.setFontSize(9); doc.setTextColor(...TXT); doc.text(l1, x, y + sh + 7); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(l2, x, y + sh + 11);
    };
    await sigBox(M, "Firma del cliente", S.firmaCli, S.nombre, `${S.dni.toUpperCase()} · ${meta.fechaHora}`);
    await sigBox(M + sw + 10, "Firma del técnico GriBeer", S.firmaTec, S.tecnico, `${EMP.nombre} · ${meta.fechaHora}`);
    y += sh + 16;

    // Pie en todas las páginas
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`${EMP.nombre} · ${S.tipo} Nº ${meta.id}`, M, 290);
      doc.text(`Página ${i} de ${n}`, W - M, 290, { align: "right" });
    }
    return doc;
  }

  // ── Envío ───────────────────────────────────────────────────
  const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const blobToB64 = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });

  async function post(payload) {
    if (!CFG.APPS_SCRIPT_URL) throw new Error("Falta configurar APPS_SCRIPT_URL en config.js");
    const r = await fetch(CFG.APPS_SCRIPT_URL, { method: "POST", credentials: "omit", body: JSON.stringify(payload), redirect: "follow" });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch { throw new Error("Respuesta no válida del servidor"); }
    if (!j.ok) throw new Error(j.error || "Error en el servidor");
    return j;
  }

  let lastPdf = null;
  async function enviar() {
    const area = $("#sendArea");
    const btn = $("#sendBtn");
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Generando PDF…';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const id = `GB-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const meta = { id, fechaHora: now.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) };
    let doc;
    try { doc = await buildPDF(meta); } catch (e) { btn.disabled = false; btn.textContent = "Firmar y enviar contrato"; $("#err").textContent = "Error generando el PDF: " + e.message; return; }
    const tipoSlug = { "Contrato": "Contrato", "Albarán de entrega": "Albaran_entrega", "Albarán de recogida": "Albaran_recogida" }[S.tipo] || "Documento";
    const fileName = `${S.fechaEntrega || now.toISOString().slice(0, 10)}_${slug(S.empresa || S.nombre)}_${tipoSlug}_${id.slice(-6)}.pdf`;
    const blob = doc.output("blob");
    lastPdf = { blob, fileName };
    const payload = {
      secret: CFG.SECRET, fileName, pdfBase64: await blobToB64(blob),
      tipo: S.tipo, id, copiaCliente: !!S.copiaCliente, emailCliente: S.email,
      resumen: rows(), empresa: S.empresa, nombre: S.nombre, fechaEntrega: fmtDate(S.fechaEntrega),
    };
    btn.innerHTML = '<span class="spin"></span>Guardando en Drive y enviando email…';
    try {
      const res = await post(payload);
      S.enviado = { id, fileName, url: res.fileUrl || "", email: res.emailTo || "rmartin@gribeer.com", ok: true };
    } catch (e) {
      queuePending(payload);
      S.enviado = { id, fileName, ok: false, error: e.message };
    }
    save(); render();
  }

  function queuePending(p) {
    const L = store.get(LS_PEND, []);
    if (!L.some((x) => x.id === p.id)) L.push(p);
    if (!store.set(LS_PEND, L)) { /* sin espacio: queda la descarga manual */ }
    renderPending();
  }
  async function retryPending() {
    const L = store.get(LS_PEND, []);
    const rest = [];
    for (const p of L) { try { await post(p); } catch { rest.push(p); } }
    store.set(LS_PEND, rest); renderPending();
    alert(rest.length ? `Quedan ${rest.length} documento(s) sin enviar. Revisa la conexión.` : "✓ Documentos pendientes enviados.");
  }
  function renderPending() {
    const L = store.get(LS_PEND, []);
    const el = $("#pending");
    el.innerHTML = L.length ? `<div class="pend"><span>⚠️ ${L.length} documento(s) firmados pendientes de enviar</span><button class="btn-s" id="retry">Reintentar</button></div>` : "";
    const r = $("#retry"); if (r) r.onclick = retryPending;
  }

  function renderDone() {
    const E = S.enviado;
    app.innerHTML = E.ok
      ? `<h2>✅ Documento firmado y enviado</h2>
         <div class="status ok">Se ha guardado en Google Drive y se ha enviado a <b>${esc(E.email)}</b>${S.copiaCliente ? ` y a <b>${esc(S.email)}</b>` : ""}.<br><small>Nº ${esc(E.id)} · ${esc(E.fileName)}</small></div>
         ${E.url ? `<a class="big b" href="${esc(E.url)}" target="_blank" rel="noopener">📁 Abrir en Google Drive</a>` : ""}
         <button class="big c" id="dl">⬇️ Descargar PDF</button>
         <button class="big a" id="nuevo">+ Nuevo documento</button>`
      : `<h2>⚠️ Firmado, pero no se pudo enviar</h2>
         <div class="status ko">${esc(E.error)}</div>
         <div class="status info">El documento queda guardado en este dispositivo como <b>pendiente</b> y podrás reenviarlo con el botón «Reintentar» de arriba. Descárgalo también por seguridad.</div>
         <button class="big a" id="dl">⬇️ Descargar PDF</button>
         <button class="big c" id="nuevo">+ Nuevo documento</button>`;
    const dl = $("#dl");
    dl.onclick = async () => {
      if (!lastPdf) { const doc = await buildPDF({ id: E.id, fechaHora: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) }); lastPdf = { blob: doc.output("blob"), fileName: E.fileName }; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(lastPdf.blob); a.download = lastPdf.fileName; a.click();
    };
    $("#nuevo").onclick = () => { S = blank(); store.del(LS_DRAFT); lastPdf = null; render(); };
  }

  renderPending();
  render();
})();
