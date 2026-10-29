/* OrdenaPro: primera versión local. Sin cuentas, servidor ni APIs de pago. */
(() => {
  const $ = id => document.getElementById(id);
  const DB_NAME = "ordenapro-db";
  const STORE = "orders";
  let db = null;
  let currentEditId = null;
  let recognition = null;
  let isRecording = false;
  let memoryFallback = [];
  const fields = ["client","site","machine","technician","fault","workDone","date","minutes","voiceText","notes"];

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB no disponible"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }
  function requestStore(mode="readonly") { return db.transaction(STORE, mode).objectStore(STORE); }
  function allOrders() {
    if (!db) return Promise.resolve([...memoryFallback]);
    return new Promise((resolve,reject) => {
      const req = requestStore().getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function putOrder(order) {
    if (!db) {
      const i = memoryFallback.findIndex(o => o.id === order.id);
      if (i >= 0) memoryFallback[i] = order; else memoryFallback.push(order);
      return Promise.resolve();
    }
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(order);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  function deleteOrder(id) {
    if (!db) { memoryFallback = memoryFallback.filter(o => o.id !== id); return Promise.resolve(); }
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  function uid() { return "OT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase(); }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function materialRow(data={}) {
    const tpl = $("materialTemplate").content.cloneNode(true);
    const row = tpl.querySelector(".material-row");
    row.querySelector(".mat-name").value = data.name || "";
    row.querySelector(".mat-ref").value = data.ref || "";
    row.querySelector(".mat-qty").value = data.qty ?? 1;
    row.querySelector(".mat-unit").value = data.unit || "ud.";
    row.querySelector(".remove-material").addEventListener("click", () => row.remove());
    $("materialsList").appendChild(row);
  }
  function getMaterials() {
    return [...document.querySelectorAll(".material-row")].map(row => ({
      name: row.querySelector(".mat-name").value.trim(),
      ref: row.querySelector(".mat-ref").value.trim(),
      qty: row.querySelector(".mat-qty").value === "" ? "" : Number(row.querySelector(".mat-qty").value),
      unit: row.querySelector(".mat-unit").value
    })).filter(m => m.name || m.ref);
  }
  function fillForm(order={}) {
    fields.forEach(key => { $(key).value = order[key] ?? (key === "date" ? today() : ""); });
    $("materialsList").innerHTML = "";
    (order.materials?.length ? order.materials : [{}]).forEach(materialRow);
    currentEditId = order.id || null;
    $("formTitle").textContent = currentEditId ? "Editar orden" : "Orden de trabajo";
    $("saveBtn").textContent = currentEditId ? "Guardar cambios" : "Guardar orden";
    $("formMessage").textContent = "";
  }
  function formData() {
    const result = {};
    fields.forEach(key => result[key] = $(key).value.trim());
    result.minutes = result.minutes === "" ? "" : Number(result.minutes);
    result.materials = getMaterials();
    return result;
  }
  async function saveCurrent() {
    const data = formData();
    if (!data.client) return showMessage("Indica el cliente antes de guardar.", true);
    if (!data.workDone) return showMessage("Describe el trabajo realizado antes de guardar.", true);
    const existing = currentEditId ? (await allOrders()).find(o => o.id === currentEditId) : null;
    const order = {...data, id: currentEditId || uid(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()};
    try {
      await putOrder(order);
      currentEditId = order.id;
      showMessage("Orden guardada en este dispositivo.");
      await renderOrders();
      $("formTitle").textContent = "Editar orden";
      $("saveBtn").textContent = "Guardar cambios";
    } catch (e) {
      showMessage("No se ha podido guardar. Exporta los datos y revisa el espacio disponible.", true);
    }
  }
  function showMessage(text, error=false) {
    $("formMessage").textContent = text;
    $("formMessage").style.color = error ? "#a43e35" : "#245947";
  }
  async function renderOrders() {
    const query = $("searchOrders").value.toLowerCase().trim();
    const orders = (await allOrders()).sort((a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const filtered = orders.filter(o => JSON.stringify(o).toLowerCase().includes(query));
    $("orderCount").textContent = orders.length;
    const list = $("ordersList");
    if (!filtered.length) {
      list.innerHTML = `<div class="empty">${orders.length ? "No hay coincidencias con esa búsqueda." : "Todavía no hay órdenes guardadas. Crea la primera con el botón de arriba."}</div>`;
      return;
    }
    list.innerHTML = filtered.map(o => {
      const materials = (o.materials || []).map(m => `${m.name || "Material"}${m.ref ? " · "+m.ref : ""} × ${m.qty || 1} ${m.unit || "ud."}`).join("; ");
      return `<article class="order-card">
        <div class="order-card-top"><div><div class="order-id">${esc(o.id)}</div><h3>${esc(o.client || "Sin cliente")} · ${esc(o.machine || "Equipo sin indicar")}</h3><p>${esc(o.date || "")}${o.technician ? " · Técnico: "+esc(o.technician) : ""}${o.minutes !== "" && o.minutes != null ? " · "+esc(o.minutes)+" min" : ""}</p></div></div>
        <p><strong>Trabajo:</strong> ${esc(o.workDone || "")}</p>
        ${o.fault ? `<p><strong>Avería:</strong> ${esc(o.fault)}</p>` : ""}
        ${materials ? `<p><strong>Material:</strong> ${esc(materials)}</p>` : ""}
        <div class="order-actions">
          <button class="secondary" data-action="edit" data-id="${esc(o.id)}">Editar</button>
          <button class="secondary" data-action="print" data-id="${esc(o.id)}">Imprimir / PDF</button>
          <button class="secondary" data-action="delete" data-id="${esc(o.id)}">Eliminar</button>
        </div>
      </article>`;
    }).join("");
  }
  async function actionOrder(action,id) {
    const order = (await allOrders()).find(o => o.id === id);
    if (!order) return;
    if (action === "edit") {
      fillForm(order);
      $("formPanel").scrollIntoView({behavior:"smooth",block:"start"});
    } else if (action === "delete") {
      if (confirm(`¿Eliminar la orden ${id}? Esta acción no se puede deshacer.`)) {
        await deleteOrder(id);
        if (currentEditId === id) fillForm();
        await renderOrders();
      }
    } else if (action === "print") printOrder(order);
  }
  function printOrder(o) {
    const w = window.open("", "_blank");
    if (!w) { alert("El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para esta app o usa la exportación CSV."); return; }
    const mats = (o.materials || []).filter(m => m.name || m.ref).map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.ref)}</td><td>${esc(m.qty)}</td><td>${esc(m.unit)}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Orden ${esc(o.id)}</title><style>body{font:14px Arial,sans-serif;color:#17251e;margin:32px}h1{color:#173d32}small{color:#627168}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}section{margin:18px 0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd7d0;padding:8px;text-align:left}th{background:#edf4ef}.line{border-bottom:1px solid #ddd;padding:9px 0;min-height:22px}@media print{button{display:none}}</style></head><body><h1>Orden de trabajo</h1><small>${esc(o.id)} · Fecha: ${esc(o.date || "")}</small><div class="meta"><div><b>Cliente</b><div>${esc(o.client)}</div></div><div><b>Centro / ubicación</b><div>${esc(o.site)}</div></div><div><b>Máquina / equipo</b><div>${esc(o.machine)}</div></div><div><b>Técnico</b><div>${esc(o.technician)}</div></div><div><b>Tiempo empleado</b><div>${esc(o.minutes)} min</div></div><div><b>Avería / solicitud</b><div>${esc(o.fault)}</div></div></div><section><h3>Trabajo realizado</h3><div class="line">${esc(o.workDone)}</div></section><section><h3>Material utilizado</h3><table><thead><tr><th>Descripción</th><th>Referencia</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>${mats || "<tr><td colspan='4'>Sin materiales registrados</td></tr>"}</tbody></table></section><section><h3>Observaciones</h3><div class="line">${esc(o.notes)}</div></section><p style="margin-top:45px">Firma del cliente: ___________________________</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }
  function download(filename, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function csvCell(value) { return `"${String(value ?? "").replace(/"/g,'""')}"`; }
  async function exportCSV() {
    const orders = await allOrders();
    if (!orders.length) return alert("Todavía no hay órdenes que exportar.");
    const header = ["ID","Fecha","Cliente","Ubicación","Máquina","Técnico","Avería","Trabajo realizado","Tiempo (min)","Materiales","Observaciones"];
    const rows = orders.map(o => [o.id,o.date,o.client,o.site,o.machine,o.technician,o.fault,o.workDone,o.minutes,(o.materials||[]).map(m=>`${m.name} [${m.ref}] x ${m.qty} ${m.unit}`).join(" | "),o.notes]);
    const csv = "\uFEFF" + [header,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n");
    download("ordenes-trabajo.csv",csv,"text/csv;charset=utf-8");
  }
  async function backupJSON() {
    const orders = await allOrders();
    download("ordenapro-copia-"+today()+".json",JSON.stringify({app:"OrdenaPro",version:1,exportedAt:new Date().toISOString(),orders},null,2),"application/json");
  }
  async function importJSON(file) {
    try {
      const data = JSON.parse(await file.text());
      const orders = Array.isArray(data) ? data : data.orders;
      if (!Array.isArray(orders)) throw new Error("Formato no válido");
      if (!confirm(`Se van a importar ${orders.length} órdenes. Si una orden tiene el mismo ID, se actualizará. ¿Continuar?`)) return;
      for (const o of orders) {
        if (o && o.id && o.client && o.workDone) await putOrder(o);
      }
      await renderOrders();
      alert("Importación terminada. Revisa los datos importados.");
    } catch { alert("No se pudo importar. Selecciona una copia JSON válida de OrdenaPro."); }
    $("importFile").value = "";
  }
  function parseVoiceText() {
    const text = $("voiceText").value.trim();
    if (!text) return showMessage("Primero dicta o escribe una descripción.", true);
    // Helpers simples, transparentes y editables; no se usa IA ni servicio externo.
    const client = text.match(/(?:cliente|empresa)\s+([^,.;]+)/i);
    const machine = text.match(/(?:máquina|maquina|equipo)\s+([^,.;]+)/i);
    const minutes = text.match(/(\d+)\s*(?:minutos|minuto|min)\b/i);
    const fault = text.match(/(?:avería|averia|problema|fuga)\s+([^.;]+)/i);
    if (client && !$("client").value) $("client").value = client[1].trim();
    if (machine && !$("machine").value) $("machine").value = machine[1].trim();
    if (minutes && !$("minutes").value) $("minutes").value = minutes[1];
    if (fault && !$("fault").value) $("fault").value = fault[0].trim();
    if (!$("workDone").value) $("workDone").value = text;
    showMessage("He rellenado algunos campos cuando he reconocido el patrón. Revisa todo antes de guardar.");
  }
  function setupVoice() {
    // En el APK, utiliza el reconocedor nativo de Android cuando está disponible.
    if (window.AndroidVoice && typeof window.AndroidVoice.start === "function") {
      window.onNativeVoiceResult = text => {
        const existing = $("voiceText").value.trim();
        $("voiceText").value = existing ? existing + " " + text : text;
        $("voiceBtn").classList.remove("recording");
        $("voiceLabel").textContent = "Dictar parte";
      };
      window.onNativeVoicePartial = text => {
        $("voiceBtn").classList.add("recording");
        $("voiceLabel").textContent = "Escuchando…";
        $("voiceText").value = text;
      };
      window.onNativeVoiceStatus = text => {
        $("voiceStatus").textContent = text;
        if (!text.includes("Escuchando")) {
          $("voiceBtn").classList.remove("recording");
          $("voiceLabel").textContent = "Dictar parte";
        }
      };
      $("voiceBtn").addEventListener("click", () => {
        $("voiceStatus").textContent = "Solicitando reconocimiento de voz del móvil…";
        try { window.AndroidVoice.start(); }
        catch { $("voiceStatus").textContent = "No se pudo iniciar el servicio de voz. Puedes escribir el texto."; }
      });
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $("voiceBtn").disabled = true;
      $("voiceBtn").title = "Este navegador no ofrece reconocimiento de voz compatible.";
      $("voiceStatus").textContent = "Este navegador no admite dictado. Usa el teclado por voz del móvil o escribe el texto.";
      $("voiceBtn").style.opacity = ".55";
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      isRecording = true;
      $("voiceBtn").classList.add("recording");
      $("voiceLabel").textContent = "Escuchando… pulsa para parar";
      $("voiceStatus").textContent = "Habla con claridad. El navegador puede necesitar conexión a Internet.";
    };
    recognition.onresult = event => {
      let transcript = "";
      for (let i=0; i<event.results.length; i++) transcript += event.results[i][0].transcript + (event.results[i].isFinal ? " " : "");
      $("voiceText").value = transcript.trim();
    };
    recognition.onerror = event => {
      $("voiceStatus").textContent = event.error === "not-allowed" ? "Permite el micrófono en el navegador." : "No se pudo reconocer la voz. Puedes escribir o usar el dictado del teclado.";
    };
    recognition.onend = () => {
      isRecording = false;
      $("voiceBtn").classList.remove("recording");
      $("voiceLabel").textContent = "Dictar parte";
      if (!$("voiceStatus").textContent.includes("Permite")) $("voiceStatus").textContent = "Dictado finalizado. Revisa la transcripción.";
    };
    $("voiceBtn").addEventListener("click", () => {
      if (isRecording) recognition.stop();
      else {
        try { recognition.start(); }
        catch { $("voiceStatus").textContent = "Espera un momento y vuelve a intentarlo."; }
      }
    });
  }
  function init() {
    $("date").value = today();
    materialRow();
    $("newOrderBtn").addEventListener("click", () => {
      fillForm();
      $("formPanel").scrollIntoView({behavior:"smooth",block:"start"});
      $("client").focus({preventScroll:true});
    });
    $("addMaterialBtn").addEventListener("click", () => materialRow());
    $("saveBtn").addEventListener("click", saveCurrent);
    $("clearBtn").addEventListener("click", () => { if(confirm("¿Limpiar el formulario actual? Los cambios sin guardar se perderán.")) fillForm(); });
    $("parseBtn").addEventListener("click", parseVoiceText);
    $("searchOrders").addEventListener("input", renderOrders);
    $("exportCsvBtn").addEventListener("click", exportCSV);
    $("backupBtn").addEventListener("click", backupJSON);
    $("importFile").addEventListener("change", e => { if (e.target.files?.[0]) importJSON(e.target.files[0]); });
    $("ordersList").addEventListener("click", e => {
      const btn = e.target.closest("button[data-action]");
      if (btn) actionOrder(btn.dataset.action,btn.dataset.id);
    });
    setupVoice();
    openDB().then(() => { $("connectionState").textContent = "Guardado local"; renderOrders(); })
      .catch(() => { $("connectionState").textContent = "Modo temporal"; $("voiceStatus").textContent += " Almacenamiento limitado en este navegador."; renderOrders(); });
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
    }
    window.addEventListener("online", () => $("connectionState").textContent = "Con conexión");
    window.addEventListener("offline", () => $("connectionState").textContent = "Sin conexión");
  }
  document.addEventListener("DOMContentLoaded", init);
})();