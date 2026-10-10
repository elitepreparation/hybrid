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
  // claves: "hecho|semana|Día N" -> {hecho:"1"}   y   "semana|Día N|Ejercicio" -> {series,reps,peso}
  function avance(a) {
    var reg = a.registros || {};
    var hechosPorSemana = {}, pesos = [], total = 0;
    Object.keys(reg).forEach(function (k) {
      var v = reg[k] || {};
      if (k.indexOf("hecho|") === 0) {
        if (v.hecho !== "1") return;
        var p = k.split("|");
        (hechosPorSemana[p[1]] = hechosPorSemana[p[1]] || []).push(p[2]);
        total++;
      } else if (v.peso !== undefined && v.peso !== "") {
        var q = k.split("|");
        pesos.push({ semana: q[0], dia: q[1], ejercicio: q.slice(2).join("|"), series: v.series, reps: v.reps, peso: v.peso });
      }
    });
    var esperados = DIAS_POR_NIVEL[a.nivel] || 0;
    var sem = semanaActual();
    var hechosSemana = (hechosPorSemana[String(sem)] || []).length;
    return { hechosPorSemana: hechosPorSemana, pesos: pesos, total: total, esperados: esperados, hechosSemana: hechosSemana, semana: sem };
  }

  // ---- render ----
  function estadoVenc(a) {
    var d = diasHastaVencer(a);
    if (!a.vencimiento) return { cls: "is-warn", txt: "sin fecha de pago" };
    if (d < 0) return { cls: "is-bad", txt: "vencido " + fmtDia(a.vencimiento) };
    if (d <= 7) return { cls: "is-warn", txt: "vence " + fmtDia(a.vencimiento) + " (" + Math.ceil(d) + " d)" };
    return { cls: "is-ok", txt: "vigente hasta " + fmtDia(a.vencimiento) };
  }

  function renderStats() {
    var activos = alumnos.filter(function (a) { return diasSinEntrar(a) <= 7; }).length;
    var vencen = alumnos.filter(function (a) { var d = diasHastaVencer(a); return d >= 0 && d <= 7; }).length;
    var nunca = alumnos.filter(function (a) { return !a.ultimoIngreso; }).length;
    var items = [
      ["Alumnos", alumnos.length],
      ["Entraron en 7 días", activos],
      ["Vencen en 7 días", vencen],
      ["Nunca entraron", nunca]
    ];
    $("[data-admin-stats]").innerHTML = items.map(function (it) {
      return '<div class="admin-stat"><b>' + it[1] + '</b><span>' + it[0] + '</span></div>';
    }).join("");
  }

  function detalleHTML(a) {
    var av = avance(a);
    var semanas = Object.keys(av.hechosPorSemana).sort();
    var hechos = semanas.length
      ? semanas.map(function (s) { return '<li><b>Semana ' + esc(s) + ':</b> ' + av.hechosPorSemana[s].map(esc).join(", ") + '</li>'; }).join("")
      : '<li class="admin-muted">Todavía no marcó ningún día como hecho.</li>';
    var pesos = av.pesos.length
      ? '<table class="log-table"><thead><tr><th>Sem</th><th>Día</th><th>Ejercicio</th><th>Series × reps</th><th>Peso</th></tr></thead><tbody>' +
        av.pesos.sort(function (x, y) { return Number(x.semana) - Number(y.semana) || String(x.dia).localeCompare(String(y.dia)); }).map(function (p) {
          return '<tr><td>' + esc(p.semana) + '</td><td>' + esc(p.dia) + '</td><td>' + esc(p.ejercicio) + '</td><td>' + esc(p.series) + ' × ' + esc(p.reps) + '</td><td>' + esc(p.peso) + ' kg</td></tr>';
        }).join("") + '</tbody></table>'
      : '<p class="admin-muted">No cargó pesos todavía.</p>';
    var perfil = a.perfil || {};
    var datos = [
      ["Mail", a.email], ["Ciudad", perfil.ciudad], ["WhatsApp", perfil.whatsapp], ["Objetivos", perfil.objetivos], ["Lesiones", perfil.historialLesiones], ["Patologías", perfil.patologias], ["Instagram", perfil.instagram], ["Pagó el", fmtDia(a.fechaPago)]
    ].filter(function (d) { return d[1]; }).map(function (d) { return '<li><b>' + esc(d[0]) + ':</b> ' + esc(d[1]) + '</li>'; }).join("");
    var fotos = [];
    if (perfil.fotoPerfilUrl) fotos.push('<a href="' + esc(perfil.fotoPerfilUrl) + '" target="_blank" rel="noopener">Foto de perfil</a>');
    if (perfil.fotoAptoUrl) fotos.push('<a href="' + esc(perfil.fotoAptoUrl) + '" target="_blank" rel="noopener">Apto físico</a>');
    return '<div class="admin-detail">' +
      '<div><p class="admin-sub">Días hechos</p><ul>' + hechos + '</ul></div>' +
      '<div><p class="admin-sub">Datos</p><ul>' + datos + '</ul>' + (fotos.length ? '<p>' + fotos.join(" · ") + '</p>' : '') + '</div>' +
      '<div class="admin-detail-wide"><p class="admin-sub">Pesos registrados</p>' + pesos + '</div></div>';
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
        '<span class="admin-cell admin-name"><strong>' + esc(a.nombre || a.email) + '</strong><small>' + esc(a.nivel || "sin nivel") + '</small></span>' +
        '<span class="admin-cell"><em>Último ingreso</em><b class="' + (inactivo ? 'is-bad-txt' : '') + '">' + esc(haceCuanto(a.ultimoIngreso)) + '</b><small>' + esc(fmtFecha(a.ultimoIngreso)) + '</small></span>' +
        '<span class="admin-cell"><em>Tiempo</em><b>' + esc(fmtTiempo(a.ultimaSesionSeg)) + '</b><small>total ' + esc(fmtTiempo(a.tiempoTotalSeg)) + ' · ' + a.ingresos + (a.ingresos === 1 ? ' ingreso' : ' ingresos') + '</small></span>' +
        '<span class="admin-cell"><em>Avance</em><b>' + prog + '</b>' + (av.esperados ? '<span class="week-progress-bar"><span style="width:' + pct + '%"></span></span>' : '') + '</span>' +
        '<span class="admin-cell"><em>Plan</em><b class="admin-venc ' + v.cls + '">' + esc(v.txt) + '</b></span>' +
      '</button>' + (abre ? detalleHTML(a) : '') + '</article>';
  }

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
