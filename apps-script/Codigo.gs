// Complex180 API — Apps Script en la cuenta de Gaby (fomiczfitness@gmail.com).
// Copia de referencia: el original vive en script.google.com, proyecto "Complex180 API".
// Si se cambia esto, hay que pegarlo en el editor y crear una implementación con "Nueva versión".
// Necesita el servicio avanzado "Drive API" (v3) habilitado para convertir Excel a Hoja de Google.

var ROOT_NAME = "Complex 180";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  var out;
  try {
    if (action === "videos") out = getVideos();
    else if (action === "plan") {
      var nivelPedido = String(e.parameter.nivel || "OPEN").toUpperCase();
      out = (nivelPedido === "PERSONALIZADO") ? getPlanPersonalizado(e.parameter.nombre) : getPlan(nivelPedido);
    }
    else if (action === "login") out = getAlumnoLogin(e.parameter.email, e.parameter.clave);
    else if (action === "stats") out = getStatsPublicas();
    else out = { ok: false, error: "accion desconocida" };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// guardarDatos/guardarArchivo: los dos casos de escritura. e.parameter viaja igual que en
// doGet cuando el POST llega form-urlencoded (así lo manda profile.js con URLSearchParams).
function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  var out;
  try {
    if (action === "guardarDatos") out = guardarDatosAlumno(e.parameter.email, e.parameter.clave, e.parameter.perfil, e.parameter.registros);
    else if (action === "guardarArchivo") out = guardarArchivoAlumno(e.parameter.email, e.parameter.clave, e.parameter.campo, e.parameter.nombreOriginal, e.parameter.tipo, e.parameter.base64);
    else if (action === "sesion") out = registrarSesion(e.parameter.email, e.parameter.clave);
    else if (action === "latido") out = registrarLatido(e.parameter.email, e.parameter.clave, e.parameter.segundos);
    else if (action === "admin") out = getAdminAlumnos(e.parameter.claveAdmin);
    else if (action === "registrar") out = registrarAlumno(e.parameter.nombre, e.parameter.email, e.parameter.perfil);
    else if (action === "archivarMes") out = archivarMes(e.parameter.email, e.parameter.clave, e.parameter.mes, e.parameter.datos);
    else if (action === "adminBorrar") out = adminBorrarRegistros(e.parameter.claveAdmin, e.parameter.email, e.parameter.alcance);
    else out = { ok: false, error: "accion desconocida" };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function rootFolder() {
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  if (!it.hasNext()) throw new Error("No existe la carpeta " + ROOT_NAME);
  return it.next();
}

function subFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

// ponytail: setSharing en cada request; si algún día hay muchos archivos y esto pesa,
// chequear getSharingAccess() antes o compartir la carpeta raíz una sola vez.
function linkShare(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
}

// junta los videos de una carpeta y, si tiene subcarpetas (como Movilidad, que Gaby
// organizó en Movilidad Tren Superior/Inferior/Zona Media), entra en cada una también
// — a cualquier profundidad. "grupo" queda con el nombre de la carpeta que contiene
// directamente al archivo, así los sub-grupos de Movilidad aparecen separados.
function listarVideos(carpeta, videos, categoria) {
  var files = carpeta.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    linkShare(f);
    videos.push({
      id: f.getId(),
      nombre: f.getName().replace(/\.[^.]+$/, ""),
      url: f.getUrl(),
      tipo: f.getMimeType(),
      grupo: carpeta.getName(),
      categoria: categoria // carpeta de primer nivel dentro de "Videos ejercicios" (Movilidad agrupa sus 3 subcarpetas)
    });
  }
  var subcarpetas = carpeta.getFolders();
  while (subcarpetas.hasNext()) {
    listarVideos(subcarpetas.next(), videos, categoria);
  }
}

function getVideos() {
  var carpeta = subFolder(rootFolder(), "Videos ejercicios");
  var videos = [], categorias = [];
  if (carpeta) {
    var grupos = carpeta.getFolders();
    while (grupos.hasNext()) {
      var g = grupos.next();
      categorias.push(g.getName()); // también las carpetas vacías, para que aparezcan como bloque
      listarVideos(g, videos, g.getName());
    }
  }
  return { ok: true, videos: videos, categorias: categorias };
}

var MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Planificaciones/OPEN y /PRO tienen UN solo archivo "Planificacion OPEN|PRO" con
// una hoja (tab) por mes (Enero..Diciembre) — no más subcarpetas por mes. Gaby edita
// la hoja del mes que corresponda, o sube un Excel con esas mismas 12 hojas.
function getPlan(nivel) {
  var vacio = { ok: true, nivel: nivel, mes: "", archivos: [], semanas: [] };
  var plan = subFolder(rootFolder(), "Planificaciones");
  var nivelFolder = plan ? subFolder(plan, nivel) : null;
  if (!nivelFolder) return vacio;

  var hoy = new Date();
  var mesNombre = MESES_ES[hoy.getMonth()];
  var mesEtiqueta = Utilities.formatDate(hoy, Session.getScriptTimeZone(), "yyyy-MM") + " " + mesNombre;

  var archivos = [], manual = null, auto = null, xlsx = null;
  var files = nivelFolder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var tipo = f.getMimeType();
    if (f.getName() === "Planificacion (auto)") { auto = f; continue; } // interna, no se lista
    linkShare(f);
    archivos.push({ id: f.getId(), nombre: f.getName(), url: f.getUrl(), tipo: tipo });
    if (tipo === MimeType.GOOGLE_SHEETS && !manual) manual = f;
    if (tipo === MimeType.MICROSOFT_EXCEL && !xlsx) xlsx = f;
  }

  // Excel subido por Gaby: se convierte una sola vez a "Planificacion (auto)" y se re-convierte si sube uno más nuevo
  if (!manual && xlsx && (!auto || xlsx.getLastUpdated() > auto.getLastUpdated())) {
    if (auto) auto.setTrashed(true);
    var creado = Drive.Files.copy(
      { name: "Planificacion (auto)", mimeType: MimeType.GOOGLE_SHEETS, parents: [nivelFolder.getId()] },
      xlsx.getId()
    );
    auto = DriveApp.getFileById(creado.id);
  }

  var libro = manual || auto;
  var semanas = [];
  if (libro) {
    try {
      var hojaMes = SpreadsheetApp.open(libro).getSheetByName(mesNombre);
      if (hojaMes) semanas = parsePlanificacion(hojaMes);
    } catch (err) { semanas = []; }
  }
  return { ok: true, nivel: nivel, mes: mesEtiqueta, archivos: archivos, semanas: semanas };
}

