/**
 * Visualización: Clientes (Mejor uso / Mayor oportunidad)
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Dimensión: Cliente
 *  - Medidas, en este orden:
 *      1. Calificación General   2. Ahorro por Lograr   3. Vehículos   4. Regiones del cliente
 *  - Filtro: Periodo Month = el mes que quieras ver
 *  Izquierda: top por calificación general. Derecha: top por ahorro por lograr.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "clientes_ranking",
    label: "Clientes (Ranking)",

    options: {
        title: { type: "string", label: "Título", default: "Clientes", section: "Texto", order: 1 },
        leftTitle: { type: "string", label: "Título izquierda", default: "Mejor uso", section: "Texto", order: 2 },
        leftHint: { type: "string", label: "Nota izquierda", default: "General", section: "Texto", order: 3 },
        rightTitle: { type: "string", label: "Título derecha", default: "Mayor oportunidad", section: "Texto", order: 4 },
        rightHint: { type: "string", label: "Nota derecha", default: "Por lograr", section: "Texto", order: 5 },
        periodText: { type: "string", label: "Texto de periodo", default: "", section: "Texto", order: 6 },
        topN: { type: "number", label: "Cuántos clientes por lista", default: 4, section: "Estilo", order: 1 },
        hideUnassigned: { type: "boolean", label: "Ocultar \"Sin cliente\"", default: true, section: "Estilo", order: 2 },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Estilo", order: 3 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Estilo", order: 4 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 5 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .cr-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .cr-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
        .cr-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .cr-head { display: flex; justify-content: space-between; align-items: center; }
        .cr-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .cr-period { font-size: 11px; color: #94a3b8; }
        .cr-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .cr-colhead { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 800;
          text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
        .cr-colhead span.h { font-weight: 500; text-transform: none; color: #64748b; letter-spacing: 0; }
        .cr-item { display: grid; grid-template-columns: 16px 1fr auto; gap: 8px; align-items: center;
          background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
        .cr-item.clickable { cursor: pointer; } .cr-item.clickable:hover { border-color: #cbd5e1; }
        .cr-rank { font-size: 12px; color: #94a3b8; font-weight: 700; }
        .cr-name { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .cr-sub { font-size: 11px; color: #64748b; }
        .cr-val { text-align: right; }
        .cr-val b { display: block; font-size: 16px; font-weight: 800; }
        .cr-val span { font-size: 10.5px; color: #64748b; }
        .cr-empty { font-size: 12px; color: #94a3b8; padding: 8px 0; }
      </style>
      <div class="cr-wrap">
        <div class="cr-card with-border" id="cr-card">
          <div class="cr-head"><h3 class="cr-title" id="cr-title"></h3><span class="cr-period" id="cr-period"></span></div>
          <div class="cr-cols">
            <div><div class="cr-colhead" id="cr-lh"></div><div id="cr-left"></div></div>
            <div><div class="cr-colhead" id="cr-rh"></div><div id="cr-right"></div></div>
          </div>
        </div>
      </div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        if (dims.length === 0 || measures.length < 3) {
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa Cliente + Calificación General, Ahorro por Lograr, Vehículos (y opcional Regiones del cliente)." });
            done(); return;
        }
        const $ = (id) => element.querySelector("#" + id);
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        const money = (v) => {
            if (v === null) return "—";
            const a = Math.abs(v);
            if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(v).toLocaleString("es-MX");
        };
        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const genColor = (v) => v === null ? "#64748b" : v >= goodFrom ? "#15803d" : v >= warnFrom ? "#a16207" : "#b91c1c";
        const topN = Math.max(1, Math.round(Number.isFinite(config.topN) ? config.topN : 4));

        const [mGen, mPor, mVeh, mReg] = measures.map(m => m.name);
        const d0 = dims[0].name;

        const regionsText = (cell) => {
            if (!cell) return "";
            let list = cell.value;
            if (typeof list === "string") list = list.split(",").map(s => s.trim()).filter(Boolean);
            if (!Array.isArray(list)) list = [];
            list = list.filter(x => x && x !== "Sin región");
            if (!list.length) return "";
            const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            return list.length === 1 ? cap(list[0]) : `${cap(list[0])} y ${list.length - 1} más`;
        };

        let clients = data.map(r => ({
            name: LookerCharts.Utils.textForCell(r[d0]),
            gen: toNum(r[mGen] && r[mGen].value),
            por: toNum(r[mPor] && r[mPor].value),
            veh: toNum(r[mVeh] && r[mVeh].value),
            regions: mReg ? regionsText(r[mReg]) : "",
            linksGen: (r[mGen] && r[mGen].links) || [],
            linksPor: (r[mPor] && r[mPor].links) || []
        }));
        if (config.hideUnassigned !== false) clients = clients.filter(c => c.name && c.name !== "Sin cliente" && c.name !== "∅");

        const best = clients.filter(c => c.gen !== null).sort((a, b) => b.gen - a.gen).slice(0, topN);
        const opp = clients.filter(c => c.por !== null && c.por > 0).sort((a, b) => b.por - a.por).slice(0, topN);

        const units = (v) => v === null ? "" : `${v.toLocaleString("es-MX")} ${v === 1 ? "unidad" : "unidades"}`;
        const item = (c, i, side) => `
      <div class="cr-item${(side === "l" ? c.linksGen : c.linksPor).length ? " clickable" : ""}" data-side="${side}" data-i="${i}">
        <span class="cr-rank">${i + 1}</span>
        <div><div class="cr-name">${esc(c.name)}</div><div class="cr-sub">${esc(c.regions)}</div></div>
        <div class="cr-val">${side === "l"
                ? `<b style="color:${genColor(c.gen)}">${c.gen.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>`
                : `<b style="color:#c2410c">${money(c.por)}</b>`}<span>${units(c.veh)}</span></div>
      </div>`;

        $("cr-title").textContent = config.title || "";
        $("cr-period").textContent = config.periodText || "";
        $("cr-card").classList.toggle("with-border", config.showCard !== false);
        $("cr-lh").innerHTML = `<span style="color:#15803d">● ${esc(config.leftTitle || "")}</span><span class="h">${esc(config.leftHint || "")}</span>`;
        $("cr-rh").innerHTML = `<span style="color:#c2410c">◆ ${esc(config.rightTitle || "")}</span><span class="h">${esc(config.rightHint || "")}</span>`;
        $("cr-left").innerHTML = best.length ? best.map((c, i) => item(c, i, "l")).join("") : `<div class="cr-empty">Sin datos</div>`;
        $("cr-right").innerHTML = opp.length ? opp.map((c, i) => item(c, i, "r")).join("") : `<div class="cr-empty">Sin datos</div>`;

        element.querySelectorAll(".cr-item.clickable").forEach(el => el.addEventListener("click", (event) => {
            const side = el.getAttribute("data-side"), i = Number(el.getAttribute("data-i"));
            const c = side === "l" ? best[i] : opp[i];
            LookerCharts.Utils.openDrillMenu({ links: side === "l" ? c.linksGen : c.linksPor, event });
        }));

        done();
    }
});
