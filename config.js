// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN — GriBeer Contratos
// ─────────────────────────────────────────────────────────────
window.GB_CONFIG = {
  // URL de la Web App de Google Apps Script (termina en /exec).
  // Se obtiene al implementar apps-script/Code.gs (ver README).
  APPS_SCRIPT_URL: "",

  // Debe coincidir con SECRET en apps-script/Code.gs
  SECRET: "gribeer-contratos-2026",

  // Técnicos que pueden firmar por GriBeer
  TECNICOS: ["Rubén", "Jose", "Billy"],

  EMPRESA: {
    nombre: "GRIBEER EVENTOS S.L.",
    cif: "B10628956",
    email: "info@gribeer.com",
    tel: "+34 919 930 393",
    web: "www.gribeer.com",
  },
};