// columnas fijas: Semana | Dia | Foco | Ejercicio | Series | Reps (fila 1 = encabezado)
function parsePlanificacion(hoja) {
  var values = hoja.getDataRange().getValues();
  var semanas = [], porSemana = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var sem = parseInt(r[0], 10);
    var nombreEj = String(r[3] || "").trim();
    if (!sem || !nombreEj) continue;
    var diaRaw = String(r[1] || "").trim();
    var dia = /^\d+$/.test(diaRaw) ? "Día " + diaRaw : diaRaw;
    if (!porSemana[sem]) { porSemana[sem] = { semana: sem, dias: [], porDia: {} }; semanas.push(porSemana[sem]); }
    var s = porSemana[sem];
    if (!s.porDia[dia]) { s.porDia[dia] = { dia: dia, foco: String(r[2] || "").trim(), ejercicios: [] }; s.dias.push(s.porDia[dia]); }
    s.porDia[dia].ejercicios.push({ nombre: nombreEj, series: Number(r[4]) || 0, reps: Number(r[5]) || 0 });
    var bloque = String(r[6] || "").trim(); // columna G opcional: "Bloque" (ej. Potencia)
    if (bloque) s.porDia[dia].ejercicios[s.porDia[dia].ejercicios.length - 1].bloque = bloque;
  }
  semanas.forEach(function (s) { delete s.porDia; });
  return semanas;
}

// busca una hoja por nombre sin importar mayúsculas/minúsculas ni espacios de sobra —
// los nombres de alumno no siempre se tipean idénticos
function buscarHojaPorNombre(libro, nombre) {
  var buscado = String(nombre || "").trim().toLowerCase();
  if (!buscado) return null;
  var hojas = libro.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getName().trim().toLowerCase() === buscado) return hojas[i];
  }
  return null;
}

// Plan Personalizado: a diferencia de OPEN/PRO (una hoja por mes, misma para todos), acá
// hay UNA hoja por ALUMNO en Drive > Complex 180 > Planificaciones > PERSONALIZADO >
// "Planificacion Personalizada", con el nombre exacto que Lucas cargó en "Alumnos - claves"
// (columna Nombre). No devuelve "archivos" (a diferencia de getPlan) porque el archivo real
// tiene las hojas de TODOS los alumnos personalizados juntas — compartir ese link expondría
// los planes de los demás, así que el alumno solo ve los datos ya parseados de su propia hoja.
function getPlanPersonalizado(nombreAlumno) {
  var vacio = { ok: true, nivel: "PERSONALIZADO", mes: "", archivos: [], semanas: [] };
  var plan = subFolder(rootFolder(), "Planificaciones");
  var personalFolder = plan ? subFolder(plan, "PERSONALIZADO") : null;
  if (!personalFolder) return vacio;

  var archivos = personalFolder.getFilesByName("Planificacion Personalizada");
  if (!archivos.hasNext()) return vacio;

  var semanas = [];
  try {
    var libro = SpreadsheetApp.open(archivos.next());
    var hoja = buscarHojaPorNombre(libro, nombreAlumno);
    if (hoja) semanas = parsePlanificacion(hoja);
  } catch (err) { semanas = []; }
  return { ok: true, nivel: "PERSONALIZADO", mes: "", archivos: [], semanas: semanas };
}

