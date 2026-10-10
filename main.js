(function () {
  "use strict";

  const data = window.__BRAND__ || {};
  const API_URL = "https://script.google.com/macros/s/AKfycby9c2jdl19l7tZBwxHG8Dpw6fz_bT_Chhc_WEydQAW1tiFPYtulxbaAk-MmYtMWlexrTw/exec";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  function waLink(nivel, mensaje) {
    const base = "https://wa.me/" + (data.whatsapp || "");
    if (mensaje) return base + "?text=" + encodeURIComponent(mensaje);
    const text = data.whatsappText || "Hola, quiero info";
    const full = nivel ? text + " — nivel " + nivel : text;
    return base + "?text=" + encodeURIComponent(full);
  }

  function initWhatsApp() {
    $$("[data-whatsapp]").forEach(a => {
      a.href = waLink(a.dataset.nivel || "", a.dataset.mensaje || "");
    });
  }

  // Precios: se muestran recién cuando el alumno elige un plan (toca la tarjeta)
  function initPlanPicker() {
    const cards = $$(".nivel-card--pick");
    if (!cards.length) return;
    function elegir(card) {
      cards.forEach(c => {
        const on = c === card;
        c.classList.toggle("is-selected", on);
        c.setAttribute("aria-pressed", on);
        $(".nivel-price", c).hidden = !on;
        $(".nivel-hint", c).hidden = on;
        if (on) $("[data-price-value]", c).textContent = c.dataset.price;
      });
    }
    cards.forEach(card => {
      card.addEventListener("click", e => { if (!e.target.closest("a")) elegir(card); });
      card.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); elegir(card); }
      });
    });
  }

  function initReveals() {
    const targets = $$(".reveal");
    if (!targets.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });
    targets.forEach(t => io.observe(t));

    setTimeout(() => {
      targets.forEach(el => {
        if (!el.classList.contains("is-revealed") && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-revealed");
        }
      });
    }, 6000);
  }

  // anima un número de 0 a "target" (respeta "reducir movimiento")
  function animarNumero(el, target, suffix) {
    suffix = suffix || "";
    if (reduced) { el.textContent = target + suffix; return; }
    const dur = 900;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * p) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCountUp() {
    const els = $$("[data-count]");
    if (!els.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        animarNumero(el, parseInt(el.dataset.count, 10) || 0, el.dataset.suffix || "");
      });
    }, { threshold: 0.2 });
    els.forEach(el => io.observe(el));
  }

  // cantidad de alumnos activos (plan vigente): viene del servidor (solo el número, sin datos personales);
  // si no se puede cargar, el bloque queda oculto en vez de mostrar un valor roto
  function initAlumnosStat() {
    const card = $("[data-stat-alumnos]");
    const el = $("[data-alumnos-count]");
    if (!card || !el) return;
    fetch(API_URL + "?action=stats").then(r => r.json()).then(d => {
      const n = d && d.ok ? parseInt(d.alumnos, 10) : 0;
      if (!(n > 0)) return;
      card.hidden = false;
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          animarNumero(el, n, "");
        });
      }, { threshold: 0.2 });
      io.observe(card);
    }).catch(() => {});
  }

  function initSmoothAnchors() {
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#" || id === "#top") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navOffset = 76;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - navOffset,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  function initServiceWorker() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function boot() {
    safe(initWhatsApp, "initWhatsApp");
    safe(initPlanPicker, "initPlanPicker");
    safe(initReveals, "initReveals");
    safe(initCountUp, "initCountUp");
    safe(initAlumnosStat, "initAlumnosStat");
    safe(initSmoothAnchors, "initSmoothAnchors");
    safe(initServiceWorker, "initServiceWorker");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
