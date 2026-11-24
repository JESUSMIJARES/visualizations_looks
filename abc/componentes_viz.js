/**
 * Visualización: Componentes del rubro
 * Tabla de componentes (peso, eventos o tiempo, calificación con barra)
 * + distribución de unidades Bien / Atención / Crítico.
 *
 * Cómo alimentarla (Explore "Componentes por Rubro"):
 *  - Dimensiones: Componente, Peso, Rubro (componentes)
 *  - Medidas, EN ESTE ORDEN:
 *      1. Calificación   2. Eventos   3. Tiempo (h)
 *      4. Bien (rubro)   5. Atención (rubro)   6. Crítico (rubro)
 *  - El filtro "Rubro" del dashboard decide qué componentes llegan.
 *  Si un rubro no tiene eventos (ej. Conducción RPM), la columna muestra el tiempo en horas.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "componentes_rubro",
    label: "Componentes del Rubro",

    options: {
        title: { type: "string", label: "Título (vacío = Componentes · rubro)", default: "", section: "Texto", order: 1 },
        distTitle: { type: "string", label: "Título de la distribución (vacío = automático)", default: "", section: "Texto", order: 2 },
        sortBy: {
            type: "string", label: "Orden de los componentes", display: "select", section: "Estilo", order: 1,
            values: [{ "Calificación (menor a mayor)": "score" }, { "Peso (mayor a menor)": "peso" }, { "Como vienen": "none" }],
            default: "score"
        },
        darkMode: { type: "boolean", label: "Modo oscuro", default: false, section: "Estilo", order: 2 },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .cp-wrap { --bg:#ffffff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0; --track:#f1f5f9; --head:#334155;
          width:100%; height:100%; box-sizing:border-box; padding:4px 6px; overflow:auto; background:var(--bg); color:var(--text);
          font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
        .cp-wrap.dark { --bg:#111827; --text:#f1f5f9; --muted:#94a3b8; --line:#1f2937; --track:#1f2937; --head:#cbd5e1; }
        .cp-title { margin:0 0 14px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--head); }
        table.cp { width:100%; border-collapse:collapse; font-size:13px; }
        .cp th { font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted);
          padding:6px 10px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
        .cp th:first-child, .cp td:first-child { text-align:left; }
        .cp td { padding:9px 10px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
        .cp td.score .sc { display:flex; align-items:center; justify-content:flex-end; gap:12px; }
        .cp .track { width:90px; height:6px; border-radius:999px; background:var(--track); overflow:hidden; }
        .cp .fill { height:100%; border-radius:999px; }
        .cp .val { font-size:16px; font-weight:800; min-width:44px; text-align:right; }
        .cp-sub { margin:22px 0 10px; font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
        .cp-dist { display:grid; grid-template-columns:110px minmax(80px, 260px) 40px; gap:10px 14px; align-items:center;
          font-size:13px; justify-content:center; }
        .cp-dist .bar { height:9px; border-radius:999px; background:var(--track); overflow:hidden; }
        .cp-dist .bar div { height:100%; border-radius:999px; }
        .cp-dist b { font-weight:800; text-align:right; }
        .cp-empty { font-size:13px; color:var(--muted); padding:12px 0; }
      </style>
      <div class="cp-wrap" id="cp-wrap">
        <h3 class="cp-title" id="cp-title"></h3>
        <table class="cp" id="cp-table"></table>
        <div class="cp-sub" id="cp-sub"></div>
        <div class="cp-dist" id="cp-dist"></div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);

        $("cp-wrap").classList.toggle("dark", config.darkMode === true);

        if (!dims.length || !measures.length) {
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa Componente, Peso y Rubro + Calificación, Eventos, Tiempo (h), Bien, Atención y Crítico (en ese orden)." });
            done(); return;
        }

        // ---------- Identificar dimensiones ----------
        const dRubro = dims.find(d => /(^|\.)rubro$/.test(d.name));
        const dPeso = dims.find(d => /(^|\.)peso$/.test(d.name));
        const dComp = dims.find(d => d !== dRubro && d !== dPeso) || dims[0];
        const [mCal, mEv, mHr, mB, mA, mC] = measures.map(m => m.name);

        const RUBROS = {
            seguridad: "Seguridad", conduccion_rpm: "Conducción RPM", camaras: "Cámaras", salud_mecanica: "Salud Mecánica",
            ralenti: "Ralentí", dano_motor: "Daño Motor", general: "General", combustible: "Combustible"
        };
        const rubroKey = dRubro && data[0] ? String(data[0][dRubro.name].value || "") : "";
        const rubroName = RUBROS[rubroKey] || rubroKey;
        $("cp-title").textContent = config.title || (rubroName ? `Componentes · ${rubroName}` : "Componentes");

        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const COLORS = { good: "#22c55e", warn: "#eab308", bad: "#ef4444", none: "#94a3b8" };
        const stateOf = (v) => v === null ? "none" : v >= goodFrom ? "good" : v >= warnFrom ? "warn" : "bad";

        // ---------- Filas de componentes ----------
        let rows = data.map(r => ({
            name: LookerCharts.Utils.textForCell(r[dComp.name]),
            peso: dPeso ? toNum(r[dPeso.name].value) : null,
            cal: mCal ? toNum(r[mCal] && r[mCal].value) : null,
            ev: mEv ? toNum(r[mEv] && r[mEv].value) : null,
            hr: mHr ? toNum(r[mHr] && r[mHr].value) : null,
            links: (mCal && r[mCal] && r[mCal].links) || []
        })).filter(r => r.name && r.name !== "∅");

        const usesTime = rows.length > 0 && rows.every(r => r.ev === null) && rows.some(r => r.hr !== null);
        if (config.sortBy === "peso") rows.sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0));
        else if (config.sortBy !== "none") rows.sort((a, b) => (a.cal ?? Infinity) - (b.cal ?? Infinity));

        const n0 = (v) => v === null ? "—" : v.toLocaleString("es-MX", { maximumFractionDigits: 0 });
        const linksBy = [];
        $("cp-table").innerHTML = rows.length ? `
      <thead><tr><th>Componente</th><th>Peso</th><th>${usesTime ? "Tiempo" : "Eventos"}</th><th>Calificación</th></tr></thead>
      <tbody>${rows.map((r, i) => {
            linksBy[i] = r.links;
            const st = stateOf(r.cal), color = COLORS[st];
            const pct = r.cal === null ? 0 : Math.max(0, Math.min(100, r.cal));
            return `<tr data-i="${i}" style="${r.links.length ? "cursor:pointer" : ""}">
          <td>${esc(r.name)}</td>
          <td>${r.peso === null ? "—" : Math.round(r.peso * 100) + "%"}</td>
          <td>${usesTime ? (r.hr === null ? "—" : n0(r.hr) + " h") : n0(r.ev)}</td>
          <td class="score"><div class="sc"><div class="track"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="val" style="color:${color}">${r.cal === null ? "—" : r.cal.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span></div></td>
        </tr>`;
        }).join("")}</tbody>` : `<tbody><tr><td class="cp-empty">Este rubro no tiene componentes.</td></tr></tbody>`;

        element.querySelectorAll("#cp-table tr[data-i]").forEach(tr => {
            const links = linksBy[Number(tr.getAttribute("data-i"))];
            if (links && links.length) tr.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links, event }));
        });

        // ---------- Distribución de unidades (se lee de la primera fila) ----------
        const first = data[0] || {};
        const dist = [
            { label: "Bien", icon: "●", color: COLORS.good, m: mB },
            { label: "Atención", icon: "▲", color: COLORS.warn, m: mA },
            { label: "Crítico", icon: "◆", color: COLORS.bad, m: mC }
        ].filter(d => d.m).map(d => ({ ...d, v: toNum(first[d.m] && first[d.m].value) || 0, links: (first[d.m] && first[d.m].links) || [] }));
        const totalUnits = dist.reduce((s, d) => s + d.v, 0);

        $("cp-sub").textContent = dist.length ? (config.distTitle || `Unidades por calificación${rubroName ? " de " + rubroName : ""}`) : "";
        $("cp-sub").style.display = dist.length ? "" : "none";
        $("cp-dist").innerHTML = dist.map((d, i) => `
      <span style="color:var(--text)"><span style="color:${d.color}">${d.icon}</span> ${d.label}</span>
      <div class="bar" data-d="${i}" style="${d.links.length ? "cursor:pointer" : ""}"><div style="width:${totalUnits ? (d.v / totalUnits * 100).toFixed(1) : 0}%;background:${d.color}"></div></div>
      <b>${d.v.toLocaleString("es-MX")}</b>`).join("");
        element.querySelectorAll("#cp-dist .bar").forEach(el => {
            const d = dist[Number(el.getAttribute("data-d"))];
            if (d.links.length) el.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links: d.links, event }));
        });

        done();
    }
});