// correr desde el editor para probar sin desplegar: Ver > Registro
function test() {
  Logger.log(JSON.stringify(getVideos()));
  Logger.log(JSON.stringify(getPlan("OPEN")));
}

var UN_MES_MS = 30 * 24 * 60 * 60 * 1000; // 30 días ≈ 1 mes de validez — sin líos de meses de 28/30/31 días

// busca la fila del alumno en "Alumnos - claves"
// (columnas Nombre | Email | Clave | Nivel | Fecha de pago | Perfil (JSON) | Registros (JSON))
// por mail+clave — lo usan getAlumnoLogin, guardarDatosAlumno y guardarArchivoAlumno, antes
// era la misma búsqueda copiada 2 veces.
// Devuelve { ok:true, hoja, fila (1-based), r (valores de la fila) } o { ok:false, error }.
function buscarFilaAlumno(email, clave) {
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  if (!archivos || !archivos.hasNext()) return { ok: false, error: "no configurado" };

  var emailNorm = String(email || "").trim().toLowerCase();
  var claveNorm = String(clave || "").trim();
  if (!emailNorm || !claveNorm) return { ok: false, error: "faltan datos" };

  var hoja = SpreadsheetApp.open(archivos.next()).getSheets()[0];
  var values = hoja.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[1] || "").trim().toLowerCase() !== emailNorm) continue;
    if (String(r[2] || "").trim() !== claveNorm) return { ok: false, error: "clave incorrecta" };
    return { ok: true, hoja: hoja, fila: i + 1, r: r };
  }
  return { ok: false, error: "mail no encontrado" };
}

// Lucas carga una fila por alumno cuando paga; esta función es lo único que lee esa planilla.
// El pago habilita LOS DOS planes por 1 mes desde "Fecha de pago" — "Nivel" ya no
// restringe el acceso, solo decide qué plan se muestra primero en el dashboard.
// Cuando el alumno vuelve a pagar, Lucas solo actualiza "Fecha de pago" y el
// vencimiento se recalcula solo, sin tocar nada más. Devuelve también el perfil y
// "mis registros" guardados la última vez (en cualquier dispositivo) para que el
// alumno no tenga que completar todo de nuevo si entra desde otro celular.
function getAlumnoLogin(email, clave) {
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;
  var r = res.r;

  var fechaPago = parseFecha(r[4]);
  if (!fechaPago) return { ok: false, error: "sin fecha de pago registrada" };
  var vencimiento = new Date(fechaPago.getTime() + UN_MES_MS);
  if (new Date() > vencimiento) return { ok: false, error: "vencido" };

  var nivel = String(r[3] || "").trim().toUpperCase();
  return {
    ok: true,
    nombre: String(r[0] || "").trim(),
    nivel: (nivel === "OPEN" || nivel === "PRO" || nivel === "PERSONALIZADO") ? nivel : "",
    vencimiento: vencimiento.toISOString(),
    perfil: parseJSONSeguro(r[5]),
    registros: parseJSONSeguro(r[6]),
    reinicio: String(r[12] || "") // COL_REINICIO (se define más abajo en el archivo)
  };
}

// "Fecha de pago" puede llegar como Date (si Sheets la detectó como fecha) o como texto.
// Si es texto "dd/mm/aaaa" hay que parsearlo a mano: new Date(string) interpreta
// mm/dd/aaaa (formato EEUU), así que con día > 12 tira Invalid Date o, peor,
// calcula una fecha equivocada sin avisar (ej. "05/08/2026" leído como 8 de mayo).
function parseFecha(valor) {
  if (valor instanceof Date && !isNaN(valor)) return valor;
  if (!valor) return null;
  var s = String(valor).trim();
  var m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(s); // dd/mm/aaaa o dd-mm-aaaa
  if (m) {
    var d1 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d1) ? null : d1;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); // aaaa-mm-dd (ISO, sin ambigüedad)
  if (m) {
    var d2 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d2) ? null : d2;
  }
  var d3 = new Date(s);
  return isNaN(d3) ? null : d3;
}

function parseJSONSeguro(valor) {
  if (!valor) return null;
  try { return JSON.parse(String(valor)); } catch (err) { return null; }
}

