/**
 * Visualización: Rejilla de Rubros (tarjetas con semáforo, delta y minitendencia)
 *
 * Cómo alimentarla:
 *  - 1 dimensión de fecha (ej. Periodo Month) + 1 medida por rubro.
 *  - Cada medida es una tarjeta. El valor grande es el periodo más reciente,
 *    el delta compara contra el periodo anterior y la línea muestra todos los periodos.
 *  - Si un rubro no tiene dato en el periodo actual, la tarjeta dice "Pendiente de fuente".
 *  - Sin dimensión de fecha: muestra solo los valores (sin delta ni tendencia).
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "rubros_grid",
    label: "Rejilla de Rubros",

    options: {
        title: { type: "string", label: "Título", default: "Rubros", section: "Texto", order: 1 },
        showLegend: { type: "boolean", label: "Mostrar leyenda del semáforo", default: true, section: "Texto", order: 2 },
        showPeriod: { type: "boolean", label: "Mostrar periodo (ej. junio vs mayo)", default: true, section: "Texto", order: 3 },
        pendingText: { type: "string", label: "Texto cuando no hay dato", default: "Pendiente de fuente", section: "Texto", order: 4 },

        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 },
        goodLabel: { type: "string", label: "Etiqueta Bien", default: "Bien", section: "Semáforo", order: 3 },
        warnLabel: { type: "string", label: "Etiqueta Atención", default: "Atención", section: "Semáforo", order: 4 },
        badLabel: { type: "string", label: "Etiqueta Crítico", default: "Crítico", section: "Semáforo", order: 5 },

        columns: { type: "number", label: "Columnas", default: 3, section: "Estilo", order: 1 },
        decimals: { type: "number", label: "Decimales del valor", default: 1, section: "Estilo", order: 2 },
        showSparkline: { type: "boolean", label: "Mostrar minitendencia", default: true, section: "Estilo", order: 3 },
        enableDrill: { type: "boolean", label: "Abrir detalle al dar clic", default: true, section: "Estilo", order: 4 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 5 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .rg-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .rg-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff;
          border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; overflow: auto; }
        .rg-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .rg-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .rg-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #334155; }
        .rg-legend { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; justify-content: center; }
        .rg-chip { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; border: 1px solid; }
        .rg-period { font-size: 11px; color: #94a3b8; margin-left: auto; }
        .rg-grid { display: grid; gap: 10px; flex: 1; }
        .rg-item { position: relative; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;
          background: #f8fafc; display: flex; flex-direction: column; gap: 6px; min-height: 92px; }
        .rg-item.clickable { cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        .rg-item.clickable:hover { border-color: #c7d2e3; box-shadow: 0 4px 12px rgba(17,24,39,.08); }
        .rg-item-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .rg-name { font-size: 12px; font-weight: 600; color: #334155; line-height: 1.2; }
        .rg-help { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #cbd5e1; color: #64748b;
          font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; }
        .rg-body { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
        .rg-left { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .rg-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1; letter-spacing: -.01em; }
        .rg-value.pending { font-size: 20px; color: #94a3b8; }
        .rg-badge { align-self: flex-start; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 4px; }
        .rg-delta { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
        .rg-spark { flex: 1; max-width: 120px; height: 36px; }
        .rg-spark svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .s-good { color: #15803d; background: #dcfce7; border-color: #bbf7d0; }
        .s-warn { color: #b45309; background: #fef3c7; border-color: #fde68a; }
        .s-bad  { color: #b91c1c; background: #fee2e2; border-color: #fecaca; }
        .s-none { color: #64748b; background: #f1f5f9; border-color: #e2e8f0; }
      </style>
      <div class="rg-wrap">
        <div class="rg-card with-border" id="rg-card">
          <div class="rg-head">
            <h3 class="rg-title" id="rg-title"></h3>
            <div class="rg-legend" id="rg-legend"></div>
            <span class="rg-period" id="rg-period"></span>
          </div>
          <div class="rg-grid" id="rg-grid"></div>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;

        if (measures.length === 0) {
            this.addError({ id: "no-measures", title: "Faltan medidas", message: "Agrega una medida por rubro (Seguridad, Conducción RPM, Daño Motor…)." });
            done(); return;
        }

        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);

        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const labels = {
            good: config.goodLabel || "Bien",
            warn: config.warnLabel || "Atención",
            bad: config.badLabel || "Crítico"
        };
        const decimals = Number.isFinite(config.decimals) ? config.decimals : 1;
        const pendingText = config.pendingText || "Pendiente de fuente";
        const COLORS = { good: "#16a34a", warn: "#d97706", bad: "#dc2626", none: "#94a3b8" };
        const stateOf = (v) => v === null ? "none" : v >= goodFrom ? "good" : v >= warnFrom ? "warn" : "bad";
        const fmt = (v, d) => v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

        // ---------- Orden por periodo ----------
        let rows = data.slice();
        if (dims.length > 0) {
            const d0 = dims[0].name;
            rows.sort((a, b) => String(a[d0].value).localeCompare(String(b[d0].value)));
        }
        const last = rows[rows.length - 1];
        const prev = rows.length > 1 ? rows[rows.length - 2] : null;

        // ---------- Encabezado ----------
        $("rg-title").textContent = config.title || "";
        $("rg-card").classList.toggle("with-border", config.showCard !== false);

        const legend = $("rg-legend");
        legend.style.display = config.showLegend === false ? "none" : "";
        legend.innerHTML =
            `<span class="rg-chip s-good">● ≥ ${goodFrom} ${esc(labels.good)}</span>` +
            `<span class="rg-chip s-warn">▲ ${warnFrom}–${goodFrom} ${esc(labels.warn)}</span>` +
            `<span class="rg-chip s-bad">◆ &lt; ${warnFrom} ${esc(labels.bad)}</span>`;

        const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const periodName = (row) => {
            if (!row || dims.length === 0) return "";
            const raw = String(row[dims[0].name].value || "");
            const m = raw.match(/^(\d{4})-(\d{2})/);
            return m ? MESES[parseInt(m[2], 10) - 1] : LookerCharts.Utils.textForCell(row[dims[0].name]);
        };
        const periodEl = $("rg-period");
        periodEl.style.display = config.showPeriod === false ? "none" : "";
        periodEl.textContent = prev ? `${periodName(last)} vs ${periodName(prev)}` : periodName(last);

        // ---------- Minitendencia (SVG) ----------
        const sparkline = (values, color) => {
            const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
            if (pts.length < 2) return "";
            const W = 120, H = 36, pad = 3;
            const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v));
            const span = max - min || 1;
            const n = values.length - 1 || 1;
            const xy = pts.map(p => [pad + (p.i / n) * (W - pad * 2), pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
            const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
            const lastPt = xy[xy.length - 1];
            return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <path d="${area}" fill="${color}" fill-opacity="0.15" stroke="none"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
        <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="2.6" fill="${color}"/>
      </svg>`;
        };

        // ---------- Tarjetas ----------
        const cols = Math.max(1, Math.round(Number.isFinite(config.columns) ? config.columns : 3));
        const grid = $("rg-grid");
        grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

        const arrowUp = "▲", arrowDown = "▼", flat = "■";
        const linksByIndex = [];

        grid.innerHTML = measures.map((m, idx) => {
            const name = m.label_short || m.label;
            const help = m.description || name;
            const cur = last ? toNum(last[m.name] && last[m.name].value) : null;
            const before = prev ? toNum(prev[m.name] && prev[m.name].value) : null;
            const series = rows.map(r => toNum(r[m.name] && r[m.name].value));
            const state = stateOf(cur);
            const color = COLORS[state];
            linksByIndex[idx] = (last && last[m.name] && last[m.name].links) || [];

            let valueHtml, badgeHtml, deltaHtml = "";
            if (cur === null) {
                valueHtml = `<div class="rg-value pending">—</div>`;
                badgeHtml = `<span class="rg-badge s-none">${esc(pendingText)}</span>`;
            } else {
                valueHtml = `<div class="rg-value">${fmt(cur, decimals)}</div>`;
                const icon = state === "good" ? "●" : state === "warn" ? "▲" : "◆";
                badgeHtml = `<span class="rg-badge s-${state}">${icon} ${esc(labels[state])}</span>`;
                if (before !== null) {
                    const diff = Number((cur - before).toFixed(decimals));
                    const dColor = diff > 0 ? COLORS.good : diff < 0 ? COLORS.bad : COLORS.none;
                    const dIcon = diff > 0 ? arrowUp : diff < 0 ? arrowDown : flat;
                    deltaHtml = `<span class="rg-delta" style="color:${dColor}">${dIcon} ${fmt(Math.abs(diff), decimals)}</span>`;
                }
            }

            const spark = config.showSparkline !== false && dims.length > 0 ? sparkline(series, color) : "";
            const clickable = config.enableDrill !== false && linksByIndex[idx].length > 0;

            return `
        <div class="rg-item${clickable ? " clickable" : ""}" data-idx="${idx}">
          <div class="rg-item-top">
            <span class="rg-name">${esc(name)}</span>
            <span class="rg-help" title="${esc(help)}">?</span>
          </div>
          <div class="rg-body">
            <div class="rg-left">${valueHtml}${badgeHtml}${deltaHtml}</div>
            <div class="rg-spark">${spark}</div>
          </div>
        </div>`;
        }).join("");

        // ---------- Clic para abrir el detalle ----------
        grid.querySelectorAll(".rg-item.clickable").forEach(el => {
            el.addEventListener("click", (event) => {
                const links = linksByIndex[Number(el.getAttribute("data-idx"))];
                if (links && links.length) LookerCharts.Utils.openDrillMenu({ links, event });
            });
        });

        done();
    }
});
