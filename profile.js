(function () {
  "use strict";
  // ponytail: DIAS_BASE es el respaldo de muestra — se usa solo si Gaby todavía no subió
  // la planilla real "Planificacion" a la carpeta del mes/nivel en Drive.

  var API_URL = "https://script.google.com/macros/s/AKfycby9c2jdl19l7tZBwxHG8Dpw6fz_bT_Chhc_WEydQAW1tiFPYtulxbaAk-MmYtMWlexrTw/exec";

  var DIAS_BASE = {
    OPEN: [
      { dia: "Día 1", foco: "Fuerza tren superior", ejercicios: [
        { nombre: "Press banca", series: 4, reps: 8, bloque: "Potencia" }, { nombre: "Remo con barra", series: 4, reps: 8, bloque: "Potencia" },
        { nombre: "Press militar", series: 3, reps: 10, bloque: "Fuerza" }, { nombre: "Plancha", series: 3, reps: 30, bloque: "Core" }
      ]},
      { dia: "Día 2", foco: "Resistencia", ejercicios: [
        { nombre: "Bike ritmo moderado", series: 1, reps: 20 }, { nombre: "Circuito funcional", series: 3, reps: 1 }
      ]},
      { dia: "Día 3", foco: "Fuerza tren inferior", ejercicios: [
        { nombre: "Sentadilla", series: 4, reps: 8 }, { nombre: "Prensa", series: 4, reps: 10 },
        { nombre: "Zancadas", series: 3, reps: 12 }, { nombre: "Core", series: 3, reps: 30 }
      ]},
      { dia: "Día 4", foco: "Híbrido", ejercicios: [
        { nombre: "Kettlebell swings", series: 4, reps: 15 }, { nombre: "Burpees", series: 4, reps: 12 }
      ]}
    ],
    PRO: [
      { dia: "Día 1", foco: "Fuerza tren superior", ejercicios: [
        { nombre: "Press banca", series: 5, reps: 6 }, { nombre: "Remo con barra", series: 5, reps: 6 },
        { nombre: "Press militar", series: 4, reps: 8 }, { nombre: "Plancha", series: 4, reps: 45 }
      ]},
      { dia: "Día 2", foco: "Resistencia", ejercicios: [
        { nombre: "Bike series de ritmo", series: 1, reps: 30 }, { nombre: "Circuito funcional", series: 5, reps: 1 }
      ]},
      { dia: "Día 3", foco: "Fuerza tren inferior", ejercicios: [
        { nombre: "Sentadilla", series: 5, reps: 6 }, { nombre: "Prensa pesada", series: 4, reps: 10 },
        { nombre: "Peso muerto rumano", series: 4, reps: 8 }, { nombre: "Core", series: 4, reps: 45 }
      ]},
      { dia: "Día 4", foco: "Híbrido", ejercicios: [
        { nombre: "Clean & press", series: 5, reps: 5 }, { nombre: "Burpees", series: 5, reps: 15 }, { nombre: "Sprint 20m", series: 6, reps: 1 }
      ]},
      { dia: "Día 5", foco: "Fuerza cuerpo completo", ejercicios: [
        { nombre: "Peso muerto rumano", series: 4, reps: 8 }, { nombre: "Press militar", series: 4, reps: 8 }, { nombre: "Zancadas", series: 3, reps: 12 }
      ]},
      { dia: "Día 6", foco: "Resistencia + movilidad", ejercicios: [
        { nombre: "Running cambios de ritmo", series: 1, reps: 35 }, { nombre: "Movilidad general", series: 1, reps: 10 }
      ]}
    ],
    PERSONALIZADO: [] // no hay muestra genérica — el plan personalizado es siempre el real, de la hoja del alumno
  };

  var EJERCICIOS = [
    { nombre: "Press banca", grupo: "Tren superior" }, { nombre: "Remo con barra", grupo: "Tren superior" },
    { nombre: "Press militar", grupo: "Tren superior" }, { nombre: "Sentadilla", grupo: "Tren inferior" },
    { nombre: "Prensa", grupo: "Tren inferior" }, { nombre: "Zancadas", grupo: "Tren inferior" },
    { nombre: "Peso muerto rumano", grupo: "Tren inferior" }, { nombre: "Plancha", grupo: "Core" },
    { nombre: "Kettlebell swings", grupo: "Híbrido" }, { nombre: "Burpees", grupo: "Híbrido" },
    { nombre: "Clean & press", grupo: "Híbrido" }, { nombre: "Sprint 20m", grupo: "Híbrido" },
    { nombre: "Bike ritmo moderado", grupo: "Resistencia" }, { nombre: "Running ritmo suave", grupo: "Resistencia" },
    { nombre: "Circuito funcional", grupo: "Resistencia" }, { nombre: "Movilidad general", grupo: "Movilidad" }
  ];

  var KEYS = {
    profile: "complex180_profile", nivel: "complex180_nivel", log: "complex180_log",
    vencimiento: "complex180_vencimiento", email: "complex180_email", clave: "complex180_clave",
    reinicio: "complex180_reinicio", // marca que cambia cuando Gaby borra registros desde su panel
    nombreCuenta: "complex180_nombre_cuenta" // el "Nombre" que Lucas cargó en Alumnos - claves,
    // no el que el alumno completó en su perfil — es el que usa el Plan Personalizado para
    // encontrar su hoja en Drive
  };
  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.from((scope || document).querySelectorAll(sel)); };

  function getJSON(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function setJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // saca el id de archivo de un link de Drive ("/d/<id>/" o "?id=<id>")
  function driveId(url) {
    var m = /\/d\/([-\w]{20,})/.exec(url || "") || /[?&]id=([-\w]{20,})/.exec(url || "");
    return m ? m[1] : null;
  }

  // semana 1-4 del mes según el día de hoy (día 1-7 = semana 1, 8-14 = semana 2, …)
  function semanaActual() {
    return Math.min(4, Math.ceil(new Date().getDate() / 7));
  }

  function showView(id) {
    ["view-clave", "view-form", "view-dashboard"].forEach(function (v) { $("#" + v).hidden = (v !== id); });
    var conSesion = id === "view-dashboard" || (id === "view-form" && !!getJSON(KEYS.profile));
    var planilla = $("[data-planilla]");
    if (planilla) planilla.hidden = !conSesion;
    var avatarBtn = $("[data-avatar]");
    if (avatarBtn) avatarBtn.hidden = !conSesion;
    var salir = $("[data-logout]");
    if (salir) salir.hidden = (id === "view-clave");
    cerrarMenuPlanilla();
  }

  // el pago habilita los DOS planes (OPEN y PRO) por 1 mes — el vencimiento lo calcula
  // el Apps Script a partir de "Fecha de pago" y viaja en la respuesta del login
  function vigente() {
    var v = localStorage.getItem(KEYS.vencimiento);
    return !!v && new Date(v) > new Date();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // manda el perfil y/o "mis registros" al servidor para que viajen con el alumno
  // a cualquier dispositivo — usa el mail+clave guardados al loguearse.
  function guardarEnServidor(datos) {
    var email = localStorage.getItem(KEYS.email);
    var clave = localStorage.getItem(KEYS.clave);
    if (!email || !clave) return;
    var body = new URLSearchParams({ action: "guardarDatos", email: email, clave: clave });
    if (datos.perfil) body.set("perfil", JSON.stringify(datos.perfil));
    if (datos.registros) body.set("registros", JSON.stringify(datos.registros));
    fetch(API_URL, { method: "POST", body: body }).catch(function () { /* sin conexión: queda solo local por ahora */ });
  }
  var guardarRegistrosServidor = debounce(function (log) { guardarEnServidor({ registros: log }); }, 900);

  var TAMANIO_MAX_ARCHIVO = 8 * 1024 * 1024; // 8MB — límite razonable para foto/apto físico

  function leerArchivoBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // sube "Foto de perfil" o "Apto físico" — el server lo guarda en Drive > INFO ALUMNOS
  // y en el perfil (perfil.fotoPerfilUrl / perfil.fotoAptoUrl) para que quede asociado
  // al alumno para siempre, en cualquier dispositivo. Devuelve el link, o null si falló.
  function subirArchivoAlumno(campo, file) {
    var email = localStorage.getItem(KEYS.email);
    var clave = localStorage.getItem(KEYS.clave);
    if (!email || !clave) return Promise.resolve(null);
    return leerArchivoBase64(file).then(function (base64) {
      var body = new URLSearchParams({
        action: "guardarArchivo", email: email, clave: clave, campo: campo,
        nombreOriginal: file.name, tipo: file.type, base64: base64
      });
      return fetch(API_URL, { method: "POST", body: body }).then(function (r) { return r.json(); });
    }).then(function (data) { return (data && data.ok) ? data.url : null; })
      .catch(function () { return null; });
  }

  // ---- Acceso alumnos (mail + clave) — se valida contra la planilla de alumnos en Drive ----
  function initClave() {
    var form = $("[data-clave-form]");
    if (!form) return;

    var passInput = $("[data-pass-input]", form);
    var passToggle = $("[data-pass-toggle]", form);
    if (passInput && passToggle) {
      passToggle.addEventListener("click", function () {
        var visible = passInput.type === "text";
        passInput.type = visible ? "password" : "text";
        passToggle.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim();
      var clave = form.elements.clave.value.trim();
      var msg = $("[data-clave-msg]");
      var btn = form.querySelector("button[type=submit]");
      msg.textContent = "Verificando…";
      btn.disabled = true;
      fetch(API_URL + "?action=login&email=" + encodeURIComponent(email) + "&clave=" + encodeURIComponent(clave))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          btn.disabled = false;
          if (data.ok) {
            localStorage.setItem(KEYS.vencimiento, data.vencimiento);
            localStorage.setItem(KEYS.email, email);
            localStorage.setItem(KEYS.clave, clave);
            if (data.nivel === "OPEN" || data.nivel === "PRO" || data.nivel === "PERSONALIZADO") setJSON(KEYS.nivel, data.nivel);
            if (data.nombre) localStorage.setItem(KEYS.nombreCuenta, data.nombre);
            // el servidor manda el perfil/registros guardados la última vez (en cualquier dispositivo)
            if (data.perfil) setJSON(KEYS.profile, data.perfil);
            if (data.registros) setJSON(KEYS.log, data.registros);
            if (data.reinicio) localStorage.setItem(KEYS.reinicio, data.reinicio);
            if (getJSON(KEYS.profile)) { renderDashboard(); showView("view-dashboard"); }
            else { showView("view-form"); }
          } else if (data.error === "vencido") {
            msg.textContent = "Tu acceso venció. Pagá de nuevo y Gaby te lo renueva.";
          } else {
            msg.textContent = "Mail o clave incorrectos. Fijate con Gaby.";
          }
        })
        .catch(function () {
          btn.disabled = false;
          msg.textContent = "No se pudo verificar. Probá de nuevo en un rato.";
        });
    });
  }

  // ---- Planificación real (planilla de Drive) con la de muestra como respaldo ----
  var planCache = {}; // { OPEN: [ {semana, dias:[...]} , ... ] , PRO: [...] }

  function mockSemanas(nivel) {
    return [1, 2, 3, 4].map(function (n) { return { semana: n, dias: DIAS_BASE[nivel] }; });
  }

  function semanasFor(nivel) {
    var real = planCache[nivel];
    return (real && real.length) ? real : mockSemanas(nivel);
  }

  function diasDeSemana(nivel, n) {
    var semanas = semanasFor(nivel);
    var match = semanas.filter(function (s) { return s.semana === n; })[0];
    return (match || semanas[0] || { dias: [] }).dias;
  }

  // ---- Paso 1: formulario ----
  function fillForm(profile) {
    var form = $("[data-profile-form]");
    Object.keys(profile || {}).forEach(function (k) {
      var field = form.elements[k];
      if (field && field.type !== "file") field.value = profile[k];
    });
    ["fotoPerfil", "fotoApto"].forEach(function (campo) {
      var status = $('[data-file-status="' + campo + '"]', form);
      var url = profile && profile[campo + "Url"];
      if (status) status.innerHTML = url ? 'Ya subiste este archivo — <a href="' + url + '" target="_blank" rel="noopener">ver</a>' : "";
    });
  }

  function initForm() {
    var form = $("[data-profile-form]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var profile = {};
      var archivos = [];
      fd.forEach(function (v, k) {
        if (v instanceof File) { if (v.size) archivos.push({ campo: k, file: v }); }
        else profile[k] = v;
      });
      // si no se vuelve a subir un archivo, mantiene el link que ya tenía guardado
      var previo = getJSON(KEYS.profile) || {};
      ["fotoPerfilUrl", "fotoAptoUrl", "metas"].forEach(function (k) { if (previo[k]) profile[k] = previo[k]; });

      var grande = archivos.filter(function (a) { return a.file.size > TAMANIO_MAX_ARCHIVO; })[0];
      if (grande) { alert('El archivo "' + grande.file.name + '" pesa más de 8MB, subí uno más liviano.'); return; }

      var btn = form.querySelector("[data-form-submit]");
      var textoOriginal = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = archivos.length ? "Subiendo…" : "Guardando…"; }

      Promise.all(archivos.map(function (a) {
        return subirArchivoAlumno(a.campo, a.file).then(function (url) { if (url) profile[a.campo + "Url"] = url; });
      })).then(function () {
        setJSON(KEYS.profile, profile);
        guardarEnServidor({ perfil: profile });
        if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
        renderDashboard();
        marcarSeccion("plan");
        showView("view-dashboard");
      });
    });
  }

  // ---- Dashboard: toolbar ----
  // ---- Menú "Tu Planilla": Perfil / Planificación / Videos, uno debajo del otro ----
  function cerrarMenuPlanilla() {
    var menu = $("[data-planilla-menu]"), btn = $("[data-planilla-btn]");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function marcarSeccion(seccion) {
    $$("[data-ir]").forEach(function (b) {
      if (b.dataset.ir === seccion) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  function irA(seccion) {
    if (seccion === "perfil") {
      fillForm(getJSON(KEYS.profile));
      var nivel = getJSON(KEYS.nivel);
      $("[data-registros-card]").hidden = !nivel;
      if (nivel) renderRegistros(nivel);
      showView("view-form");
    } else {
      $$("[data-dash-panel]").forEach(function (p) { p.hidden = (p.dataset.dashPanel !== seccion); });
      showView("view-dashboard");
    }
    marcarSeccion(seccion);
    window.scrollTo(0, 0);
  }

  function initDashToolbar() {
    var btn = $("[data-planilla-btn]"), menu = $("[data-planilla-menu]");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var abrir = menu.hidden;
      menu.hidden = !abrir;
      btn.setAttribute("aria-expanded", String(abrir));
    });
    menu.addEventListener("click", function (e) {
      var item = e.target.closest("[data-ir]");
      if (item) irA(item.dataset.ir);
    });
    document.addEventListener("click", function (e) { if (!e.target.closest("[data-planilla]")) cerrarMenuPlanilla(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarMenuPlanilla(); });

    $("[data-toggle-monthly]").addEventListener("click", function (e) {
      var box = $("[data-monthly-view]");
      box.hidden = !box.hidden;
      e.target.textContent = box.hidden ? "Ver planificación mensual" : "Ocultar planificación mensual";
    });
    $("[data-logout]").addEventListener("click", cerrarSesion);
  }

  // borra todo lo guardado en este dispositivo (perfil, registros, mail/clave) y
  // vuelve a la pantalla de clave — así otro alumno puede entrar en el mismo celular
  // sin ver los datos del anterior.
  function cerrarSesion() {
    Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); });
    planCache = {};
    videosCache = EJERCICIOS;
    var claveForm = $("[data-clave-form]");
    if (claveForm) claveForm.reset();
    var msg = $("[data-clave-msg]");
    if (msg) msg.textContent = "";
    showView("view-clave");
  }

  // ---- helpers de render de un día (solo lectura) ----
  function diaCardReadOnly(semana, dia, log) {
    var items = dia.ejercicios.map(function (ej) {
      var saved = (log[semana + "|" + dia.dia + "|" + ej.nombre] || {});
      var peso = saved.peso ? " · " + saved.peso + "kg registrado" : "";
      var series = saved.series != null ? saved.series : ej.series;
      var reps = saved.reps != null ? saved.reps : ej.reps;
      return ej.nombre + " — " + series + "x" + reps + peso;
    }).join(" · ");
    return '<div class="log-day' + (diaHecho(log, semana, dia.dia) ? ' is-done' : '') + '"><div class="log-day-head"><h3>' + dia.dia + (diaHecho(log, semana, dia.dia) ? ' ✓' : '') + '</h3><span>' + dia.foco + '</span></div>' +
      '<p class="log-readonly">' + items + '</p></div>';
  }

  // ---- Vista semanal: semana → día, un día a la vez, con progreso ----
  var vista = { nivel: null, semana: null, dia: null };

  function hechoKey(semana, dia) { return "hecho|" + semana + "|" + dia; }
  function diaHecho(log, semana, dia) { var h = log[hechoKey(semana, dia)]; return !!(h && h.hecho === "1"); }

  // busca un video de la biblioteca cuyo nombre coincida con el del ejercicio
  function videoDe(nombre) {
    var n = String(nombre || "").trim().toLowerCase();
    if (n.length < 3) return null;
    return videosCache.filter(function (v) {
      if (!(v.id || driveId(v.url))) return false;
      var vn = String(v.nombre || "").trim().toLowerCase();
      return vn === n || (vn.length >= 4 && (n.indexOf(vn) > -1 || vn.indexOf(n) > -1));
    })[0] || null;
  }

  function exKey(semana, dia, ejercicio) { return semana + "|" + dia + "|" + ejercicio; }
  function attr(v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  function diaDetalleHTML(semana, dia, log) {
    var okCount = 0;
    function fila(ej) {
      var key = exKey(semana, dia.dia, ej.nombre);
      var saved = log[key] || {};
      var ok = saved.ok === "1";
      if (ok) okCount++;
      var v = videoDe(ej.nombre);
      var id = v && (v.id || driveId(v.url));
      return '<li class="ex-row' + (ok ? ' is-ok' : '') + '">' +
        '<span class="ex-name">' + ej.nombre +
          (id ? ' <button type="button" class="ex-video" data-play-id="' + id + '" data-play-nombre="' + attr(ej.nombre) + '">▶ Técnica</button>' : '') +
        '</span>' +
        '<span class="ex-plan" data-label="A hacer"><span><b>' + ej.series + '</b> series</span><span><b>' + ej.reps + '</b> reps</span></span>' +
        '<input type="text" class="ex-did" data-ex-did data-k="' + attr(key) + '" placeholder="ej. ' + ej.series + ' × ' + ej.reps + '" aria-label="Lo que hice en ' + attr(ej.nombre) + '" value="' + attr(saved.hechoTxt || "") + '">' +
        '<label class="ex-check" title="Marcar como hecho"><input type="checkbox" data-ex-ok data-k="' + attr(key) + '"' + (ok ? ' checked' : '') + ' aria-label="Hecho: ' + attr(ej.nombre) + '"><span aria-hidden="true"></span></label>' +
        '</li>';
    }
    // bloques (ej. "Potencia") arriba de sus ejercicios; si la planilla no trae columna "Bloque", se usa el foco del día
    var grupos = [];
    dia.ejercicios.forEach(function (ej) {
      var nombre = ej.bloque || dia.foco || "";
      var ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.nombre === nombre) ultimo.items.push(ej);
      else grupos.push({ nombre: nombre, items: [ej] });
    });
    var bloques = grupos.map(function (g) {
      return '<section class="blk">' + (g.nombre ? '<p class="blk-title">' + escHtml(g.nombre) + '</p>' : '') +
        '<ul class="ex-list">' + g.items.map(fila).join("") + '</ul></section>';
    }).join("");
    var hecho = diaHecho(log, semana, dia.dia);
    return '<div class="log-day day-card' + (hecho ? ' is-done' : '') + '">' +
      '<div class="log-day-head"><h3>' + dia.dia + '</h3></div>' +
      '<p class="ex-progress" data-ex-progress>' + okCount + ' de ' + dia.ejercicios.length + ' ejercicios hechos</p>' +
      '<div class="ex-head" aria-hidden="true"><span>Ejercicio</span><span>A hacer</span><span>Lo que hice</span><span>✓</span></div>' +
      bloques +
      '<button type="button" class="btn ' + (hecho ? 'btn-ghost' : 'btn-primary') + ' day-done" data-toggle-hecho data-semana="' + semana + '" data-dia="' + dia.dia + '">' +
      (hecho ? '✓ Día hecho — deshacer' : 'Marcar día como hecho') + '</button></div>';
  }

  function renderWeekly(nivel) {
    var log = getJSON(KEYS.log) || {};
    renderMes(nivel);
    var semanas = semanasFor(nivel);
    var hoy = semanaActual();
    if (vista.nivel !== nivel) { vista.nivel = nivel; vista.semana = hoy; vista.dia = null; }
    var dias = diasDeSemana(nivel, vista.semana);
    var panel = $("[data-week-panel]");
    if (!dias.length) { panel.hidden = true; return; }
    panel.hidden = false;

    if (!dias.some(function (d) { return d.dia === vista.dia; })) {
      var pendiente = dias.filter(function (d) { return !diaHecho(log, vista.semana, d.dia); })[0];
      vista.dia = (pendiente || dias[0]).dia;
    }

    $("[data-week-nav]").innerHTML = semanas.map(function (s) {
      var on = s.semana === vista.semana;
      return '<button type="button" role="tab" aria-selected="' + on + '" class="week-chip' + (on ? ' is-active' : '') + '" data-semana-chip="' + s.semana + '">' +
        'Semana ' + s.semana + (s.semana === hoy ? '<small>actual</small>' : '') + '</button>';
    }).join("");

    var hechos = dias.filter(function (d) { return diaHecho(log, vista.semana, d.dia); }).length;
    $("[data-week-progress]").innerHTML = '<div class="week-progress-text"><strong>' + hechos + ' de ' + dias.length + '</strong> días hechos esta semana</div>' +
      '<div class="week-progress-bar"><span style="width:' + Math.round(hechos / dias.length * 100) + '%"></span></div>';

    // 3 a 5 días: todos en una fila; más de 5: se reparten en dos filas parejas
    $("[data-day-nav]").style.setProperty("--cols", dias.length <= 5 ? dias.length : Math.ceil(dias.length / 2));
    $("[data-day-nav]").innerHTML = dias.map(function (d) {
      var on = d.dia === vista.dia, ok = diaHecho(log, vista.semana, d.dia);
      var MAX = 4;
      var resumen = d.ejercicios.slice(0, MAX).map(function (e) { return '<li>' + e.nombre + '</li>'; }).join("") +
        (d.ejercicios.length > MAX ? '<li class="day-more">+ ' + (d.ejercicios.length - MAX) + ' más</li>' : '');
      return '<button type="button" role="tab" aria-selected="' + on + '" class="day-chip' + (on ? ' is-active' : '') + (ok ? ' is-done' : '') + '" data-dia-chip="' + d.dia + '">' +
        '<span class="day-chip-head"><b>' + d.dia + '</b>' + (ok ? '<i class="day-check" aria-label="Día hecho">✓</i>' : '') + '</span>' +
        '<small class="day-foco">' + d.foco + '</small>' +
        '<ul class="day-sum">' + resumen + '</ul>' +
        '<span class="day-count">' + d.ejercicios.length + (d.ejercicios.length === 1 ? ' ejercicio' : ' ejercicios') + '</span></button>';
    }).join("");

    var dia = dias.filter(function (d) { return d.dia === vista.dia; })[0];
    $("[data-week-dias]").innerHTML = diaDetalleHTML(vista.semana, dia, log);
  }

  function initPlanNav() {
    var panel = $("[data-week-panel]");
    // "Lo que hice" y tilde por ejercicio: se guardan en el mismo registro del alumno
    function guardarEjercicio(k, campos) {
      var log = getJSON(KEYS.log) || {};
      log[k] = log[k] || {};
      Object.keys(campos).forEach(function (c) { log[k][c] = campos[c]; });
      setJSON(KEYS.log, log);
      guardarRegistrosServidor(log);
    }
    panel.addEventListener("input", function (e) {
      var inp = e.target.closest("[data-ex-did]");
      if (inp) guardarEjercicio(inp.dataset.k, { hechoTxt: inp.value });
    });
    panel.addEventListener("change", function (e) {
      var chk = e.target.closest("[data-ex-ok]");
      if (!chk) return;
      guardarEjercicio(chk.dataset.k, { ok: chk.checked ? "1" : "0" });
      var row = chk.closest(".ex-row");
      if (row) row.classList.toggle("is-ok", chk.checked);
      var card = chk.closest(".day-card");
      if (card) {
        var total = $$("[data-ex-ok]", card).length;
        var hechos = $$("[data-ex-ok]", card).filter(function (c) { return c.checked; }).length;
        $("[data-ex-progress]", card).textContent = hechos + " de " + total + " ejercicios hechos";
      }
      renderMes(getJSON(KEYS.nivel) || "OPEN");
    });
    panel.addEventListener("click", function (e) {
      var nivel = getJSON(KEYS.nivel) || "OPEN";
      var sem = e.target.closest("[data-semana-chip]");
      if (sem) { vista.semana = Number(sem.dataset.semanaChip); vista.dia = null; renderWeekly(nivel); return; }
      var dia = e.target.closest("[data-dia-chip]");
      if (dia) { vista.dia = dia.dataset.diaChip; renderWeekly(nivel); return; }
      var toggle = e.target.closest("[data-toggle-hecho]");
      if (toggle) {
        var log = getJSON(KEYS.log) || {};
        var key = hechoKey(toggle.dataset.semana, toggle.dataset.dia);
        var marcar = !diaHecho(log, toggle.dataset.semana, toggle.dataset.dia);
        log[key] = { hecho: marcar ? "1" : "0" };
        setJSON(KEYS.log, log);
        guardarRegistrosServidor(log);
        renderWeekly(nivel);
        renderMonthly(nivel);
        if (marcar) festejar();
        return;
      }
      var play = e.target.closest("[data-play-id]");
      if (play) openVideo(play.dataset.playId, play.dataset.playNombre);
    });
  }

  function renderMonthly(nivel) {
    var log = getJSON(KEYS.log) || {};
    var host = $("[data-monthly-view]");
    host.innerHTML = semanasFor(nivel).map(function (s) {
      return '<div class="week-group"><p>Semana ' + s.semana + '</p>' +
        s.dias.map(function (d) { return diaCardReadOnly(s.semana, d, log); }).join("") + '</div>';
    }).join("");
  }

  // ---- "Mis registros" (editable, dentro de Perfil — semana actual) ----
  function renderRegistros(nivel) {
    var log = getJSON(KEYS.log) || {};
    var host = $("[data-registros-dias]");
    $("[data-registros-card]").hidden = false;
    var n = semanaActual();
    host.innerHTML = diasDeSemana(nivel, n).map(function (dia) {
      var rows = dia.ejercicios.map(function (ej) {
        var key = n + "|" + dia.dia + "|" + ej.nombre;
        var saved = log[key] || {};
        return '<tr>' +
          '<td>' + ej.nombre + '</td>' +
          '<td><input type="number" min="0" data-log-input data-key="' + key + '" data-field="series" value="' + (saved.series != null ? saved.series : ej.series) + '"></td>' +
          '<td><input type="number" min="0" data-log-input data-key="' + key + '" data-field="reps" value="' + (saved.reps != null ? saved.reps : ej.reps) + '"></td>' +
          '<td><input type="number" min="0" step="0.5" data-log-input data-key="' + key + '" data-field="peso" placeholder="kg" value="' + (saved.peso != null ? saved.peso : "") + '"></td>' +
          '</tr>';
      }).join("");
      return '<div class="log-day"><div class="log-day-head"><h3>' + dia.dia + '</h3><span>' + dia.foco + '</span></div>' +
        '<table class="log-table"><thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Peso</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join("");

    $$("[data-log-input]", host).forEach(function (input) {
      input.addEventListener("input", function () {
        var log = getJSON(KEYS.log) || {};
        var key = input.dataset.key;
        log[key] = log[key] || {};
        log[key][input.dataset.field] = input.value;
        setJSON(KEYS.log, log);
        guardarRegistrosServidor(log);
      });
    });
  }

  // ---- Videos (lee la carpeta "Videos ejercicios" del Drive vía Apps Script) ----
  var videosCache = EJERCICIOS; // arranca con la lista de muestra hasta que llegue la real
  var carpetaVideoActual = null; // null = viendo las carpetas; si no, el nombre del grupo abierto

  // arma la tarjeta de un video (miniatura + nombre + grupo) — igual que antes
  function videoCard(e) {
    var id = e.id || driveId(e.url);
    var thumb = id
      ? '<span class="video-thumb"><img src="https://drive.google.com/thumbnail?id=' + id + '&sz=w480" alt="" loading="lazy"><span class="video-play">▶</span></span>'
      : '<span class="video-thumb"><span class="video-play">▶</span></span>';
    var body = '<span class="video-card-body"><strong>' + e.nombre + '</strong><small>' + e.grupo + '</small></span>';
    return id
      ? '<button type="button" class="video-card" data-play-id="' + id + '" data-play-nombre="' + e.nombre + '">' + thumb + body + '</button>'
      : '<div class="video-card">' + thumb + body + '</div>';
  }

  // quita tildes/mayúsculas para comparar nombres de carpetas ("Elongación" = "elongacion")
  function normNombre(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  // bloques que siempre aparecen en Videos, aunque todavía no tengan videos cargados
  var CATEGORIAS_FIJAS = ["Movilidad", "Elongación", "Técnica de carrera"];
  var categoriasServidor = []; // carpetas de primer nivel de "Videos ejercicios" (incluye las vacías)

  // bloque al que pertenece un video: la carpeta de primer nivel; "Movilidad Tren Superior/Inferior/Zona Media"
  // quedan dentro de "Movilidad" aunque el servidor todavía no mande la categoría
  function categoriaDe(v) {
    if (v.categoria) return v.categoria;
    return normNombre(v.grupo).indexOf("movilidad") === 0 ? "Movilidad" : v.grupo;
  }

  function listaCategorias() {
    var out = [], vistos = {};
    function agregar(n) { var k = normNombre(n); if (!k || vistos[k]) return; vistos[k] = true; out.push(n); }
    CATEGORIAS_FIJAS.forEach(agregar);
    categoriasServidor.forEach(agregar);
    videosCache.forEach(function (v) { agregar(categoriaDe(v)); });
    return out;
  }

  function videosDeCategoria(cat) {
    var k = normNombre(cat);
    return videosCache.filter(function (v) { return normNombre(categoriaDe(v)) === k; });
  }

  // agrupa por "grupo" (la carpeta de Drive), en el mismo orden en que Drive fue
  // devolviendo las carpetas
  function agruparPorCarpeta(items) {
    var grupos = [], porGrupo = {};
    items.forEach(function (e) {
      if (!porGrupo[e.grupo]) { porGrupo[e.grupo] = []; grupos.push(e.grupo); }
      porGrupo[e.grupo].push(e);
    });
    return { grupos: grupos, porGrupo: porGrupo };
  }

  // pantalla inicial: un bloque grande por categoría — hay que tocarlo para entrar y ver los videos
  function renderCarpetasVideo() {
    var list = $("[data-video-list]");
    list.className = "folder-grid";
    list.innerHTML = listaCategorias().map(function (c) {
      var cant = videosDeCategoria(c).filter(function (v) { return v.id || driveId(v.url); }).length;
      return '<button type="button" class="folder-card' + (cant ? '' : ' is-empty') + '" data-open-folder="' + c.replace(/"/g, "&quot;") + '">' +
        '<strong>' + c + '</strong><small>' + (cant ? cant + (cant === 1 ? " video" : " videos") : "Próximamente") + '</small></button>';
    }).join("");
  }

  var volverCarpetasHTML = '<button type="button" class="video-back" data-video-back>← Volver a las carpetas</button>';

  function renderVideoList(filter) {
    var f = (filter || "").toLowerCase();

    // sin búsqueda y sin carpeta abierta: mostrar las carpetas
    if (!f && !carpetaVideoActual) { renderCarpetasVideo(); return; }

    var list = $("[data-video-list]");
    list.className = "video-groups";

    // con texto en el buscador: resultados agrupados en toda la biblioteca (sale de la carpeta)
    if (f) {
      var items = videosCache.filter(function (e) {
        return e.nombre.toLowerCase().indexOf(f) > -1 || e.grupo.toLowerCase().indexOf(f) > -1;
      });
      if (!items.length) {
        list.innerHTML = volverCarpetasHTML + '<p style="color:var(--mute);">No encontramos ejercicios con ese nombre.</p>';
        return;
      }
      var agrupadoBusqueda = agruparPorCarpeta(items);
      list.innerHTML = volverCarpetasHTML + agrupadoBusqueda.grupos.map(function (g) {
        return '<div class="video-group"><p>' + g + '</p><div class="video-grid">' +
          agrupadoBusqueda.porGrupo[g].map(videoCard).join("") + '</div></div>';
      }).join("");
      return;
    }

    // adentro de un bloque: sus videos, separados por carpeta (Movilidad muestra sus 3 subcarpetas)
    var deLaCategoria = videosDeCategoria(carpetaVideoActual);
    if (!deLaCategoria.length) {
      list.innerHTML = volverCarpetasHTML + '<div class="video-group"><p>' + carpetaVideoActual + '</p><p class="quick-hint">Todavía no hay videos en este bloque.</p></div>';
      return;
    }
    var porCarpeta = agruparPorCarpeta(deLaCategoria);
    list.innerHTML = volverCarpetasHTML + porCarpeta.grupos.map(function (g) {
      return '<div class="video-group"><p>' + g + '</p><div class="video-grid">' + porCarpeta.porGrupo[g].map(videoCard).join("") + '</div></div>';
    }).join("");
  }

  function openVideo(id, nombre) {
    $("[data-video-modal-title]").textContent = nombre;
    $("[data-video-frame]").src = "https://drive.google.com/file/d/" + id + "/preview";
    $("[data-video-modal]").classList.add("is-open");
  }

  function closeVideo() {
    $("[data-video-modal]").classList.remove("is-open");
    $("[data-video-frame]").src = "about:blank"; // corta la reproducción al cerrar
  }

  function initVideos() {
    renderVideoList("");
    $("[data-video-search]").addEventListener("input", function (e) { renderVideoList(e.target.value); });

    $("[data-video-list]").addEventListener("click", function (e) {
      var card = e.target.closest("[data-play-id]");
      if (card) { openVideo(card.dataset.playId, card.dataset.playNombre); return; }
      var folder = e.target.closest("[data-open-folder]");
      if (folder) { carpetaVideoActual = folder.dataset.openFolder; renderVideoList(""); return; }
      var back = e.target.closest("[data-video-back]");
      if (back) {
        carpetaVideoActual = null;
        $("[data-video-search]").value = "";
        renderVideoList("");
      }
    });
    var modal = $("[data-video-modal]");
    $("[data-close-video]").addEventListener("click", closeVideo);
    modal.addEventListener("mousedown", function (e) { if (e.target === modal) closeVideo(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeVideo(); });

    fetch(API_URL + "?action=videos").then(function (r) { return r.json(); }).then(function (data) {
      if (data.ok && data.videos.length) {
        // las carpetas de Drive pueden terminar en " CX" (ej. "Movilidad CX"): se muestran sin ese sufijo
        var limpiar = function (n) { return String(n || "").replace(/\s+CX\s*$/i, "").trim(); };
        videosCache = data.videos.map(function (v) {
          var c = {}; Object.keys(v).forEach(function (k) { c[k] = v[k]; });
          c.grupo = limpiar(v.grupo);
          if (v.categoria) c.categoria = limpiar(v.categoria);
          return c;
        });
        categoriasServidor = (data.categorias || []).map(limpiar);
        var nv = getJSON(KEYS.nivel); if (nv && !$("#view-dashboard").hidden) renderWeekly(nv);
        renderVideoList($("[data-video-search]").value);
        renderQuickVideos();
      }
    }).catch(function () { /* sin conexión: se queda con la lista de muestra */ });
  }

  // ---- Acceso rápido: buscar un video por nombre sin salir de la planificación ----
  function renderQuickVideos() {
    var host = $("[data-quick-results]");
    if (!host) return;
    var q = ($("[data-quick-search]").value || "").trim().toLowerCase();
    var conVideo = videosCache.filter(function (v) { return v.id || driveId(v.url); });
    if (!q) {
      host.innerHTML = '<p class="quick-hint">Escribí el nombre del ejercicio para ver su técnica.</p>';
      return;
    }
    var items = conVideo.filter(function (v) {
      return String(v.nombre).toLowerCase().indexOf(q) > -1 || String(v.grupo).toLowerCase().indexOf(q) > -1;
    }).slice(0, 8);
    host.innerHTML = items.length
      ? items.map(function (v) {
        var id = v.id || driveId(v.url);
        return '<button type="button" class="quick-item" data-play-id="' + id + '" data-play-nombre="' + String(v.nombre).replace(/"/g, "&quot;") + '">' +
          '<span class="quick-play">▶</span><span><strong>' + v.nombre + '</strong><small>' + v.grupo + '</small></span></button>';
      }).join("")
      : '<p class="quick-hint">No hay videos con ese nombre.</p>';
  }

  function initQuickVideos() {
    $("[data-quick-search]").addEventListener("input", renderQuickVideos);
    $("[data-quick-results]").addEventListener("click", function (e) {
      var play = e.target.closest("[data-play-id]");
      if (play) openVideo(play.dataset.playId, play.dataset.playNombre);
    });
    renderQuickVideos();
  }

  // ---- Planificación real: archivo subido + planilla estructurada ----
  function renderPlanArchivo(nivel, archivos, mes) {
    var box = $("[data-plan-archivo]");
    if (!box) return;
    if (!archivos || !archivos.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "Tu coach subió la planificación de " + (mes || "").split(" ")[1] + ": " +
      archivos.map(function (a) { return '<a href="' + a.url + '" target="_blank" rel="noopener">' + a.nombre + '</a>'; }).join(", ");
  }

  // si hay un PDF en la carpeta del mes, lo muestra embebido en la página
  function renderPlanPdf(archivos) {
    var wrap = $("[data-plan-pdf]");
    if (!wrap) return false;
    var pdf = (archivos || []).filter(function (a) {
      return a.tipo === "application/pdf" && (a.id || driveId(a.url));
    })[0];
    if (!pdf) { wrap.hidden = true; wrap.innerHTML = ""; return false; }
    var id = pdf.id || driveId(pdf.url);
    wrap.hidden = false;
    wrap.innerHTML = '<iframe src="https://drive.google.com/file/d/' + id + '/preview" title="Planificación del mes"></iframe>';
    return true;
  }

  function fetchPlan(nivel) {
    var url = API_URL + "?action=plan&nivel=" + nivel;
    // Plan Personalizado: cada alumno tiene su propia hoja en la planilla, buscada por el
    // nombre que Lucas cargó (no hay "mes" ni "OPEN/PRO" acá)
    if (nivel === "PERSONALIZADO") url += "&nombre=" + encodeURIComponent(localStorage.getItem(KEYS.nombreCuenta) || "");
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.ok) return;
      renderPlanArchivo(nivel, data.archivos, data.mes);
      var hayPdf = renderPlanPdf(data.archivos);
      if (data.semanas && data.semanas.length) {
        planCache[nivel] = data.semanas;
        if (getJSON(KEYS.nivel) === nivel) {
          renderWeekly(nivel);
          renderMonthly(nivel);
          if (!$("#view-form").hidden) renderRegistros(nivel);
        }
      } else if (hayPdf && getJSON(KEYS.nivel) === nivel) {
        // el PDF es la planificación real del mes: no mostramos las tarjetas de muestra
        $("[data-week-panel]").hidden = true;
        var monthly = document.querySelector(".monthly-card");
        if (monthly) monthly.hidden = true;
      }
    }).catch(function () { var box = $("[data-plan-archivo]"); if (box) box.hidden = true; });
  }

  // ---- Dashboard: cada alumno tiene UN plan (OPEN, PRO o PERSONALIZADO) y solo ve ese ----
  var NIVEL_LABEL = { OPEN: "Nivel OPEN", PRO: "Nivel PRO", PERSONALIZADO: "Plan Personalizado" };

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Foto de perfil (opcional) junto al nombre; se sube desde "Perfil" en el menú Tu Planilla ----
  function renderAvatar() {
    var p = getJSON(KEYS.profile) || {};
    var img = $("[data-avatar-img]"), ini = $("[data-avatar-ini]");
    if (!img || !ini) return;
    ini.textContent = String(p.nombre || "?").trim().charAt(0).toUpperCase() || "?";
    var id = driveId(p.fotoPerfilUrl);
    var btn = $("[data-avatar]");
    if (id) {
      img.onerror = function () { img.hidden = true; ini.hidden = false; if (btn) btn.classList.add("no-foto"); };
      img.src = "https://drive.google.com/thumbnail?id=" + id + "&sz=w256";
      img.hidden = false; ini.hidden = true;
      if (btn) btn.classList.remove("no-foto");
    } else {
      img.hidden = true; ini.hidden = false;
      if (btn) btn.classList.add("no-foto");
    }
  }

  // ---- "Tu mes": días completados del mes, de la semana y ejercicios hechos ----
  function renderMes(nivel) {
    if (!$("[data-mes-dias]")) return;
    var log = getJSON(KEYS.log) || {};
    var hoy = semanaActual();
    var totalPlan = semanasFor(nivel).reduce(function (a, s) { return a + s.dias.length; }, 0);
    var diasSemana = diasDeSemana(nivel, hoy).length;
    var hechos = 0, hechosSemana = 0, ejercicios = 0;
    Object.keys(log).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = log[k] || {};
      if (k.indexOf("hecho|") === 0) {
        if (v.hecho === "1") { hechos++; if (k.split("|")[1] === String(hoy)) hechosSemana++; }
      } else if (v.ok === "1") ejercicios++;
    });
    $("[data-mes-dias]").textContent = hechos;
    $("[data-mes-dias-de]").textContent = totalPlan ? "de " + totalPlan + " días del mes" : "días completados";
    $("[data-mes-semana]").textContent = hechosSemana;
    $("[data-mes-semana-de]").textContent = diasSemana ? "de " + diasSemana + " esta semana" : "esta semana";
    $("[data-mes-ej]").textContent = ejercicios;
    $("[data-mes-bar]").style.width = (totalPlan ? Math.min(100, Math.round(hechos / totalPlan * 100)) : 0) + "%";
  }

  // ---- "Mis objetivos": el punto de partida del perfil + metas que el alumno suma y va tildando ----
  var MAX_METAS = 10;

  function metasDelPerfil() {
    var p = getJSON(KEYS.profile) || {};
    return Array.isArray(p.metas) ? p.metas : [];
  }

  function guardarMetas(metas) {
    var p = getJSON(KEYS.profile) || {};
    p.metas = metas;
    setJSON(KEYS.profile, p);
    guardarEnServidor({ perfil: p });
    renderObjetivos();
  }

  function renderObjetivos() {
    var list = $("[data-obj-list]");
    if (!list) return;
    var p = getJSON(KEYS.profile) || {};
    var ini = $("[data-obj-inicial]");
    if (p.objetivos) { ini.hidden = false; ini.innerHTML = "<b>Mi punto de partida:</b> " + escHtml(p.objetivos); }
    else ini.hidden = true;
    var metas = metasDelPerfil();
    list.innerHTML = metas.length ? metas.map(function (m, i) {
      return '<li class="obj-item' + (m.ok ? ' is-ok' : '') + '">' +
        '<label class="ex-check" title="Marcar como logrado"><input type="checkbox" data-obj-ok="' + i + '"' + (m.ok ? ' checked' : '') + ' aria-label="Logrado: ' + escHtml(m.t) + '"><span aria-hidden="true"></span></label>' +
        '<span class="obj-text">' + escHtml(m.t) + '</span>' +
        '<button type="button" class="obj-del" data-obj-del="' + i + '" aria-label="Quitar objetivo">✕</button></li>';
    }).join("") : '<li class="obj-vacio">Todavía no sumaste objetivos. Escribí el primero abajo.</li>';
  }

  // achica y recorta la foto en cuadrado (así sube rápido y queda bien en el círculo)
  function reducirImagen(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var lado = Math.min(img.width, img.height);
        var out = Math.min(max, lado);
        var c = document.createElement("canvas");
        c.width = c.height = out;
        c.getContext("2d").drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, out, out);
        c.toBlob(function (b) {
          if (!b) { reject(new Error("blob")); return; }
          resolve({ file: new File([b], "foto.jpg", { type: "image/jpeg" }), dataUrl: c.toDataURL("image/jpeg", 0.85) });
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("img")); };
      img.src = url;
    });
  }

  // el círculo de la barra: al tocarlo se elige la foto y se sube directo, sin pasar por el formulario
  function initAvatar() {
    var btn = $("[data-avatar]"), input = $("[data-avatar-file]");
    if (!btn || !input) return;
    btn.addEventListener("click", function () { if (!btn.classList.contains("is-loading")) input.click(); });
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      input.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { alert("Elegí una imagen."); return; }
      btn.classList.add("is-loading");
      reducirImagen(f, 640).then(function (res) {
        var img = $("[data-avatar-img]"), ini = $("[data-avatar-ini]");
        img.src = res.dataUrl; img.hidden = false; ini.hidden = true; btn.classList.remove("no-foto"); // vista previa inmediata
        return subirArchivoAlumno("fotoPerfil", res.file).then(function (url) {
          if (!url) throw new Error("subida");
          var p = getJSON(KEYS.profile) || {};
          p.fotoPerfilUrl = url;
          setJSON(KEYS.profile, p);
          guardarEnServidor({ perfil: p });
        });
      }).catch(function () {
        alert("No se pudo subir la foto. Probá de nuevo en un rato.");
        renderAvatar();
      }).then(function () { btn.classList.remove("is-loading"); });
    });
  }

  function initObjetivos() {
    var form = $("[data-obj-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("[data-obj-input]");
      var texto = input.value.trim().slice(0, 120);
      var metas = metasDelPerfil().slice();
      if (!texto || metas.length >= MAX_METAS) return;
      metas.push({ t: texto, ok: false });
      input.value = "";
      guardarMetas(metas);
    });
    $("[data-obj-list]").addEventListener("change", function (e) {
      var chk = e.target.closest("[data-obj-ok]");
      if (!chk) return;
      var metas = metasDelPerfil().slice();
      var i = Number(chk.dataset.objOk);
      if (metas[i]) { metas[i] = { t: metas[i].t, ok: chk.checked }; guardarMetas(metas); }
    });
    $("[data-obj-list]").addEventListener("click", function (e) {
      var del = e.target.closest("[data-obj-del]");
      if (!del) return;
      var metas = metasDelPerfil().slice();
      metas.splice(Number(del.dataset.objDel), 1);
      guardarMetas(metas);
    });
  }

  function setNivelActivo(nivel) {
    setJSON(KEYS.nivel, nivel);
    $$("[data-toggle-nivel]").forEach(function (b) { b.classList.toggle("is-active", b.dataset.toggleNivel === nivel); });
    var profile = getJSON(KEYS.profile) || {};
    $("[data-plan-nombre]").textContent = (profile.nombre || "") + " " + (profile.apellido || "");
    $("[data-plan-meta]").textContent = (NIVEL_LABEL[nivel] || nivel) + (profile.ciudad ? " · " + profile.ciudad : "");
    renderAvatar();
    renderObjetivos();
    renderWeekly(nivel);
    renderMonthly(nivel);
    $("[data-monthly-view]").hidden = true;
    $("[data-toggle-monthly]").textContent = "Ver planificación mensual";
    fetchPlan(nivel);
  }

  function initNivelToggle() {
    $$("[data-toggle-nivel]").forEach(function (btn) {
      btn.addEventListener("click", function () { setNivelActivo(btn.dataset.toggleNivel); });
    });
  }

  // ---- Seguimiento de actividad (alimenta el panel del coach): cada ingreso y el tiempo con la pantalla visible ----
  var seguimientoActivo = false;

  function postAccion(action, extra) {
    var email = localStorage.getItem(KEYS.email);
    var clave = localStorage.getItem(KEYS.clave);
    if (!email || !clave) return Promise.resolve(null);
    var body = new URLSearchParams({ action: action, email: email, clave: clave });
    Object.keys(extra || {}).forEach(function (k) { body.set(k, extra[k]); });
    return fetch(API_URL, { method: "POST", body: body, keepalive: true })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; /* sin conexión: no se registra */ });
  }

  // ---- Registros: sincronización con lo que Gaby borra desde su panel + cambio de mes ----
  function mesClave() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  // para el historial solo se guarda lo que importa (días hechos, ejercicios tildados, texto y pesos)
  function compactarRegistros(log) {
    var out = {};
    Object.keys(log).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = log[k] || {};
      if (k.indexOf("hecho|") === 0) { if (v.hecho === "1") out[k] = { hecho: "1" }; return; }
      var o = {};
      if (v.ok === "1") o.ok = "1";
      if (v.hechoTxt) o.hechoTxt = v.hechoTxt;
      if (v.peso !== undefined && v.peso !== "") o.peso = v.peso;
      if (Object.keys(o).length) out[k] = o;
    });
    return out;
  }

  // las claves de registros son semana 1-4 sin mes: al cambiar de mes se archiva el anterior
  // (queda en el panel de Gaby) y el alumno arranca el mes nuevo limpio
  function rotarMesSiHaceFalta() {
    var log = getJSON(KEYS.log) || {};
    var actual = mesClave();
    if (!log._mes) { log._mes = actual; setJSON(KEYS.log, log); return Promise.resolve(false); }
    if (log._mes === actual) return Promise.resolve(false);
    var viejo = compactarRegistros(log);
    function reiniciar() {
      var nuevo = { _mes: actual };
      setJSON(KEYS.log, nuevo);
      guardarRegistrosServidor(nuevo);
      return true;
    }
    if (!Object.keys(viejo).length) return Promise.resolve(reiniciar());
    return postAccion("archivarMes", { mes: log._mes, datos: JSON.stringify(viejo) })
      .then(function (r) { return (r && r.ok) ? reiniciar() : false; });
  }

  function sincronizarRegistros(data) {
    if (data && data.ok) {
      var local = localStorage.getItem(KEYS.reinicio) || "";
      if (data.reinicio && data.reinicio !== local) {
        setJSON(KEYS.log, data.registros || {});
        localStorage.setItem(KEYS.reinicio, data.reinicio);
      }
    }
    return rotarMesSiHaceFalta().then(function () {
      var nv = getJSON(KEYS.nivel);
      if (nv && !$("#view-dashboard").hidden) { renderWeekly(nv); renderMonthly(nv); }
    });
  }

  // ---- Festejo al completar un día: confeti y globos durante ~2 segundos ----
  function festejar() {
    var cont = document.createElement("div");
    cont.className = "festejo";
    cont.setAttribute("aria-hidden", "true");
    var html = '<div class="festejo-msg">¡Día completado!</div>';
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var colores = ["#1a5fe0", "#0b2f7a", "#f5b700", "#e63946", "#2ecc71", "#ff7a00", "#8e44ad"];
      var al = function (a, b) { return a + Math.random() * (b - a); };
      for (var i = 0; i < 46; i++) {
        html += '<i class="festejo-confeti" style="left:' + al(0, 100).toFixed(1) + '%;background:' + colores[i % colores.length] +
          ';width:' + al(6, 11).toFixed(0) + 'px;height:' + al(9, 16).toFixed(0) + 'px;--d:' + al(0, .35).toFixed(2) + 's;--t:' + al(1.3, 1.7).toFixed(2) +
          's;--r:' + al(-720, 720).toFixed(0) + 'deg"></i>';
      }
      for (var j = 0; j < 9; j++) {
        html += '<b class="festejo-globo" style="left:' + al(6, 92).toFixed(1) + '%;background:' + colores[(j + 2) % colores.length] +
          ';--d:' + al(0, .3).toFixed(2) + 's;--t:' + al(1.5, 1.8).toFixed(2) + 's"></b>';
      }
    }
    cont.innerHTML = html;
    document.body.appendChild(cont);
    setTimeout(function () { cont.remove(); }, 2200);
  }

  function iniciarSeguimiento() {
    if (seguimientoActivo) return;
    seguimientoActivo = true;
    postAccion("sesion").then(sincronizarRegistros);
    var acumulado = 0;
    var desde = document.visibilityState === "visible" ? Date.now() : null;
    function enviar() {
      if (desde) { acumulado += (Date.now() - desde) / 1000; desde = Date.now(); }
      var seg = Math.round(acumulado);
      if (seg >= 5) { acumulado -= seg; postAccion("latido", { segundos: Math.min(seg, 300) }); }
    }
    setInterval(function () { if (document.visibilityState === "visible") enviar(); }, 120000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { enviar(); desde = null; }
      else desde = Date.now();
    });
  }

  function renderDashboard() {
    var nivel = getJSON(KEYS.nivel) || "OPEN";
    // solo se ve el nivel pagado — el otro botón ni se muestra, no hay para dónde "cambiarse" gratis
    $$("[data-toggle-nivel]").forEach(function (b) { b.hidden = b.dataset.toggleNivel !== nivel; });
    $$("[data-dash-panel]").forEach(function (p) { p.hidden = (p.dataset.dashPanel !== "plan"); });
    marcarSeccion("plan");
    setNivelActivo(nivel);
    iniciarSeguimiento();
  }

  function boot() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    initClave();
    initForm();
    initDashToolbar();
    initNivelToggle();
    initPlanNav();
    initVideos();
    initQuickVideos();
    initAvatar();
    initObjetivos();

    var fab = $("[data-whatsapp-fab]");
    var brand = window.__BRAND__ || {};
    if (fab && brand.whatsapp) {
      fab.href = "https://wa.me/" + brand.whatsapp + "?text=" + encodeURIComponent(brand.whatsappText || "Hola");
    }
    var registro = $("[data-whatsapp-register]");
    if (registro && brand.whatsapp) {
      registro.href = "https://wa.me/" + brand.whatsapp + "?text=" + encodeURIComponent("Hola Gaby, quiero registrarme en Elite Preparation");
    }

    if (!vigente()) { showView("view-clave"); return; }
    if (!getJSON(KEYS.profile)) { showView("view-form"); return; }
    renderDashboard();
    showView("view-dashboard");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