// guarda el perfil y/o "mis registros" del alumno en su fila de "Alumnos - claves"
// (columnas F y G) — así viajan con el mail del alumno a cualquier dispositivo.
// Solo escribe si mail+clave matchean (misma validación que el login).
function guardarDatosAlumno(email, clave, perfilJson, registrosJson) {
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;
  if (perfilJson != null) res.hoja.getRange(res.fila, 6).setValue(perfilJson);
  if (registrosJson != null) res.hoja.getRange(res.fila, 7).setValue(registrosJson);
  return { ok: true };
}

var CAMPOS_ARCHIVO = { fotoPerfil: "Foto de perfil", fotoApto: "Apto fisico" };

// guarda un archivo (foto de perfil / apto físico) que sube el alumno: valida mail+clave
// igual que el login, y lo deja en Drive > Complex 180 > INFO ALUMNOS > <carpeta del
// alumno>, una carpeta por alumno para tener todo junto. Devuelve el link del archivo —
// profile.js lo guarda en el perfil (perfil.fotoPerfilUrl / perfil.fotoAptoUrl), así queda
// asociado al alumno para siempre y viaja a cualquier dispositivo con su mail+clave, igual
// que el resto del perfil. Si el alumno vuelve a subir el mismo campo, reemplaza el archivo
// anterior en vez de acumular versiones viejas.
function guardarArchivoAlumno(email, clave, campo, nombreOriginal, tipo, base64) {
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;

  var etiqueta = CAMPOS_ARCHIVO[campo];
  if (!etiqueta) return { ok: false, error: "campo desconocido" };
  if (!base64) return { ok: false, error: "falta el archivo" };

  var nombreAlumno = String(res.r[0] || "").trim();
  var infoAlumnos = subFolder(rootFolder(), "INFO ALUMNOS") || rootFolder().createFolder("INFO ALUMNOS");
  var nombreCarpeta = (nombreAlumno ? nombreAlumno + " — " : "") + String(email).trim().toLowerCase();
  var carpeta = subFolder(infoAlumnos, nombreCarpeta) || infoAlumnos.createFolder(nombreCarpeta);

  // saca cualquier versión anterior de este mismo campo (puede tener otra extensión si
  // cambió de jpg a png entre subidas)
  var previos = carpeta.getFiles();
  while (previos.hasNext()) {
    var f = previos.next();
    if (f.getName().indexOf(etiqueta) === 0) f.setTrashed(true);
  }

  var ext = (String(nombreOriginal || "").match(/\.[^.]+$/) || [""])[0];
  var bytes = Utilities.base64Decode(String(base64));
  var blob = Utilities.newBlob(bytes, tipo || "application/octet-stream", etiqueta + ext);
  var file = carpeta.createFile(blob);
  linkShare(file);
  return { ok: true, url: file.getUrl() };
}

// correr desde el editor si hace falta (crea la planilla si no existe, o le agrega
// las columnas Perfil/Registros si ya existía de una versión anterior — idempotente,
// no pisa filas con datos). Drive > Complex 180 > Alumnos > "Alumnos - claves". No es
// pública (a diferencia de videos/planificación) porque tiene mails y claves.
function crearHojaAlumnos() {
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  if (!alumnosFolder) throw new Error('No existe la carpeta "Alumnos" dentro de Complex 180');

  var NOMBRE = "Alumnos - claves";
  var encabezados = ["Nombre", "Email", "Clave", "Nivel", "Fecha de pago", "Perfil (JSON)", "Registros (JSON)", "Fecha de vencimiento"];
  var existentes = alumnosFolder.getFilesByName(NOMBRE);
  var ss;
  if (existentes.hasNext()) {
    ss = SpreadsheetApp.open(existentes.next());
  } else {
    ss = SpreadsheetApp.create(NOMBRE);
    var file = DriveApp.getFileById(ss.getId());
    alumnosFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file); // saca la copia que Drive deja en "Mi unidad"
    ss.getSheets()[0].setName("Alumnos");
  }

  var hoja = ss.getSheets()[0];
  var actuales = hoja.getRange(1, 1, 1, encabezados.length).getValues()[0];
  var faltaAlguno = encabezados.some(function (h, i) { return actuales[i] !== h; });
  if (faltaAlguno) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight("bold");
    hoja.setFrozenRows(1);
    hoja.autoResizeColumns(1, encabezados.length);
  }

  Logger.log(ss.getUrl());
  return ss.getUrl();
}

