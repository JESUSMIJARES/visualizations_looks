/**
 * Visualización: Componentes del rubro (vista Análisis)
 * Cambia su contenido según el rubro del filtro, como en el mockup:
 *  - Seguridad:      indicadores + tabla + tiempo arriba de 75 km/h por rango
 *  - Conducción RPM: % del tiempo por rango de RPM + tabla (tiempo)
 *  - Cámaras / Salud Mecánica: indicadores + tabla
 *  - Ralentí:        % del tiempo de motor en ralentí vs meta + horas, litros y costo
 *  - Daño Motor:     eventos de RPM en zona de daño + RPM máxima
 *  Siempre: distribución de unidades Bien / Atención / Crítico.
 *
 * Cómo alimentarla (Explore "Componentes por Rubro"):
 *  - Dimensiones: Componente, Peso, Rubro (componentes)
 *  - Medidas (se reconocen por nombre, el orden no importa):
 *      Calificación, Eventos, Tiempo (h), Bien/Atención/Crítico (rubro), Vehículos Activos,
 *      Vel. Máx., Eventos RPM en zona de daño, RPM máxima, Horas en ralentí, Horas de motor,
 *      Litros en ralentí, Litros de combustible, Costo del ralentí,
 *      Horas 75–85 / 85–95 / 95–105 / 105–115 / > 115 km/h
 *  Si falta una medida, ese indicador simplemente no aparece.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "componentes_rubro",
    label: "Componentes del Rubro",

    options: {
        title: { type: "string", label: "Título (vacío = Componentes · rubro)", default: "", section: "Texto", order: 1 },
        distTitle: { type: "string", label: "Título de la distribución (vacío = automático)", default: "", section: "Texto", order: 2 },
        sortBy: {
            type: "string", label: "Orden de los componentes", display: "select", section: "Estilo", order: 1,
            values: [{ "Calificación (menor a mayor)": "score" }, { "Peso (mayor a menor)": "peso" }, { "Como vienen": "none" }],
            default: "score"
        },
        darkMode: { type: "boolean", label: "Modo oscuro", default: false, section: "Estilo", order: 2 },
        metaRalenti: { type: "number", label: "Meta de ralentí (%)", default: 4, section: "Metas", order: 1 },
        goodFrom: { type: "number", label: "Bien desde (≥)", default: 80, section: "Semáforo", order: 1 },
        warnFrom: { type: "number", label: "Atención desde (≥)", default: 70, section: "Semáforo", order: 2 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .cp-wrap { --bg:#ffffff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0; --track:#eef2f7; --head:#334155;
          --good:#16a34a; --warn:#eab308; --bad:#dc2626; --orange:#f97316;
          width:100%; height:100%; box-sizing:border-box; padding:2px 4px; overflow:auto; background:var(--bg); color:var(--text);
          font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; display:flex; flex-direction:column; gap:12px; }
        .cp-wrap.dark { --bg:#111827; --text:#f1f5f9; --muted:#94a3b8; --line:#1f2937; --track:#1f2937; --head:#cbd5e1;
          --good:#22c55e; --warn:#eab308; --bad:#ef4444; }
        .cp-title { margin:0; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--head); }
        .cp-sec { font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
        .cp-kpis { display:flex; gap:28px; flex-wrap:wrap; }
        .cp-kpi { border-left:2px solid var(--line); padding:2px 0 2px 10px; min-width:110px; flex:1; }
        .cp-kpi b { display:block; font-size:17px; font-weight:700; line-height:1.15; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
        .cp-kpi span { display:block; font-size:11px; color:var(--text); opacity:.85; }
        .cp-kpi small { display:block; font-size:10px; color:var(--muted); }
        .cp-hero { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
        .cp-hero b { font-size:34px; font-weight:700; line-height:1; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
        .cp-hero span { font-size:12px; }
        .cp-hero em { margin-left:auto; font-style:normal; font-size:12px; color:var(--muted); }
        .cp-meter { position:relative; height:10px; border-radius:999px; background:var(--track); margin-top:10px; }
        .cp-meter > div { height:100%; border-radius:999px; }
        .cp-meter i { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--good); }
        table.cp { width:100%; border-collapse:collapse; font-size:12px; color:var(--text); font-family:inherit; }
        .cp th { font-size:9.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
          padding:5px 10px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
        .cp th:first-child, .cp td:first-child { text-align:left; }
        .cp td { padding:5px 8px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; color:var(--text); font-variant-numeric:tabular-nums; }
        .cp td.score .sc { display:flex; align-items:center; justify-content:flex-end; gap:14px; }
        .cp .track { width:70px; height:6px; border-radius:999px; background:var(--track); overflow:hidden; }
        .cp .fill { height:100%; border-radius:999px; }
        .cp .val { font-size:14px; font-weight:700; min-width:44px; text-align:right; }
        .cp-stack { display:flex; height:16px; border-radius:6px; overflow:hidden; background:var(--track); }
        .cp-stack div { display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:600; color:#1f2937; white-space:nowrap; overflow:hidden; }
        .cp-leg { display:flex; gap:14px; flex-wrap:wrap; margin-top:6px; font-size:11.5px; color:var(--muted); }
        .cp-leg span i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
        .cp-leg b { color:var(--text); margin-left:3px; }
        .cp-dist { display:grid; grid-template-columns:100px minmax(80px, 240px) 40px; gap:7px 12px; align-items:center;
          font-size:12px; justify-content:center; }
        .cp-dist .bar { height:9px; border-radius:999px; background:var(--track); overflow:hidden; }
        .cp-dist .bar div { height:100%; border-radius:999px; }
        .cp-dist b { font-weight:700; text-align:right; }
        .cp-meta { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:11px; color:var(--muted); }
        .cp-meta b { color:var(--good); }
        .cp-mbar { margin-left:auto; width:110px; height:6px; border-radius:999px; background:var(--orange); overflow:hidden; }
        .cp-mbar div { height:100%; background:var(--good); }
        .cp-money { display:grid; grid-template-columns:auto 1fr 1fr 1fr; gap:5px; align-items:center; }
        .cp-money .h { font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); text-align:center; }
        .cp-money .lg { font-size:11.5px; font-weight:600; color:var(--good); padding-right:6px; }
        .cp-money .lp { font-size:11.5px; font-weight:600; color:var(--orange); padding-right:6px; }
        .cp-mcell { border:1px solid var(--line); border-radius:6px; padding:6px 10px; text-align:right; font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; }
        .cp-mcell.g { color:var(--good); } .cp-mcell.o { color:var(--orange); }
        .cp-mcell.hl { border:2px solid #3b82f6; padding:5px 9px; }
        .cp-empty { font-size:12.5px; color:var(--muted); line-height:1.5; }
        .cp-click { cursor:pointer; }
      </style>
      <div class="cp-wrap" id="cp-wrap"></div>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;
        const wrap = element.querySelector("#cp-wrap");
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        wrap.classList.toggle("dark", config.darkMode === true);

        if (!dims.length || !measures.length) {
            this.addError({ id: "fields", title: "Faltan campos", message: "Usa Componente, Peso y Rubro + Calificación, Eventos, Tiempo (h), Bien, Atención y Crítico." });
            done(); return;
        }

        // ---------- Campos ----------
        const short = (f) => f.name.split(".").pop();
        const dRubro = dims.find(d => short(d) === "rubro");
        const dPeso = dims.find(d => short(d) === "peso");
        const dComp = dims.find(d => d !== dRubro && d !== dPeso) || dims[0];
        const M = (re, pos) => { const m = measures.find(x => re.test(short(x))); return m ? m.name : (pos !== undefined && measures[pos] ? measures[pos].name : null); };
        const f = {
            cal: M(/^calificacion_componente$/, 0), ev: M(/^eventos_componente$/, 1), hr: M(/^horas_componente$/, 2),
            b: M(/_bien$/, 3), a: M(/_atencion$/, 4), c: M(/_critico$/, 5),
            act: M(/^vehiculos_activos$/), vel: M(/^velocidad_maxima$/), dano: M(/^eventos_dano_rpm$/), rpm: M(/^rpm_maxima$/),
            hRal: M(/^horas_ralenti$/), hMot: M(/^horas_motor$/), lRal: M(/^litros_ralenti$/), lTot: M(/^litros_combustible$/),
            cRal: M(/^costo_ralenti$/),
            cCond: M(/^costo_conduccion$/), aRend: M(/^ahorro_rendimiento$/), aRal: M(/^ahorro_ralenti$/),
            pRend: M(/^por_lograr_rendimiento$/), pRal: M(/^por_lograr_ralenti$/), aTot: M(/^ahorro_logrado$/), pTot: M(/^ahorro_por_lograr$/),
            rReal: M(/^rendimiento_real$/), rEsp: M(/^rendimiento_esperado$/),
            v75: M(/^horas_75_85$/), v85: M(/^horas_85_95$/), v95: M(/^horas_95_105$/), v105: M(/^horas_105_115$/), v115: M(/^horas_115$/)
        };
        const first = data[0] || {};
        const rubroKey0 = dRubro && data[0] ? String(data[0][dRubro.name].value || "") : "";
        // En Combustible cada fila es una clase de vehículo: los totales se suman entre filas.
        // En los demás rubros todas las filas traen el mismo total: se lee la primera.
        const top = (k) => {
            if (!f[k]) return null;
            if (rubroKey0 !== "combustible") return toNum(first[f[k]] && first[f[k]].value);
            const vals = data.map(r => toNum(r[f[k]] && r[f[k]].value)).filter(v => v !== null);
            return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
        };
        const linksOf = (k) => (f[k] && first[f[k]] && first[f[k]].links) || [];

        const RUBROS = {
            seguridad: "Seguridad", conduccion_rpm: "Conducción RPM", camaras: "Cámaras", salud_mecanica: "Salud Mecánica",
            ralenti: "Ralentí", dano_motor: "Daño Motor", general: "General", combustible: "Combustible"
        };
        const rubroKey = dRubro && data[0] ? String(data[0][dRubro.name].value || "") : "";
        const rubroName = RUBROS[rubroKey] || rubroKey;

        const goodFrom = Number.isFinite(config.goodFrom) ? config.goodFrom : 80;
        const warnFrom = Number.isFinite(config.warnFrom) ? config.warnFrom : 70;
        const colorOf = (v) => v === null ? "var(--muted)" : v >= goodFrom ? "var(--good)" : v >= warnFrom ? "var(--warn)" : "var(--bad)";
        const n0 = (v) => v === null ? "—" : Math.round(v).toLocaleString("es-MX");
        const n1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const money = (v) => {
            const a = Math.abs(v);
            if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(v / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(v).toLocaleString("es-MX");
        };

        // ---------- Filas de componentes (las filas sin componente no se dibujan) ----------
        let rows = data.filter(r => r[dComp.name] && r[dComp.name].value !== null && r[dComp.name].value !== "").map(r => ({
            name: LookerCharts.Utils.textForCell(r[dComp.name]),
            peso: dPeso ? toNum(r[dPeso.name].value) : null,
            cal: f.cal ? toNum(r[f.cal] && r[f.cal].value) : null,
            ev: f.ev ? toNum(r[f.ev] && r[f.ev].value) : null,
            hr: f.hr ? toNum(r[f.hr] && r[f.hr].value) : null,
            links: (f.cal && r[f.cal] && r[f.cal].links) || []
        })).filter(r => r.name && r.name !== "∅");
        const usesTime = rows.length > 0 && rows.every(r => r.ev === null) && rows.some(r => r.hr !== null);
        const sumEv = rows.reduce((s, r) => s + (r.ev || 0), 0);
        const act = top("act");
        const perAct = (v) => (act && v !== null) ? n1(v / act) : "—";

        // ---------- Piezas ----------
        const kpis = (items) => {
            const list = items.filter(x => x && x.v !== null && x.v !== undefined);
            return list.length ? `<div class="cp-kpis">${list.map(x => `<div class="cp-kpi"><b>${x.v}</b><span>${esc(x.l)}</span>${x.s ? `<small>${esc(x.s)}</small>` : ""}</div>`).join("")}</div>` : "";
        };
        const stack = (title, parts, showInside) => {
            const tot = parts.reduce((s, p) => s + (p.v || 0), 0);
            if (!tot) return "";
            return `<div><div class="cp-sec">${esc(title)}</div>
        <div class="cp-stack">${parts.map(p => { const pc = (p.v || 0) / tot * 100; return pc > 0 ? `<div style="width:${pc}%;background:${p.c}">${showInside && pc >= 8 ? n1(pc) + "%" : ""}</div>` : ""; }).join("")}</div>
        <div class="cp-leg">${parts.map(p => { const pc = (p.v || 0) / tot * 100; return `<span><i style="background:${p.c}"></i>${esc(p.l)}${!showInside || pc < 8 ? `<b>${n1(pc)}%</b>` : ""}</span>`; }).join("")}</div></div>`;
        };
        const linksBy = [];
        const table = () => {
            if (!rows.length) return "";
            if (config.sortBy === "peso") rows.sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0));
            else if (config.sortBy !== "none") rows.sort((a, b) => (a.cal ?? Infinity) - (b.cal ?? Infinity));
            return `<table class="cp"><thead><tr><th>Componente</th><th>Peso</th><th>${usesTime ? "Tiempo" : "Eventos"}</th><th>Calificación</th></tr></thead>
        <tbody>${rows.map((r, i) => {
                linksBy[i] = r.links;
                const c = colorOf(r.cal), pct = r.cal === null ? 0 : Math.max(0, Math.min(100, r.cal));
                return `<tr data-i="${i}" class="${r.links.length ? "cp-click" : ""}"><td>${esc(r.name)}</td>
            <td>${r.peso === null ? "—" : Math.round(r.peso * 100) + "%"}</td>
            <td>${usesTime ? (r.hr === null ? "—" : n0(r.hr) + " h") : n0(r.ev)}</td>
            <td class="score"><div class="sc"><div class="track"><div class="fill" style="width:${pct}%;background:${c}"></div></div>
              <span class="val" style="color:${c}">${r.cal === null ? "—" : n1(r.cal)}</span></div></td></tr>`;
            }).join("")}</tbody></table>`;
        };

        // ---------- Contenido por rubro ----------
        let body = "";
        if (!rubroKey || rubroKey === "general") {
            body = `<div class="cp-empty">La General es el promedio de los 6 rubros. Elige un rubro para ver sus componentes.</div>`;
        } else if (rubroKey === "seguridad") {
            const graves = rows.filter(r => /descolgad|accidente/i.test(r.name)).reduce((s, r) => s + (r.ev || 0), 0);
            const vel = top("vel");
            body = kpis([
                { v: n0(graves), l: "eventos graves" },
                { v: perAct(graves), l: "graves por vehículo activo" },
                vel !== null ? { v: n0(vel) + " km/h", l: "velocidad máxima" } : null
            ]) + table() + stack("Tiempo arriba de 75 km/h, por rango de velocidad", [
                { l: ">75 km/hr", v: top("v75"), c: "#4ade80" }, { l: ">85 km/hr", v: top("v85"), c: "#16a34a" },
                { l: ">95 km/hr", v: top("v95"), c: "#facc15" }, { l: ">105 km/hr", v: top("v105"), c: "#f97316" },
                { l: ">115 km/hr", v: top("v115"), c: "#dc2626" }
            ], true);
        } else if (rubroKey === "conduccion_rpm") {
            const h = (re) => { const r = rows.find(x => re.test(x.name)); return r ? r.hr : null; };
            body = stack("% del tiempo por rango de RPM", [
                { l: "Economía", v: h(/econom/i), c: "#84cc16" }, { l: "Desempeño", v: h(/desempe/i), c: "#facc15" },
                { l: "Fuera de rango", v: h(/fuera/i), c: "#dc2626" }
            ], true) + table();
        } else if (rubroKey === "camaras") {
            body = kpis([{ v: n0(sumEv), l: "eventos de cámara" }, { v: perAct(sumEv), l: "por vehículo activo" }]) + table();
        } else if (rubroKey === "salud_mecanica") {
            body = kpis([{ v: n0(sumEv), l: "alertas mecánicas" }, { v: perAct(sumEv), l: "por vehículo activo" }]) + table();
        } else if (rubroKey === "ralenti") {
            const hR = top("hRal"), hM = top("hMot"), lR = top("lRal"), lT = top("lTot"), cR = top("cRal");
            const meta = Number.isFinite(config.metaRalenti) ? config.metaRalenti : 4;
            const pct = (hR !== null && hM) ? hR / hM * 100 : null;
            body = (pct !== null ? `<div><div class="cp-hero"><b style="color:${pct <= meta ? "var(--good)" : "var(--orange)"}">${n1(pct)}%</b>
          <span>del tiempo de motor encendido en ralentí</span><em>meta ${n1(meta).replace(/,0$|\.0$/, "")}%</em></div>
          <div class="cp-meter"><div style="width:${Math.min(100, pct)}%;background:${pct <= meta ? "var(--good)" : "var(--orange)"}"></div><i style="left:${Math.min(100, meta)}%"></i></div></div>` : "")
                + kpis([
                    hR !== null ? { v: n0(hR) + " h", l: "en ralentí", s: hM ? `de ${n0(hM)} h de motor` : "" } : null,
                    lR !== null ? { v: n0(lR) + " L", l: "en ralentí", s: lT ? `${n1(lR / lT * 100)}% del combustible` : "" } : null,
                    cR !== null ? { v: money(cR), l: "costo del ralentí" } : null
                ]);
        } else if (rubroKey === "dano_motor") {
            const ev = top("dano"), rpm = top("rpm");
            body = (ev !== null ? `<div class="cp-hero"><b style="color:${ev > 0 ? "var(--bad)" : "var(--good)"}">${n0(ev)}</b>
          <span>eventos de RPM en zona de daño</span><em>meta 0</em></div>` : "")
                + kpis([
                    ev !== null ? { v: perAct(ev), l: "eventos por vehículo activo" } : null,
                    rpm !== null ? { v: n0(rpm), l: "RPM máxima" } : null
                ]);
        } else if (rubroKey === "combustible") {
            const lT = top("lTot"), lR = top("lRal"), cR = top("cRal"), cC = top("cCond");
            const aT = top("aTot"), pT = top("pTot");
            const lC = lT !== null ? lT - (lR || 0) : null;
            const pctLog = (aT !== null && pT !== null && aT + pT > 0) ? aT / (aT + pT) * 100 : null;
            const cell = (v, cls, hl) => `<div class="cp-mcell ${cls}${hl ? " hl" : ""}">${v === null ? "—" : money(v)}</div>`;
            const clases = data.map(r => ({
                name: LookerCharts.Utils.textForCell(r[dComp.name]),
                real: f.rReal ? toNum(r[f.rReal] && r[f.rReal].value) : null,
                esp: f.rEsp ? toNum(r[f.rEsp] && r[f.rEsp].value) : null
            })).filter(x => x.name && x.name !== "∅" && x.real !== null);
            const d2 = (v) => v === null ? "—" : v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            body = `<div><div class="cp-sec">Combustible utilizado</div>` + kpis([
                lC !== null ? { v: n0(lC) + " L", l: "Conduciendo", s: cC !== null ? money(cC) : "" } : null,
                lR !== null ? { v: n0(lR) + " L", l: "Ralentí", s: [lT ? n1(lR / lT * 100) + "%" : "", cR !== null ? money(cR) : ""].filter(Boolean).join(" · ") } : null
            ]) + `</div>`
                + `<div><div class="cp-meta"><span class="cp-sec" style="margin:0">Meta</span>${pctLog !== null ? `<div class="cp-mbar"><div style="width:${pctLog}%"></div></div><span><b>${Math.round(pctLog)}%</b> logrado</span>` : ""}</div>
           <div class="cp-money">
             <span></span><span class="h">Rendimiento</span><span class="h">Ralentí</span><span class="h">Total</span>
             <span class="lg">Ahorro logrado</span>${cell(top("aRend"), "g")}${cell(top("aRal"), "g")}${cell(aT, "g")}
             <span class="lp">Ahorro por lograr</span>${cell(top("pRend"), "o")}${cell(top("pRal"), "o")}${cell(pT, "o", true)}
           </div></div>`
                + (clases.length ? `<div><div class="cp-sec">Rendimiento</div><table class="cp"><thead><tr><th>Clase</th><th>Real km/L</th><th>Esperado</th><th>Diferencia</th></tr></thead><tbody>${clases.map(x => {
                    const d = (x.real !== null && x.esp !== null) ? x.real - x.esp : null;
                    const c = d === null ? "var(--muted)" : d >= 0 ? "var(--good)" : "var(--bad)";
                    return `<tr><td>${esc(x.name)}</td><td>${d2(x.real)}</td><td>${d2(x.esp)}</td><td><span class="val" style="color:${c}">${d === null ? "—" : (d >= 0 ? "▲ " : "▼ ") + d2(Math.abs(d))}</span></td></tr>`;
                }).join("")
                    }</tbody></table></div>` : "");
        } else {
            body = kpis([{ v: n0(sumEv), l: "eventos" }]) + (table() || `<div class="cp-empty">Este rubro no tiene componentes.</div>`);
        }

        // ---------- Distribución de unidades ----------
        const dist = (rubroKey && rubroKey !== "general" && rubroKey !== "combustible") ? [
            { label: "Bien", icon: "●", color: "var(--good)", k: "b" },
            { label: "Atención", icon: "▲", color: "var(--warn)", k: "a" },
            { label: "Crítico", icon: "◆", color: "var(--bad)", k: "c" }
        ].filter(d => f[d.k]).map(d => ({ ...d, v: top(d.k) || 0, links: linksOf(d.k) })) : [];
        const totalUnits = dist.reduce((s, d) => s + d.v, 0);
        const distHtml = dist.length ? `<div><div class="cp-sec">${esc(config.distTitle || `Unidades por calificación de ${rubroName}`)}</div>
      <div class="cp-dist">${dist.map((d, i) => `
        <span><span style="color:${d.color}">${d.icon}</span> ${d.label}</span>
        <div class="bar${d.links.length ? " cp-click" : ""}" data-d="${i}"><div style="width:${totalUnits ? (d.v / totalUnits * 100).toFixed(1) : 0}%;background:${d.color}"></div></div>
        <b>${d.v.toLocaleString("es-MX")}</b>`).join("")}</div></div>` : "";

        const title = config.title || (rubroName && rubroKey !== "general" ? `Componentes · ${rubroName}` : "Componentes");
        wrap.innerHTML = `<h3 class="cp-title">${esc(title)}</h3>${body}${distHtml}`;

        // ---------- Clics ----------
        wrap.querySelectorAll("table.cp tr[data-i]").forEach(tr => {
            const links = linksBy[Number(tr.getAttribute("data-i"))];
            if (links && links.length) tr.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links, event }));
        });
        wrap.querySelectorAll(".cp-dist .bar").forEach(el => {
            const d = dist[Number(el.getAttribute("data-d"))];
            if (d.links.length) el.addEventListener("click", (event) => LookerCharts.Utils.openDrillMenu({ links: d.links, event }));
        });

        done();
    }
});