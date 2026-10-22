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
    plan: "complex180_plan", // última planificación recibida de cada nivel (para entrenar sin señal)
    videos: "complex180_videos", // última lista de videos recibida
    pend: "complex180_pend", // hay registros sin subir al servidor (se reintenta al volver la señal)
    hist: "complex180_hist", // meses anteriores guardados (copia del servidor)
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
    ["view-clave", "view-registro", "view-pendiente", "view-form", "view-dashboard"].forEach(function (v) { var el = $("#" + v); if (el) el.hidden = (v !== id); });
    if (id !== "view-form") { modoRegistro = null; $("#view-form").classList.remove("is-registro"); }
    var conSesion = id === "view-dashboard" || (id === "view-form" && !!getJSON(KEYS.profile));
    var planilla = $("[data-planilla]");
    if (planilla) planilla.hidden = !conSesion;
    var avatarBtn = $("[data-avatar]");
    if (avatarBtn) avatarBtn.hidden = !conSesion;
    var salir = $("[data-logout]");
    if (salir) salir.hidden = (id === "view-clave" || id === "view-registro" || id === "view-pendiente" || (id === "view-form" && !getJSON(KEYS.profile)));
    cerrarMenuPlanilla();
  }

  // registro de una persona nueva: nombre y mail primero, después el formulario; queda pendiente hasta que Gaby la active
  var modoRegistro = null;

  function mostrarPendiente(datos) {
    $("[data-pend-nombre]").textContent = datos.nombre || "bienvenido";
    var brand = window.__BRAND__ || {};
    var nom = datos.nombre || "un alumno nuevo";
    var plan = datos.plan;
    var quiero = !plan || plan === "Todavía no sé" ? "quiero información sobre los planes" : plan === "Personalizado" ? "quiero el plan Personalizado" : "quiero el plan " + plan + " de híbrido";
    var txt = "Soy " + nom + ", " + quiero + ", tengo muchas ganas de entrenar. Ya me registré en la web con el mail " + datos.email + ".";
    var link = "https://wa.me/" + (brand.whatsapp || "") + "?text=" + encodeURIComponent(txt);
    $("[data-pend-wa]").href = link;
    showView("view-pendiente");
    // abre solo el WhatsApp de Gaby con el aviso armado; el botón queda por si el celular no lo abre
    clearTimeout(mostrarPendiente.t);
    mostrarPendiente.t = setTimeout(function () { window.location.href = link; }, 2500);
    window.scrollTo(0, 0);
  }

  function enviarRegistro(profile, form) {
    var btn = form.querySelector("[data-form-submit]");
    var textoOriginal = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    profile.planInteres = modoRegistro.plan;
    var datos = { nombre: (profile.apodo || profile.nombre || modoRegistro.nombre), email: modoRegistro.email, plan: modoRegistro.plan };
    var body = new URLSearchParams({ action: "registrar", nombre: profile.nombre || modoRegistro.nombre, email: modoRegistro.email, perfil: JSON.stringify(profile) });
    fetch(API_URL, { method: "POST", body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { mostrarPendiente(datos); return; }
        alert(d && d.error === "email invalido" ? "Revisá tu email." : "No pudimos enviar tus datos. Probá de nuevo en un rato.");
      })
      .catch(function () { alert("No hay conexión. Probá de nuevo en un rato."); })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = textoOriginal; } });
  }

  // asterisco (*) en todos los campos obligatorios de los formularios de alta y de perfil
  function marcarObligatorios() {
    $$("[data-profile-form] [required], [data-registro-form] [required]").forEach(function (campo) {
      var label = campo.closest("label");
      if (!label || label.querySelector(".req") || label.classList.contains("pf-consent")) return;
      var marca = document.createElement("span");
      marca.className = "req";
      marca.setAttribute("aria-hidden", "true");
      marca.textContent = " *";
      // el texto de la pregunta y el asterisco van juntos en una sola línea (la etiqueta es una columna)
      var titulo = document.createElement("span");
      titulo.className = "lbl-t";
      var nodo = label.firstChild;
      while (nodo && nodo !== campo) { var sig = nodo.nextSibling; titulo.appendChild(nodo); nodo = sig; }
      titulo.appendChild(marca);
      label.insertBefore(titulo, campo);
    });
  }

  // dentro de la app, "Volver al inicio" y la marca de arriba llevan a la planificación (no a la página de presentación)
  function initVolverInicio() {
    $$(".nav-home, .nav-brand").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (!getJSON(KEYS.profile) || !vigente()) return; // sin sesión: sigue el link normal al inicio
        e.preventDefault();
        irA("plan");
      });
    });
  }

  function initRegistro() {
    $$("[data-ir-registro]").forEach(function (b) { b.addEventListener("click", function () { try { fetch(API_URL + "?action=evento&e=unirme", { mode: "no-cors", keepalive: true }).catch(function () {}); } catch (err) {} showView("view-registro"); window.scrollTo(0, 0); }); });
    $$("[data-ir-login]").forEach(function (b) { b.addEventListener("click", function () { showView("view-clave"); window.scrollTo(0, 0); }); });
    var form = $("[data-registro-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = form.elements.nombre.value.trim();
      var email = form.elements.email.value.trim().toLowerCase();
      var plan = form.elements.plan.value;
      var msg = $("[data-registro-msg]");
      if (nombre.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = "Revisá tu nombre y tu email."; return; }
      if (!plan) { msg.textContent = "Elegí qué plan te interesa."; return; }
      msg.textContent = "";
      var f = $("[data-profile-form]");
      f.reset();
      f.elements.nombre.value = nombre;
      if (f.elements.mail) f.elements.mail.value = email;
      $("[data-apodo]").value = "";
      showView("view-form");            // showView limpia el modo registro: se activa recién después
      modoRegistro = { nombre: nombre, email: email, plan: plan };
      $("#view-form").classList.add("is-registro");
      window.scrollTo(0, 0);
    });
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
    fetch(API_URL, { method: "POST", body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (datos.registros) { if (d && d.ok) localStorage.removeItem(KEYS.pend); else localStorage.setItem(KEYS.pend, "1"); } })
      .catch(function () { if (datos.registros) localStorage.setItem(KEYS.pend, "1"); /* sin conexión: queda en el celular y se sube después */ });
  }
  // al volver la señal (o al abrir la web) se suben los registros que quedaron en el celular
  function sincronizarPendiente() {
    if (!localStorage.getItem(KEYS.pend) || navigator.onLine === false) return;
    guardarEnServidor({ registros: getJSON(KEYS.log) || {} });
  }

  // aviso fijo cuando no hay conexión
  function initOffline() {
    var el = $("[data-offline]");
    function act() { if (el) el.hidden = navigator.onLine !== false; }
    window.addEventListener("online", function () { act(); sincronizarPendiente(); });
    window.addEventListener("offline", act);
    act();
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
      fetch(API_URL, { method: "POST", body: new URLSearchParams({ action: "login", email: email, clave: clave }) })
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
            if (data.historial) setJSON(KEYS.hist, data.historial);
            if (getJSON(KEYS.profile)) { renderDashboard(); irA("plan"); }
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
    if (form.elements.cumple && form.elements.cumple.value) form.elements.cumple.dispatchEvent(new Event("input"));
    if (form.elements.consentimiento) form.elements.consentimiento.checked = !!(profile && profile.consentimiento);
    ["fotoPerfil", "fotoApto"].forEach(function (campo) {
      var status = $('[data-file-status="' + campo + '"]', form);
      var url = profile && profile[campo + "Url"];
      if (status) status.innerHTML = url ? 'Ya subiste este archivo — <a href="' + url + '" target="_blank" rel="noopener">ver</a>' : "";
    });
  }

  function initForm() {
    var form = $("[data-profile-form]");
    // la edad sale de la fecha de nacimiento, así siempre coinciden
    var campoCumple = form.elements.cumple, campoEdad = form.elements.edad;
    function edadDe(f) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ""));
      if (!m) return "";
      var h = new Date(), e = h.getFullYear() - Number(m[1]);
      if (h.getMonth() + 1 < Number(m[2]) || (h.getMonth() + 1 === Number(m[2]) && h.getDate() < Number(m[3]))) e--;
      return e > 0 && e < 120 ? String(e) : "";
    }
    function sincEdad() { if (campoCumple && campoEdad) campoEdad.value = edadDe(campoCumple.value); }
    if (campoCumple) { campoCumple.addEventListener("input", sincEdad); campoCumple.addEventListener("change", sincEdad); }
    form.addEventListener("reset", function () { setTimeout(sincEdad, 0); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (campoCumple) { sincEdad(); if (!campoEdad.value) { alert("Revisá tu fecha de nacimiento."); return; } }
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
      if (fotoPendiente) profile.fotoPerfilUrl = fotoPendiente;
      profile.apodo = ($("[data-apodo]").value || "").trim();
      if (profile.consentimiento) profile.consentimiento = new Date().toISOString();
      else if (previo.consentimiento) profile.consentimiento = previo.consentimiento;
      // altura (cm) y peso (kg) se aceptan con coma o punto; una altura como 1,75 se entiende en metros
      var alt = parseFloat(String(profile.altura || "").replace(",", "."));
      if (alt > 0 && alt < 3) alt = alt * 100;
      if (!(alt >= 120 && alt <= 230)) { alert("Revisá la altura: escribila en centímetros, por ejemplo 175."); return; }
      profile.altura = String(Math.round(alt));
      var pes = parseFloat(String(profile.peso || "").replace(",", "."));
      if (!(pes >= 30 && pes <= 250)) { alert("Revisá el peso: escribilo en kilos, por ejemplo 72,5."); return; }
      profile.peso = String(Math.round(pes * 10) / 10);
      if (modoRegistro) { enviarRegistro(profile, form); return; }

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
        irA("plan");
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

  // ---- Historial: entrenamientos guardados (mes en curso y meses anteriores) ----
  var MESES_HIST = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function etiquetaMes(clave) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(clave || ""));
    return m ? MESES_HIST[Number(m[2]) - 1] + " " + m[1] : String(clave || "");
  }

  // agrupa un registro (mes en curso o archivado) en semanas > días > ejercicios
  function agruparHistorial(registro) {
    var semanas = {};
    function dia(s, d) {
      var sem = semanas[s] = semanas[s] || {};
      return sem[d] = sem[d] || { dia: d, hecho: false, fecha: "", rpe: "", ejercicios: [] };
    }
    Object.keys(registro || {}).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = registro[k] || {};
      var p = k.split("|");
      if (p[0] === "hecho") {
        var x = dia(p[1], p.slice(2).join("|"));
        if (v.hecho === "1") { x.hecho = true; x.fecha = v.f || ""; }
        if (v.rpe) x.rpe = v.rpe;
      } else if (v.hechoTxt || (v.peso !== undefined && v.peso !== "")) {
        dia(p[0], p[1]).ejercicios.push({ nombre: p.slice(2).join("|"), txt: v.hechoTxt || (v.peso + " kg") });
      }
    });
    return Object.keys(semanas).map(Number).sort(function (a, b) { return b - a; }).map(function (s) {
      var dias = Object.keys(semanas[s]).sort().map(function (d) { return semanas[s][d]; })
        .filter(function (d) { return d.hecho || d.ejercicios.length; });
      return { semana: s, dias: dias };
    }).filter(function (s) { return s.dias.length; });
  }

  function historialMesHTML(clave, registro, abierto) {
    var semanas = agruparHistorial(registro);
    var hechos = 0;
    semanas.forEach(function (s) { s.dias.forEach(function (d) { if (d.hecho) hechos++; }); });
    var cuerpo = semanas.length ? semanas.map(function (s) {
      return '<div class="hist-sem"><p class="hist-sem-t">Semana ' + s.semana + '</p>' + s.dias.map(function (d) {
        var cab = '<b>' + escHtml(d.dia) + '</b>' + (d.hecho ? ' <span class="hist-ok">✓ hecho' + (d.fecha ? ' · ' + fechaCorta(d.fecha) : '') + '</span>' : ' <span class="hist-parcial">en curso</span>') +
          (d.rpe ? ' <span class="hist-rpe">esfuerzo ' + escHtml(String(d.rpe)) + '/10</span>' : '');
        var ejs = d.ejercicios.length ? '<ul class="hist-ejs">' + d.ejercicios.map(function (e) {
          return '<li><span>' + escHtml(e.nombre) + '</span><em>' + escHtml(e.txt) + '</em></li>';
        }).join("") + '</ul>' : '';
        return '<div class="hist-dia">' + cab + ejs + '</div>';
      }).join("") + '</div>';
    }).join("") : '<p class="hist-vacio">Sin entrenamientos guardados este mes.</p>';
    return '<details class="hist-mes"' + (abierto ? ' open' : '') + '><summary><b>' + escHtml(etiquetaMes(clave)) + '</b><span>' +
      hechos + (hechos === 1 ? ' día hecho' : ' días hechos') + '</span></summary>' + cuerpo + '</details>';
  }

  // ---- Récords personales: la mejor marca por ejercicio (más kilos; a igualdad, más repeticiones) ----
  function numero(v) { var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; }

  // series de un registro: las cargadas en cuadritos o, en los meses archivados, las que se leen del resumen "S1 15 x 10kg"
  function seriesDeEntrada(v) {
    if (v && Array.isArray(v.sets)) return v.sets.map(function (s) { return { r: numero(s.r), k: numero(s.k) }; });
    var out = [], re = /S\d+\s+([\d.,]+|\?)\s*(?:x|-)\s*([\d.,]+)\s*kg/gi, m;
    while (v && v.hechoTxt && (m = re.exec(v.hechoTxt))) out.push({ r: numero(m[1]), k: numero(m[2]) });
    return out;
  }

  // todas las marcas guardadas: del mes en curso y de los meses archivados
  function marcasTodas(excluirKey) {
    var marcas = [];
    function recorrer(registro, etiqueta) {
      Object.keys(registro || {}).forEach(function (k) {
        if (k.charAt(0) === "_" || k.indexOf("hecho|") === 0 || k === excluirKey) return;
        var p = k.split("|");
        var ej = p.slice(2).join("|");
        var dia = (registro["hecho|" + p[0] + "|" + p[1]] || {});
        seriesDeEntrada(registro[k]).forEach(function (s) {
          if (s.k > 0) marcas.push({ ej: ej, kg: s.k, reps: s.r, cuando: dia.f ? fechaCorta(dia.f) : etiqueta });
        });
      });
    }
    var log = getJSON(KEYS.log) || {};
    recorrer(log, etiquetaMes(log._mes || mesClave()));
    var hist = getJSON(KEYS.hist) || {};
    Object.keys(hist).forEach(function (m) { recorrer(hist[m], etiquetaMes(m)); });
    return marcas;
  }

  function mejorMarca(lista) {
    return lista.reduce(function (b, m) { return !b || m.kg > b.kg || (m.kg === b.kg && m.reps > b.reps) ? m : b; }, null);
  }

  function recordsHTML() {
    var porEj = {};
    marcasTodas().forEach(function (m) { (porEj[m.ej.toLowerCase()] = porEj[m.ej.toLowerCase()] || []).push(m); });
    var mejores = Object.keys(porEj).map(function (k) { return mejorMarca(porEj[k]); })
      .sort(function (a, b) { return a.ej.localeCompare(b.ej); });
    if (!mejores.length) return '<section class="hist-records"><p class="hist-records-t">🏆 Récords personales</p><p class="hist-vacio">Cuando anotes kilos en tus ejercicios, acá aparece tu mejor marca de cada uno.</p></section>';
    return '<section class="hist-records"><p class="hist-records-t">🏆 Récords personales</p><ul class="hist-records-l">' + mejores.map(function (m) {
      return '<li><span class="hr-ej">' + escHtml(m.ej) + '</span><b>' + escHtml(String(m.kg).replace(".", ",")) + ' kg' + (m.reps ? ' × ' + m.reps : '') + '</b><em>' + escHtml(m.cuando) + '</em></li>';
    }).join("") + '</ul></section>';
  }

  // aviso cuando se supera la mejor marca anterior de un ejercicio
  var ultimoRecord = {};
  function avisarRecord(key, fila) {
    var kg = numero(fila.querySelector("[data-set-k]").value), reps = numero(fila.querySelector("[data-set-r]").value);
    if (!(kg > 0) || !(reps > 0)) return;
    var ej = key.split("|").slice(2).join("|");
    var previas = marcasTodas(key).filter(function (m) { return m.ej.toLowerCase() === ej.toLowerCase(); });
    var previo = mejorMarca(previas);
    var otrasSeries = Array.from(document.querySelectorAll('[data-sets][data-k="' + key.replace(/"/g, '\\"') + '"] [data-set-row]')).map(function (r) { return numero(r.querySelector("[data-set-k]").value); });
    if (!previo || kg <= previo.kg || kg < Math.max.apply(null, otrasSeries) || ultimoRecord[key] === kg) return;
    ultimoRecord[key] = kg;
    var t = document.createElement("div");
    t.className = "toast-record";
    t.setAttribute("role", "status");
    t.innerHTML = '🏆 <b>¡Nuevo récord!</b> ' + escHtml(ej) + ': ' + escHtml(String(kg).replace(".", ",")) + ' kg <small>(antes ' + escHtml(String(previo.kg).replace(".", ",")) + ' kg)</small>';
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("is-fuera"); setTimeout(function () { t.remove(); }, 400); }, 4200);
  }

  function renderHistorial() {
    var cont = $("[data-historial-lista]");
    if (!cont) return;
    var log = getJSON(KEYS.log) || {};
    var hist = getJSON(KEYS.hist) || {};
    var html = recordsHTML() + historialMesHTML(log._mes || mesClave(), log, true);
    Object.keys(hist).sort().reverse().forEach(function (m) { html += historialMesHTML(m, hist[m], false); });
    if (!Object.keys(hist).length) html += '<p class="hist-nota">Acá se van a ir guardando tus meses anteriores.</p>';
    cont.innerHTML = html;
  }

  function irA(seccion) {
    if (seccion === "perfil") {
      fillForm(getJSON(KEYS.profile));
      $("[data-apodo]").value = (getJSON(KEYS.profile) || {}).apodo || "";
      renderAvatar();
      showView("view-form");
    } else {
      $$("[data-dash-panel]").forEach(function (p) { p.hidden = (p.dataset.dashPanel !== seccion); });
      if (seccion === "historial") { renderHistorial(); renderMes(getJSON(KEYS.nivel) || "OPEN"); }
      showView("view-dashboard");
    }
    marcarSeccion(seccion);
    window.scrollTo(0, 0);
    // el botón "atrás" del navegador también vuelve a la planificación
    try { if (seccion !== "plan" && !(history.state && history.state.sec)) history.pushState({ sec: seccion }, ""); } catch (err) {}
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

    $("[data-logout]").addEventListener("click", cerrarSesion);
    $$("[data-volver]").forEach(function (b) { b.addEventListener("click", function () { irA("plan"); }); });
    window.addEventListener("popstate", function () {
      var enPerfil = !$("#view-form").hidden;
      var enVideos = !$("#view-dashboard").hidden && !$('[data-dash-panel="videos"]').hidden;
      if ((enPerfil || enVideos) && getJSON(KEYS.profile)) irA("plan");
    });
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
    return '<div class="log-day' + (diaHecho(log, semana, dia.dia) ? ' is-done' : '') + '"><div class="log-day-head"><h3>' + dia.dia + (diaHecho(log, semana, dia.dia) ? ' ✓' : '') + '</h3><span>' + focosDe(dia).join(" + ") + '</span></div>' +
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

  // focos que se trabajan en el día: todos los de la planilla; con un servidor viejo, el foco único
  function focosDe(dia) {
    if (dia && Array.isArray(dia.focos) && dia.focos.length) return dia.focos;
    return dia && dia.foco ? [dia.foco] : [];
  }

  // ---- "Hoy te toca": el próximo día pendiente de esta semana, a un toque ----
  function renderHoy(nivel) {
    var card = $("[data-hoy-card]");
    if (!card) return;
    var log = getJSON(KEYS.log) || {};
    var hoy = semanaActual();
    var dias = diasDeSemana(nivel, hoy);
    if (!dias.length) { card.hidden = true; return; }
    var pendiente = dias.filter(function (d) { return !diaHecho(log, hoy, d.dia); })[0];
    card.hidden = false;
    card.classList.toggle("is-completa", !pendiente);
    $("[data-hoy-kicker]").textContent = pendiente ? "Hoy te toca" : "Semana " + hoy;
    if (pendiente) {
      $("[data-hoy-titulo]").textContent = pendiente.dia;
      $("[data-hoy-focos]").textContent = focosDe(pendiente).join(" · ");
      $("[data-hoy-meta]").textContent = "";
    } else {
      $("[data-hoy-titulo]").textContent = "¡Semana completa!";
      $("[data-hoy-focos]").textContent = "";
      $("[data-hoy-meta]").textContent = "Hiciste los " + dias.length + " días de esta semana. Descansá y a seguir con la próxima.";
    }
  }

  // link de WhatsApp para consultarle a Gaby sobre un día puntual
  function waConsultaDia(semana, dia) {
    var brand = window.__BRAND__ || {};
    var p = getJSON(KEYS.profile) || {};
    var txt = "Hola Gaby, soy " + (nombreVisible(p) || "alumno") + ". Tengo una consulta sobre el " + dia.dia + (focosDe(dia).length ? " (" + focosDe(dia).join(" + ") + ")" : "") + " de la semana " + semana + ".";
    return "https://wa.me/" + (brand.whatsapp || "") + "?text=" + encodeURIComponent(txt);
  }

  // ---- "Lo que hice": un cuadrito para repeticiones y otro para kilos por cada serie, con botón para sumar series ----
  function setRowHTML(n, s, quitable, prev, unica) {
    s = s || {};
    prev = prev || {};
    return '<div class="set-row' + (unica ? ' set-row--unica' : '') + '" data-set-row>' + '<span class="set-n">' + (unica ? "" : n) + '</span>' +
      '<input type="text" inputmode="decimal" maxlength="5" class="set-in" data-set-r placeholder="' + attr(prev.r || "reps") + '" aria-label="Repeticiones' + (unica ? '' : ' de la serie ' + n) + '" value="' + attr(s.r || "") + '">' +
      '<span class="set-x" aria-hidden="true">-</span>' +
      '<input type="text" inputmode="decimal" maxlength="5" class="set-in" data-set-k placeholder="' + attr(prev.k || "kg") + '" aria-label="Kilos' + (unica ? '' : ' de la serie ' + n) + '" value="' + attr(s.k || "") + '">' +
      (quitable ? '<button type="button" class="set-del" data-set-del aria-label="Quitar la serie ' + n + '">&times;</button>' : '') + '</div>';
  }

  // lo que anotó el alumno la última vez en este mismo ejercicio (semana anterior; si no hay, meses archivados)
  function previoEjercicio(semana, dia, ejercicio, log) {
    for (var s = Number(semana) - 1; s >= 1; s--) {
      var v = (log || {})[exKey(s, dia, ejercicio)];
      if (v && ((Array.isArray(v.sets) && v.sets.some(function (x) { return x.r || x.k; })) || v.hechoTxt)) return v;
    }
    var hist = getJSON(KEYS.hist) || {};
    var meses = Object.keys(hist).sort().reverse();
    for (var m = 0; m < meses.length; m++) {
      for (var w = 4; w >= 1; w--) {
        var h = hist[meses[m]][exKey(w, dia, ejercicio)];
        if (h && h.hechoTxt) return h;
      }
    }
    return null;
  }

  function resumenPrevio(p) {
    if (!p) return "";
    if (Array.isArray(p.sets) && p.sets.some(function (x) { return x.r || x.k; })) {
      return p.sets.map(function (x, i) {
        if (!x.r && !x.k) return "";
        return "S" + (i + 1) + " " + (x.r || "?") + (x.k ? " - " + x.k + "kg" : "");
      }).filter(Boolean).join(" · ");
    }
    return p.hechoTxt || "";
  }

  // serie de aproximación (opcional, solo si la planilla la indica): una fila "A" arriba de las series
  function aprRowHTML(a) {
    a = a || {};
    return '<div class="set-row set-row--apr" data-apr-row><span class="set-n set-n--apr" title="Serie de aproximación">A</span>' +
      '<input type="text" inputmode="decimal" maxlength="5" class="set-in" data-apr-r placeholder="reps" aria-label="Repeticiones de la serie de aproximación" value="' + attr(a.r || "") + '">' +
      '<span class="set-x" aria-hidden="true">-</span>' +
      '<input type="text" inputmode="decimal" maxlength="5" class="set-in" data-apr-k placeholder="kg" aria-label="Kilos de la serie de aproximación" value="' + attr(a.k || "") + '"></div>';
  }

  // Si todas las series fueron iguales se carga una sola fila (reps y kilos); si no, una fila por serie.
  function setsInterior(iguales, sets, plan, n, psets, apr) {
    var html = apr ? aprRowHTML(apr) : "";
    if (iguales) {
      html += setRowHTML(1, sets && sets[0], false, psets[0], true);
    } else {
      for (var i = 0; i < n; i++) html += setRowHTML(i + 1, sets ? sets[i] : null, i >= plan, psets[i], false);
      html += '<button type="button" class="set-add" data-set-add>+ serie</button>';
    }
    if (n > 1) html += '<label class="set-igual"><input type="checkbox" data-set-igual' + (iguales ? ' checked' : '') + '><span>Todas iguales</span></label>';
    return html;
  }

  function setsHTML(key, ej, saved, previo) {
    var guardadas = Array.isArray(saved.sets) && saved.sets.length ? saved.sets : null;
    var plan = Math.max(1, Math.min(10, Number(ej.series) || 1));
    var n = guardadas ? guardadas.length : plan;
    // "Todas iguales" nunca viene tildada de entrada: solo queda así si el alumno la eligió (y sigue siendo cierto)
    var iguales = n > 1 && !!saved.igual && !!guardadas && guardadas.every(function (s) { return s.r === guardadas[0].r && s.k === guardadas[0].k; });
    var psets = previo && Array.isArray(previo.sets) ? previo.sets.slice(0, 10) : [];
    var tieneApr = !!ej.aprox;
    return '<div class="ex-sets-box" data-sets data-k="' + attr(key) + '" data-plan="' + plan + '" data-n="' + n + '" data-prev="' + attr(JSON.stringify(psets)) + '"' + (tieneApr ? ' data-apr="1"' : '') + '>' +
      setsInterior(iguales, guardadas, plan, n, psets, tieneApr ? (saved.apr || {}) : null) + '</div>';
  }

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
        '<span class="ex-plan" data-label="Realizar"><span class="ex-sr"><span><b>' + ej.series + '</b> series</span>' + (ej.repsTxt ? '<span><b>' + escHtml(ej.repsTxt) + '</b></span>' : '<span><b>' + ej.reps + '</b> reps</span>') + '</span>' + (ej.carga ? '<span class="ex-carga"><b>' + ej.carga + '</b></span>' : '') + (ej.aprox ? '<span class="ex-desc">Aproximación ' + escHtml(ej.aprox) + '</span>' : '') + (ej.descanso ? '<span class="ex-desc">Descanso ' + escHtml(ej.descanso) + '</span>' : '') + '</span>' +
        setsHTML(key, ej, saved, previoEjercicio(semana, dia.dia, ej.nombre, log)) +
        '</li>';
    }
    // Movilidad: las filas de la planilla con Bloque "Movilidad" van en un bloque propio, al principio del día
    function esMov(ej) { return /^movilidad/i.test(String(ej.bloque || "").trim()); }
    var movs = dia.ejercicios.filter(esMov);
    var resto = dia.ejercicios.filter(function (ej) { return !esMov(ej); });
    function filaMov(ej) {
      var v = videoDe(ej.nombre);
      var id = v && (v.id || driveId(v.url));
      var dosis = [ej.series && (ej.repsTxt || ej.reps) ? ej.series + " x " + (ej.repsTxt || ej.reps) : (ej.repsTxt || ""), ej.carga || "", ej.descanso ? "descanso " + ej.descanso : ""].filter(Boolean).join(" · ");
      return '<li class="ex-row ex-row--mov"><span class="ex-mov-txt"><span class="ex-name">' + ej.nombre + '</span>' +
        (dosis ? '<span class="ex-dosis">' + escHtml(dosis) + '</span>' : '') + '</span>' +
        (id ? '<button type="button" class="ex-video" data-play-id="' + id + '" data-play-nombre="' + attr(ej.nombre) + '">▶ Técnica</button>' : '') + '</li>';
    }
    var movHtml = movs.length ? '<section class="blk blk--mov"><p class="blk-title">Movilidad</p><ul class="ex-list">' + movs.map(filaMov).join("") + '</ul></section>' : "";
    // bloques (ej. "Potencia") arriba de sus ejercicios; si la planilla no trae columna "Bloque", se usa el foco del día
    var grupos = [];
    resto.forEach(function (ej) {
      var nombre = ej.bloque || ej.foco || dia.foco || "";
      var ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.nombre === nombre) ultimo.items.push(ej);
      else grupos.push({ nombre: nombre, items: [ej] });
    });
    var bloques = grupos.map(function (g) {
      return '<section class="blk">' + (g.nombre ? '<p class="blk-title">' + escHtml(g.nombre) + '</p>' : '') +
        '<ul class="ex-list">' + g.items.map(fila).join("") + '</ul></section>';
    }).join("");
    var rpeActual = Number((log[hechoKey(semana, dia.dia)] || {}).rpe) || 0;
    var rpeHtml = '<div class="rpe" role="group" aria-label="Esfuerzo del día">' +
      '<p class="rpe-titulo">¿Qué tan duro estuvo? <small>1 = suave · 10 = máximo</small></p><div class="rpe-botones">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
        return '<button type="button" class="rpe-btn' + (n === rpeActual ? ' is-activo' : '') + '" data-rpe="' + n + '" data-semana="' + semana + '" data-dia="' + attr(dia.dia) + '" aria-pressed="' + (n === rpeActual) + '">' + n + '</button>';
      }).join("") + '</div></div>';
    var hecho = diaHecho(log, semana, dia.dia);
    return '<div class="log-day day-card' + (hecho ? ' is-done' : '') + '">' +
      '<div class="log-day-head"><h3>' + dia.dia + '</h3></div>' +
      movHtml +
      (resto.length ? '<div class="ex-head" aria-hidden="true"><span>Ejercicio</span><span>Realizar</span><span>Lo que hice</span></div>' : '') +
      bloques + rpeHtml +
      '<div class="day-acciones">' +
      '<button type="button" class="btn ' + (hecho ? 'btn-ghost' : 'btn-primary') + ' day-done" data-toggle-hecho data-semana="' + semana + '" data-dia="' + dia.dia + '">' +
      (hecho ? '✓ Día hecho — deshacer' : 'Marcar día como hecho') + '</button>' +
      '<a class="btn btn-ghost day-consulta" href="' + waConsultaDia(semana, dia) + '" target="_blank" rel="noopener">Consultar este día</a></div></div>';
  }

  function renderWeekly(nivel) {
    var log = getJSON(KEYS.log) || {};
    renderMes(nivel);
    renderHoy(nivel);
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


    // 3 a 5 días: todos en una fila; más de 5: se reparten en dos filas parejas
    $("[data-day-nav]").style.setProperty("--cols", dias.length <= 5 ? dias.length : Math.ceil(dias.length / 2));
    $("[data-day-nav]").innerHTML = dias.map(function (d) {
      var on = d.dia === vista.dia, ok = diaHecho(log, vista.semana, d.dia);
      return '<button type="button" role="tab" aria-selected="' + on + '" class="day-chip' + (on ? ' is-active' : '') + (ok ? ' is-done' : '') + '" data-dia-chip="' + d.dia + '">' +
        '<span class="day-chip-head"><b>' + d.dia + '</b>' + (ok ? '<i class="day-check" aria-label="Día hecho">✓</i>' : '') + '</span>' +
        '</button>';
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
    function esIgual(box) { var c = box.querySelector("[data-set-igual]"); return !!(c && c.checked); }
    function leerFilas(box) {
      return $$("[data-set-row]", box).map(function (row) {
        return { r: (row.querySelector("[data-set-r]").value || "").trim(), k: (row.querySelector("[data-set-k]").value || "").trim() };
      });
    }
    function leerApr(box) {
      var f = box.querySelector("[data-apr-row]");
      if (!f) return null;
      return { r: (f.querySelector("[data-apr-r]").value || "").trim(), k: (f.querySelector("[data-apr-k]").value || "").trim() };
    }
    function guardarSets(box) {
      var filas = leerFilas(box), sets;
      if (esIgual(box)) {
        var n = Number(box.dataset.n) || 1;
        sets = [];
        for (var i = 0; i < n; i++) sets.push({ r: filas[0].r, k: filas[0].k });
      } else {
        sets = filas;
        box.dataset.n = String(sets.length);
      }
      var resumen = sets.map(function (s, i) {
        if (!s.r && !s.k) return "";
        return "S" + (i + 1) + " " + (s.r || "?") + (s.k ? " x " + s.k + "kg" : "");
      }).filter(Boolean).join(" · ");
      var apr = leerApr(box);
      if (apr && (apr.r || apr.k)) resumen = "Aprox " + (apr.r || "?") + (apr.k ? " x " + apr.k + "kg" : "") + (resumen ? " · " + resumen : "");
      var datos = { sets: sets, hechoTxt: resumen, igual: esIgual(box) };
      if (apr) datos.apr = apr;
      guardarEjercicio(box.dataset.k, datos);
    }
    // cambia entre "todas iguales" (una fila) y "una fila por serie"
    function cambiarModo(box, iguales) {
      var filas = leerFilas(box);
      var apr = box.dataset.apr === "1" ? leerApr(box) : null;
      var plan = Number(box.dataset.plan) || 1, n = Number(box.dataset.n) || filas.length;
      var psets = []; try { psets = JSON.parse(box.dataset.prev || "[]"); } catch (err) {}
      if (iguales) {
        var difieren = filas.some(function (s) { return s.r !== filas[0].r || s.k !== filas[0].k; });
        if (difieren && !confirm("Se va a copiar la serie 1 a todas las demás. ¿Seguir?")) { box.querySelector("[data-set-igual]").checked = false; return; }
        n = filas.length;
      }
      var sets = [];
      for (var i = 0; i < n; i++) sets.push({ r: filas[0].r, k: filas[0].k });
      box.dataset.n = String(n);
      box.innerHTML = setsInterior(iguales, sets, plan, n, psets, apr);
      guardarSets(box);
    }
    panel.addEventListener("input", function (e) {
      var inp = e.target.closest(".set-in");
      if (!inp) return;
      var limpio = inp.value.replace(/[^0-9.,]/g, "");
      if (limpio !== inp.value) inp.value = limpio;
      guardarSets(inp.closest("[data-sets]"));
    });
    panel.addEventListener("change", function (e) {
      var ig = e.target.closest("[data-set-igual]");
      if (ig) { cambiarModo(ig.closest("[data-sets]"), ig.checked); return; }
      var inp = e.target.closest(".set-in");
      if (!inp) return;
      var caja = inp.closest("[data-sets]");
      var filaSerie = inp.closest("[data-set-row]");
      if (filaSerie) avisarRecord(caja.dataset.k, filaSerie);
    });
    panel.addEventListener("click", function (e) {
      var add = e.target.closest("[data-set-add]");
      if (add) {
        var box = add.closest("[data-sets]");
        var n = $$("[data-set-row]", box).length;
        var psets = []; try { psets = JSON.parse(box.dataset.prev || "[]"); } catch (err) {}
        add.insertAdjacentHTML("beforebegin", setRowHTML(n + 1, null, true, psets[n], false));
        var ult = $$("[data-set-r]", box).pop();
        if (ult) ult.focus();
        guardarSets(box);
        return;
      }
      var del = e.target.closest("[data-set-del]");
      if (del) {
        var caja = del.closest("[data-sets]");
        del.closest("[data-set-row]").remove();
        $$("[data-set-row]", caja).forEach(function (row, i) { var nn = row.querySelector(".set-n"); if (nn) nn.textContent = String(i + 1); });
        guardarSets(caja);
      }
    });
    panel.addEventListener("click", function (e) {
      var nivel = getJSON(KEYS.nivel) || "OPEN";
      var sem = e.target.closest("[data-semana-chip]");
      if (sem) { vista.semana = Number(sem.dataset.semanaChip); vista.dia = null; renderWeekly(nivel); return; }
      var dia = e.target.closest("[data-dia-chip]");
      if (dia) { vista.dia = dia.dataset.diaChip; renderWeekly(nivel); return; }
      var rpeBtn = e.target.closest("[data-rpe]");
      if (rpeBtn) {
        var lg = getJSON(KEYS.log) || {};
        var kk = hechoKey(rpeBtn.dataset.semana, rpeBtn.dataset.dia);
        var ant = lg[kk] || { hecho: "0" };
        var nuevoRpe = Number(rpeBtn.dataset.rpe);
        lg[kk] = { hecho: ant.hecho || "0" };
        if (ant.f) lg[kk].f = ant.f;
        if (Number(ant.rpe) !== nuevoRpe) lg[kk].rpe = nuevoRpe; // tocar el mismo número lo saca
        setJSON(KEYS.log, lg);
        guardarRegistrosServidor(lg);
        renderWeekly(nivel);
        return;
      }
      var toggle = e.target.closest("[data-toggle-hecho]");
      if (toggle) {
        var log = getJSON(KEYS.log) || {};
        var key = hechoKey(toggle.dataset.semana, toggle.dataset.dia);
        var marcar = !diaHecho(log, toggle.dataset.semana, toggle.dataset.dia);
        var previoDia = log[key] || {};
        var nuevoDia = marcar ? { hecho: "1", f: fechaHoy() } : { hecho: "0" };
        if (previoDia.rpe) nuevoDia.rpe = previoDia.rpe;
        log[key] = nuevoDia;
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
    if (!host) return; // sin resumen mensual en pantalla
    host.innerHTML = semanasFor(nivel).map(function (s) {
      return '<div class="week-group"><p>Semana ' + s.semana + '</p>' +
        s.dias.map(function (d) { return diaCardReadOnly(s.semana, d, log); }).join("") + '</div>';
    }).join("");
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
    // si Drive no entrega una miniatura (límite de pedidos, red lenta), queda el fondo oscuro con el ▶ en vez de una imagen rota
    $("[data-video-list]").addEventListener("error", function (e) {
      if (e.target && e.target.tagName === "IMG") e.target.remove();
    }, true);
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

    function usarVideos(data) {
      if (data && data.ok && data.videos && data.videos.length) {
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
    }
    fetch(API_URL + "?action=videos").then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.ok) { try { setJSON(KEYS.videos, data); } catch (err) {} }
      usarVideos(data);
    }).catch(function () { usarVideos(getJSON(KEYS.videos)); /* sin conexión: última lista guardada, o la de muestra */ });
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
    function aplicar(data) {
      renderPlanArchivo(nivel, data.archivos, data.mes);
      var hayPdf = renderPlanPdf(data.archivos);
      if (data.semanas && data.semanas.length) {
        planCache[nivel] = data.semanas;
        if (getJSON(KEYS.nivel) === nivel) {
          renderWeekly(nivel);
          renderMonthly(nivel);
        }
      } else if (hayPdf && getJSON(KEYS.nivel) === nivel) {
        // el PDF es la planificación real del mes: no mostramos las tarjetas de muestra
        $("[data-week-panel]").hidden = true;
        var monthly = document.querySelector(".monthly-card");
        if (monthly) monthly.hidden = true;
      }
    }
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error("plan");
      // se guarda la última planificación recibida para poder entrenar sin señal
      var guardados = getJSON(KEYS.plan) || {};
      guardados[nivel] = data;
      try { setJSON(KEYS.plan, guardados); } catch (err) {}
      aplicar(data);
    }).catch(function () {
      var copia = (getJSON(KEYS.plan) || {})[nivel];
      if (copia) aplicar(copia);
      else { var box = $("[data-plan-archivo]"); if (box) box.hidden = true; }
    });
  }

  // ---- Dashboard: cada alumno tiene UN plan (OPEN, PRO o PERSONALIZADO) y solo ve ese ----
  var NIVEL_LABEL = { OPEN: "Nivel OPEN", PRO: "Nivel PRO", PERSONALIZADO: "Plan Personalizado" };

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Foto de perfil (opcional) junto al nombre; se sube desde "Perfil" en el menú Tu Planilla ----
  // nombre que se muestra: el apodo si lo eligió, si no nombre y apellido
  function nombreVisible(p) {
    p = p || {};
    return String(p.apodo || "").trim() || ((p.nombre || "") + " " + (p.apellido || "")).trim();
  }

  // los dos círculos de foto: el chico de la barra y el grande de "Perfil"
  var CIRCULOS = [
    { btn: "[data-avatar]", img: "[data-avatar-img]", ini: "[data-avatar-ini]" },
    { btn: "[data-avatar-big]", img: "[data-avatar-big-img]", ini: "[data-avatar-big-ini]" }
  ];

  function renderAvatar() {
    var p = getJSON(KEYS.profile) || {};
    var letra = String(p.apodo || p.nombre || "?").trim().charAt(0).toUpperCase() || "?";
    var id = driveId(p.fotoPerfilUrl || fotoPendiente);
    CIRCULOS.forEach(function (c) {
      var btn = $(c.btn), img = $(c.img), ini = $(c.ini);
      if (!btn || !img || !ini) return;
      ini.textContent = letra;
      if (id) {
        img.onerror = function () { img.hidden = true; ini.hidden = false; btn.classList.add("no-foto"); };
        img.src = "https://drive.google.com/thumbnail?id=" + id + "&sz=w512";
        img.hidden = false; ini.hidden = true;
        btn.classList.remove("no-foto");
      } else {
        img.hidden = true; ini.hidden = false;
        btn.classList.add("no-foto");
      }
    });
  }

  // si todavía no hay perfil guardado (alumno nuevo), la foto subida espera hasta que guarde el formulario
  var fotoPendiente = "";

  function initAvatar() {
    var input = $("[data-avatar-file]");
    if (!input) return;
    var botones = CIRCULOS.map(function (c) { return $(c.btn); }).filter(Boolean);
    function ocupado() { return botones.some(function (b) { return b.classList.contains("is-loading"); }); }
    botones.forEach(function (b) { b.addEventListener("click", function () { if (!ocupado()) input.click(); }); });
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      input.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { alert("Elegí una imagen."); return; }
      botones.forEach(function (b) { b.classList.add("is-loading"); });
      reducirImagen(f, 640).then(function (res) {
        // vista previa inmediata en los dos círculos
        CIRCULOS.forEach(function (c) {
          var btn = $(c.btn), img = $(c.img), ini = $(c.ini);
          if (!btn || !img || !ini) return;
          img.src = res.dataUrl; img.hidden = false; ini.hidden = true; btn.classList.remove("no-foto");
        });
        return subirArchivoAlumno("fotoPerfil", res.file).then(function (url) {
          if (!url) throw new Error("subida");
          var p = getJSON(KEYS.profile);
          if (p) {
            p.fotoPerfilUrl = url;
            setJSON(KEYS.profile, p);
            guardarEnServidor({ perfil: p });
          } else {
            fotoPendiente = url;
          }
        });
      }).catch(function () {
        alert("No se pudo subir la foto. Probá de nuevo en un rato.");
        renderAvatar();
      }).then(function () { botones.forEach(function (b) { b.classList.remove("is-loading"); }); });
    });
  }

  // el nombre o apodo que el alumno elige para su perfil (se guarda solo al escribir)
  function initApodo() {
    var input = $("[data-apodo]");
    if (!input) return;
    var guardar = debounce(function () {
      var p = getJSON(KEYS.profile);
      if (!p) return; // alumno nuevo: se guarda junto con el formulario
      p.apodo = input.value.trim();
      setJSON(KEYS.profile, p);
      guardarEnServidor({ perfil: p });
      var nombre = $("[data-plan-nombre]");
      if (nombre) nombre.textContent = nombreVisible(p);
      renderAvatar();
    }, 700);
    input.addEventListener("input", guardar);
  }

  // fecha local de hoy como AAAA-MM-DD (para guardar cuándo se completó cada día)
  function fechaHoy() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // "2026-10-10" -> "10/10"
  function fechaCorta(f) {
    var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(f || ""));
    return m ? Number(m[2]) + "/" + Number(m[1]) : "";
  }

  // ---- "Tu mes": días completados, adherencia, racha y el mapa de constancia semana por semana ----
  function renderMes(nivel) {
    if (!$("[data-mes-dias]")) return;
    var log = getJSON(KEYS.log) || {};
    var hoy = semanaActual();
    var semanas = semanasFor(nivel);
    var hechosPorSemana = {}, fechas = {};
    Object.keys(log).forEach(function (k) {
      if (k.indexOf("hecho|") !== 0) return;
      var v = log[k] || {};
      if (v.hecho !== "1") return;
      var p = k.split("|");
      hechosPorSemana[p[1]] = (hechosPorSemana[p[1]] || 0) + 1;
      fechas[p[1] + "|" + p[2]] = v.f || "";
    });

    var totalPlan = 0, hechos = 0, planHastaHoy = 0, hechosHastaHoy = 0;
    var completa = {};
    semanas.forEach(function (s) {
      var plan = s.dias.length, hecho = hechosPorSemana[String(s.semana)] || 0;
      totalPlan += plan; hechos += hecho;
      if (s.semana <= hoy) { planHastaHoy += plan; hechosHastaHoy += Math.min(hecho, plan); }
      completa[s.semana] = plan > 0 && hecho >= plan;
    });
    // racha: semanas completas seguidas, hacia atrás desde esta semana (si todavía no la completó, desde la anterior)
    var racha = 0, w = completa[hoy] ? hoy : hoy - 1;
    while (w >= 1 && completa[w]) { racha++; w--; }

    $("[data-mes-dias]").textContent = hechos;
    $("[data-mes-dias-de]").textContent = totalPlan ? "de " + totalPlan + " días del mes" : "días completados";
    $("[data-mes-adh]").textContent = (planHastaHoy ? Math.round(hechosHastaHoy / planHastaHoy * 100) : 0) + "%";
    $("[data-mes-racha]").textContent = racha;
    $("[data-mes-racha-de]").textContent = racha === 1 ? "semana seguida" : "semanas seguidas";
    $("[data-mes-bar]").style.width = (totalPlan ? Math.min(100, Math.round(hechos / totalPlan * 100)) : 0) + "%";

    // mapa: una fila por semana, un cuadradito por día planificado; los hechos llevan su fecha debajo
    var mapa = $("[data-mapa-mes]");
    if (!mapa) return;
    mapa.innerHTML = semanas.map(function (s) {
      var celdas = s.dias.map(function (d) {
        var f = fechas[s.semana + "|" + d.dia];
        var hecho = f !== undefined;
        return '<span class="mapa-celda' + (hecho ? ' is-hecho' : '') + '" title="' + escHtml(d.dia + (hecho ? " — hecho" + (f ? " el " + fechaCorta(f) : "") : " — pendiente")) + '">' +
          '<i>' + (hecho ? "✓" : "") + '</i><small>' + (hecho ? escHtml(fechaCorta(f)) : "") + '</small></span>';
      }).join("");
      var hechosSem = hechosPorSemana[String(s.semana)] || 0;
      return '<div class="mapa-fila' + (s.semana === hoy ? ' is-actual' : '') + '">' +
        '<span class="mapa-sem">Sem ' + s.semana + '</span>' +
        '<span class="mapa-celdas">' + celdas + '</span>' +
        '<span class="mapa-total">' + hechosSem + '/' + s.dias.length + '</span></div>';
    }).join("");
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
    $("[data-plan-nombre]").textContent = nombreVisible(profile);
    $("[data-plan-meta]").textContent = (NIVEL_LABEL[nivel] || nivel) + (profile.ciudad ? " · " + profile.ciudad : "");
    renderAvatar();
    renderObjetivos();
    renderWeekly(nivel);
    renderMonthly(nivel);
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
      if (k.indexOf("hecho|") === 0) { if (v.hecho === "1") var e1 = { hecho: "1" }; if (v.f) e1.f = v.f; if (v.rpe) e1.rpe = v.rpe; out[k] = e1; return; }
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
      .then(function (r) {
        if (r && r.ok) { var hh = getJSON(KEYS.hist) || {}; hh[log._mes] = viejo; setJSON(KEYS.hist, hh); }
        return (r && r.ok) ? reiniciar() : false;
      });
  }

  function sincronizarRegistros(data) {
    if (data && data.ok) {
      var local = localStorage.getItem(KEYS.reinicio) || "";
      if (data.historial) setJSON(KEYS.hist, data.historial);
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
    var avisoApto = $("[data-apto-aviso]");
    if (avisoApto) avisoApto.hidden = !!(getJSON(KEYS.profile) || {}).fotoAptoUrl;
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
    initRegistro();
    initVolverInicio();
    initOffline();
    sincronizarPendiente();
    marcarObligatorios();
    initApodo();
    initObjetivos();
    var aptoIr = $("[data-apto-ir]");
    if (aptoIr) aptoIr.addEventListener("click", function () { irA("perfil"); var f = $("[name=fotoApto]"); if (f) f.scrollIntoView({ behavior: "smooth", block: "center" }); });

    var fab = $("[data-whatsapp-fab]");
    var brand = window.__BRAND__ || {};
    if (fab && brand.whatsapp) {
      fab.href = "https://wa.me/" + brand.whatsapp + "?text=" + encodeURIComponent(brand.whatsappText || "Hola");
    }

    if (!vigente()) { showView("view-clave"); return; }
    if (!getJSON(KEYS.profile)) { showView("view-form"); return; }
    renderDashboard();
    showView("view-dashboard");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