// correr desde el editor una sola vez (idempotente). Crea Drive > Complex 180 >
// Planificaciones > PERSONALIZADO > "Planificacion Personalizada", con una hoja
// "Plantilla" de ejemplo (mismas columnas que OPEN/PRO: Semana | Dia | Foco | Ejercicio |
// Series | Reps). Para un alumno nuevo del Plan Personalizado: duplicar la hoja Plantilla
// (clic derecho en la solapa > Duplicar) y renombrar la copia con el nombre EXACTO que
// tiene en "Alumnos - claves" (columna Nombre) — así lo encuentra getPlanPersonalizado().
function crearPlanificacionPersonalizada() {
  var plan = subFolder(rootFolder(), "Planificaciones");
  if (!plan) throw new Error('No existe la carpeta "Planificaciones" dentro de Complex 180');
  var personalFolder = subFolder(plan, "PERSONALIZADO") || plan.createFolder("PERSONALIZADO");

  var NOMBRE = "Planificacion Personalizada";
  var existentes = personalFolder.getFilesByName(NOMBRE);
  var ss;
  if (existentes.hasNext()) {
    ss = SpreadsheetApp.open(existentes.next());
  } else {
    ss = SpreadsheetApp.create(NOMBRE);
    var file = DriveApp.getFileById(ss.getId());
    personalFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  var headers = ["Semana", "Dia", "Foco", "Ejercicio", "Series", "Reps"];
  var plantilla = ss.getSheetByName("Plantilla");
  if (!plantilla) {
    var primera = ss.getSheets()[0];
    plantilla = (ss.getSheets().length === 1) ? primera.setName("Plantilla") : ss.insertSheet("Plantilla");
  }
  if (String(plantilla.getRange(1, 1).getValue()) !== "Semana") {
    plantilla.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    plantilla.setFrozenRows(1);
    plantilla.getRange(2, 1, 2, headers.length).setValues([
      [1, "Día 1", "Fuerza tren superior", "Press banca", 4, 8],
      [1, "Día 2", "Resistencia", "Bike ritmo moderado", 1, 20]
    ]);
  }

  Logger.log(ss.getUrl());
  return ss.getUrl();
}

// correr desde el editor una sola vez (idempotente, se puede correr de nuevo sin romper
// nada). Agrega la columna H "Fecha de vencimiento" a "Alumnos - claves" con una fórmula
// que se completa sola para cada fila que tenga "Fecha de pago" (columna E + 30 días —
// mismo criterio que UN_MES_MS) y un semáforo de color por formato condicional: amarillo
// cuando faltan 10 días o menos, rojo cuando faltan 5 días o menos (incluye vencidos).
// Al agregar una fila nueva la columna H se completa sola, no hay que copiar nada.
function configurarVencimientos() {
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  if (!archivos || !archivos.hasNext()) throw new Error('No existe "Alumnos - claves"');
  var hoja = SpreadsheetApp.open(archivos.next()).getSheets()[0];

  var COL = 8; // H
  if (String(hoja.getRange(1, COL).getValue()) !== "Fecha de vencimiento") {
    hoja.getRange(1, COL).setValue("Fecha de vencimiento").setFontWeight("bold");
  }
  hoja.getRange(2, COL).setFormula('=ARRAYFORMULA(IF(E2:E="","",E2:E+30))');

  var filas = Math.max(hoja.getMaxRows() - 1, 1);
  var rango = hoja.getRange(2, COL, filas, 1);
  rango.setNumberFormat("dd/mm/yyyy");

  // saca reglas de formato condicional viejas de esta columna antes de agregar las nuevas,
  // para poder correr esta función de nuevo sin duplicarlas
  var reglas = hoja.getConditionalFormatRules().filter(function (r) {
    return r.getRanges().every(function (rg) { return rg.getColumn() !== COL; });
  });
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(H2<>"",H2<=TODAY()+5)')
      .setBackground("#f4c7c3")
      .setRanges([rango])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(H2<>"",H2<=TODAY()+10,H2>TODAY()+5)')
      .setBackground("#fce8b2")
      .setRanges([rango])
      .build()
  );
  hoja.setConditionalFormatRules(reglas);

  return "listo";
}

