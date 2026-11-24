/**
 * Visualización: Tabla de ranking con Impacto
 * Sirve para Clientes, Sucursales, Regiones y Vehículos (vista Análisis).
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión 1: el elemento (Cliente, Localidad, Región o Económico)
 *  - Dimensiones extra (opcionales, ej. Tipo de Vehículo y Modelo): se muestran en la columna "Unidad"
 *  - Periodo Month (para la tendencia y el Δ). Filtra 6 meses, por ejemplo.
 *  - Medidas, EN ESTE ORDEN:
 *      1. Calificación seleccionada   2. Vehículos Activos   3. Km Recorridos
 *      4. Unidades en meta (opcional)  5. Unidades fuera de meta (opcional)
 *      6. Métrica extra (opcional, ej. Vel. Máx.)
 *
 * Impacto = (Calificación del elemento − Calificación del nivel superior)
 *           × (Vehículos activos del elemento ÷ Vehículos activos del nivel superior)
 * El "nivel superior" es todo lo que dejan pasar los filtros del dashboard
 * (nacional, un cliente, una sucursal…), así que se calcula con las filas de esta misma consulta.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "tabla_ranking",
    label: "Tabla Ranking (Impacto)",

    options: {
        title: { type: "string", label: "Título (ej. Clientes)", default: "Clientes", section: "Texto", order: 1 },
        showCount: { type: "boolean", label: "Mostrar número de elementos junto al título", default: true, section: "Texto", order: 2 },
        rightText: { type: "string", label: "Texto a la derecha (vacío = en meta · fuera)", default: "", section: "Texto", order: 3 },
        nameHeader: { type: "string", label: "Encabezado de la primera columna", default: "Cliente", section: "Texto", order: 4 },
        extraDimsHeader: { type: "string", label: "Encabezado de las dimensiones extra", default: "Unidad", section: "Texto", order: 5 },
        extraHeader: { type: "string", label: "Encabezado de la métrica extra", default: "Vel. máx.", section: "Texto", order: 6 },

        showMeta: { type: "boolean", label: "Columna En meta", default: true, section: "Columnas", order: 1 },
        showPos: { type: "boolean", label: "Columna Posición", default: true, section: "Columnas", order: 2 },
        showKm: { type: "boolean", label: "Columna Km", default: true, section: "Columnas", order: 3 },
        showTrend: { type: "boolean", label: "Columna Tendencia", default: true, section: "Columnas", order: 4 },

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
        .tk-wrap { --bg:#ffffff; --text:#0f172a; --muted:#64748b; --line:#eef2f7; --head:#334155; --spark:#3b82f6;
          width:100%; height:100%; box-sizing:border-box; padding:4px 6px; display:flex; flex-direction:column;
          background:var(--bg); color:var(--text); font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
        .tk-wrap.dark { --bg:#111827; --text:#f1f5f9; --muted:#94a3b8; --line:#1f2937; --head:#cbd5e1; --spark:#60a5fa; }
        .tk-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; gap:10px; }
        .tk-title { margin:0; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--head); }
        .tk-title span { color:var(--muted); font-weight:600; margin-left:6px; }
        .tk-right { font-size:11.5px; color:var(--muted); white-space:nowrap; }
        .tk-right b.g { color:#22c55e; } .tk-right b.r { color:#ef4444; }
        .tk-scroll { flex:1; overflow:auto; }
        table.tk { width:100%; border-collapse:collapse; font-size:13px; color:var(--text); font-family:inherit; }
        .tk th { position:sticky; top:0; background:var(--bg); font-size:10px; font-weight:700; letter-spacing:.05em;
          text-transform:uppercase; color:var(--muted); padding:6px 8px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
        .tk th.l, .tk td.l { text-align:left; }
        .tk td { padding:8px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; color:var(--text); }
        .tk td.name { font-weight:700; }
        .tk td.unit { line-height:1.2; } .tk td.unit small { display:block; color:var(--muted); font-size:11px; }
        .tk .score { font-weight:800; font-size:15px; }
        .tk .pos small { color:var(--muted); font-size:10px; margin-left:2px; }
        .tk .meta .g { color:#22c55e; font-weight:700; } .tk .meta .r { color:#ef4444; font-weight:700; }
        .tk .meta .s { color:var(--muted); margin:0 3px; }
        .tk .imp { font-weight:700; }
        .tk .trend { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
        .tk .trend svg { width:56px; height:20px; display:block; overflow:visible; }
        .tk .delta { font-size:11.5px; font-weight:700; min-width:44px; text-align:right; }
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
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa el elemento (Cliente, Región…) + Periodo Month y las medidas: Calificación seleccionada, Vehículos Activos, Km, En meta, Fuera de meta (en ese orden)." });
            done(); return;
        }

        // ---------- Dimensiones: elemento, mes y extras ----------
        const isMonth = (d) => data.some(r => /^\d{4}-\d{2}$/.test(String(r[d.name] && r[d.name].value)));
        const dMonth = dims.find(isMonth);
        const dName = dims.find(d => d !== dMonth);
        const dExtras = dims.filter(d => d !== dMonth && d !== dName);
        const [mCal, mAct, mKm, mIn, mOut, mExtra] = measures.map(m => m.name);
        const val = (r, m) => m ? toNum(r[m] && r[m].value) : null;

        const months = dMonth ? [...new Set(data.map(r => String(r[dMonth.name].value)))].filter(m => /^\d{4}-\d{2}$/.test(m)).sort() : ["_"];
        // Último mes con datos (lo que va del mes en curso, o el anterior si aún está vacío)
        const monthHasData = (m) => data.some(r => (!dMonth || String(r[dMonth.name].value) === m) && val(r, mCal) !== null);
        const withData = months.filter(monthHasData);
        const lastMonth = withData[withData.length - 1] || months[months.length - 1];
        const prevMonth = withData.length > 1 ? withData[withData.length - 2] : null;

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
            it.byMonth[m] = { cal: val(r, mCal), act: val(r, mAct), km: val(r, mKm), inM: val(r, mIn), outM: val(r, mOut), extra: val(r, mExtra) };
            if (m === lastMonth) it.links = (r[mCal] && r[mCal].links) || [];
        });

        let rows = [...items.values()].map(it => {
            const cur = it.byMonth[lastMonth] || {};
            const prev = prevMonth ? (it.byMonth[prevMonth] || {}) : {};
            return {
                name: it.name, extras: it.extras, links: it.links,
                cal: cur.cal ?? null, act: cur.act ?? null, km: cur.km ?? null,
                inM: cur.inM ?? null, outM: cur.outM ?? null, extra: cur.extra ?? null,
                delta: (cur.cal != null && prev.cal != null) ? cur.cal - prev.cal : null,
                trend: months.map(m => it.byMonth[m] ? it.byMonth[m].cal : null)
            };
        }).filter(r => r.cal !== null);

        // ---------- Nivel superior e Impacto ----------
        // Nivel superior = todas las filas de la consulta (lo que dejan pasar los filtros)
        const totalAct = rows.reduce((s, r) => s + (r.act || 0), 0);
        const parentCal = totalAct > 0 ? rows.reduce((s, r) => s + r.cal * (r.act || 0), 0) / totalAct : null;
        rows.forEach(r => {
            r.impact = (parentCal !== null && totalAct > 0 && r.act) ? (r.cal - parentCal) * (r.act / totalAct) : null;
        });

        // ---------- Posición (1 = mejor calificación) ----------
        const byScore = rows.slice().sort((a, b) => b.cal - a.cal);
        byScore.forEach((r, i) => { r.pos = i + 1; });

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
        const colorOf = (v) => v === null ? "var(--muted)" : v >= goodFrom ? "#22c55e" : v >= warnFrom ? "#eab308" : "#ef4444";
        const km = (v) => v === null ? "—" : Math.abs(v) >= 1e4 ? Math.round(v / 1e3).toLocaleString("es-MX") + " mil" : Math.round(v).toLocaleString("es-MX");
        const d1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const spark = (values) => {
            const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
            if (pts.length < 2) return "";
            const W = 56, H = 20, pad = 2, n = values.length - 1 || 1;
            const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)), span = max - min || 1;
            const xy = pts.map(p => [pad + (p.i / n) * (W - pad * 2), pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
            const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
            const lp = xy[xy.length - 1];
            return `<svg viewBox="0 0 ${W} ${H}"><path d="${line}" fill="none" stroke="var(--spark)" stroke-width="1.5"/><circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="2.2" fill="var(--spark)"/></svg>`;
        };
        const deltaHtml = (d) => {
            if (d === null) return `<span class="delta" style="color:var(--muted)">—</span>`;
            const r = Number(d.toFixed(1));
            const c = r > 0 ? "#22c55e" : r < 0 ? "#ef4444" : "var(--muted)";
            return `<span class="delta" style="color:${c}">${r > 0 ? "▲" : r < 0 ? "▼" : "■"} ${d1(Math.abs(r))}</span>`;
        };

        // ---------- Columnas visibles ----------
        const showMeta = config.showMeta !== false && !!mIn && !!mOut;
        const showPos = config.showPos !== false;
        const showKm = config.showKm !== false && !!mKm;
        const showTrend = config.showTrend !== false && !!dMonth;
        const showExtra = !!mExtra;
        const showUnit = dExtras.length > 0;

        const head = [
            `<th class="l">${esc(config.nameHeader || (dName.label_short || dName.label))}</th>`,
            showUnit ? `<th class="l">${esc(config.extraDimsHeader || "Unidad")}</th>` : "",
            showKm ? `<th>Km</th>` : "",
            showMeta ? `<th>En meta</th>` : "",
            showPos ? `<th>Pos.</th>` : "",
            showExtra ? `<th>${esc(config.extraHeader || "")}</th>` : "",
            `<th>Calif.</th>`, `<th>Impacto</th>`,
            showTrend ? `<th>Tendencia</th>` : ""
        ].join("");

        const total = rows.length;
        const body = rows.map((r, i) => `
      <tr data-i="${i}" class="${r.links.length ? "click" : ""}">
        <td class="l name">${esc(r.name)}</td>
        ${showUnit ? `<td class="l unit">${esc(r.extras[0] || "")}${r.extras.length > 1 ? `<small>${esc(r.extras.slice(1).join(" · "))}</small>` : ""}</td>` : ""}
        ${showKm ? `<td>${km(r.km)}</td>` : ""}
        ${showMeta ? `<td class="meta"><span class="g">${r.inM ?? 0}</span><span class="s">/</span><span class="r">${r.outM ?? 0}</span></td>` : ""}
        ${showPos ? `<td class="pos"><b>${r.pos}°</b><small>de ${total}</small></td>` : ""}
        ${showExtra ? `<td style="color:#ef4444;font-weight:700">${r.extra === null ? "—" : Math.round(r.extra).toLocaleString("es-MX")}</td>` : ""}
        <td><span class="score" style="color:${colorOf(r.cal)}">${d1(r.cal)}</span></td>
        <td class="imp" style="color:${r.impact === null ? "var(--muted)" : r.impact < 0 ? "#ef4444" : "#22c55e"}">${r.impact === null ? "—" : (r.impact > 0 ? "+" : r.impact < 0 ? "−" : "") + Math.abs(r.impact).toFixed(2)}</td>
        ${showTrend ? `<td><div class="trend">${spark(r.trend)}${deltaHtml(r.delta)}</div></td>` : ""}
      </tr>`).join("");

        $("tk-table").innerHTML = total ? `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>` : `<tbody><tr><td class="tk-empty">Sin datos</td></tr></tbody>`;

        // ---------- Encabezado ----------
        $("tk-title").innerHTML = `${esc(config.title || "")}${config.showCount !== false ? `<span>${total}</span>` : ""}`;
        const sumIn = rows.reduce((s, r) => s + (r.inM || 0), 0), sumOut = rows.reduce((s, r) => s + (r.outM || 0), 0);
        $("tk-right").innerHTML = config.rightText
            ? esc(config.rightText)
            : (mIn && mOut ? `<b class="g">${sumIn}</b> en meta · <b class="r">${sumOut}</b> fuera` : "");

        // ---------- Clic: detalle de las unidades del elemento ----------
        element.querySelectorAll("#tk-table tr[data-i]").forEach(tr => {
            const r = rows[Number(tr.getAttribute("data-i"))];
            if (r.links.length) tr.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links: r.links, event }));
        });

        done();
    }
});