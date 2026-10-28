/**
 * Visualización: Combustible (ahorro logrado vs por lograr, del mes y acumulado)
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensiones: Tipo de Vehículo  y  Periodo Month
 *  - Medidas, en este orden: 1. Ahorro Logrado  2. Ahorro por Lograr
 *  - Filtro: Periodo Year = este año (para que el acumulado sea del año)
 *  Arriba muestra el mes más reciente; abajo, la suma de todos los meses filtrados.
 *  El desglose (Pesado / Mediano / Ligero) sale de Tipo de Vehículo.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "combustible_ahorro",
    label: "Combustible (Ahorro)",

    options: {
        title: { type: "string", label: "Título", default: "Combustible", section: "Texto", order: 1 },
        labelLogrado: { type: "string", label: "Texto ahorro logrado", default: "Ahorro logrado", section: "Texto", order: 2 },
        labelPorLograr: { type: "string", label: "Texto ahorro por lograr", default: "Ahorro por lograr", section: "Texto", order: 3 },
        colorLogrado: { type: "array", label: "Color logrado", display: "color", default: ["#15803d"], section: "Estilo", order: 1 },
        colorPorLograr: { type: "array", label: "Color por lograr", display: "color", default: ["#c2410c"], section: "Estilo", order: 2 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 3 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .cb-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .cb-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; overflow: auto; }
        .cb-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .cb-head { display: flex; justify-content: space-between; align-items: center; }
        .cb-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .cb-period { font-size: 11px; color: #94a3b8; }
        .cb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .cb-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .cb-lbl { font-size: 12px; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px;
          border-top: 2px solid #e2e8f0; padding-top: 6px; }
        .cb-dot { width: 9px; height: 9px; border-radius: 2px; flex: none; }
        .cb-val { font-size: 30px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; line-height: 1.05; }
        .cb-val.small { font-size: 26px; }
        .cb-split { font-size: 11px; color: #64748b; line-height: 1.4; }
        .cb-split b { color: #334155; font-weight: 700; }
        .cb-sub { font-size: 11px; color: #94a3b8; text-align: right; border-top: 1px solid #f1f5f9; padding-top: 8px; }
        .cb-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: #f1f5f9; }
        .cb-bar-labels { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 4px; }
      </style>
      <div class="cb-wrap">
        <div class="cb-card with-border" id="cb-card">
          <div class="cb-head"><h3 class="cb-title" id="cb-title"></h3><span class="cb-period" id="cb-period"></span></div>
          <div class="cb-row" id="cb-month"></div>
          <div class="cb-sub" id="cb-sub"></div>
          <div class="cb-row" id="cb-acc"></div>
          <div>
            <div class="cb-bar" id="cb-bar"></div>
            <div class="cb-bar-labels" id="cb-bar-labels"></div>
          </div>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        if (measures.length < 2) {
            this.addError({ id: "fields", title: "Faltan medidas", message: "Usa Tipo de Vehículo + Periodo Month y las medidas Ahorro Logrado y Ahorro por Lograr (en ese orden)." });
            done(); return;
        }

        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? 0 : Number(v);
        const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const money = (v) => {
            const a = Math.abs(v);
            if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(v).toLocaleString("es-MX");
        };
        const pct = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;

        // Detecta cuál dimensión es el mes (valores tipo 2026-06) y cuál el tipo de vehículo
        const isMonthDim = (d) => data.some(r => /^\d{4}-\d{2}/.test(String(r[d.name] && r[d.name].value)));
        const dMonth = dims.find(isMonthDim);
        const dType = dims.find(d => d !== dMonth);
        const [mLog, mPor] = measures.map(m => m.name);

        const months = dMonth ? [...new Set(data.map(r => String(r[dMonth.name].value)))].filter(m => /^\d{4}-\d{2}/.test(m)).sort() : [];
        const lastMonth = months[months.length - 1];

        const typeOf = (r) => dType ? (LookerCharts.Utils.textForCell(r[dType.name]) || "Sin clasificar") : "Total";
        const agg = (rows) => {
            const byType = {}; let log = 0, por = 0;
            rows.forEach(r => {
                const t = typeOf(r), l = toNum(r[mLog] && r[mLog].value), p = toNum(r[mPor] && r[mPor].value);
                log += l; por += p;
                byType[t] = byType[t] || { log: 0, por: 0 };
                byType[t].log += l; byType[t].por += p;
            });
            return { log, por, byType };
        };
        const monthAgg = agg(dMonth ? data.filter(r => String(r[dMonth.name].value) === lastMonth) : data);
        const accAgg = agg(data);

        const cLog = (config.colorLogrado && config.colorLogrado[0]) || "#15803d";
        const cPor = (config.colorPorLograr && config.colorPorLograr[0]) || "#c2410c";
        const types = Object.keys(accAgg.byType).sort((a, b) => accAgg.byType[b].log + accAgg.byType[b].por - (accAgg.byType[a].log + accAgg.byType[a].por));

        const split = (a, key) => dType
            ? types.map(t => `${esc(t)} <b>${pct(a.byType[t] ? a.byType[t][key] : 0, a[key])}%</b>`).join(" · ")
            : "";
        const block = (a, small) => `
      <div class="cb-col">
        <span class="cb-lbl"><span class="cb-dot" style="background:${cLog}"></span>${esc(config.labelLogrado || "Ahorro logrado")}</span>
        <span class="cb-val${small ? " small" : ""}">${money(a.log)}</span>
        <span class="cb-split">${split(a, "log")}</span>
      </div>
      <div class="cb-col">
        <span class="cb-lbl"><span class="cb-dot" style="background:${cPor}"></span>${esc(config.labelPorLograr || "Ahorro por lograr")}</span>
        <span class="cb-val${small ? " small" : ""}">${money(a.por)}</span>
        <span class="cb-split">${split(a, "por")}</span>
      </div>`;

        $("cb-title").textContent = config.title || "";
        $("cb-card").classList.toggle("with-border", config.showCard !== false);
        const lm = lastMonth ? lastMonth.match(/^(\d{4})-(\d{2})/) : null;
        $("cb-period").textContent = lm ? `${MESES_L[parseInt(lm[2], 10) - 1]} ${lm[1]}` : "";
        $("cb-month").innerHTML = block(monthAgg, false);

        const showAcc = months.length > 1;
        $("cb-sub").style.display = showAcc ? "" : "none";
        $("cb-acc").style.display = showAcc ? "" : "none";
        const years = [...new Set(months.map(m => m.slice(0, 4)))];
        $("cb-sub").textContent = `Acumulado ${years.join("–")}`;
        $("cb-acc").innerHTML = showAcc ? block(accAgg, true) : "";

        const base = showAcc ? accAgg : monthAgg;
        const pLog = pct(base.log, base.log + base.por);
        $("cb-bar").innerHTML = `<div style="width:${pLog}%;background:${cLog}"></div><div style="width:${100 - pLog}%;background:${cPor}"></div>`;
        $("cb-bar-labels").innerHTML = `<span>${pLog}% logrado</span><span>${100 - pLog}% por lograr</span>`;

        done();
    }
});