// correr desde el editor si hace falta rearmar la estructura (idempotente: no duplica
// nada si ya está armada). Deja en Planificaciones/OPEN y /PRO un solo archivo
// "Planificacion OPEN"/"Planificacion PRO" con una hoja por mes (Enero..Diciembre,
// encabezado Semana|Dia|Foco|Ejercicio|Series|Reps). Si encuentra carpetas viejas
// de meses (formato "AAAA-MM ..." con una Hoja "Planificacion" adentro), migra esos
// datos a la hoja del mes que corresponda y borra la carpeta vieja.
function reorganizarPlanificaciones() {
  var headers = ["Semana", "Dia", "Foco", "Ejercicio", "Series", "Reps"];
  ["OPEN", "PRO"].forEach(function (nivel) {
    var plan = subFolder(rootFolder(), "Planificaciones");
    var nivelFolder = plan ? subFolder(plan, nivel) : null;
    if (!nivelFolder) return;

    var nombreArchivo = "Planificacion " + nivel;
    var existentes = nivelFolder.getFilesByName(nombreArchivo);
    var ss;
    if (existentes.hasNext()) {
      ss = SpreadsheetApp.open(existentes.next());
    } else {
      ss = SpreadsheetApp.create(nombreArchivo);
      var file = DriveApp.getFileById(ss.getId());
      nivelFolder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }

    // la primera hoja que trae el archivo nuevo pasa a ser "Enero" en vez de quedar sin usar
    var hojaInicial = ss.getSheets()[0];
    if (MESES_ES.indexOf(hojaInicial.getName()) === -1) hojaInicial.setName(MESES_ES[0]);

    MESES_ES.forEach(function (mes) {
      var hoja = ss.getSheetByName(mes) || ss.insertSheet(mes);
      if (String(hoja.getRange(1, 1).getValue()) !== "Semana") {
        hoja.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
        hoja.setFrozenRows(1);
      }
    });

    // migrar las carpetas de mes viejas ("2026-08 Agosto", etc.) si quedaron de la versión anterior
    var carpetas = nivelFolder.getFolders();
    var aBorrar = [];
    while (carpetas.hasNext()) {
      var c = carpetas.next();
      var m = /^(\d{4})-(\d{2})/.exec(c.getName());
      if (!m) continue;
      var mesNombre = MESES_ES[parseInt(m[2], 10) - 1];
      if (!mesNombre) continue;

      var archivosViejos = c.getFiles();
      var origen = null;
      while (archivosViejos.hasNext()) {
        var f = archivosViejos.next();
        if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { origen = f; break; }
      }
      if (origen) {
        var valores = SpreadsheetApp.open(origen).getSheets()[0].getDataRange().getValues();
        if (valores.length > 1) {
          var destino = ss.getSheetByName(mesNombre);
          destino.getRange(2, 1, valores.length - 1, valores[0].length).setValues(valores.slice(1));
        }
      }
      aBorrar.push(c);
    }
    aBorrar.forEach(function (c) { c.setTrashed(true); });
  });
  return "listo";
}

// =============================================================
// Panel de administrador (admin.html) — solo para Gaby
// =============================================================
// Columnas nuevas en "Alumnos - claves" (la H es el vencimiento, no se toca):
//   I Último ingreso | J Tiempo total (seg) | K Ingresos | L Última sesión (seg)
// La clave del panel NO está en el código: se guarda en Configuración del proyecto >
// Propiedades de la secuencia de comandos > ADMIN_CLAVE (la define Gaby en el editor).
//   M Reinicio de registros (marca que cambia cuando Gaby borra datos desde el panel, así el celular
//     del alumno se entera y no vuelve a subir lo borrado) | N Historial de meses anteriores (JSON)
var COL_ULTIMO = 9, COL_TIEMPO = 10, COL_INGRESOS = 11, COL_ULTSESION = 12;
var COL_REINICIO = 13, COL_HISTORIAL = 14;
var MAX_CELDA = 45000; // una celda de Sheets admite 50.000 caracteres

function asegurarEncabezadosAdmin(hoja) {
  var enc = ["Último ingreso", "Tiempo total (seg)", "Ingresos", "Última sesión (seg)", "Reinicio de registros", "Historial (JSON)"];
  var actual = hoja.getRange(1, COL_ULTIMO, 1, enc.length).getValues()[0];
  for (var i = 0; i < enc.length; i++) {
    if (!actual[i]) hoja.getRange(1, COL_ULTIMO + i).setValue(enc[i]).setFontWeight("bold");
  }
}

// el alumno abrió su perfil: suma un ingreso y arranca una sesión nueva
function registrarSesion(email, clave) {
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    asegurarEncabezadosAdmin(res.hoja);
    var ingresos = Number(res.hoja.getRange(res.fila, COL_INGRESOS).getValue()) || 0;
    res.hoja.getRange(res.fila, COL_ULTIMO).setValue(new Date());
    res.hoja.getRange(res.fila, COL_INGRESOS).setValue(ingresos + 1);
    res.hoja.getRange(res.fila, COL_ULTSESION).setValue(0);
  } finally { lock.releaseLock(); }
  // devuelve los registros guardados y la marca de reinicio: si Gaby borró algo desde el panel,
  // el celular del alumno adopta esta copia en vez de volver a subir lo viejo
  return { ok: true, reinicio: String(res.r[COL_REINICIO - 1] || ""), registros: parseJSONSeguro(res.r[6]) };
}

