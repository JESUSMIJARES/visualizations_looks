/**
 * Visualización: Calificación General (número grande, semáforo, meta y tendencia)
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión: Periodo Month (filtra los últimos 6 meses)
 *  - Medida 1: Calificación General
 *  - Medidas 2 a 5 (opcionales): cifras de abajo, ej. Vehículos, Km Recorridos, Clientes
 *  El número grande es el mes más reciente; compara contra el mes anterior
 *  y contra el promedio de los 3 meses previos.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "calificacion_general",
    label: "Calificación General",

    options: {
        title: { type: "string", label: "Título", default: "Calificación General", section: "Texto", order: 1 },
        statLabels: {
            type: "string", label: "Etiquetas de las cifras (separadas por coma, vacío = nombre de la medida)",
            default: "", section: "Texto", order: 2
        },
        meta: { type: "number", label: "Meta (línea punteada)", default: 80, section: "Semáforo", order: 1 },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 2 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 3 },
        decimals: { type: "number", label: "Decimales", default: 1, section: "Estilo", order: 1 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 2 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .cg-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .cg-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
        .cg-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .cg-head { display: flex; justify-content: space-between; align-items: center; }
        .cg-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .cg-period { font-size: 11px; color: #94a3b8; }
        .cg-top { display: flex; align-items: center; gap: 14px; }
        .cg-value { font-size: 56px; font-weight: 800; color: #0f172a; line-height: .95; letter-spacing: -.03em; }
        .cg-side { display: flex; flex-direction: column; gap: 5px; }
        .cg-badge { align-self: flex-start; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
        .cg-cmp { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 5px; }
        .cg-cmp b { font-weight: 800; }
        .cg-chart { flex: 1; min-height: 90px; position: relative; }
        .cg-chart svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .cg-stats { display: flex; justify-content: space-between; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        .cg-stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .cg-stat-v { font-size: 18px; font-weight: 800; color: #0f172a; }
        .cg-stat-l { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
        .s-good { color: #15803d; background: #dcfce7; } .s-warn { color: #a16207; background: #fef3c7; }
        .s-bad { color: #b91c1c; background: #fee2e2; } .s-none { color: #64748b; background: #f1f5f9; }
      </style>
      <div class="cg-wrap">
        <div class="cg-card with-border" id="cg-card">
          <div class="cg-head"><h3 class="cg-title" id="cg-title"></h3><span class="cg-period" id="cg-period"></span></div>
          <div class="cg-top">
            <div class="cg-value" id="cg-value">—</div>
            <div class="cg-side" id="cg-side"></div>
          </div>
          <div class="cg-chart" id="cg-chart"></div>
          <div class="cg-stats" id="cg-stats"></div>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        if (dims.length === 0 || measures.length === 0) {
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa Periodo Month + Calificación General (y opcionalmente hasta 4 medidas más para las cifras)." });
            done(); return;
        }

        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        const dec = Number.isFinite(config.decimals) ? config.decimals : 1;
        const fmt = (v, d = dec) => v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const meta = Number.isFinite(config.meta) ? config.meta : null;
        const stateOf = (v) => v === null ? "none" : v >= goodFrom ? "good" : v >= warnFrom ? "warn" : "bad";
        const STATE_TXT = { good: "● Bien", warn: "▲ Atención", bad: "◆ Crítico", none: "Sin dato" };
        const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

        const d0 = dims[0].name, mGen = measures[0].name;
        const rows = data.slice().sort((a, b) => String(a[d0].value).localeCompare(String(b[d0].value)));
        const monthOf = (r) => { const m = String(r[d0].value || "").match(/^(\d{4})-(\d{2})/); return m ? { y: m[1], i: parseInt(m[2], 10) - 1 } : null; };
        const vals = rows.map(r => toNum(r[mGen] && r[mGen].value));
        const n = rows.length;
        const cur = n ? vals[n - 1] : null;
        const prev = n > 1 ? vals[n - 2] : null;
        const prev3 = vals.slice(Math.max(0, n - 4), n - 1).filter(v => v !== null);
        const avg3 = prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : null;

        // ---------- Encabezado y valor ----------
        $("cg-title").textContent = config.title || "";
        $("cg-card").classList.toggle("with-border", config.showCard !== false);
        const lm = n ? monthOf(rows[n - 1]) : null;
        const pm = n > 1 ? monthOf(rows[n - 2]) : null;
        $("cg-period").textContent = lm ? `${MESES_L[lm.i]} ${lm.y}` : "";
        $("cg-value").textContent = cur === null ? "—" : fmt(cur);

        const cmp = (d, label) => {
            if (d === null) return "";
            const r = Number(d.toFixed(dec));
            const color = r > 0 ? "#16a34a" : r < 0 ? "#dc2626" : "#94a3b8";
            const icon = r > 0 ? "▲" : r < 0 ? "▼" : "■";
            return `<div class="cg-cmp"><b style="color:${color}">${icon} ${fmt(Math.abs(r))}</b> ${esc(label)}</div>`;
        };
        const st = stateOf(cur);
        $("cg-side").innerHTML =
            `<span class="cg-badge s-${st}">${STATE_TXT[st]}</span>` +
            (cur !== null && prev !== null ? cmp(cur - prev, pm ? `vs ${MESES_L[pm.i]}` : "vs mes anterior") : "") +
            (cur !== null && avg3 !== null ? cmp(cur - avg3, `vs prom. ${prev3.length} meses`) : "");

        // ---------- Gráfica de línea con meta ----------
        const W = 400, H = 110, padX = 14, padTop = 18, padBot = 22;
        const nums = vals.filter(v => v !== null);
        let chart = "";
        if (nums.length) {
            let min = Math.min(...nums, meta ?? Infinity), max = Math.max(...nums, meta ?? -Infinity);
            const span = Math.max(max - min, 4); min -= span * 0.25; max += span * 0.25;
            const x = (i) => n === 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2);
            const y = (v) => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBot);
            const pts = vals.map((v, i) => v === null ? null : [x(i), y(v)]).filter(Boolean);
            const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padBot} L${pts[0][0].toFixed(1)},${H - padBot} Z` : "";
            const metaLine = meta !== null
                ? `<line x1="${padX}" x2="${W - padX}" y1="${y(meta).toFixed(1)}" y2="${y(meta).toFixed(1)}" stroke="#16a34a" stroke-width="1.2" stroke-dasharray="4 4"/>
           <text x="${padX}" y="${(y(meta) - 5).toFixed(1)}" font-size="10" fill="#16a34a" font-weight="600">Meta ${fmt(meta, 0)}</text>` : "";
            const labels = rows.map((r, i) => { const m = monthOf(r); return m ? `<text x="${x(i).toFixed(1)}" y="${H - 4}" font-size="10" fill="#64748b" text-anchor="middle">${MESES[m.i]}</text>` : ""; }).join("");
            const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#fff" stroke="#1d4ed8" stroke-width="1.6"/>`).join("");
            const last = pts[pts.length - 1];
            const lastLbl = cur !== null ? `<text x="${(last[0] + 6).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}" font-size="11" font-weight="700" fill="#0f172a">${fmt(cur)}</text>` : "";
            chart = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${metaLine}
        ${area ? `<path d="${area}" fill="#3b82f6" fill-opacity="0.08"/>` : ""}
        <path d="${line}" fill="none" stroke="#1d4ed8" stroke-width="2" vector-effect="non-scaling-stroke"/>
        ${dots}${labels}${lastLbl}</svg>`;
        }
        $("cg-chart").innerHTML = chart;

        // ---------- Cifras de abajo (mes más reciente) ----------
        const custom = String(config.statLabels || "").split(",").map(s => s.trim());
        const compact = (v) => {
            if (v === null) return "—";
            const a = Math.abs(v);
            if (a >= 1e6) return (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 1 }) + " M";
            if (a >= 1e4) return Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return v.toLocaleString("es-MX", { maximumFractionDigits: 0 });
        };
        const lastRow = n ? rows[n - 1] : null;
        $("cg-stats").innerHTML = measures.slice(1, 5).map((m, i) => {
            const cell = lastRow && lastRow[m.name];
            const v = toNum(cell && cell.value);
            const label = custom[i] || m.label_short || m.label;
            return `<div class="cg-stat"><span class="cg-stat-v">${compact(v)}</span><span class="cg-stat-l">${esc(label)}</span></div>`;
        }).join("");
        $("cg-stats").style.display = measures.length > 1 ? "" : "none";

        done();
    }
});
