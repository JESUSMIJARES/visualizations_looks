/**
 * Visualización: Seguridad (eventos por tipo con barras y delta vs mes anterior)
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión: Periodo Month (filtra los últimos 2 meses o más)
 *  - Medida 1: Unidades con posible accidente   (número secundario de arriba)
 *  - Medidas 2 en adelante: eventos por tipo, ej. Posible accidente, Descolgadas,
 *    Velocidad > 115, Frenado, Aceleración, Giro. La primera de ellas es el número grande.
 *  En eventos, bajar es bueno: ▼ verde, ▲ rojo.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "seguridad_eventos",
    label: "Seguridad (Eventos)",

    options: {
        title: { type: "string", label: "Título", default: "Seguridad", section: "Texto", order: 1 },
        headlineLabel: { type: "string", label: "Texto bajo el número grande", default: "posibles accidentes", section: "Texto", order: 2 },
        unitsLabel: { type: "string", label: "Texto bajo las unidades", default: "unidades", section: "Texto", order: 3 },
        footnote: { type: "string", label: "Nota al pie (opcional)", default: "", section: "Texto", order: 4 },
        barColor: { type: "array", label: "Color de las barras", display: "color", default: ["#1e293b"], section: "Estilo", order: 1 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 2 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .se-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .se-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; overflow: auto; }
        .se-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .se-head { display: flex; justify-content: space-between; align-items: center; }
        .se-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .se-period { font-size: 11px; color: #94a3b8; }
        .se-top { display: flex; align-items: flex-end; gap: 22px; }
        .se-big { display: flex; flex-direction: column; }
        .se-big b { font-size: 34px; font-weight: 800; color: #0f172a; line-height: 1; letter-spacing: -.02em; }
        .se-big.sm b { font-size: 24px; }
        .se-big span { font-size: 11px; color: #64748b; margin-top: 3px; }
        .se-delta { font-size: 13px; font-weight: 700; margin-bottom: 14px; }
        .se-list { display: flex; flex-direction: column; gap: 7px; }
        .se-row { display: grid; grid-template-columns: 110px 1fr 52px 52px; gap: 10px; align-items: center; font-size: 12px; color: #334155; }
        .se-row.clickable { cursor: pointer; }
        .se-track { height: 7px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
        .se-fill { height: 100%; border-radius: 999px; }
        .se-num { text-align: right; font-weight: 700; color: #0f172a; }
        .se-d { text-align: right; font-weight: 700; font-size: 11.5px; }
        .se-foot { font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 8px; }
      </style>
      <div class="se-wrap">
        <div class="se-card with-border" id="se-card">
          <div class="se-head"><h3 class="se-title" id="se-title"></h3><span class="se-period" id="se-period"></span></div>
          <div class="se-top" id="se-top"></div>
          <div class="se-list" id="se-list"></div>
          <div class="se-foot" id="se-foot"></div>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        if (measures.length < 2) {
            this.addError({ id: "fields", title: "Faltan medidas", message: "Usa Periodo Month + Unidades con posible accidente + las medidas de eventos (Posible accidente, Descolgadas, …)." });
            done(); return;
        }
        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        const n0 = (v) => v === null ? "—" : v.toLocaleString("es-MX", { maximumFractionDigits: 0 });
        const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

        let rows = data.slice();
        if (dims.length) rows.sort((a, b) => String(a[dims[0].name].value).localeCompare(String(b[dims[0].name].value)));
        const last = rows[rows.length - 1], prev = rows.length > 1 ? rows[rows.length - 2] : null;
        const val = (r, m) => r ? toNum(r[m.name] && r[m.name].value) : null;
        const monthName = (r) => { if (!r || !dims.length) return ""; const m = String(r[dims[0].name].value).match(/^(\d{4})-(\d{2})/); return m ? MESES_L[parseInt(m[2], 10) - 1] : ""; };

        const deltaHtml = (cur, before, cls) => {
            if (cur === null || before === null) return `<span class="${cls}" style="color:#94a3b8">—</span>`;
            const d = cur - before;
            // En eventos, menos es mejor
            const color = d < 0 ? "#16a34a" : d > 0 ? "#dc2626" : "#94a3b8";
            const icon = d > 0 ? "▲" : d < 0 ? "▼" : "■";
            return `<span class="${cls}" style="color:${color}">${icon} ${n0(Math.abs(d))}</span>`;
        };

        const mUnits = measures[0];
        const events = measures.slice(1);
        const headline = events[0];

        $("se-title").textContent = config.title || "";
        $("se-card").classList.toggle("with-border", config.showCard !== false);
        const lm = last && dims.length ? String(last[dims[0].name].value).match(/^(\d{4})-(\d{2})/) : null;
        $("se-period").textContent = lm ? `${MESES_L[parseInt(lm[2], 10) - 1]} ${lm[1]}` : "";

        $("se-top").innerHTML = `
      <div class="se-big"><b>${n0(val(last, headline))}</b><span>${esc(config.headlineLabel || "")}</span></div>
      <div class="se-big sm"><b>${n0(val(last, mUnits))}</b><span>${esc(config.unitsLabel || "")}</span></div>
      <div class="se-delta">${deltaHtml(val(last, headline), val(prev, headline), "")}${prev ? ` <span style="color:#94a3b8;font-weight:500">vs ${monthName(prev)}</span>` : ""}</div>`;

        const maxV = Math.max(1, ...events.map(m => val(last, m) || 0));
        const color = (config.barColor && config.barColor[0]) || "#1e293b";
        const linksBy = [];
        $("se-list").innerHTML = events.map((m, i) => {
            const v = val(last, m);
            linksBy[i] = (last && last[m.name] && last[m.name].links) || [];
            return `
        <div class="se-row${linksBy[i].length ? " clickable" : ""}" data-i="${i}">
          <span>${esc(m.label_short || m.label)}</span>
          <div class="se-track"><div class="se-fill" style="width:${((v || 0) / maxV * 100).toFixed(1)}%;background:${color}"></div></div>
          <span class="se-num">${n0(v)}</span>
          ${deltaHtml(v, val(prev, m), "se-d")}
        </div>`;
        }).join("");
        element.querySelectorAll(".se-row.clickable").forEach(el => el.addEventListener("click", (event) => {
            LookerCharts.Utils.openDrillMenu({ links: linksBy[Number(el.getAttribute("data-i"))], event });
        }));

        $("se-foot").textContent = config.footnote || "";
        $("se-foot").style.display = config.footnote ? "" : "none";
        done();
    }
});