// "latido": el perfil abierto avisa cada tanto cuántos segundos pasaron desde el aviso anterior
function registrarLatido(email, clave, segundos) {
  var seg = Math.max(0, Math.min(300, Math.round(Number(segundos) || 0)));
  if (!seg) return { ok: true };
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    asegurarEncabezadosAdmin(res.hoja);
    var total = Number(res.hoja.getRange(res.fila, COL_TIEMPO).getValue()) || 0;
    var ses = Number(res.hoja.getRange(res.fila, COL_ULTSESION).getValue()) || 0;
    res.hoja.getRange(res.fila, COL_TIEMPO).setValue(total + seg);
    res.hoja.getRange(res.fila, COL_ULTSESION).setValue(ses + seg);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function verificarAdmin(clave) {
  var esperada = PropertiesService.getScriptProperties().getProperty("ADMIN_CLAVE");
  if (!esperada) throw new Error("el panel no está configurado (falta ADMIN_CLAVE)");
  var cache = CacheService.getScriptCache();
  var fallos = Number(cache.get("admin_fallos")) || 0;
  if (fallos >= 5) throw new Error("demasiados intentos, esperá 10 minutos");
  if (String(clave || "") !== esperada) {
    cache.put("admin_fallos", String(fallos + 1), 600);
    Utilities.sleep(1000);
    throw new Error("clave incorrecta");
  }
  cache.remove("admin_fallos");
}

// devuelve a todos los alumnos con su actividad y avances. NUNCA devuelve las claves de los alumnos.
function getAdminAlumnos(claveAdmin) {
  verificarAdmin(claveAdmin);
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  if (!archivos || !archivos.hasNext()) throw new Error("no existe la planilla de alumnos");
  var values = SpreadsheetApp.open(archivos.next()).getSheets()[0].getDataRange().getValues();

  function iso(v) { var d = parseFecha(v); return d ? d.toISOString() : null; }
  var alumnos = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!String(r[1] || "").trim()) continue;
    var pago = parseFecha(r[4]);
    var nivel = String(r[3] || "").trim().toUpperCase();
    alumnos.push({
      nombre: String(r[0] || "").trim(),
      email: String(r[1] || "").trim(),
      nivel: nivel,
      fechaPago: pago ? pago.toISOString() : null,
      vencimiento: pago ? new Date(pago.getTime() + UN_MES_MS).toISOString() : null,
      ultimoIngreso: iso(r[COL_ULTIMO - 1]),
      tiempoTotalSeg: Number(r[COL_TIEMPO - 1]) || 0,
      ingresos: Number(r[COL_INGRESOS - 1]) || 0,
      ultimaSesionSeg: Number(r[COL_ULTSESION - 1]) || 0,
      perfil: parseJSONSeguro(r[5]),
      registros: parseJSONSeguro(r[6]),
      historial: parseJSONSeguro(r[COL_HISTORIAL - 1])
    });
  }
  return { ok: true, ahora: new Date().toISOString(), alumnos: alumnos };
}

// el perfil del alumno, al cambiar de mes, manda acá el mes que cierra para no mezclarlo con el nuevo.
// Queda en la columna N (por mes) hasta que Gaby lo borre desde el panel.
function archivarMes(email, clave, mes, datosJson) {
  var res = buscarFilaAlumno(email, clave);
  if (!res.ok) return res;
  var mesNorm = String(mes || "").trim();
  if (!/^\d{4}-\d{2}$/.test(mesNorm)) return { ok: false, error: "mes invalido" };
  var datos = parseJSONSeguro(datosJson);
  if (!datos) return { ok: false, error: "datos invalidos" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    asegurarEncabezadosAdmin(res.hoja);
    var celda = res.hoja.getRange(res.fila, COL_HISTORIAL);
    var hist = parseJSONSeguro(celda.getValue()) || {};
    hist[mesNorm] = datos;
    var txt = JSON.stringify(hist);
    if (txt.length > MAX_CELDA) return { ok: false, error: "historial lleno" };
    celda.setValue(txt);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

// borra registros de un alumno desde el panel.
// alcance: "todo" | "semana:N" (mes en curso) | "mes:AAAA-MM" (historial)
function adminBorrarRegistros(claveAdmin, email, alcance) {
  verificarAdmin(claveAdmin);
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  if (!archivos || !archivos.hasNext()) throw new Error("no existe la planilla de alumnos");
  var hoja = SpreadsheetApp.open(archivos.next()).getSheets()[0];
  var values = hoja.getDataRange().getValues();
  var emailNorm = String(email || "").trim().toLowerCase();
  var fila = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || "").trim().toLowerCase() === emailNorm) { fila = i + 1; break; }
  }
  if (!fila) throw new Error("alumno no encontrado");

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    asegurarEncabezadosAdmin(hoja);
    var al = String(alcance || "");
    var reg = parseJSONSeguro(hoja.getRange(fila, 7).getValue()) || {};
    var hist = parseJSONSeguro(hoja.getRange(fila, COL_HISTORIAL).getValue()) || {};
    if (al === "todo") {
      reg = {}; hist = {};
    } else if (/^semana:\d+$/.test(al)) {
      var sem = al.split(":")[1];
      Object.keys(reg).forEach(function (k) {
        if (k.charAt(0) === "_") return;
        var p = k.split("|");
        if ((p[0] === "hecho" ? p[1] : p[0]) === sem) delete reg[k];
      });
    } else if (/^mes:\d{4}-\d{2}$/.test(al)) {
      delete hist[al.split(":")[1]];
    } else {
      throw new Error("alcance invalido");
    }
    hoja.getRange(fila, 7).setValue(Object.keys(reg).length ? JSON.stringify(reg) : "");
    hoja.getRange(fila, COL_HISTORIAL).setValue(Object.keys(hist).length ? JSON.stringify(hist) : "");
    hoja.getRange(fila, COL_REINICIO).setValue(String(new Date().getTime()));
  } finally { lock.releaseLock(); }
  return { ok: true };
}

