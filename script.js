/* Portofolio — Muhammad Fikri Bari
   Tanpa framework. Semua fitur bersifat tambahan: tanpa JavaScript halaman tetap terbaca. */
(function () {
  "use strict";

  /* Proyek Pilihan: kartu dibuat dari data/projects.js (dikelola lewat admin.html).
     Harus berjalan sebelum efek scroll dipasang agar kartu ikut beranimasi. */
  renderProjects();

  function renderProjects() {
    var wrap = document.querySelector("[data-projects]");
    if (!wrap) return;
    var list = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
    wrap.textContent = "";
    if (!list.length) {
      wrap.appendChild(el("p", "projects__empty", "Proyek segera ditambahkan."));
      return;
    }
    list.forEach(function (p, i) { wrap.appendChild(projectCard(p || {}, i)); });
  }

  function projectCard(p, i) {
    var card = el("article", "project");

    var media = el("div", "project__media");
    media.setAttribute("aria-hidden", "true");
    media.appendChild(el("span", "project__num", String(i + 1).padStart(2, "0")));
    if (p.image) {
      var img = el("img");
      img.src = p.image;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () { img.remove(); });
      media.appendChild(img);
    }
    card.appendChild(media);

    var body = el("div", "project__body");
    var top = el("div", "project__top");
    if (p.type) top.appendChild(el("p", "project__type", p.type));
    if (p.period) top.appendChild(el("p", "project__date", p.period));
    body.appendChild(top);
    body.appendChild(el("h3", "project__title", p.title || "Tanpa judul"));
    if (p.description) body.appendChild(el("p", "project__desc", p.description));
    if (p.role) {
      var role = el("p", "project__role");
      role.appendChild(el("strong", null, "Peran:"));
      role.appendChild(document.createTextNode(" " + p.role));
      body.appendChild(role);
    }
    var tech = Array.isArray(p.tech) ? p.tech.filter(Boolean) : [];
    if (tech.length) {
      var chips = el("ul", "chips");
      chips.setAttribute("aria-label", "Teknologi");
      tech.forEach(function (t) { chips.appendChild(el("li", "chip", t)); });
      body.appendChild(chips);
    }

    // Link hanya dipasang jika alamatnya http(s) yang valid. Tanpa link: tampilkan status
    // (mis. "Sudah digunakan") jika diisi, selain itu "Demo segera".
    var foot = el("div", "project__foot");
    var hasLink = /^https?:\/\/\S+$/i.test(p.link || "");
    if (p.status) foot.appendChild(el("span", "live", p.status));
    if (hasLink) {
      var a = el("a", "project__link", "Lihat proyek ");
      a.href = p.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.insertAdjacentHTML("beforeend", '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>');
      foot.appendChild(a);
    } else if (!p.status) {
      foot.appendChild(el("span", "soon", "Demo segera"));
    }
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* Tahun otomatis di footer */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* Foto: siluet placeholder tampil sampai assets/foto.png berhasil dimuat.
     Jika file belum ada, <img> dibuang agar tidak muncul ikon gambar rusak. */
  var photo = document.querySelector(".hero__photo");
  var img = photo && photo.querySelector(".hero__img");
  if (img) {
    var onLoad = function () { photo.classList.add("has-photo"); };
    var onError = function () { img.remove(); };
    if (img.complete) {
      img.naturalWidth > 0 ? onLoad() : onError();
    } else {
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
    }
  }

  /* CV: kalau assets/cv.pdf belum diunggah ke GitHub Pages, tombol diganti
     menjadi "CV segera" (abu-abu) supaya tidak ada link mati.
     Hanya dicek saat dibuka lewat http(s); saat dibuka langsung dari file, dilewati. */
  var cvLinks = document.querySelectorAll("[data-cv]");
  if (cvLinks.length && /^https?:$/.test(location.protocol) && window.fetch) {
    fetch(cvLinks[0].getAttribute("href"), { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        var type = res.headers.get("content-type") || "";
        if (!res.ok || type.indexOf("pdf") === -1) disableCv();
      })
      .catch(function () { /* jaringan bermasalah: biarkan tombol apa adanya */ });
  }
  function disableCv() {
    cvLinks.forEach(function (a) {
      a.removeAttribute("href");
      a.removeAttribute("download");
      a.classList.add("is-disabled");
      a.setAttribute("aria-disabled", "true");
      var label = a.querySelector("[data-cv-label]");
      if (label) label.textContent = "CV segera";
    });
  }

  /* Tombol "Salin" email */
  var status = document.querySelector("[data-copy-status]");
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var label = btn.querySelector("[data-copy-label]");
    var timer;
    btn.addEventListener("click", function () {
      copyText(btn.getAttribute("data-copy")).then(function (ok) {
        if (label) label.textContent = ok ? "Tersalin!" : "Gagal";
        btn.classList.toggle("is-copied", ok);
        if (status) status.textContent = ok ? "Alamat email disalin." : "Gagal menyalin, silakan salin manual.";
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (label) label.textContent = "Salin";
          btn.classList.remove("is-copied");
        }, 2000);
      });
    });
  });

  /* Kartu proyek: posisi kursor untuk efek cahaya */
  if (window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".project").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* Efek scroll — hanya jika <html> punya kelas "motion" (lihat <head>) */
  var root = document.documentElement;
  if (root.classList.contains("motion")) initScrollEffects();

  function initScrollEffects() {
    /* 1. Elemen muncul saat masuk layar */
    var revealSel = [
      ".section__head > :not(.section__title)", ".project", ".block-title",
      ".timeline li", ".org", ".chips--lg .chip", ".step", ".quote",
      "#kontak .eyebrow", ".contact__intro", ".contact-list > li"
    ].join(",");
    document.querySelectorAll(revealSel).forEach(function (el) { el.setAttribute("data-reveal", ""); });
    document.querySelectorAll(".section__title, .contact__title").forEach(function (el) {
      el.setAttribute("data-reveal", "wipe");
    });

    var items = document.querySelectorAll("[data-reveal]");
    items.forEach(function (el) { // urutan dalam satu kelompok → jeda bertahap
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.hasAttribute("data-reveal");
      });
      el.style.setProperty("--i", Math.min(sibs.indexOf(el), 8));
    });

    // Judul "wipe" terpotong penuh oleh clip-path sehingga dianggap tak terlihat,
    // jadi yang dipantau adalah pembungkusnya.
    var targetFor = new Map();
    items.forEach(function (el) {
      var watch = el.getAttribute("data-reveal") === "wipe" ? el.parentElement : el;
      targetFor.set(watch, (targetFor.get(watch) || []).concat(el));
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          targetFor.get(entry.target).forEach(function (el) { el.classList.add("is-visible"); });
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    targetFor.forEach(function (_, watch) { io.observe(watch); });

    /* 2. Efek yang mengikuti posisi scroll */
    var bar = document.querySelector(".scroll-progress");
    var hero = document.querySelector(".hero");
    var process = document.querySelector(".process");
    var steps = process ? Array.prototype.slice.call(process.querySelectorAll(".step")) : [];
    var wide = window.matchMedia("(min-width: 900px)");
    if (bar) bar.classList.add("is-on");
    if (process) process.classList.add("is-tracking");

    var ticking = false;
    function requestUpdate() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var y = window.scrollY;
      var max = root.scrollHeight - vh;

      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
      if (hero && y < vh * 1.5) hero.style.setProperty("--py", (y * 0.35).toFixed(1) + "px");

      if (process && steps.length) {
        var p, active = [];
        if (wide.matches) {
          // Desktop (horizontal): garis terisi saat bagian ini naik dari 85% ke 40% tinggi layar
          var rect = process.getBoundingClientRect();
          p = clamp((vh * 0.85 - rect.top) / (vh * 0.45));
          steps.forEach(function (s, i) { active.push(p > 0 && p >= i / (steps.length - 1) - 0.01); });
        } else {
          // HP (vertikal): garis mengikuti titik di 60% tinggi layar
          var marker = vh * 0.6;
          var centers = steps.map(function (s) {
            var r = s.querySelector(".step__icon").getBoundingClientRect();
            return r.top + r.height / 2;
          });
          var first = centers[0], last = centers[centers.length - 1];
          p = clamp((marker - first) / (last - first));
          centers.forEach(function (c) { active.push(c <= marker); });
        }
        process.style.setProperty("--p", p.toFixed(3));
        var current = active.lastIndexOf(true);
        steps.forEach(function (s, i) {
          s.classList.toggle("is-active", active[i]);
          s.classList.toggle("is-current", i === current);
        });
      }
    }

    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
})();
