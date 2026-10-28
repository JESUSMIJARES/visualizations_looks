/**
 * Visualización: Comparativa por Región
 * Tabla con semáforo en la calificación, montos de ahorro, minitendencia y delta vs mes anterior.
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión 1: Región
 *  - Dimensión 2: Periodo Month  (para la tendencia y el delta; filtra 6 meses, por ejemplo)
 *  - Medidas, EN ESTE ORDEN:
 *      1. Vehículos   2. Km / Vehículo   3. Calificación General
 *      4. Ahorro Logrado   5. Ahorro por Lograr
 *  Las columnas muestran el mes más reciente. La fila de total se calcula sola.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "tabla_regiones",
    label: "Comparativa por Región",

    options: {
        title: { type: "string", label: "Título", default: "Comparativa por Región", section: "Texto", order: 1 },
        showPeriod: { type: "boolean", label: "Mostrar mes (arriba a la derecha)", default: true, section: "Texto", order: 2 },
        totalLabel: { type: "string", label: "Texto de la fila total", default: "Total", section: "Texto", order: 3 },
        showTotal: { type: "boolean", label: "Mostrar fila total", default: true, section: "Texto", order: 4 },

        sortBy: {
            type: "string", label: "Ordenar por", display: "select", section: "Orden", order: 1,
            values: [
                { "Ahorro por lograr (mayor a menor)": "porLograr" },
                { "Calificación general (menor a mayor)": "general" },
                { "Vehículos (mayor a menor)": "vehiculos" },
                { "Ahorro logrado (mayor a menor)": "logrado" },
                { "Región (A-Z)": "region" }
            ],
            default: "porLograr"
        },

        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 },

        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 1 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .tr-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .tr-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; overflow: auto; }
        .tr-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .tr-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .tr-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .tr-period { font-size: 11px; color: #94a3b8; }
        table.tr { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tr th { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #64748b;
          text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .tr th:first-child, .tr td:first-child { text-align: left; }
        .tr th.sorted::after { content: " ↓"; }
        .tr td { padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #334155; white-space: nowrap; }
        .tr td.name { font-weight: 700; color: #0f172a; }
        .tr tr.total td { background: #f8fafc; font-weight: 700; border-top: 1px solid #e2e8f0; border-bottom: none; }
        .tr .pill { display: inline-block; min-width: 40px; text-align: center; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
        .tr .s-good { color: #15803d; background: #dcfce7; }
        .tr .s-warn { color: #a16207; background: #fef3c7; }
        .tr .s-bad  { color: #b91c1c; background: #fee2e2; }
        .tr .s-none { color: #64748b; background: #f1f5f9; }
        .tr .money-good { color: #15803d; }
        .tr .money-bad { color: #c2410c; }
        .tr .muted { color: #94a3b8; }
        .tr .spark { width: 90px; height: 24px; display: inline-block; vertical-align: middle; }
        .tr .spark svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .tr .delta { font-weight: 700; }
      </style>
      <div class="tr-wrap">
        <div class="tr-card with-border" id="tr-card">
          <div class="tr-head">
            <h3 class="tr-title" id="tr-title"></h3>
            <span class="tr-period" id="tr-period"></span>
          </div>
          <table class="tr" id="tr-table"></table>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;

        if (dims.length === 0 || measures.length < 5) {
            this.addError({
                id: "fields", title: "Faltan campos",
                message: "Usa Región + Periodo Month y 5 medidas en este orden: Vehículos, Km/Vehículo, Calificación General, Ahorro Logrado, Ahorro por Lograr."
            });
            done(); return;
        }

        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);

        const [mVeh, mKm, mGen, mLog, mPor] = measures.map(m => m.name);
        const dRegion = dims[0].name;
        const dMonth = dims.length > 1 ? dims[1].name : null;

        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const stateOf = (v) => v === null ? "none" : v >= goodFrom ? "good" : v >= warnFrom ? "warn" : "bad";
        const COLORS = { good: "#16a34a", warn: "#d97706", bad: "#dc2626", none: "#94a3b8" };

        const money = (v) => {
            if (v === null) return "—";
            const a = Math.abs(v);
            if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(v).toLocaleString("es-MX");
        };
        const num = (v, d = 0) => v === null ? "—" : v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

        // ---------- Meses ----------
        const months = dMonth
            ? [...new Set(data.map(r => String(r[dMonth].value)))].filter(m => m && m !== "null").sort()
            : ["_"];
        const lastMonth = months[months.length - 1];
        const prevMonth = months.length > 1 ? months[months.length - 2] : null;

        // ---------- Agrupar por región ----------
        const regions = new Map();
        data.forEach(r => {
            const name = LookerCharts.Utils.textForCell(r[dRegion]) || "Sin región";
            const month = dMonth ? String(r[dMonth].value) : "_";
            if (!regions.has(name)) regions.set(name, { name, byMonth: {}, links: null });
            const reg = regions.get(name);
            reg.byMonth[month] = {
                veh: toNum(r[mVeh] && r[mVeh].value),
                km: toNum(r[mKm] && r[mKm].value),
                gen: toNum(r[mGen] && r[mGen].value),
                log: toNum(r[mLog] && r[mLog].value),
                por: toNum(r[mPor] && r[mPor].value)
            };
            if (month === lastMonth) reg.links = r[mGen] && r[mGen].links;
        });

        const rowsOut = [...regions.values()].map(reg => {
            const cur = reg.byMonth[lastMonth] || {};
            const prev = prevMonth ? (reg.byMonth[prevMonth] || {}) : {};
            return {
                name: reg.name,
                veh: cur.veh ?? null, km: cur.km ?? null, gen: cur.gen ?? null,
                log: cur.log ?? null, por: cur.por ?? null,
                delta: (cur.gen != null && prev.gen != null) ? cur.gen - prev.gen : null,
                trend: months.map(m => (reg.byMonth[m] && reg.byMonth[m].gen != null) ? reg.byMonth[m].gen : null),
                links: reg.links || []
            };
        }).filter(r => r.veh !== null || r.gen !== null || r.log !== null || r.por !== null);

        // ---------- Orden ----------
        const by = config.sortBy || "porLograr";
        const desc = (k) => (a, b) => (b[k] ?? -Infinity) - (a[k] ?? -Infinity);
        if (by === "porLograr") rowsOut.sort(desc("por"));
        else if (by === "logrado") rowsOut.sort(desc("log"));
        else if (by === "vehiculos") rowsOut.sort(desc("veh"));
        else if (by === "general") rowsOut.sort((a, b) => (a.gen ?? Infinity) - (b.gen ?? Infinity));
        else rowsOut.sort((a, b) => a.name.localeCompare(b.name, "es"));

        // ---------- Total (calificación y km ponderados por vehículos) ----------
        const weighted = (rows, monthKey) => {
            let veh = 0, kmW = 0, kmV = 0, genW = 0, genV = 0, log = 0, por = 0, hasLog = false, hasPor = false;
            rows.forEach(reg => {
                const v = monthKey ? (regions.get(reg.name).byMonth[monthKey] || {}) : reg;
                const n = v.veh || 0;
                veh += n;
                if (v.km != null && n) { kmW += v.km * n; kmV += n; }
                if (v.gen != null && n) { genW += v.gen * n; genV += n; }
                if (v.log != null) { log += v.log; hasLog = true; }
                if (v.por != null) { por += v.por; hasPor = true; }
            });
            return {
                veh, km: kmV ? kmW / kmV : null, gen: genV ? genW / genV : null,
                log: hasLog ? log : null, por: hasPor ? por : null
            };
        };
        const total = weighted(rowsOut, lastMonth);
        const totalPrev = prevMonth ? weighted(rowsOut, prevMonth) : null;
        total.delta = (total.gen != null && totalPrev && totalPrev.gen != null) ? total.gen - totalPrev.gen : null;
        total.trend = months.map(m => weighted(rowsOut, m).gen);

        // ---------- Minitendencia ----------
        const spark = (values) => {
            const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
            if (pts.length < 2) return "";
            const W = 90, H = 24, pad = 3, n = values.length - 1 || 1;
            const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)), span = max - min || 1;
            const xy = pts.map(p => [pad + (p.i / n) * (W - pad * 2), pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
            const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
            const lp = xy[xy.length - 1];
            return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <path d="${area}" fill="#3b82f6" fill-opacity="0.12"/>
        <path d="${line}" fill="none" stroke="#3b82f6" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
        <circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="2.4" fill="#1d4ed8"/></svg>`;
        };

        const deltaHtml = (d) => {
            if (d === null) return `<span class="muted">—</span>`;
            const r = Number(d.toFixed(1));
            const color = r > 0 ? COLORS.good : r < 0 ? COLORS.bad : COLORS.none;
            const icon = r > 0 ? "▲" : r < 0 ? "▼" : "■";
            return `<span class="delta" style="color:${color}">${icon} ${num(Math.abs(r), 1)}</span>`;
        };

        const rowHtml = (r, isTotal, idx) => `
      <tr class="${isTotal ? "total" : ""}" ${isTotal ? "" : `data-idx="${idx}"`}>
        <td class="name">${esc(r.name)}</td>
        <td>${num(r.veh)}</td>
        <td>${num(r.km)}</td>
        <td><span class="pill s-${stateOf(r.gen)}">${num(r.gen, 1)}</span></td>
        <td class="money-good">${money(r.log)}</td>
        <td class="money-bad">${money(r.por)}</td>
        <td><span class="spark">${spark(r.trend)}</span></td>
        <td>${deltaHtml(r.delta)}</td>
      </tr>`;

        const sortedCol = { vehiculos: 1, general: 3, logrado: 4, porLograr: 5, region: 0 }[by];
        const headers = ["Región", "Vehículos", "Km/Veh", "General", "Ahorro logrado", "Ahorro por lograr", "Tendencia", "Δ Mes"];

        $("tr-table").innerHTML =
            `<thead><tr>${headers.map((h, i) => `<th class="${i === sortedCol ? "sorted" : ""}">${h}</th>`).join("")}</tr></thead>` +
            `<tbody>${rowsOut.map((r, i) => rowHtml(r, false, i)).join("")}` +
            (config.showTotal !== false ? rowHtml({ name: config.totalLabel || "Total", ...total }, true) : "") +
            `</tbody>`;

        // ---------- Encabezado ----------
        $("tr-title").textContent = config.title || "";
        $("tr-card").classList.toggle("with-border", config.showCard !== false);
        const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const mm = String(lastMonth).match(/^(\d{4})-(\d{2})/);
        const periodEl = $("tr-period");
        periodEl.style.display = config.showPeriod === false ? "none" : "";
        periodEl.textContent = mm ? `${MESES[parseInt(mm[2], 10) - 1]} ${mm[1]}` : "";

        // ---------- Clic en una región: detalle de sus unidades ----------
        element.querySelectorAll("#tr-table tbody tr[data-idx]").forEach(tr => {
            const links = rowsOut[Number(tr.getAttribute("data-idx"))].links;
            if (!links || !links.length) return;
            tr.style.cursor = "pointer";
            tr.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links, event }));
        });

        done();
    }
});
