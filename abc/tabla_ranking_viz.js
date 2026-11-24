/**
 * Visualización: Tabla de ranking con Impacto (vista Análisis)
 * Sirve para Clientes, Sucursales, Regiones y Vehículos.
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión 1: el elemento (Cliente, Localidad, Región o Económico)
 *  - Dimensiones extra (opcionales, ej. Tipo de Vehículo y Modelo): columna "Unidad"
 *  - Periodo Month (para la tendencia y el Δ). Filtra 6 meses.
 *  - Medidas (se reconocen por nombre, el orden no importa):
 *      Calificación seleccionada · Vehículos Activos · Vehículos · Km Recorridos
 *      Unidades en meta · Unidades fuera de meta · Vel. Máx. (opcional)
 *
 * Impacto = (Calificación del elemento − Calificación del nivel superior)
 *           × (Vehículos activos del elemento ÷ Vehículos activos del nivel superior)
 * El "nivel superior" es todo lo que dejan pasar los filtros del dashboard.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "tabla_ranking",
    label: "Tabla Ranking (Impacto)",

    options: {
        tableTitle: { type: "string", label: "Título (vacío = automático)", default: "", section: "Texto", order: 1 },
        showCount: { type: "boolean", label: "Mostrar número de elementos junto al título", default: true, section: "Texto", order: 2 },
        rightText: { type: "string", label: "Texto a la derecha (vacío = rubro seleccionado)", default: "", section: "Texto", order: 3 },
        nameHeader: { type: "string", label: "Encabezado de la primera columna (vacío = automático)", default: "", section: "Texto", order: 4 },
        extraDimsHeader: { type: "string", label: "Encabezado de las dimensiones extra", default: "Unidad", section: "Texto", order: 5 },
        extraHeader: { type: "string", label: "Encabezado de Vel. máx.", default: "Vel. máx.", section: "Texto", order: 6 },

        showActivos: { type: "boolean", label: "Columna Veh. activos", default: true, section: "Columnas", order: 1 },
        showKm: { type: "boolean", label: "Columna Km", default: true, section: "Columnas", order: 2 },
        showMeta: { type: "boolean", label: "Columna En meta", default: false, section: "Columnas", order: 3 },
        showPos: { type: "boolean", label: "Columna Posición", default: true, section: "Columnas", order: 4 },
        showExtra: { type: "boolean", label: "Columna Vel. máx. (si viene la medida)", default: true, section: "Columnas", order: 5 },
        showTrend: { type: "boolean", label: "Columna Tendencia", default: true, section: "Columnas", order: 6 },

        sortBy: {
            type: "string", label: "Ordenar por", display: "select", section: "Orden", order: 1,
            values: [
                { "Impacto (más negativo primero)": "impact" },
                { "Calificación (menor a mayor)": "scoreAsc" },
                { "Calificación (mayor a menor)": "scoreDesc" },
                { "Km (mayor a menor)": "km" },
                { "Nombre (A-Z)": "name" }
            ],
            default: "impact"
        },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 },
        darkMode: { type: "boolean", label: "Modo oscuro", default: false, section: "Estilo", order: 1 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .tk-wrap { --bg:#ffffff; --text:#0f172a; --muted:#64748b; --faint:#94a3b8; --line:#eef2f7; --head:#334155; --spark:#2563eb;
          --good:#15803d; --warn:#b7791f; --bad:#dc2626;
          width:100%; height:100%; box-sizing:border-box; padding:2px 4px; display:flex; flex-direction:column;
          background:var(--bg); color:var(--text); font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
        .tk-wrap.dark { --bg:#111827; --text:#f1f5f9; --muted:#94a3b8; --faint:#64748b; --line:#1f2937; --head:#cbd5e1; --spark:#60a5fa;
          --good:#22c55e; --warn:#eab308; --bad:#ef4444; }
        .tk-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; gap:10px; }
        .tk-title { margin:0; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--head); }
        .tk-title span { color:var(--muted); font-weight:500; margin-left:8px; letter-spacing:.04em; }
        .tk-right { font-size:11px; color:var(--muted); white-space:nowrap; }
        .tk-scroll { flex:1; overflow:auto; }
        table.tk { width:100%; border-collapse:collapse; font-size:12px; color:var(--text); font-family:inherit; }
        .tk th { position:sticky; top:0; z-index:1; background:var(--bg); font-size:9.5px; font-weight:600; letter-spacing:.06em;
          text-transform:uppercase; color:var(--muted); padding:5px 6px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
        .tk th.l, .tk td.l { text-align:left; }
        .tk th.c, .tk td.c { text-align:center; }
        .tk td { padding:5px 6px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; color:var(--text); font-variant-numeric:tabular-nums; }
        .tk td.name { font-weight:600; max-width:170px; overflow:hidden; text-overflow:ellipsis; }
        .tk td.unit { line-height:1.2; font-size:11.5px; max-width:130px; overflow:hidden; text-overflow:ellipsis; } .tk td.unit small { display:block; color:var(--muted); font-size:10px; overflow:hidden; text-overflow:ellipsis; }
        .tk small.of { color:var(--faint); font-size:9.5px; margin-left:3px; }
        .tk .score { font-weight:700; font-size:14px; }
        .tk .pos b { font-weight:600; }
        .tk .meta .g { color:var(--good); font-weight:700; } .tk .meta .r { color:var(--bad); font-weight:700; }
        .tk .meta .s { color:var(--muted); margin:0 3px; }
        .tk .imp { font-weight:500; }
        .tk .trend { display:flex; align-items:center; justify-content:flex-end; gap:4px; }
        .tk .trend svg { width:40px; height:16px; display:block; overflow:visible; }
        .tk .delta { font-size:10.5px; font-weight:600; min-width:34px; text-align:right; }
        .tk tr.click { cursor:pointer; } .tk tr.click:hover td { background:rgba(148,163,184,.08); }
        .tk-empty { font-size:13px; color:var(--muted); padding:12px 0; }
      </style>
      <div class="tk-wrap" id="tk-wrap">
        <div class="tk-head"><h3 class="tk-title" id="tk-title"></h3><span class="tk-right" id="tk-right"></span></div>
        <div class="tk-scroll"><table class="tk" id="tk-table"></table></div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);

        $("tk-wrap").classList.toggle("dark", config.darkMode === true);
        if (!dims.length || measures.length < 2) {
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa el elemento (Cliente, Región…) + Periodo Month y las medidas Calificación seleccionada, Vehículos Activos, Vehículos y Km Recorridos." });
            done(); return;
        }

        // ---------- Dimensiones: elemento, mes y extras ----------
        const isMonth = (d) => data.some(r => /^\d{4}-\d{2}$/.test(String(r[d.name] && r[d.name].value)));
        const dMonth = dims.find(isMonth);
        const dName = dims.find(d => d !== dMonth);
        const dExtras = dims.filter(d => d !== dMonth && d !== dName);

        // ---------- Medidas por nombre (con respaldo por posición) ----------
        const short = (m) => m.name.split(".").pop();
        const byName = (re) => measures.find(m => re.test(short(m)));
        const mCalF = byName(/^calificacion_seleccionada$/) || measures[0];
        const mActF = byName(/^vehiculos_activos$/) || measures[1];
        const mVehF = byName(/^vehiculos$/);
        const mKmF = byName(/^km_recorridos$/) || byName(/(^|_)km/);
        const mInF = byName(/en_meta$/);
        const mOutF = byName(/fuera_meta$/);
        const mExtraF = byName(/velocidad_maxima$/);
        const [mCal, mAct, mVeh, mKm, mIn, mOut, mExtra] = [mCalF, mActF, mVehF, mKmF, mInF, mOutF, mExtraF].map(m => m ? m.name : null);
        const val = (r, m) => m ? toNum(r[m] && r[m].value) : null;

        const months = dMonth ? [...new Set(data.map(r => String(r[dMonth.name].value)))].filter(m => /^\d{4}-\d{2}$/.test(m)).sort() : ["_"];
        const monthHasData = (m) => data.some(r => (!dMonth || String(r[dMonth.name].value) === m) && val(r, mCal) !== null);
        const withData = months.filter(monthHasData);
        const lastMonth = withData[withData.length - 1] || months[months.length - 1];
        const prevMonth = withData.length > 1 ? withData[withData.length - 2] : null;
        const trendMonths = withData.length ? months.slice(0, months.indexOf(lastMonth) + 1) : months;

        // ---------- Agrupar por elemento ----------
        const items = new Map();
        data.forEach(r => {
            if (!dName || !r[dName.name]) return;
            const name = LookerCharts.Utils.textForCell(r[dName.name]);
            if (!name || name === "∅") return;
            const m = dMonth ? String(r[dMonth.name].value) : "_";
            if (!items.has(name)) items.set(name, { name, extras: [], byMonth: {}, links: [] });
            const it = items.get(name);
            if (dExtras.length && !it.extras.length) it.extras = dExtras.map(d => LookerCharts.Utils.textForCell(r[d.name])).filter(x => x && x !== "∅");
            it.byMonth[m] = { cal: val(r, mCal), act: val(r, mAct), veh: val(r, mVeh), km: val(r, mKm), inM: val(r, mIn), outM: val(r, mOut), extra: val(r, mExtra) };
            if (m === lastMonth) it.links = (r[mCal] && r[mCal].links) || [];
        });

        let rows = [...items.values()].map(it => {
            const cur = it.byMonth[lastMonth] || {};
            const prev = prevMonth ? (it.byMonth[prevMonth] || {}) : {};
            return {
                name: it.name, extras: it.extras, links: it.links,
                cal: cur.cal ?? null, act: cur.act ?? null, veh: cur.veh ?? null, km: cur.km ?? null,
                inM: cur.inM ?? null, outM: cur.outM ?? null, extra: cur.extra ?? null,
                delta: (cur.cal != null && prev.cal != null) ? cur.cal - prev.cal : null,
                trend: trendMonths.map(m => it.byMonth[m] ? it.byMonth[m].cal : null)
            };
        }).filter(r => r.cal !== null);

        // ---------- Nivel superior e Impacto ----------
        const totalAct = rows.reduce((s, r) => s + (r.act || 0), 0);
        const parentCal = totalAct > 0 ? rows.reduce((s, r) => s + r.cal * (r.act || 0), 0) / totalAct : null;
        rows.forEach(r => {
            r.impact = (parentCal !== null && totalAct > 0 && r.act) ? (r.cal - parentCal) * (r.act / totalAct) : null;
        });

        // ---------- Posición (1 = mejor calificación) ----------
        rows.slice().sort((a, b) => b.cal - a.cal).forEach((r, i) => { r.pos = i + 1; });

        // ---------- Orden ----------
        const by = config.sortBy || "impact";
        if (by === "impact") rows.sort((a, b) => (a.impact ?? 0) - (b.impact ?? 0));
        else if (by === "scoreAsc") rows.sort((a, b) => a.cal - b.cal);
        else if (by === "scoreDesc") rows.sort((a, b) => b.cal - a.cal);
        else if (by === "km") rows.sort((a, b) => (b.km ?? -1) - (a.km ?? -1));
        else rows.sort((a, b) => a.name.localeCompare(b.name, "es"));

        // ---------- Formatos ----------
        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const colorOf = (v) => v === null ? "var(--muted)" : v >= goodFrom ? "var(--good)" : v >= warnFrom ? "var(--warn)" : "var(--bad)";
        const n0 = (v) => Math.round(v).toLocaleString("es-MX");
        const km = (v) => v === null ? "—" : Math.abs(v) >= 1e4 ? Math.round(v / 1e3).toLocaleString("es-MX") + " mil" : n0(v);
        const d1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const spark = (values) => {
            const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
            if (pts.length < 2) return "";
            const W = 44, H = 18, pad = 2, n = values.length - 1 || 1;
            const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)), span = max - min || 1;
            const xy = pts.map(p => [pad + (p.i / n) * (W - pad * 2), pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
            const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
            const lp = xy[xy.length - 1];
            return `<svg viewBox="0 0 ${W} ${H}"><path d="${area}" fill="var(--spark)" fill-opacity=".12"/><path d="${line}" fill="none" stroke="var(--spark)" stroke-width="1.4" stroke-linejoin="round"/><circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="2.1" fill="var(--spark)"/></svg>`;
        };
        const deltaHtml = (d) => {
            if (d === null) return `<span class="delta" style="color:var(--faint)">—</span>`;
            const r = Number(d.toFixed(1));
            const c = r > 0 ? "var(--good)" : r < 0 ? "var(--bad)" : "var(--muted)";
            return `<span class="delta" style="color:${c}">${r > 0 ? "▲" : r < 0 ? "▼" : "■"} ${d1(Math.abs(r))}</span>`;
        };

        // ---------- Columnas visibles ----------
        const showActivos = config.showActivos !== false && !!mAct;
        const showKm = config.showKm !== false && !!mKm;
        const showMeta = config.showMeta === true && !!mIn && !!mOut;
        const showPos = config.showPos !== false;
        const showExtra = config.showExtra !== false && !!mExtra;
        const showTrend = config.showTrend !== false && !!dMonth;
        const showUnit = dExtras.length > 0;

        const dn = dName.name.split(".").pop();
        const AUTO = {
            cliente: ["Clientes", "Cliente"], region: ["Regiones", "Región"], localidad: ["Sucursales", "Sucursal"],
            sucursal: ["Sucursales", "Sucursal"], economico: ["Vehículos", "Vehículo"]
        };
        const auto = AUTO[dn] || [dName.label_short || dName.label || "", dName.label_short || dName.label || ""];

        const head = [
            `<th class="l">${esc(config.nameHeader || auto[1])}</th>`,
            showUnit ? `<th class="l">${esc(config.extraDimsHeader || "Unidad")}</th>` : "",
            showActivos ? `<th>Veh. activos</th>` : "",
            showKm ? `<th>Km</th>` : "",
            showMeta ? `<th>En meta</th>` : "",
            showPos ? `<th>Pos.</th>` : "",
            showExtra ? `<th>${esc(config.extraHeader || "Vel. máx.")}</th>` : "",
            `<th>Calif.</th>`, `<th>Impacto</th>`,
            showTrend ? `<th>Tendencia</th>` : ""
        ].join("");

        const total = rows.length;
        const actCell = (r) => {
            if (r.act === null) return "—";
            if (r.veh === null || !r.veh) return n0(r.act);
            return `${n0(r.act)}<small class="of">de ${n0(r.veh)} · ${Math.round(r.act / r.veh * 100)}%</small>`;
        };
        const body = rows.map((r, i) => `
      <tr data-i="${i}" class="${r.links.length ? "click" : ""}">
        <td class="l name" title="${esc(r.name)}">${esc(r.name)}</td>
        ${showUnit ? `<td class="l unit">${esc(r.extras[0] || "")}${r.extras.length > 1 ? `<small>${esc(r.extras.slice(1).join(" · "))}</small>` : ""}</td>` : ""}
        ${showActivos ? `<td>${actCell(r)}</td>` : ""}
        ${showKm ? `<td>${km(r.km)}</td>` : ""}
        ${showMeta ? `<td class="meta"><span class="g">${r.inM ?? 0}</span><span class="s">/</span><span class="r">${r.outM ?? 0}</span></td>` : ""}
        ${showPos ? `<td class="pos"><b>${r.pos}°</b><small class="of">de ${total}</small></td>` : ""}
        ${showExtra ? `<td>${r.extra === null || r.extra === 0 ? "—" : n0(r.extra)}</td>` : ""}
        <td><span class="score" style="color:${colorOf(r.cal)}">${d1(r.cal)}</span></td>
        <td class="imp" style="color:${r.impact === null || Math.abs(r.impact) < 0.005 ? "var(--muted)" : r.impact < 0 ? "var(--bad)" : "var(--good)"}">${r.impact === null ? "—" : (Math.abs(r.impact) < 0.005 ? "" : r.impact > 0 ? "+" : "−") + Math.abs(r.impact).toFixed(2)}</td>
        ${showTrend ? `<td><div class="trend">${spark(r.trend)}${deltaHtml(r.delta)}</div></td>` : ""}
      </tr>`).join("");

        $("tk-table").innerHTML = total ? `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>` : `<tbody><tr><td class="tk-empty">Sin datos</td></tr></tbody>`;

        // ---------- Encabezado ----------
        $("tk-title").innerHTML = `${esc(config.tableTitle || auto[0])}${config.showCount !== false ? `<span>${total}</span>` : ""}`;
        // A la derecha: el rubro seleccionado (la medida toma su nombre del filtro Rubro)
        const rubroLabel = mCalF ? (mCalF.label_short || mCalF.label || "") : "";
        $("tk-right").textContent = config.rightText || rubroLabel.replace(/^.*?\s[-–]\s/, "");

        // ---------- Clic: detalle de las unidades del elemento ----------
        element.querySelectorAll("#tk-table tr[data-i]").forEach(tr => {
            const r = rows[Number(tr.getAttribute("data-i"))];
            if (r.links.length) tr.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links: r.links, event }));
        });

        done();
    }
});
