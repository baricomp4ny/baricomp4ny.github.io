/* Admin Proyek Pilihan
   - Mengelola isi data/projects.js (urutan, teks, gambar).
   - Publikasi: satu commit ke GitHub lewat API (Git Data API), lalu GitHub Pages membangun ulang website.
   - Token GitHub hanya disimpan di browser ini dan hanya dikirim ke api.github.com. */
(() => {
  "use strict";

  const DATA_PATH = "data/projects.js";
  const CV_PATH = "assets/cv.pdf";
  const MAX_CV_SIZE = 10 * 1024 * 1024;
  const IMAGE_DIR = "assets/projects/";
  const MAX_IMAGE_WIDTH = 1280;
  const STORE_KEY = "pf-admin";

  const $ = (sel) => document.querySelector(sel);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  const state = {
    projects: normalizeList(window.PROJECTS),
    baseline: [],          // data terakhir yang tersimpan (lokal atau di GitHub)
    remoteSha: null,       // sha data/projects.js di GitHub saat dimuat (cek bentrok)
    images: new Map(),     // path gambar baru → { blob, url } (belum diunggah)
    conn: null,            // { owner, repo, branch, token }
    editing: -1,           // indeks yang sedang diedit (-1 = baru)
    draftImage: undefined, // undefined = tidak berubah, null = dihapus, { path, blob, url } = baru
    cv: null,              // { blob, name } = CV baru yang belum dipublikasikan
  };
  state.baseline = clone(state.projects);

  /* ---------- Penyimpanan pengaturan (aman jika storage diblokir) ---------- */
  function readStore() {
    const out = {};
    try { Object.assign(out, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) { /* abaikan */ }
    try { const t = sessionStorage.getItem(STORE_KEY + "-token"); if (t && !out.token) out.token = t; } catch (e) { /* abaikan */ }
    return out;
  }
  function writeStore(conn, remember) {
    try {
      const saved = { owner: conn.owner, repo: conn.repo, branch: conn.branch };
      if (remember) saved.token = conn.token;
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch (e) { /* abaikan */ }
    try {
      if (remember) sessionStorage.removeItem(STORE_KEY + "-token");
      else sessionStorage.setItem(STORE_KEY + "-token", conn.token);
    } catch (e) { /* abaikan */ }
  }
  function clearToken() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      delete saved.token;
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch (e) { /* abaikan */ }
    try { sessionStorage.removeItem(STORE_KEY + "-token"); } catch (e) { /* abaikan */ }
  }

  /* ---------- Data ---------- */
  function normalize(p) {
    p = p || {};
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    return {
      title: str(p.title),
      type: str(p.type),
      period: str(p.period),
      description: str(p.description),
      role: str(p.role),
      tech: Array.isArray(p.tech) ? p.tech.map(str).filter(Boolean) : [],
      link: str(p.link),
      status: str(p.status),
      image: str(p.image),
    };
  }
  function normalizeList(list) { return Array.isArray(list) ? list.map(normalize) : []; }

  function serialize(list) {
    return '/* Data "Proyek Pilihan". Dikelola lewat admin.html — boleh diedit manual, jaga format JSON-nya. */\n' +
      "window.PROJECTS = " + JSON.stringify(list, null, 2) + ";\n";
  }
  function parse(text) {
    const m = text.match(/window\.PROJECTS\s*=\s*([\s\S]*?);?\s*$/);
    if (!m) throw new Error("Format data/projects.js tidak dikenali.");
    return normalizeList(JSON.parse(m[1]));
  }

  // Gambar baru yang dipakai proyek dan belum diunggah ke GitHub
  const pendingImages = () => [...new Set(state.projects.map((p) => p.image))].filter((path) => {
    const img = state.images.get(path);
    return img && !img.published;
  });
  const isDirty = () => JSON.stringify(state.projects) !== JSON.stringify(state.baseline) ||
    pendingImages().length > 0 || !!state.cv;

  /* ---------- Tampilan daftar ---------- */
  function previewSrc(path) {
    if (!path) return "";
    const local = state.images.get(path);
    return local ? local.url : path;
  }

  function thumb(path, cls) {
    const box = document.createElement("div");
    box.className = "thumb" + (cls ? " " + cls : "");
    const src = previewSrc(path);
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = src;
      img.addEventListener("error", () => { box.textContent = "Gambar belum tersedia"; });
      box.appendChild(img);
    } else {
      box.textContent = "Tanpa gambar";
    }
    return box;
  }

  function renderList() {
    const list = $("#list");
    list.textContent = "";
    if (!state.projects.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Belum ada proyek. Klik “+ Tambah proyek”.";
      list.appendChild(li);
    }
    // Tandai proyek baru (hijau) dan yang diubah (kuning) dibanding versi tersimpan
    const saved = new Set(state.baseline.map((p) => JSON.stringify(p)));
    const savedTitles = new Set(state.baseline.map((p) => p.title));
    state.projects.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "item";
      if (!saved.has(JSON.stringify(p))) li.classList.add(savedTitles.has(p.title) ? "is-changed" : "is-new");

      const left = document.createElement("div");
      left.className = "item__left";
      const num = document.createElement("span");
      num.className = "item__num";
      num.textContent = String(i + 1).padStart(2, "0");
      left.append(num, thumb(p.image));

      const info = document.createElement("div");
      info.className = "item__info";
      const title = document.createElement("p");
      title.className = "item__title";
      title.textContent = p.title || "Tanpa judul";
      const meta = document.createElement("p");
      meta.className = "item__meta";
      meta.textContent = [p.type, p.period, p.status, p.link ? "ada link" : (p.status ? "" : "Demo segera")]
        .filter(Boolean).join(" · ");
      info.append(title, meta);

      const tools = document.createElement("div");
      tools.className = "item__tools";
      tools.append(
        toolBtn("↑", "Naikkan " + p.title, i === 0, () => move(i, -1)),
        toolBtn("↓", "Turunkan " + p.title, i === state.projects.length - 1, () => move(i, 1)),
        textBtn("Edit", () => openEditor(i)),
        textBtn("Hapus", () => removeProject(i), "btn--danger")
      );

      li.append(left, info, tools);
      list.appendChild(li);
    });
    updateDirty();
  }

  function toolBtn(label, aria, disabled, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }
  function textBtn(label, onClick, extra) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn--ghost btn--sm" + (extra ? " " + extra : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function updateDirty() {
    const dirty = isDirty();
    const badge = $("#dirty-badge");
    badge.textContent = dirty ? "Ada perubahan belum dipublikasikan" : "Tidak ada perubahan";
    badge.classList.toggle("is-warn", dirty);
    $("#publish").disabled = !dirty || !state.conn;
    $("#discard").disabled = !dirty;
    if (dirty && !state.conn) setStatus("#pub-status", "Hubungkan GitHub (langkah 1) untuk mempublikasikan, atau pakai “Unduh file (manual)”.");
    else if (!dirty && $("#pub-status").dataset.kind !== "ok") setStatus("#pub-status", "");
  }

  function setStatus(sel, msg, kind) {
    const el = $(sel);
    el.textContent = msg;
    el.className = "status" + (kind ? " is-" + kind : "");
    el.dataset.kind = kind || "";
  }

  /* ---------- Aksi daftar ---------- */
  function move(i, dir) {
    const j = i + dir;
    [state.projects[i], state.projects[j]] = [state.projects[j], state.projects[i]];
    renderList();
  }

  function removeProject(i) {
    const p = state.projects[i];
    if (!confirm(`Hapus proyek “${p.title}” dari daftar?\n(Baru benar-benar terhapus dari website setelah dipublikasikan.)`)) return;
    state.projects.splice(i, 1);
    dropUnusedLocalImages();
    renderList();
  }

  function dropUnusedLocalImages() {
    const used = new Set(state.projects.map((p) => p.image));
    for (const [path, img] of state.images) {
      if (!used.has(path)) { URL.revokeObjectURL(img.url); state.images.delete(path); }
    }
  }

  /* ---------- Form tambah/edit ---------- */
  const dialog = $("#editor");
  const form = $("#edit-form");

  function openEditor(index) {
    state.editing = index;
    state.draftImage = undefined;
    const p = index >= 0 ? state.projects[index] : normalize({});
    $("#editor-title").textContent = index >= 0 ? `Edit proyek ${String(index + 1).padStart(2, "0")}` : "Tambah proyek";
    form.title.value = p.title;
    form.type.value = p.type;
    form.period.value = p.period;
    form.description.value = p.description;
    form.role.value = p.role;
    form.tech.value = p.tech.join(", ");
    form.link.value = p.link;
    const preset = ["", "Sudah digunakan"].includes(p.status);
    form.statusChoice.value = preset ? p.status : "__custom";
    form.status.value = preset ? "" : p.status;
    syncStatusField();
    form.image.value = "";
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    setStatus("#edit-status", "");
    showDraftImage(p.image);
    dialog.showModal();
    form.title.focus();
  }

  function showDraftImage(path) {
    const box = $("#img-preview");
    const fresh = thumb(path, "thumb--lg");
    fresh.id = "img-preview";
    if (!path) fresh.textContent = "Belum ada gambar";
    box.replaceWith(fresh);
    $("#img-remove").hidden = !path;
  }

  function currentDraftPath() {
    if (state.draftImage === null) return "";
    if (state.draftImage) return state.draftImage.path;
    return state.editing >= 0 ? state.projects[state.editing].image : "";
  }

  form.image.addEventListener("change", async () => {
    const file = form.image.files[0];
    if (!file) return;
    setStatus("#edit-status", "Memproses gambar…");
    try {
      const { blob, ext } = await processImage(file);
      if (state.draftImage && state.draftImage.url) URL.revokeObjectURL(state.draftImage.url);
      const base = slugify(form.title.value || file.name.replace(/\.[^.]+$/, "")) || "proyek";
      const path = `${IMAGE_DIR}${base}-${Date.now().toString(36)}.${ext}`;
      state.draftImage = { path, blob, url: URL.createObjectURL(blob) };
      state.images.set(path, { blob, url: state.draftImage.url }); // sementara untuk pratinjau
      showDraftImage(path);
      setStatus("#edit-status", `Gambar siap (${Math.round(blob.size / 1024)} KB).`, "ok");
    } catch (err) {
      setStatus("#edit-status", err.message, "err");
    } finally {
      form.image.value = "";
    }
  });

  // Status: pilihan cepat, atau kotak teks jika "Lainnya"
  function syncStatusField() {
    const custom = form.statusChoice.value === "__custom";
    $("#status-custom").hidden = !custom;
    form.status.required = custom;
  }
  form.statusChoice.addEventListener("change", () => {
    syncStatusField();
    if (form.statusChoice.value === "__custom") form.status.focus();
  });

  $("#img-remove").addEventListener("click", () => {
    state.draftImage = null;
    showDraftImage("");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const link = form.link.value.trim();
    const errors = [];
    const mark = (field, bad) => { if (bad) field.setAttribute("aria-invalid", "true"); else field.removeAttribute("aria-invalid"); return bad; };
    if (mark(form.title, !form.title.value.trim())) errors.push("Nama proyek wajib diisi.");
    if (mark(form.description, !form.description.value.trim())) errors.push("Deskripsi wajib diisi.");
    if (mark(form.link, link && !/^https?:\/\/\S+\.\S+$/i.test(link))) errors.push("Link harus diawali http:// atau https://.");
    if (mark(form.status, form.statusChoice.value === "__custom" && !form.status.value.trim())) errors.push("Tulis teks status, atau pilih status lain.");
    if (errors.length) { setStatus("#edit-status", errors.join(" "), "err"); return; }

    const project = normalize({
      title: form.title.value,
      type: form.type.value,
      period: form.period.value,
      description: form.description.value,
      role: form.role.value,
      tech: form.tech.value.split(","),
      link,
      status: form.statusChoice.value === "__custom" ? form.status.value : form.statusChoice.value,
      image: currentDraftPath(),
    });
    if (state.editing >= 0) state.projects[state.editing] = project;
    else state.projects.push(project);
    state.draftImage = undefined;
    dropUnusedLocalImages();
    dialog.close();
    renderList();
  });

  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => {
    // gambar yang dipilih tapi tidak disimpan → buang
    state.draftImage = undefined;
    dropUnusedLocalImages();
  });

  $("#add").addEventListener("click", () => openEditor(-1));

  /* ---------- Gambar: perkecil & kompres di browser ---------- */
  async function processImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Format gambar harus PNG, JPG, atau WebP.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 20 MB.");
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    if (img.close) img.close();
    let blob = await toBlob(canvas, "image/webp", 0.85);
    if (blob && blob.type === "image/webp") return { blob, ext: "webp" };
    blob = await toBlob(canvas, "image/jpeg", 0.85);
    if (!blob) throw new Error("Gambar gagal diproses.");
    return { blob, ext: "jpg" };
  }
  function loadImage(file) {
    if (window.createImageBitmap) return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File gambar tidak bisa dibaca.")); };
      img.src = url;
    });
  }
  const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

  function slugify(s) {
    return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const c = state.conn;
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`, {
      method: opts.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${c.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 404 && opts.allow404) return null;
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) { /* abaikan */ }
      const hints = {
        401: "Token salah atau sudah kedaluwarsa.",
        403: "Token tidak punya izin. Pastikan Contents: Read and write untuk repo ini.",
        404: "Repository/branch tidak ditemukan, atau token tidak diberi akses ke repo ini.",
        409: "Repository kosong atau sedang berubah. Coba lagi.",
        422: "GitHub menolak perubahan.",
      };
      throw new Error(`${hints[res.status] || "Gagal menghubungi GitHub."} (${res.status}: ${msg})`);
    }
    return res.status === 204 ? null : res.json();
  }

  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToText(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  }

  async function fetchRemoteData() {
    const ref = encodeURIComponent(state.conn.branch);
    const file = await gh(`/contents/${DATA_PATH}?ref=${ref}`, { allow404: true });
    if (!file) return { sha: null, list: null };
    return { sha: file.sha, list: parse(b64ToText(file.content)) };
  }

  /* ---------- Koneksi ---------- */
  const connForm = $("#conn-form");

  connForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const conn = {
      owner: connForm.owner.value.trim(),
      repo: connForm.repo.value.trim(),
      branch: connForm.branch.value.trim(),
      token: connForm.token.value.trim(),
    };
    if (!conn.owner || !conn.repo || !conn.branch || !conn.token) return;
    if (isDirty() && !confirm("Menghubungkan akan memuat data terbaru dari GitHub dan mengganti perubahan yang belum dipublikasikan. Lanjutkan?")) return;
    $("#connect").disabled = true;
    setStatus("#conn-status", "Menghubungkan…");
    state.conn = conn;
    try {
      const repo = await gh("");
      if (repo.permissions && !repo.permissions.push) throw new Error("Token hanya bisa membaca, belum bisa menulis. Ubah izin Contents menjadi Read and write.");
      await gh(`/git/ref/heads/${encodeURIComponent(conn.branch)}`);
      const remote = await fetchRemoteData();
      state.remoteSha = remote.sha;
      if (remote.list) {
        state.projects = remote.list;
        state.baseline = clone(remote.list);
      }
      dropUnusedLocalImages();
      writeStore(conn, connForm.remember.checked);
      setConnected(true);
      setStatus("#conn-status", remote.list
        ? `Terhubung ke ${conn.owner}/${conn.repo} (${conn.branch}). Data proyek dimuat dari GitHub.`
        : `Terhubung. ${DATA_PATH} belum ada di GitHub dan akan dibuat saat publikasi.`, "ok");
      renderList();
    } catch (err) {
      state.conn = null;
      setConnected(false);
      setStatus("#conn-status", err.message, "err");
    } finally {
      $("#connect").disabled = false;
    }
  });

  $("#disconnect").addEventListener("click", () => {
    state.conn = null;
    state.remoteSha = null;
    clearToken();
    connForm.token.value = "";
    connForm.remember.checked = false;
    setConnected(false);
    setStatus("#conn-status", "Terputus. Token dihapus dari browser ini.");
    updateDirty();
  });

  function setConnected(on) {
    const badge = $("#conn-badge");
    badge.textContent = on ? "Terhubung" : "Belum terhubung";
    badge.classList.toggle("is-ok", on);
    $("#disconnect").hidden = !on;
    $("#connect").textContent = on ? "Hubungkan ulang" : "Hubungkan";
    updateDirty();
  }

  /* ---------- Publikasi (satu commit) ---------- */
  $("#publish").addEventListener("click", async () => {
    if (!state.conn || !isDirty()) return;
    const invalid = state.projects.find((p) => !p.title || !p.description);
    if (invalid) { setStatus("#pub-status", "Ada proyek tanpa nama/deskripsi. Lengkapi dulu.", "err"); return; }

    const btn = $("#publish");
    btn.disabled = true;
    try {
      const branch = encodeURIComponent(state.conn.branch);
      setStatus("#pub-status", "Memeriksa data terbaru di GitHub…");
      const remote = await fetchRemoteData();
      if (remote.sha !== state.remoteSha) {
        throw new Error("Data di GitHub berubah sejak dimuat (mungkin diedit dari tempat lain). Klik “Hubungkan ulang” untuk memuat versi terbaru.");
      }

      const ref = await gh(`/git/ref/heads/${branch}`);
      const baseSha = ref.object.sha;
      const baseCommit = await gh(`/git/commits/${baseSha}`);
      const tree = [];

      const uploads = pendingImages();
      for (let i = 0; i < uploads.length; i++) {
        setStatus("#pub-status", `Mengunggah gambar ${i + 1} dari ${uploads.length}…`);
        const bytes = new Uint8Array(await state.images.get(uploads[i]).blob.arrayBuffer());
        const blob = await gh("/git/blobs", { method: "POST", body: { content: bytesToB64(bytes), encoding: "base64" } });
        tree.push({ path: uploads[i], mode: "100644", type: "blob", sha: blob.sha });
      }

      const cvUploaded = !!state.cv;
      if (state.cv) {
        setStatus("#pub-status", "Mengunggah CV…");
        const bytes = new Uint8Array(await state.cv.blob.arrayBuffer());
        const blob = await gh("/git/blobs", { method: "POST", body: { content: bytesToB64(bytes), encoding: "base64" } });
        tree.push({ path: CV_PATH, mode: "100644", type: "blob", sha: blob.sha });
      }

      tree.push({ path: DATA_PATH, mode: "100644", type: "blob", content: serialize(state.projects) });

      // Gambar di folder proyek yang tidak dipakai lagi ikut dihapus dari repo
      const used = new Set(state.projects.map((p) => p.image));
      const unused = [...new Set(state.baseline.map((p) => p.image))]
        .filter((path) => path && path.startsWith(IMAGE_DIR) && !used.has(path));
      for (const path of unused) {
        const exists = await gh(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${branch}`, { allow404: true });
        if (exists) tree.push({ path, mode: "100644", type: "blob", sha: null });
      }

      setStatus("#pub-status", "Menyimpan perubahan…");
      const newTree = await gh("/git/trees", { method: "POST", body: { base_tree: baseCommit.tree.sha, tree } });
      const commit = await gh("/git/commits", {
        method: "POST",
        body: { message: "Perbarui Proyek Pilihan (via admin)", tree: newTree.sha, parents: [baseSha] },
      });
      await gh(`/git/refs/heads/${branch}`, { method: "PATCH", body: { sha: commit.sha } });

      const after = await fetchRemoteData();
      state.remoteSha = after.sha;
      state.baseline = clone(state.projects);
      // Gambar tetap disimpan lokal untuk pratinjau sampai GitHub Pages selesai membangun ulang,
      // tapi ditandai sudah terunggah agar tidak dihitung sebagai perubahan lagi.
      uploads.forEach((path) => { state.images.get(path).published = true; });
      if (cvUploaded) {
        clearCv();
        setStatus("#cv-status", "CV baru sudah dipublikasikan.", "ok");
      }
      setStatus("#pub-status", "Berhasil dipublikasikan! Website akan diperbarui dalam ± 1–2 menit (muat ulang dengan Ctrl+F5 jika belum berubah).", "ok");
      renderList();
    } catch (err) {
      setStatus("#pub-status", err.message, "err");
    } finally {
      updateDirty();
    }
  });

  /* ---------- CV ---------- */
  const cvInput = $("#cv-input");

  cvInput.addEventListener("change", async () => {
    const file = cvInput.files[0];
    cvInput.value = "";
    if (!file) return;
    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("File harus berformat PDF.");
      if (file.size > MAX_CV_SIZE) throw new Error("Ukuran CV maksimal 10 MB.");
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head) !== "%PDF-") throw new Error("File ini bukan PDF yang valid.");
      state.cv = { blob: file, name: file.name };
      $("#cv-cancel").hidden = false;
      setStatus("#cv-status", `Siap diganti: ${file.name} (${Math.round(file.size / 1024)} KB). Klik Publikasikan di langkah 4.`, "ok");
    } catch (err) {
      setStatus("#cv-status", err.message, "err");
    }
    updateDirty();
  });

  $("#cv-cancel").addEventListener("click", () => {
    clearCv();
    setStatus("#cv-status", "");
    updateDirty();
  });

  function clearCv() {
    state.cv = null;
    $("#cv-cancel").hidden = true;
  }

  /* ---------- Batalkan & unduh manual ---------- */
  $("#discard").addEventListener("click", () => {
    if (!confirm("Batalkan semua perubahan yang belum dipublikasikan?")) return;
    state.projects = clone(state.baseline);
    clearCv();
    setStatus("#cv-status", "");
    dropUnusedLocalImages();
    setStatus("#pub-status", "");
    renderList();
  });

  $("#download").addEventListener("click", () => {
    saveFile(new Blob([serialize(state.projects)], { type: "text/javascript" }), "projects.js");
    const imgs = pendingImages();
    imgs.forEach((path) => saveFile(state.images.get(path).blob, path.split("/").pop()));
    setStatus("#pub-status",
      `Diunduh: projects.js${imgs.length ? ` dan ${imgs.length} gambar` : ""}. Unggah manual ke GitHub: projects.js → folder data/` +
      (imgs.length ? ", gambar → folder assets/projects/." : ".") +
      (state.cv ? " Untuk CV: unggah file PDF Anda ke folder assets/ dengan nama cv.pdf." : ""), "ok");
  });

  function saveFile(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Mulai ---------- */
  const saved = readStore();
  ["owner", "repo", "branch"].forEach((k) => { if (saved[k]) connForm[k].value = saved[k]; });
  if (saved.token) {
    connForm.token.value = saved.token;
    try { connForm.remember.checked = !!JSON.parse(localStorage.getItem(STORE_KEY) || "{}").token; } catch (e) { /* abaikan */ }
    connForm.requestSubmit();
  }
  if (!window.PROJECTS) setStatus("#conn-status", "data/projects.js tidak terbaca. Hubungkan GitHub untuk memuat data.", "err");
  renderList();
})();
