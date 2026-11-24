/**
 * Visualización: Tira de Rubros (vista Análisis)
 * Una fila de tarjetas compactas: General, los 6 rubros y Combustible.
 * Resalta el rubro elegido en el filtro "Rubro" del dashboard.
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión: Periodo Month (filtro "is in the last 6 months")
 *  - Medidas, en el orden en que quieres las tarjetas:
 *      Calificación General, Seguridad, Ralentí, Cámaras, Conducción RPM, Daño Motor, Salud Mecánica
 *      + Ahorro por Lograr (opcional, tarjeta Combustible en $)
 *      + Calificación seleccionada (opcional, NO se dibuja: solo sirve para saber qué rubro resaltar)
 *
 * Es una visualización nueva: no cambia la Rejilla de Rubros del Reporte General.
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "rubros_strip",
    label: "Tira de Rubros",

    options: {
        title: { type: "string", label: "Título", default: "Rubros", section: "Texto", order: 1 },
        rightText: { type: "string", label: "Texto a la derecha (vacío = mes)", default: "", section: "Texto", order: 2 },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 },
        darkMode: { type: "boolean", label: "Modo oscuro", default: false, section: "Estilo", order: 1 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .rs-wrap { --bg:#fff; --card:#fff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0; --head:#334155;
          --good:#15803d; --warn:#b7791f; --bad:#dc2626; --sel:#2563eb; --selbg:#eff6ff;
          width:100%; height:100%; box-sizing:border-box; padding:2px 4px; background:var(--bg); color:var(--text);
          font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; display:flex; flex-direction:column; overflow:auto; }
        .rs-wrap.dark { --bg:#111827; --card:#111827; --text:#f1f5f9; --muted:#94a3b8; --line:#1f2937; --head:#cbd5e1;
          --good:#22c55e; --warn:#eab308; --bad:#ef4444; --sel:#60a5fa; --selbg:#172554; }
        .rs-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
        .rs-title { margin:0; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--head); }
        .rs-right { font-size:11px; color:var(--muted); }
        .rs-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(125px, 1fr)); gap:6px; }
        .rs-card { border:1px solid var(--line); border-radius:8px; padding:6px 8px; background:var(--card);
          display:flex; flex-direction:column; gap:2px; min-width:0; }
        .rs-card.sel { border:2px solid var(--sel); background:var(--selbg); padding:5px 7px; }
        .rs-card.click { cursor:pointer; } .rs-card.click:hover { border-color:#94a3b8; }
        .rs-card.sel.click:hover { border-color:var(--sel); }
        .rs-name { font-size:11px; color:var(--head); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rs-row { display:flex; align-items:center; gap:6px; min-width:0; }
        .rs-val { font-size:17px; font-weight:700; line-height:1.1; letter-spacing:-.01em; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .rs-pill { font-size:9px; font-weight:600; padding:1px 6px; border-radius:999px; white-space:nowrap; }
        .rs-pill.good { color:var(--good); background:rgba(34,197,94,.14); }
        .rs-pill.warn { color:var(--warn); background:rgba(234,179,8,.18); }
        .rs-pill.bad  { color:var(--bad);  background:rgba(239,68,68,.12); }
        .rs-unit { font-size:10.5px; color:var(--muted); white-space:nowrap; }
        .rs-spark { flex:1; min-width:24px; height:16px; }
        .rs-spark svg { width:100%; height:100%; display:block; overflow:visible; }
        .rs-delta { font-size:10px; font-weight:600; white-space:nowrap; }
        .rs-delta small { color:var(--muted); font-weight:400; margin-left:3px; }
      </style>
      <div class="rs-wrap" id="rs-wrap">
        <div class="rs-head"><h3 class="rs-title" id="rs-title"></h3><span class="rs-right" id="rs-right"></span></div>
        <div class="rs-grid" id="rs-grid"></div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        $("rs-wrap").classList.toggle("dark", config.darkMode === true);
        if (!measures.length) {
            this.addError({ id: "fields", title: "Faltan medidas", message: "Usa Periodo Month + una medida por rubro." });
            done(); return;
        }

        const short = (m) => m.name.split(".").pop();
        const mSel = measures.find(m => short(m) === "calificacion_seleccionada");
        const cards = measures.filter(m => m !== mSel);

        // ---------- Meses: del más viejo al más reciente con dato ----------
        let rows = data.slice();
        const d0 = dims.length ? dims[0].name : null;
        if (d0) rows.sort((a, b) => String(a[d0].value).localeCompare(String(b[d0].value)));
        const has = (r) => cards.some(m => toNum(r[m.name] && r[m.name].value) !== null);
        while (rows.length > 1 && !has(rows[rows.length - 1])) rows.pop();
        while (rows.length > 1 && !has(rows[0])) rows.shift();
        const last = rows[rows.length - 1] || {};
        const prev = rows.length > 1 ? rows[rows.length - 2] : null;

        const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        const MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const ym = (r) => { const m = d0 && r ? String(r[d0].value || "").match(/^(\d{4})-(\d{2})/) : null; return m ? [m[1], parseInt(m[2], 10) - 1] : null; };
        const lastYm = ym(last), prevYm = ym(prev);

        $("rs-title").textContent = config.title || "";
        $("rs-right").textContent = config.rightText || (lastYm ? `${MESL[lastYm[1]]} ${lastYm[0]}` : "");

        // ---------- Rubro seleccionado (por el nombre que toma la medida del filtro) ----------
        const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^calificacion\s+/, "").trim();
        const selName = mSel ? norm(mSel.label_short || mSel.label) : "";

        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const state = (v) => v >= goodFrom ? "good" : v >= warnFrom ? "warn" : "bad";
        const LBL = { good: "● Bien", warn: "▲ Atención", bad: "◆ Crítico" };
        const d1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const money = (v) => {
            const a = Math.abs(v);
            if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(v).toLocaleString("es-MX");
        };
        const spark = (values, color) => {
            const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
            if (pts.length < 2) return "";
            const W = 60, H = 16, pad = 2, n = values.length - 1 || 1;
            const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)), span = max - min || 1;
            const xy = pts.map(p => [pad + (p.i / n) * (W - pad * 2), pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
            const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
            return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${area}" fill="${color}" fill-opacity=".12"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.3" vector-effect="non-scaling-stroke"/></svg>`;
        };

        const linksBy = [];
        $("rs-grid").innerHTML = cards.map((m, i) => {
            const isMoney = /ahorro|gasto|monto/.test(short(m));
            const name = isMoney ? "Combustible" : String(m.label_short || m.label).replace(/^Calificaci[oó]n\s+/i, "");
            const cur = toNum(last[m.name] && last[m.name].value);
            const bef = prev ? toNum(prev[m.name] && prev[m.name].value) : null;
            const series = rows.map(r => toNum(r[m.name] && r[m.name].value));
            linksBy[i] = (last[m.name] && last[m.name].links) || [];
            const vs = prevYm ? `<small>vs ${MES[prevYm[1]]}</small>` : "";

            let valHtml, extra = "", deltaHtml = "", color;
            if (cur === null) {
                color = "var(--muted)";
                valHtml = `<span class="rs-val" style="color:${color}">—</span>`;
            } else if (isMoney) {
                color = "var(--bad)";
                valHtml = `<span class="rs-val" style="color:var(--warn)">${money(cur)}</span>`;
                extra = `<span class="rs-unit">por lograr</span>`;
                if (bef !== null) {
                    const d = cur - bef; // menos por lograr = mejor
                    const c = d < 0 ? "var(--good)" : d > 0 ? "var(--bad)" : "var(--muted)";
                    deltaHtml = `<span class="rs-delta" style="color:${c}">${d < 0 ? "▼" : d > 0 ? "▲" : "■"} ${money(Math.abs(d))}${vs}</span>`;
                }
            } else {
                const st = state(cur);
                color = `var(--${st})`;
                valHtml = `<span class="rs-val" style="color:${color}">${d1(cur)}</span>`;
                extra = `<span class="rs-pill ${st}">${LBL[st]}</span>`;
                if (bef !== null) {
                    const d = Number((cur - bef).toFixed(1));
                    const c = d > 0 ? "var(--good)" : d < 0 ? "var(--bad)" : "var(--muted)";
                    deltaHtml = `<span class="rs-delta" style="color:${c}">${d > 0 ? "▲" : d < 0 ? "▼" : "■"} ${d1(Math.abs(d))}${vs}</span>`;
                }
            }
            const sel = !isMoney && selName && norm(name) === selName;
            return `<div class="rs-card${sel ? " sel" : ""}${linksBy[i].length ? " click" : ""}" data-i="${i}" title="${esc(m.description || name)}">
        <span class="rs-name">${esc(name)}</span>
        <div class="rs-row">${valHtml}${extra}<div class="rs-spark">${spark(series, color)}</div></div>
        ${deltaHtml || '<span class="rs-delta">&nbsp;</span>'}
      </div>`;
        }).join("");

        element.querySelectorAll("#rs-grid .rs-card.click").forEach(el => {
            const links = linksBy[Number(el.getAttribute("data-i"))];
            el.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links, event }));
        });

        done();
    }
});