// correr una sola vez desde el editor (idempotente): crea las carpetas nuevas de videos dentro de
// Drive > Complex 180 > Videos ejercicios, si todavía no existen.
function crearCarpetasVideos() {
  var base = subFolder(rootFolder(), "Videos ejercicios");
  if (!base) throw new Error('No existe la carpeta "Videos ejercicios"');
  ["Elongación", "Técnica de carrera"].forEach(function (n) {
    if (!subFolder(base, n)) base.createFolder(n);
  });
  return "listo";
}

// dato público de la página de inicio: cuántos alumnos están activos (plan vigente: pagaron en los últimos 30 días).
// Devuelve SOLO el número (sin nombres ni mails) y lo guarda 10 minutos para no leer la planilla en cada visita.
function getStatsPublicas() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get("stats_activos");
  if (guardado) return { ok: true, alumnos: Number(guardado) };
  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  var n = 0;
  if (archivos && archivos.hasNext()) {
    var values = SpreadsheetApp.open(archivos.next()).getSheets()[0].getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (!String(values[i][1] || "").trim()) continue;
      var pago = parseFecha(values[i][4]);
      if (pago && new Date(pago.getTime() + UN_MES_MS) > new Date()) n++;
    }
  }
  cache.put("stats_activos", String(n), 600);
  return { ok: true, alumnos: n };
}

// Alta de una persona nueva desde "Ingresar > Soy nuevo": nombre + mail + los datos del formulario.
// Queda como PENDIENTE: sin clave ni fecha de pago, así que no puede entrar al plan hasta que Gaby la active
// (completando Clave, Nivel y Fecha de pago en "Alumnos - claves"). Si el mail ya existe no se toca nada.
function registrarAlumno(nombre, email, perfilJson) {
  var nom = String(nombre || "").trim().slice(0, 60);
  var mail = String(email || "").trim().toLowerCase();
  if (nom.length < 2) return { ok: false, error: "nombre invalido" };
  if (mail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return { ok: false, error: "email invalido" };
  var perfil = null;
  if (perfilJson) {
    if (String(perfilJson).length > 8000) return { ok: false, error: "datos invalidos" };
    perfil = parseJSONSeguro(perfilJson);
    if (!perfil || typeof perfil !== "object") return { ok: false, error: "datos invalidos" };
    // por seguridad no se aceptan links de archivos ni objetivos cargados desde afuera
    delete perfil.fotoPerfilUrl; delete perfil.fotoAptoUrl; delete perfil.metas;
  }
  var cache = CacheService.getScriptCache();
  var porHora = Number(cache.get("reg_hora")) || 0;
  if (porHora >= 40) return { ok: false, error: "demasiados registros, probá más tarde" };

  var alumnosFolder = subFolder(rootFolder(), "Alumnos");
  var archivos = alumnosFolder ? alumnosFolder.getFilesByName("Alumnos - claves") : null;
  if (!archivos || !archivos.hasNext()) return { ok: false, error: "no configurado" };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var hoja = SpreadsheetApp.open(archivos.next()).getSheets()[0];
    var values = hoja.getDataRange().getValues();
    var ultima = 1; // fila (1-based) del último alumno cargado
    for (var i = 1; i < values.length; i++) {
      var m = String(values[i][1] || "").trim().toLowerCase();
      if (m) ultima = i + 1;
      if (m === mail) return { ok: true, existente: true };
    }
    // se escribe en la fila siguiente al último alumno (no se usa appendRow para no pisar columnas con fórmulas)
    hoja.getRange(ultima + 1, 1, 1, 7).setValues([[nom, mail, "", "", "", perfil ? JSON.stringify(perfil) : "", ""]]);
    cache.put("reg_hora", String(porHora + 1), 3600);
    cache.remove("stats_activos");
  } finally { lock.releaseLock(); }
  return { ok: true };
}
