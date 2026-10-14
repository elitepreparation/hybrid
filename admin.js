(function () {
  "use strict";
  // Panel del coach: la clave se manda al Apps Script (acción "admin") y se compara allá con la
  // propiedad ADMIN_CLAVE. Acá solo se guarda en sessionStorage (se borra al cerrar la pestaña).

  var API_URL = "https://script.google.com/macros/s/AKfycby9c2jdl19l7tZBwxHG8Dpw6fz_bT_Chhc_WEydQAW1tiFPYtulxbaAk-MmYtMWlexrTw/exec";
  var KEY = "elite_admin_clave";
  var DIAS_POR_NIVEL = { OPEN: 4, PRO: 6 };
  var DIA_MS = 24 * 60 * 60 * 1000;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.from((scope || document).querySelectorAll(sel)); };

  var alumnos = [];
  var ahora = new Date();
  var abierto = null; // mail del alumno con el detalle desplegado
  var eventos = {}; // contadores por día: { "2026-10-14": { visita: 12, unirme: 3, ... } }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getClave() { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setClave(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} }

  function semanaActual() { return Math.min(4, Math.ceil(new Date().getDate() / 7)); }

  // ---- formato ----
  function fmtTiempo(seg) {
    seg = Math.round(seg || 0);
    if (seg < 60) return seg > 0 ? "< 1 min" : "—";
    var min = Math.round(seg / 60);
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  function fmtFecha(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function fechaCorta(f) {
    var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(f || ""));
    return m ? Number(m[2]) + "/" + Number(m[1]) : "";
  }

  function fechaLarga(f) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ""));
    return m ? Number(m[3]) + "/" + Number(m[2]) + "/" + m[1] : "";
  }

  function fmtDia(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function haceCuanto(iso) {
    if (!iso) return "nunca entró";
    var d = ahora - new Date(iso);
    var min = Math.floor(d / 60000);
    if (min < 1) return "recién";
    if (min < 60) return "hace " + min + " min";
    var h = Math.floor(min / 60);
    if (h < 24) return "hace " + h + " h";
    var dias = Math.floor(h / 24);
    return "hace " + dias + (dias === 1 ? " día" : " días");
  }

  function diasSinEntrar(a) { return a.ultimoIngreso ? (ahora - new Date(a.ultimoIngreso)) / DIA_MS : Infinity; }
  function diasHastaVencer(a) { return a.vencimiento ? (new Date(a.vencimiento) - ahora) / DIA_MS : -Infinity; }

  // ---- avances (salen del "log" que guarda el perfil del alumno) ----
  // claves: "hecho|semana|Día N" -> {hecho:"1"}   y   "semana|Día N|Ejercicio" -> {ok, hechoTxt, peso, ...}
  // las que empiezan con "_" son internas (por ejemplo "_mes") y no se muestran
  function resumen(reg) {
    reg = reg || {};
    var hechosPorSemana = {}, entradas = [], total = 0;
    Object.keys(reg).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = reg[k] || {};
      if (k.indexOf("hecho|") === 0) {
        if (v.hecho !== "1") return;
        var p = k.split("|");
        (hechosPorSemana[p[1]] = hechosPorSemana[p[1]] || []).push(p[2] + (v.f ? " (" + fechaCorta(v.f) + ")" : "") + (v.rpe ? " · esfuerzo " + v.rpe : ""));
        total++;
      } else if (v.ok === "1" || v.hechoTxt || (v.peso !== undefined && v.peso !== "")) {
        var q = k.split("|");
        entradas.push({ semana: q[0], dia: q[1], ejercicio: q.slice(2).join("|"), ok: v.ok === "1", txt: v.hechoTxt || "", peso: v.peso });
      }
    });
    entradas.sort(function (x, y) { return Number(x.semana) - Number(y.semana) || String(x.dia).localeCompare(String(y.dia)); });
    return { hechosPorSemana: hechosPorSemana, entradas: entradas, total: total };
  }

  function avance(a) {
    var r = resumen(a.registros);
    var esperados = DIAS_POR_NIVEL[a.nivel] || 0;
    var sem = semanaActual();
    r.esperados = esperados;
    r.semana = sem;
    r.hechosSemana = (r.hechosPorSemana[String(sem)] || []).length;
    return r;
  }

  // ---- render ----
  // días que faltan para el próximo cumpleaños (0 = hoy), o null si no cargó la fecha
  function diasParaCumple(a) {
    var f = a.perfil && a.perfil.cumple;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ""));
    if (!m) return null;
    var hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var prox = new Date(hoy.getFullYear(), Number(m[2]) - 1, Number(m[3]));
    if (prox < hoy) prox = new Date(hoy.getFullYear() + 1, Number(m[2]) - 1, Number(m[3]));
    return Math.round((prox - hoy) / DIA_MS);
  }

  // marca en la lista si el alumno ya subió el apto físico (solo para quienes ya están activos)
  function etiquetaApto(a) {
    if (!a.vencimiento) return "";
    var ok = a.perfil && a.perfil.fotoAptoUrl;
    return ok ? '<small class="admin-apto is-ok">✓ apto físico</small>' : '<small class="admin-apto">sin apto físico</small>';
  }

  function etiquetaCumple(a) {
    var d = diasParaCumple(a);
    if (d === null || d > 7) return "";
    return '<small class="admin-cumple">🎂 ' + (d === 0 ? "cumple hoy" : d === 1 ? "cumple mañana" : "cumple en " + d + " días") + '</small>';
  }

  function estadoVenc(a) {
    var d = diasHastaVencer(a);
    if (!a.vencimiento) return { cls: "is-warn", txt: "pendiente de activación" + (a.perfil && a.perfil.planInteres ? " · quiere " + a.perfil.planInteres : "") };
    if (d < 0) return { cls: "is-bad", txt: "vencido " + fmtDia(a.vencimiento) };
    if (d <= 7) return { cls: "is-warn", txt: "vence " + fmtDia(a.vencimiento) + " (" + Math.ceil(d) + " d)" };
    return { cls: "is-ok", txt: "vigente hasta " + fmtDia(a.vencimiento) };
  }

  function renderStats() {
    renderEventos();
    var activos = alumnos.filter(function (a) { return diasSinEntrar(a) <= 7; }).length;
    var vencen = alumnos.filter(function (a) { var d = diasHastaVencer(a); return d >= 0 && d <= 7; }).length;
    var nunca = alumnos.filter(function (a) { return !a.ultimoIngreso; }).length;
    var inactivos = alumnos.filter(function (a) { return diasSinEntrar(a) > 7 && a.vencimiento; }).length;
    var items = [
      ["Alumnos", alumnos.length, ""],
      ["Entraron en 7 días", activos, ""],
      ["Vencen en 7 días", vencen, "vencen"],
      ["Sin entrar hace +7 días", inactivos, "inactivos"],
      ["Por activar", alumnos.filter(function (a) { return !a.vencimiento; }).length, "pendientes"],
      ["Nunca entraron", nunca, ""]
    ];
    $("[data-admin-stats]").innerHTML = items.map(function (it) {
      var alerta = it[2] && it[1] > 0 ? " is-alerta" : "";
      return it[2]
        ? '<button type="button" class="admin-stat admin-stat--btn' + alerta + '" data-stat-filtro="' + it[2] + '"><b>' + it[1] + '</b><span>' + it[0] + '</span></button>'
        : '<div class="admin-stat"><b>' + it[1] + '</b><span>' + it[0] + '</span></div>';
    }).join("");
  }

  // visitas y conversión de los últimos 7 y 30 días (contadores anónimos del servidor)
  function renderEventos() {
    var cont = $("[data-admin-eventos]");
    if (!cont) return;
    var dias = Object.keys(eventos);
    if (!dias.length) { cont.innerHTML = '<p class="admin-muted">Todavía no hay visitas registradas. Se empiezan a contar desde que se publica la versión nueva.</p>'; return; }
    function suma(n, ev) {
      var desde = new Date(Date.now() - n * DIA_MS).toISOString().slice(0, 10);
      return dias.reduce(function (t, d) { return d >= desde ? t + (Number((eventos[d] || {})[ev]) || 0) : t; }, 0);
    }
    var filas = [["visita", "Visitas a la web"], ["plan", "Miraron un plan"], ["whatsapp", "Clics a WhatsApp"], ["unirme", "Tocaron Unirme"], ["registro", "Registros enviados"]];
    cont.innerHTML = '<p class="admin-sub">Movimiento de la web</p><table class="log-table"><thead><tr><th></th><th>Últimos 7 días</th><th>Últimos 30 días</th></tr></thead><tbody>' +
      filas.map(function (f) { return '<tr><td>' + f[1] + '</td><td>' + suma(7, f[0]) + '</td><td>' + suma(30, f[0]) + '</td></tr>'; }).join("") + '</tbody></table>';
  }

  function btnBorrar(email, alcance, texto) {
    return '<button type="button" class="admin-del" data-borrar="' + esc(alcance) + '" data-email="' + esc(email) + '">' + esc(texto) + '</button>';
  }

  function tablaEntradas(entradas) {
    if (!entradas.length) return '<p class="admin-muted">Sin ejercicios registrados.</p>';
    return '<table class="log-table"><thead><tr><th>Sem</th><th>Día</th><th>Ejercicio</th><th>Lo que hizo</th><th>Peso</th><th>✓</th></tr></thead><tbody>' +
      entradas.map(function (p) {
        return '<tr><td>' + esc(p.semana) + '</td><td>' + esc(p.dia) + '</td><td>' + esc(p.ejercicio) + '</td><td>' + esc(p.txt || "—") + '</td><td>' +
          (p.peso !== undefined && p.peso !== "" ? esc(p.peso) + ' kg' : '—') + '</td><td>' + (p.ok ? '✓' : '') + '</td></tr>';
      }).join("") + '</tbody></table>';
  }

  function detalleHTML(a) {
    var av = avance(a);
    var semanas = Object.keys(av.hechosPorSemana).sort();
    var hechos = semanas.length
      ? semanas.map(function (s) {
        return '<li><b>Semana ' + esc(s) + ':</b> ' + av.hechosPorSemana[s].map(esc).join(", ") + ' ' + btnBorrar(a.email, "semana:" + s, "Borrar semana") + '</li>';
      }).join("")
      : '<li class="admin-muted">Todavía no marcó ningún día como hecho.</li>';
    var perfil = a.perfil || {};
    var datos = [
      ["Mail", a.email], ["Apto físico", perfil.fotoAptoUrl ? "✓ Subido" : "✗ Todavía no lo subió"], ["Aceptó la privacidad", perfil.consentimiento ? fmtDia(perfil.consentimiento) : "Todavía no"], ["Plan que le interesa", perfil.planInteres], ["Fecha de nacimiento", fechaLarga(perfil.cumple)], ["Se registró el", perfil.registrado ? fmtDia(perfil.registrado) : ""], ["Ciudad", perfil.ciudad], ["WhatsApp", perfil.whatsapp], ["Objetivos", perfil.objetivos], ["Lesiones", perfil.historialLesiones], ["Patologías", perfil.patologias], ["Instagram", perfil.instagram], ["Pagó el", fmtDia(a.fechaPago)]
    ].filter(function (d) { return d[1]; }).map(function (d) { return '<li><b>' + esc(d[0]) + ':</b> ' + esc(d[1]) + '</li>'; }).join("");
    var fotos = [];
    if (perfil.fotoPerfilUrl) fotos.push('<a href="' + esc(perfil.fotoPerfilUrl) + '" target="_blank" rel="noopener">Foto de perfil</a>');
    if (perfil.fotoAptoUrl) fotos.push('<a href="' + esc(perfil.fotoAptoUrl) + '" target="_blank" rel="noopener">Apto físico</a>');

    var metas = Array.isArray(perfil.metas) ? perfil.metas : [];
    var metasHtml = metas.length
      ? "<ul>" + metas.map(function (m) { return "<li>" + (m.ok ? "✓ " : "○ ") + esc(m.t) + "</li>"; }).join("") + "</ul>"
      : "<p class=\"admin-muted\">Todavía no sumó objetivos.</p>";
    var hist = a.historial || {};
    var meses = Object.keys(hist).sort().reverse();
    var historial = meses.length
      ? meses.map(function (m) {
        var r = resumen(hist[m]);
        return '<details class="admin-hist"><summary><b>' + esc(m) + '</b> — ' + r.total + (r.total === 1 ? ' día hecho' : ' días hechos') + ', ' + r.entradas.length + ' ejercicios registrados ' +
          btnBorrar(a.email, "mes:" + m, "Borrar este mes") + '</summary>' +
          '<ul>' + Object.keys(r.hechosPorSemana).sort().map(function (s) { return '<li><b>Semana ' + esc(s) + ':</b> ' + r.hechosPorSemana[s].map(esc).join(", ") + '</li>'; }).join("") + '</ul>' +
          tablaEntradas(r.entradas) + '</details>';
      }).join("")
      : '<p class="admin-muted">Todavía no hay meses anteriores guardados.</p>';

    return '<div class="admin-detail">' +
      '<div class="admin-detail-wide">' + btnWhatsapp(a) + '</div>' +
      '<div><p class="admin-sub">Días hechos (mes en curso)</p><ul>' + hechos + '</ul></div>' +
      '<div><p class="admin-sub">Datos</p><ul>' + datos + '</ul>' + (fotos.length ? '<p>' + fotos.join(" · ") + '</p>' : '') + '</div>' +
      '<div class="admin-detail-wide"><p class="admin-sub">Objetivos del alumno</p>' + metasHtml + '</div>' +
      '<div class="admin-detail-wide"><p class="admin-sub">Ejercicios registrados (mes en curso)</p>' + tablaEntradas(av.entradas) + '</div>' +
      '<div class="admin-detail-wide"><p class="admin-sub">Historial de meses anteriores</p>' + historial + '</div>' +
      '<div class="admin-detail-wide admin-danger"><p class="admin-muted">Los registros se guardan hasta que los borres vos.</p>' +
        btnBorrar(a.email, "todo", "Borrar TODOS los registros de este alumno") + '</div></div>';
  }

  // número de WhatsApp para wa.me (si no trae código de país se asume Argentina: 54 9)
  function numeroWA(n) {
    var d = String(n || "").replace(/\D/g, "").replace(/^0+/, "");
    if (!d) return "";
    if (!/^54/.test(d)) d = "549" + d.replace(/^(\d{2,4})15/, "$1");
    return d;
  }

  // mensaje según la situación: sin activar, vencido, por vencer, inactivo o seguimiento
  function mensajeAlumno(a) {
    var nom = String(a.nombre || (a.perfil && a.perfil.nombre) || "").split(" ")[0] || "";
    var hola = "Hola" + (nom ? " " + nom : "") + ", soy Gaby de Elite Preparation. ";
    var d = diasHastaVencer(a);
    if (!a.vencimiento) return hola + "Vi que te registraste. Para darte el alta necesito el comprobante de pago. ¿Me lo enviás?";
    if (d < 0) return hola + "Tu plan venció el " + fmtDia(a.vencimiento) + ". ¿Querés renovarlo para seguir entrenando?";
    if (d <= 7) return hola + "Te recuerdo que tu plan vence el " + fmtDia(a.vencimiento) + ". ¿Lo renovamos?";
    if (diasSinEntrar(a) > 7) return hola + "Hace " + (isFinite(diasSinEntrar(a)) ? Math.floor(diasSinEntrar(a)) + " días" : "un tiempo") + " que no entrás a tu planificación. ¿Cómo venís? Si necesitás ajustar algo, avisame.";
    return hola + "¿Cómo venís con el entrenamiento?";
  }

  function btnWhatsapp(a) {
    var num = numeroWA(a.perfil && a.perfil.whatsapp);
    if (!num) return '<p class="admin-muted">Este alumno no cargó su WhatsApp.</p>';
    return '<a class="btn btn-accent admin-wa" href="https://wa.me/' + num + '?text=' + encodeURIComponent(mensajeAlumno(a)) + '" target="_blank" rel="noopener">Escribirle por WhatsApp</a>' +
      '<p class="admin-muted admin-wa-msg">' + esc(mensajeAlumno(a)) + '</p>';
  }

  function filaHTML(a) {
    var av = avance(a);
    var v = estadoVenc(a);
    var pct = av.esperados ? Math.min(100, Math.round(av.hechosSemana / av.esperados * 100)) : 0;
    var inactivo = diasSinEntrar(a) > 7;
    var prog = av.esperados
      ? av.hechosSemana + ' de ' + av.esperados + ' días <small>(sem. ' + av.semana + ')</small>'
      : av.total + ' días hechos';
    var abre = abierto === a.email;
    return '<article class="admin-row' + (abre ? ' is-open' : '') + '">' +
      '<button type="button" class="admin-row-main" data-toggle="' + esc(a.email) + '" aria-expanded="' + abre + '">' +
        '<span class="admin-cell admin-name"><strong>' + esc(a.nombre || a.email) + '</strong><small>' + esc(a.nivel || "sin nivel") + '</small>' + etiquetaCumple(a) + etiquetaApto(a) + '</span>' +
        '<span class="admin-cell"><em>Último ingreso</em><b class="' + (inactivo ? 'is-bad-txt' : '') + '">' + esc(haceCuanto(a.ultimoIngreso)) + '</b><small>' + esc(fmtFecha(a.ultimoIngreso)) + '</small></span>' +
        '<span class="admin-cell"><em>Tiempo</em><b>' + esc(fmtTiempo(a.ultimaSesionSeg)) + '</b><small>total ' + esc(fmtTiempo(a.tiempoTotalSeg)) + ' · ' + a.ingresos + (a.ingresos === 1 ? ' ingreso' : ' ingresos') + '</small></span>' +
        '<span class="admin-cell"><em>Avance</em><b>' + prog + '</b>' + (av.esperados ? '<span class="week-progress-bar"><span style="width:' + pct + '%"></span></span>' : '') + '</span>' +
        '<span class="admin-cell"><em>Plan</em><b class="admin-venc ' + v.cls + '">' + esc(v.txt) + '</b></span>' +
      '</button>' + (abre ? detalleHTML(a) : '') + '</article>';
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-stat-filtro]");
    if (!b) return;
    var sel = $("[data-admin-filter]");
    sel.value = sel.value === b.dataset.statFiltro ? "todos" : b.dataset.statFiltro;
    render();
  });

  function render() {
    renderStats();
    var q = $("[data-admin-search]").value.trim().toLowerCase();
    var filtro = $("[data-admin-filter]").value;
    var orden = $("[data-admin-sort]").value;
    var lista = alumnos.filter(function (a) {
      if (q && (a.nombre + " " + a.email).toLowerCase().indexOf(q) === -1) return false;
      if (filtro === "inactivos") return diasSinEntrar(a) > 7;
      if (filtro === "vencen") { var d = diasHastaVencer(a); return d >= 0 && d <= 7; }
      if (filtro === "vencidos") return diasHastaVencer(a) < 0;
      if (filtro === "pendientes") return !a.vencimiento;
      return true;
    });
    lista.sort(function (x, y) {
      if (orden === "nombre") return String(x.nombre).localeCompare(String(y.nombre));
      if (orden === "tiempo") return y.tiempoTotalSeg - x.tiempoTotalSeg;
      if (orden === "inactividad") return diasSinEntrar(y) - diasSinEntrar(x);
      return diasSinEntrar(x) - diasSinEntrar(y);
    });
    $("[data-admin-list]").innerHTML = lista.length ? lista.map(filaHTML).join("") : '<p class="admin-muted">No hay alumnos para mostrar.</p>';
  }

  // ---- red ----
  function pedir(clave) {
    var body = new URLSearchParams({ action: "admin", claveAdmin: clave });
    return fetch(API_URL, { method: "POST", body: body }).then(function (r) { return r.json(); });
  }

  function cargar(clave, esLogin) {
    var msg = $("[data-admin-msg]");
    if (esLogin) msg.textContent = "Verificando…";
    return pedir(clave).then(function (data) {
      if (!data || !data.ok) {
        if (esLogin) msg.textContent = (data && data.error) || "No se pudo entrar.";
        else { setClave(""); mostrarLogin(); }
        return;
      }
      setClave(clave);
      alumnos = data.alumnos || [];
      eventos = data.eventos || {};
      ahora = new Date(data.ahora || Date.now());
      $("[data-admin-updated]").textContent = "Actualizado " + ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      $("#admin-login").hidden = true;
      $("#admin-panel").hidden = false;
      render();
    }).catch(function () {
      if (esLogin) msg.textContent = "No hay conexión con el servidor.";
    });
  }

  function mostrarLogin() {
    $("#admin-panel").hidden = true;
    $("#admin-login").hidden = false;
    $("[data-admin-pass]").value = "";
  }

  function boot() {
    $("[data-admin-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      cargar($("[data-admin-pass]").value, true);
    });
    $("[data-admin-refresh]").addEventListener("click", function () { cargar(getClave(), false); });
    $("[data-admin-logout]").addEventListener("click", function () { setClave(""); alumnos = []; mostrarLogin(); });
    ["[data-admin-search]", "[data-admin-filter]", "[data-admin-sort]"].forEach(function (s) {
      $(s).addEventListener("input", render);
    });
    $("[data-admin-list]").addEventListener("click", function (e) {
      var del = e.target.closest("[data-borrar]");
      if (!del) return;
      e.stopPropagation();
      var alcance = del.dataset.borrar, email = del.dataset.email;
      var txt = alcance === "todo" ? "TODOS los registros (mes en curso e historial)"
        : alcance.indexOf("semana:") === 0 ? "los registros de la " + alcance.replace(":", " ")
        : "los registros del mes " + alcance.split(":")[1];
      if (!confirm("¿Borrar " + txt + " de " + email + "?\n\nEsto no se puede deshacer.")) return;
      del.disabled = true;
      var body = new URLSearchParams({ action: "adminBorrar", claveAdmin: getClave(), email: email, alcance: alcance });
      fetch(API_URL, { method: "POST", body: body }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) { alert("No se pudo borrar: " + ((d && d.error) || "error")); del.disabled = false; return; }
        cargar(getClave(), false);
      }).catch(function () { alert("No hay conexión con el servidor."); del.disabled = false; });
    }, true);
    $("[data-admin-list]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-toggle]");
      if (!b) return;
      abierto = abierto === b.dataset.toggle ? null : b.dataset.toggle;
      render();
    });
    var guardada = getClave();
    if (guardada) cargar(guardada, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
