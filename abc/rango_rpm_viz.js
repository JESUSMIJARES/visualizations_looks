/**
 * Visualización: Distribución por rangos (barra 100% + tarjetas)
 * Sin dimensión, 2 a 5 medidas (por ejemplo, tiempo en Economía / Desempeño / Fuera de Rango).
 * Calcula el porcentaje de cada medida sobre el total, así que acepta tiempos o porcentajes.
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "rango_rpm_barra",
    label: "Barra de Rangos (100%)",

    options: {
        chartTitle: { type: "string", label: "Título", default: "Porcentaje por Rango RPM", section: "Texto", order: 1 },
        chartSubtitle: {
            type: "string", label: "Subtítulo", section: "Texto", order: 2,
            default: "Distribución del tiempo de operación de motor según revoluciones por minuto"
        },
        name1: { type: "string", label: "Segmento 1 · nombre", default: "Economía", section: "Segmentos", order: 1 },
        desc1: { type: "string", label: "Segmento 1 · descripción", default: "Economía (1,100 - 1,500 RPM)", section: "Segmentos", order: 2 },
        name2: { type: "string", label: "Segmento 2 · nombre", default: "Desempeño", section: "Segmentos", order: 3 },
        desc2: { type: "string", label: "Segmento 2 · descripción", default: "Desempeño (1,501 - 1,900 RPM)", section: "Segmentos", order: 4 },
        name3: { type: "string", label: "Segmento 3 · nombre", default: "Fuera de Rango", section: "Segmentos", order: 5 },
        desc3: { type: "string", label: "Segmento 3 · descripción", default: "Fuera de Rango (> 1,900 RPM)", section: "Segmentos", order: 6 },
        colors: {
            type: "array", label: "Colores (en orden)", display: "colors",
            default: ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"], section: "Estilo", order: 1
        },
        decimals: { type: "number", label: "Decimales del porcentaje", default: 0, section: "Estilo", order: 2 },
        showCards: { type: "boolean", label: "Mostrar tarjetas debajo", default: true, section: "Estilo", order: 3 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 4 }
    },

    create: function (element, config) {
        element.innerHTML = `
      <style>
        .rr-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .rr-card { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
          background: #ffffff; padding: 18px 20px; border-radius: 10px; overflow: auto; }
        .rr-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06); }
        .rr-title { margin: 0; font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }
        .rr-subtitle { margin: 4px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
        .rr-body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 20px; margin-top: 16px; }
        .rr-bar { display: flex; width: 100%; height: 38px; border-radius: 4px; overflow: hidden; background: #f1f5f9; }
        .rr-seg { display: flex; align-items: center; justify-content: center; min-width: 0;
          color: #ffffff; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden;
          transition: width 0.3s ease; }
        .rr-seg + .rr-seg { border-left: 2px solid #ffffff; }
        .rr-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
        .rr-item { border: 1.5px solid; border-radius: 4px; padding: 12px 14px; }
        .rr-item-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
          font-size: 12px; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 0.02em; }
        .rr-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
        .rr-item-desc { font-size: 13px; color: #374151; line-height: 1.45; }
        .rr-empty { font-size: 13px; color: #6b7280; text-align: center; }
      </style>
      <div class="rr-wrap">
        <div class="rr-card with-border" id="rr-card">
          <div>
            <h2 class="rr-title" id="rr-title"></h2>
            <p class="rr-subtitle" id="rr-subtitle"></p>
          </div>
          <div class="rr-body">
            <div class="rr-bar" id="rr-bar"></div>
            <div class="rr-cards" id="rr-cards"></div>
          </div>
        </div>
      </div>
    `;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const measures = queryResponse.fields.measure_like;

        if (measures.length < 2) {
            this.addError({ id: "no-measures", title: "Faltan medidas", message: "Agrega de 2 a 5 medidas, una por rango (por ejemplo: Economía, Desempeño, Fuera de Rango)." });
            done(); return;
        }
        if (!data || data.length === 0) {
            this.addError({ id: "no-data", title: "Sin datos", message: "La consulta no regresó resultados." });
            done(); return;
        }

        const $ = (id) => element.querySelector("#" + id);
        $("rr-title").textContent = config.chartTitle || "";
        $("rr-subtitle").textContent = config.chartSubtitle || "";
        $("rr-card").classList.toggle("with-border", config.showCard !== false);

        // Si hay dimensión, suma todas las filas; si no, usa la primera
        const used = measures.slice(0, 5);
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? 0 : Number(v);
        const totals = used.map(m => data.reduce((acc, row) => acc + toNum(row[m.name] && row[m.name].value), 0));
        const grand = totals.reduce((a, b) => a + b, 0);

        const palette = (config.colors && config.colors.length) ? config.colors : ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];
        const decimals = Number.isFinite(config.decimals) ? config.decimals : 0;
        const names = [config.name1, config.name2, config.name3];
        const descs = [config.desc1, config.desc2, config.desc3];

        const segments = used.map((m, i) => {
            const pct = grand > 0 ? (totals[i] / grand) * 100 : 0;
            return {
                name: (names[i] && names[i].trim()) || m.label_short || m.label,
                desc: (descs[i] && descs[i].trim()) || (m.label_short || m.label),
                color: palette[i % palette.length],
                pct,
                pctText: pct.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + "%"
            };
        });

        const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

        // ---------- Barra ----------
        const bar = $("rr-bar");
        if (grand <= 0) {
            bar.innerHTML = `<div class="rr-empty" style="width:100%;align-self:center;">Sin tiempo de operación en el periodo</div>`;
        } else {
            bar.innerHTML = segments
                .filter(s => s.pct > 0)
                .map(s => `<div class="rr-seg" style="width:${s.pct}%;background:${esc(s.color)}" title="${esc(s.name)}: ${s.pctText}">${s.pct >= 4 ? s.pctText : ""}</div>`)
                .join("");
        }

        // ---------- Tarjetas ----------
        const cards = $("rr-cards");
        cards.style.display = config.showCards === false ? "none" : "";
        cards.innerHTML = segments.map(s => `
      <div class="rr-item" style="border-color:${esc(s.color)}">
        <div class="rr-item-head"><span class="rr-dot" style="background:${esc(s.color)}"></span>${esc(s.name)}</div>
        <div class="rr-item-desc">${esc(s.desc)} (${s.pctText})</div>
      </div>`).join("");

        done();
    }
});