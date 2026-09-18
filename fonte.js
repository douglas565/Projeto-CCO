/* =====================================================================
   BI OPE — CWB · FONTES AUTOMÁTICAS  (fontes.js)  ·  v3
   ---------------------------------------------------------------------
   CORREÇÕES DESTA VERSÃO (falha "AUTH_TOKEN não encontrado"):
     1. A URL de login passa a ser montada EXATAMENTE como no Power Query:
        ?CMD.COMMAND=Login&CMD_username=U&CMD_password=P&parser=json
        com as credenciais em texto literal (sem percent-encoding).
        O encodeURIComponent transformava "@consult56324" em
        "%40consult56324" e o servlet recusava a senha, devolvendo um
        JSON de erro — daí o token não aparecer.
     2. Busca do token tolerante: AUTH_TOKEN, authToken, token,
        access_token, em qualquer profundidade, ignorando maiúsculas,
        acentos e sublinhados; desembrulha respostas de proxy
        (contents/body/data como string JSON).
     3. Quando mesmo assim não encontrar, mostra a RESPOSTA CRUA e a
        lista de chaves recebidas, para diagnóstico imediato.
   ---------------------------------------------------------------------
   Login ....... /guia/command/<contexto>?CMD.COMMAND=Login... → AUTH_TOKEN
   Relatório ... /guia/command/<contexto>/relatoriosHouer.json
                 ?CMD_SCRIPT_PARAMETERS={"OPCAO":"4","PAGE":0,
                  "PAGE_SIZE":0,"DATA_INICIO":"dd/mm/aaaa"}&auth_token=..
   Lista ....... RAIZ → PONTOS_ATENDIDOS → PONTO_ATENDIDO
   Nenhum cálculo do OPE é alterado. Carregar ANTES de script.js.
   ===================================================================== */
(function () {
  "use strict";

  const LS_API = "biope.exati.cfg.v3";
  const LS_HOR = "biope.horarios.v1";
  const LS_MAP = "biope.exati.map.v2";

  /* ================= HORÁRIOS — VALORES PRÉ-SETADOS ================= */
  const HORARIOS_PADRAO = [
    { ano: 2026, mes: "JULHO", turno: "T1", ini: "07:30", fim: "16:30",
      mob: "00:20", desmob: "00:20", desloc: "01:00", interv: "01:30", metaProd: 15 },
    { ano: 2026, mes: "JULHO", turno: "T2", ini: "14:00", fim: "23:00",
      mob: "00:20", desmob: "00:20", desloc: "01:00", interv: "01:30", metaProd: 15 },
    { ano: 2026, mes: "JULHO", turno: "T3", ini: "22:00", fim: "06:00",
      mob: "00:20", desmob: "00:20", desloc: "01:00", interv: "01:30", metaProd: 15 }
  ];

  const HEAD_HORARIOS = ["ANO", "MÊS", "TURNO", "HORA INÍCIO", "HORA FIM",
    "TEMPO MOBILIZAÇÃO (min)", "TEMPO DESMOBILIZAÇÃO (min)", "TEMPO DESLOCAMENTO (min)",
    "TEMPO INTERVALO (min)", "TEMPO TOTAL PREVISTO", "META DISPONIBILIDADE",
    "META PRODUÇÃO", "META PRODUTIVIDADE (hh)"];

  const HEAD_ATEND = ["Nº atendimento", "Protocolo", "Número de identificação", "Endereço",
    "Tipo de ocorrência", "Atendimento", "Motivo", "Início", "Conclusão", "Solução", "Desc. Equipe"];
  const HEAD_EXTRA = ["Regional", "Veículo", "Bairro", "Empresa"];

  const MESES_LISTA = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

  /* ============ CONFIGURAÇÃO DA API — PRÉ-SETADA (Guia/Exati) ======== */
  const API_PADRAO = {
    ativo: false,
    host: "https://engiecuritiba.exati.com.br",
    contexto: "engiecuritiba",
    rotaLoginBase: "/guia/command/{ctx}",      // sem query — montada abaixo
    rotaRelatorio: "/guia/command/{ctx}/relatoriosHouer.json",
    usuario: "consulta.webservice",
    senha: "",
    codificarCred: false,     // false = literal, idêntico ao Power Query
    campoToken: "",           // opcional: caminho explícito, ex. RESULT.AUTH_TOKEN
    opcao: "4",
    pageSize: 0,
    paginaInicial: 0,
    maxPaginas: 200,
    enviarDataFim: false,
    extras: "",
    caminhoLista: "RAIZ.PONTOS_ATENDIDOS.PONTO_ATENDIDO",
    filtrarLocal: true,
    gerarPlanejamento: true,
    proxy: "",
    salvarSegredo: false
  };

  const MAP_PADRAO = {
    "Nº atendimento": "ID_ATENDIMENTO_PS",
    "Protocolo": "NUMERO_PROTOCOLO",
    "Número de identificação": "NUMERO_IDENTIFICACAO",
    "Endereço": "NOME_LOGRADOURO_COMPLETO",
    "Tipo de ocorrência": "DESC_TIPO_OCORRENCIA",
    "Atendimento": "DESC_STATUS_ATENDIMENTO_PS",
    "Motivo": "DESC_MOTIVO_ATENDIMENTO_PS",
    "Início": "DATA_HORA_INICIO_ATENDIMENTO",
    "Conclusão": "DATA_HORA_CONCLUSAO_ATENDIMENTO",
    "Solução": "DESC_SOLUCAO_ATENDIMENTO_PS",
    "Desc. Equipe": "DESC_EQUIPE",
    "Regional": "NOME_REGIAO",
    "Veículo": "VEICULOS",
    "Bairro": "NOME_BAIRRO",
    "Empresa": "EMPRESA_USUARIA_EQUIPE"
  };

  const SUGESTOES = {
    "Nº atendimento": ["ID_ATENDIMENTO_PS", "NUMERO_ATENDIMENTO", "ID_ATENDIMENTO"],
    "Protocolo": ["NUMERO_PROTOCOLO", "PROTOCOLO"],
    "Número de identificação": ["NUMERO_IDENTIFICACAO", "NUMERO_LOCAL_INICIAL", "ID_PONTO_SERVICO"],
    "Endereço": ["NOME_LOGRADOURO_COMPLETO", "ENDERECO_LIVRE", "NOME_LOGRADOURO"],
    "Tipo de ocorrência": ["DESC_TIPO_OCORRENCIA", "DESC_DOMINIO"],
    "Atendimento": ["DESC_STATUS_ATENDIMENTO_PS", "STATUS"],
    "Motivo": ["DESC_MOTIVO_ATENDIMENTO_PS", "MOTIVO"],
    "Início": ["DATA_HORA_INICIO_ATENDIMENTO", "DATA_INICIO_ATENDIMENTO", "HORA_INICIO"],
    "Conclusão": ["DATA_HORA_CONCLUSAO_ATENDIMENTO", "DATA_CONCLUSAO_ATENDIMENTO", "HORA_CONCLUSAO"],
    "Solução": ["DESC_SOLUCAO_ATENDIMENTO_PS", "SOLUCAO"],
    "Desc. Equipe": ["DESC_EQUIPE", "EQUIPE"],
    "Regional": ["NOME_REGIAO", "REGIAO", "REGIONAL"],
    "Veículo": ["VEICULOS", "VEICULO", "PLACA"],
    "Bairro": ["NOME_BAIRRO", "BAIRRO"],
    "Empresa": ["EMPRESA_USUARIA_EQUIPE", "NOME_PARQUE_SERVICO"]
  };

  /* ============================ HELPERS ============================ */
  const TODAS = HEAD_ATEND.concat(HEAD_EXTRA);
  const $$ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const escH = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const min2hhmm = (m) => { m = Math.max(0, Math.round(m)); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const hhmm2min = (s) => {
    if (s == null || s === "") return 0;
    const m = String(s).trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) return (+m[1]) * 60 + (+m[2]) + (+m[3] || 0) / 60;
    const n = parseFloat(String(s).replace(",", ".")); return isNaN(n) ? 0 : n;
  };
  const seg2hms = (seg) => {
    seg = Math.max(0, Math.round(seg));
    return `${String(Math.floor(seg / 3600)).padStart(2, "0")}:${String(Math.floor(seg % 3600 / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  };
  const porCaminho = (obj, caminho) => {
    if (!caminho) return obj;
    return String(caminho).split(".").reduce((o, k) => {
      if (o == null) return undefined;
      const m = k.match(/^(.*?)\[(\d+)\]$/);
      if (m) { const base = m[1] ? o[m[1]] : o; return Array.isArray(base) ? base[+m[2]] : undefined; }
      return o[k];
    }, obj);
  };
  const chaveNorm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "");

  /* desembrulha respostas de proxy: string JSON, {contents}, {body}, {data} */
  function desembrulhar(j, prof) {
    if ((prof || 0) > 4) return j;
    if (typeof j === "string") {
      const t = j.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try { return desembrulhar(JSON.parse(t), (prof || 0) + 1); } catch { return j; }
      }
      return j;
    }
    if (j && typeof j === "object") {
      for (const k of ["contents", "body", "data", "response", "result"]) {
        if (typeof j[k] === "string" && /^[\[{]/.test(j[k].trim())) {
          try { return desembrulhar(JSON.parse(j[k]), (prof || 0) + 1); } catch { }
        }
      }
    }
    return j;
  }

  /* busca recursiva tolerante por uma das chaves-alvo */
  function buscarChaves(o, alvos, prof) {
    if (!o || typeof o !== "object" || (prof || 0) > 8) return undefined;
    const alvosN = alvos.map(chaveNorm);
    for (const k of Object.keys(o)) {
      if (alvosN.includes(chaveNorm(k))) {
        const v = o[k];
        if (v != null && typeof v !== "object" && String(v).trim() !== "") return String(v);
      }
    }
    for (const k of Object.keys(o)) {
      const v = buscarChaves(o[k], alvos, (prof || 0) + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  function listarChaves(o, pref, prof, acc) {
    acc = acc || []; if (!o || typeof o !== "object" || (prof || 0) > 3) return acc;
    Object.keys(o).forEach(k => {
      const p = pref ? pref + "." + k : k;
      acc.push(p + (typeof o[k] === "object" && o[k] !== null ? "" : ` = ${String(o[k]).slice(0, 40)}`));
      if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) listarChaves(o[k], p, (prof || 0) + 1, acc);
    });
    return acc;
  }

  function paraData(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return new Date(v > 1e11 ? v : v * 1000);
    const s = String(v).trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  const fmtBR = (d) => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
  const isoDia = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const brDia = (isoStr) => isoStr ? isoStr.split("-").reverse().join("/") : "";

  /* ======================== ESTADO DO MÓDULO ======================== */
  const API = Object.assign({}, API_PADRAO, lsGet(LS_API, {}));
  const MAP = Object.assign({}, MAP_PADRAO, lsGet(LS_MAP, {}));
  let HOR = lsGet(LS_HOR, null) || HORARIOS_PADRAO.map(h => Object.assign({}, h));
  let CACHE = null, AMOSTRA = null, TOKEN = "", ULTIMA_RESP = null;

  /* ================== CÁLCULO DAS LINHAS DE HORÁRIO ================= */
  function calcTurno(h) {
    const ini = hhmm2min(h.ini), fim = hhmm2min(h.fim);
    const previsto = fim > ini ? fim - ini : (1440 - ini) + fim;
    const desc = hhmm2min(h.mob) + hhmm2min(h.desmob) + hhmm2min(h.desloc) + hhmm2min(h.interv);
    const metaDisp = Math.max(0, previsto - desc);
    const metaProd = Number(h.metaProd) || 0;
    return { previsto, desc, metaDisp, metaProd, produtSeg: (metaProd > 0 ? metaDisp / metaProd : 0) * 60 };
  }
  function horariosAOA() {
    const linhas = [HEAD_HORARIOS.slice()];
    HOR.forEach(h => {
      const c = calcTurno(h);
      linhas.push([Number(h.ano) || new Date().getFullYear(), h.mes || "", String(h.turno || "").toUpperCase(),
        h.ini, h.fim, h.mob, h.desmob, h.desloc, h.interv,
        min2hhmm(c.previsto), min2hhmm(c.metaDisp), c.metaProd, seg2hms(c.produtSeg)]);
    });
    return linhas;
  }
  function wbHorarios() {
    if (typeof XLSX === "undefined") return null;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(horariosAOA()), "Planilha1");
    return { nome: "HORÁRIOS (pré-setado no painel)", wb, daPasta: false };
  }

  /* ========================== CHAMADAS À API ======================== */
  const comProxy = (u) => API.proxy ? API.proxy + encodeURIComponent(u) : u;
  const montaURL = (rota) => String(API.host || "").replace(/\/+$/, "") +
    String(rota || "").replace("{ctx}", API.contexto);

  /* idêntico ao Power Query: credenciais literais, parser=json ao final */
  function urlLogin() {
    const cred = v => API.codificarCred ? encodeURIComponent(v) : String(v ?? "");
    return montaURL(API.rotaLoginBase) +
      "?CMD.COMMAND=Login&CMD_username=" + cred(API.usuario) +
      "&CMD_password=" + cred(API.senha) + "&parser=json";
  }

  async function autenticar() {
    const r = await fetch(comProxy(urlLogin()), { headers: { Accept: "application/json" } });
    const txt = await r.text();
    ULTIMA_RESP = txt;
    if (!r.ok) throw new Error(`Login falhou (HTTP ${r.status} ${r.statusText}). Resposta: ${txt.slice(0, 200)}`);
    if (/^\s*</.test(txt))
      throw new Error("O login devolveu HTML e não JSON — a chamada não chegou autenticada (proxy que remove a query string, ou parser=json ausente). Veja a resposta crua abaixo.");
    let j; try { j = desembrulhar(JSON.parse(txt), 0); }
    catch { throw new Error("O login não devolveu JSON válido. Veja a resposta crua abaixo."); }

    TOKEN = (API.campoToken ? porCaminho(j, API.campoToken) : null) ||
      buscarChaves(j, ["AUTH_TOKEN", "AUTHTOKEN", "TOKEN", "ACCESS_TOKEN", "SESSION_ID", "JSESSIONID"]) || "";
    if (!TOKEN) {
      const chaves = listarChaves(j, "", 0).slice(0, 25).join(" · ");
      throw new Error(`Login respondeu, mas nenhum token foi encontrado. Chaves recebidas: ${chaves || "(nenhuma)"}. ` +
        `Se o token estiver em outro campo, informe o caminho em "Caminho do token". Resposta crua abaixo.`);
    }
    return TOKEN;
  }

  function parametrosScript(deISO, ateISO, pagina) {
    const p = { OPCAO: String(API.opcao), PAGE: pagina, PAGE_SIZE: Number(API.pageSize) || 0 };
    if (deISO) p.DATA_INICIO = brDia(deISO);
    if (API.enviarDataFim && ateISO) p.DATA_FIM = brDia(ateISO);
    if (API.extras) {
      let ex; try { ex = JSON.parse(API.extras); } catch { throw new Error("Parâmetros extras não são um JSON válido."); }
      Object.assign(p, ex);
    }
    return p;
  }

  async function buscarPagina(deISO, ateISO, pagina) {
    if (!TOKEN) await autenticar();
    const par = parametrosScript(deISO, ateISO, pagina);
    const u = `${montaURL(API.rotaRelatorio)}?CMD_SCRIPT_PARAMETERS=${encodeURIComponent(JSON.stringify(par))}&auth_token=${encodeURIComponent(TOKEN)}`;
    const r = await fetch(comProxy(u), { headers: { Accept: "application/json" } });
    const txt = await r.text();
    ULTIMA_RESP = txt;
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} no relatório. Confira a rota e a OPÇÃO do script.`);
    let j; try { j = desembrulhar(JSON.parse(txt), 0); }
    catch { throw new Error("O relatório não devolveu JSON (sessão expirada ou rota incorreta). Resposta crua abaixo."); }
    let lista = porCaminho(j, API.caminhoLista);
    if (lista == null) lista = buscarLista(j, "PONTO_ATENDIDO");
    if (lista && !Array.isArray(lista)) lista = [lista];
    if (!Array.isArray(lista))
      throw new Error(`Não localizei a lista em "${API.caminhoLista}". Chaves na raiz: ${Object.keys(j).join(", ")}.`);
    return { lista, bruto: j };
  }
  function buscarLista(o, alvo, prof) {
    if (!o || typeof o !== "object" || (prof || 0) > 8) return undefined;
    const alvoN = chaveNorm(alvo);
    for (const k of Object.keys(o)) if (chaveNorm(k) === alvoN) return o[k];
    for (const k of Object.keys(o)) {
      const v = buscarLista(o[k], alvo, (prof || 0) + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  async function buscarTudo(deISO, ateISO, aoProgredir) {
    TOKEN = "";
    const todos = [];
    const tam = Number(API.pageSize) || 0;
    let pagina = Number(API.paginaInicial) || 0;
    for (let i = 0; i < (Number(API.maxPaginas) || 200); i++) {
      const { lista } = await buscarPagina(deISO, ateISO, pagina);
      todos.push(...lista);
      aoProgredir && aoProgredir(todos.length);
      if (tam <= 0) break;
      if (lista.length < tam) break;
      pagina++;
    }
    if (todos.length) AMOSTRA = todos[0];
    return todos;
  }

  /* ==================== CONVERSÃO PARA PLANILHA ===================== */
  function valorCampo(o, col) {
    let v = porCaminho(o, MAP[col]);
    if (v && typeof v === "object")
      v = v.descricao ?? v.DESCRICAO ?? v.nome ?? v.NOME ?? v.valor ?? (Array.isArray(v) ? v.join(", ") : JSON.stringify(v));
    return v == null ? "" : v;
  }
  function dataTurno(d) {
    if (!d) return null;
    const ref = new Date(d);
    if (d.getHours() * 60 + d.getMinutes() <= 390) ref.setDate(ref.getDate() - 1);
    return ref;
  }
  function filtrarPeriodo(regs, deISO, ateISO) {
    if (!API.filtrarLocal || (!deISO && !ateISO)) return regs;
    return regs.filter(o => {
      const d = paraData(valorCampo(o, "Início"));
      if (!d) return true;
      const dia = isoDia(dataTurno(d));
      return (!deISO || dia >= deISO) && (!ateISO || dia <= ateISO);
    });
  }
  function wbAtendimentos(regs) {
    const aoa = [TODAS.slice()];
    regs.forEach(o => {
      aoa.push(TODAS.map(col => {
        const v = valorCampo(o, col);
        return (col === "Início" || col === "Conclusão") ? fmtBR(paraData(v)) : v;
      }));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "ExportarConsulta");
    return wb;
  }
  function wbPlanejamento(regs) {
    const idx = {};
    regs.forEach(o => {
      const eq = String(valorCampo(o, "Desc. Equipe")).trim();
      const d = paraData(valorCampo(o, "Início"));
      if (!eq || !d) return;
      const ref = dataTurno(d);
      const k = eq + "|" + isoDia(ref);
      (idx[k] ||= { eq, data: isoDia(ref), reg: new Set(), veic: new Set(), n: 0 });
      const reg = String(valorCampo(o, "Regional")).trim(); if (reg) idx[k].reg.add(reg);
      const ve = String(valorCampo(o, "Veículo")).trim(); if (ve) idx[k].veic.add(ve);
      idx[k].n++;
    });
    const aoa = [["EQUIPE", "DATA DE ATUAÇÃO", "TURNO", "REGIONAL", "VEÍCULO", "PROTOCOLOS DESPACHADOS"]];
    Object.values(idx).forEach(v => aoa.push([v.eq, brDia(v.data), "", [...v.reg].join(", "), [...v.veic].join(", "), v.n]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Planejamento");
    return { wb, linhas: aoa.length - 1 };
  }

  function mapearAuto() {
    if (!AMOSTRA) return 0;
    const chaves = [];
    (function varre(o, pref, n) {
      if (n > 2 || !o || typeof o !== "object") return;
      Object.keys(o).forEach(k => {
        const p = pref ? pref + "." + k : k; chaves.push(p);
        if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) varre(o[k], p, n + 1);
      });
    })(AMOSTRA, "", 0);
    let n = 0;
    Object.entries(SUGESTOES).forEach(([col, cands]) => {
      const achou = cands.map(chaveNorm).reduce((a, c) => a || chaves.find(k => chaveNorm(k.split(".").pop()) === c), null)
        || cands.map(chaveNorm).reduce((a, c) => a || chaves.find(k => chaveNorm(k).includes(c)), null);
      if (achou) { MAP[col] = achou; n++; }
    });
    return n;
  }

  /* =========================== INTERFACE =========================== */
  const CSS = `
  .fx-box{background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:16px;margin-bottom:16px}
  .fx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
  .fx-f label{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
  .fx-f input,.fx-f select,.fx-f textarea{width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13px;background:#fff}
  .fx-chk{display:flex;gap:6px;align-items:center;font-size:12.5px;font-weight:600;color:#334155;padding-top:6px}
  .fx-chk input{width:auto}
  .fx-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center}
  .fx-acoes button{padding:8px 14px;border:0;border-radius:8px;background:#12315e;color:#fff;font-weight:600;cursor:pointer;font-size:13px}
  .fx-acoes button.g{background:#fff;color:#12315e;border:1px solid #12315e}
  .fx-acoes button:disabled{opacity:.5;cursor:not-allowed}
  .fx-st{font-size:12.5px;color:#475569;margin-top:10px;line-height:1.5}
  .fx-st.ok{color:#15803d}.fx-st.err{color:#b91c1c}
  table.fx-tab{width:100%;border-collapse:collapse;font-size:12.5px}
  table.fx-tab th,table.fx-tab td{border:1px solid #e2e8f0;padding:5px 6px;text-align:center;white-space:nowrap}
  table.fx-tab th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}
  table.fx-tab input,table.fx-tab select{width:100%;min-width:74px;border:1px solid #cbd5e1;border-radius:6px;padding:4px;font:inherit;font-size:12.5px;text-align:center}
  table.fx-tab td.calc{background:#f8fafc;font-weight:700;color:#12315e}
  .fx-hint{font-size:12px;color:#64748b;margin:6px 0 0}
  .fx-amostra{max-height:220px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px;font:12px/1.45 ui-monospace,Consolas,monospace;white-space:pre-wrap;margin-top:10px}
  .fx-url{font:12px/1.5 ui-monospace,Consolas,monospace;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-top:10px;word-break:break-all;color:#334155}
  `;
  const injetarCSS = () => { const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); };
  const campo = (id, rot, tipo, val, extra = "") =>
    `<div class="fx-f"><label for="${id}">${rot}</label><input id="${id}" type="${tipo}" value="${escH(val)}" ${extra}></div>`;
  const check = (id, rot, on) =>
    `<div class="fx-f"><label>&nbsp;</label><label class="fx-chk"><input type="checkbox" id="${id}" ${on ? "checked" : ""}> ${rot}</label></div>`;

  function htmlAPI() {
    const hoje = new Date(), ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const isod = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `
    <div class="fx-box">
      <h3 style="margin:0 0 4px">API Exati · Guia — Engie Curitiba</h3>
      <p class="fx-hint">A chamada é montada igual à do Power Query. As credenciais vão <b>em texto literal</b> por padrão — marcar "codificar credenciais" só é necessário se a senha tiver <code>&amp;</code> ou <code>=</code>.</p>
      <div class="fx-grid">
        ${campo("apHost", "Host", "text", API.host)}
        ${campo("apCtx", "Contexto", "text", API.contexto)}
        ${campo("apUser", "Usuário", "text", API.usuario)}
        ${campo("apPass", "Senha", "password", API.senha)}
        ${campo("apLoginBase", "Rota de login (sem query)", "text", API.rotaLoginBase)}
        ${campo("apRel", "Rota do relatório", "text", API.rotaRelatorio)}
        ${campo("apCampoToken", "Caminho do token (opcional)", "text", API.campoToken, 'placeholder="detecção automática"')}
        ${campo("apOpcao", "OPÇÃO do script", "text", API.opcao)}
        ${campo("apPageSize", "PAGE_SIZE (0 = tudo)", "number", API.pageSize, 'min="0"')}
        ${campo("apLista", "Caminho da lista no JSON", "text", API.caminhoLista)}
        ${campo("apProxy", "Proxy CORS (se necessário)", "text", API.proxy, 'placeholder="https://meu-proxy/?url="')}
        <div class="fx-f"><label for="apExtras">Parâmetros extras (JSON)</label>
          <textarea id="apExtras" rows="2" placeholder='{"ID_PARQUE_SERVICO":"123"}'>${escH(API.extras)}</textarea></div>
      </div>
      <h4 style="margin:16px 0 8px;font-size:13px;color:#475569">Período e comportamento</h4>
      <div class="fx-grid">
        ${campo("apDe", "DATA_INICIO", "date", isod(ini))}
        ${campo("apAte", "Até (recorte)", "date", isod(hoje))}
        ${check("apCred", "codificar credenciais (URL-encode)", API.codificarCred)}
        ${check("apDataFim", "enviar DATA_FIM à API", API.enviarDataFim)}
        ${check("apLocal", "recortar o período no navegador", API.filtrarLocal)}
        ${check("apPlan", "gerar regional/veículo pela API", API.gerarPlanejamento)}
        ${check("apAtivo", "usar a API no lugar da Exportação", API.ativo)}
      </div>
      <div class="fx-acoes">
        <button id="apLogar" class="g">1. Testar login</button>
        <button id="apTestar" class="g">2. Testar relatório</button>
        <button id="apBuscar">3. Buscar atendimentos</button>
        <button id="apAuto" class="g">Mapear campos</button>
        <button id="apUrl" class="g">Ver URL gerada</button>
        <button id="apXlsx" class="g">Baixar Exportação gerada</button>
        <button id="apSalvar" class="g">Salvar configuração</button>
        <button id="apLimpar" class="g">Limpar cache</button>
        <label class="fx-chk" style="margin-left:auto"><input type="checkbox" id="apSegredo" ${API.salvarSegredo ? "checked" : ""}> gravar senha neste navegador</label>
      </div>
      <div class="fx-st" id="apStatus">Informe a senha do usuário <b>${escH(API.usuario)}</b> e clique em <b>Testar login</b>.</div>
      <div class="fx-url" id="apUrlBox" style="display:none"></div>
      <div class="fx-amostra" id="apAmostra" style="display:none"></div>
    </div>

    <div class="fx-box">
      <h3 style="margin:0 0 6px">Mapeamento — campos do relatório → colunas da Exportação Consulta</h3>
      <p class="fx-hint">Pré-setado conforme o retorno de <code>PONTO_ATENDIDO</code>. Regional e Veículo alimentam os filtros do painel.</p>
      <div class="fx-grid">${TODAS.map((c, i) => campo("map" + i, c, "text", MAP[c] || "")).join("")}</div>
    </div>`;
  }

  function htmlHorarios() {
    return `
    <div class="fx-box">
      <h3 style="margin:0 0 6px">Planilha HORÁRIOS — pré-setada e editável</h3>
      <p class="fx-hint"><b>Tempo total previsto</b>, <b>META DISPONIBILIDADE</b> e <b>META PRODUTIVIDADE</b> são recalculados automaticamente (previsto − mobilização − desmobilização − deslocamento − intervalo; produtividade = disponibilidade ÷ produção).</p>
      <div style="overflow:auto"><table class="fx-tab" id="horTab"></table></div>
      <div class="fx-acoes">
        <button id="horAdd" class="g">+ Turno</button>
        <button id="horSalvar">Salvar e recalcular</button>
        <button id="horPadrao" class="g">Restaurar padrão (T1/T2/T3)</button>
        <button id="horXlsx" class="g">Baixar HORÁRIOS.xlsx</button>
      </div>
      <div class="fx-st" id="horStatus">—</div>
    </div>`;
  }

  function desenharTabelaHorarios() {
    const t = $$("horTab"); if (!t) return;
    const cols = ["Ano", "Mês", "Turno", "Início", "Fim", "Mobil.", "Desmob.", "Desloc.", "Interv.",
      "Previsto", "Meta disponib.", "Meta produção", "Meta produtiv.", ""];
    let html = "<thead><tr>" + cols.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
    HOR.forEach((h, i) => {
      const c = calcTurno(h);
      html += `<tr>
        <td><input data-i="${i}" data-k="ano" type="number" value="${escH(h.ano)}"></td>
        <td><select data-i="${i}" data-k="mes">${MESES_LISTA.map(m => `<option ${m === h.mes ? "selected" : ""}>${m}</option>`).join("")}</select></td>
        <td><input data-i="${i}" data-k="turno" value="${escH(h.turno)}"></td>
        <td><input data-i="${i}" data-k="ini" type="time" value="${escH(h.ini)}"></td>
        <td><input data-i="${i}" data-k="fim" type="time" value="${escH(h.fim)}"></td>
        <td><input data-i="${i}" data-k="mob" type="time" value="${escH(h.mob)}"></td>
        <td><input data-i="${i}" data-k="desmob" type="time" value="${escH(h.desmob)}"></td>
        <td><input data-i="${i}" data-k="desloc" type="time" value="${escH(h.desloc)}"></td>
        <td><input data-i="${i}" data-k="interv" type="time" value="${escH(h.interv)}"></td>
        <td class="calc">${min2hhmm(c.previsto)}</td>
        <td class="calc">${min2hhmm(c.metaDisp)}</td>
        <td><input data-i="${i}" data-k="metaProd" type="number" min="1" value="${escH(h.metaProd)}"></td>
        <td class="calc">${seg2hms(c.produtSeg)}</td>
        <td><button data-del="${i}" style="border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer">×</button></td>
      </tr>`;
    });
    t.innerHTML = html + "</tbody>";
    t.querySelectorAll("input[data-k],select[data-k]").forEach(el => {
      el.onchange = () => {
        const i = +el.dataset.i, k = el.dataset.k;
        HOR[i][k] = (k === "ano" || k === "metaProd") ? Number(el.value) : el.value;
        desenharTabelaHorarios();
        estado("horStatus", "Alterações pendentes — clique em <b>Salvar e recalcular</b>.", "");
      };
    });
    t.querySelectorAll("button[data-del]").forEach(b => { b.onclick = () => { HOR.splice(+b.dataset.del, 1); desenharTabelaHorarios(); }; });
  }

  const estado = (id, msg, cls) => { const e = $$(id); if (e) { e.className = "fx-st " + (cls || ""); e.innerHTML = msg; } };
  function mostrarResposta(txt) {
    const a = $$("apAmostra"); if (!a) return;
    a.style.display = "block";
    a.textContent = String(txt ?? "").slice(0, 4000) || "(resposta vazia)";
  }
  function dicaErro(msg) {
    if (/failed to fetch|networkerror|load failed/i.test(msg))
      return " — o navegador bloqueou por <b>CORS</b>. O Power BI não passa por essa restrição; no painel é preciso um <b>Proxy CORS</b> ou a liberação do domínio pela Exati.";
    return "";
  }

  function lerForm() {
    const v = id => ($$(id) ? $$(id).value.trim() : "");
    const c = id => !!($$(id) && $$(id).checked);
    Object.assign(API, {
      host: v("apHost"), contexto: v("apCtx"), usuario: v("apUser"), senha: v("apPass"),
      rotaLoginBase: v("apLoginBase"), rotaRelatorio: v("apRel"), campoToken: v("apCampoToken"),
      opcao: v("apOpcao"), pageSize: Number(v("apPageSize")) || 0, caminhoLista: v("apLista"),
      proxy: v("apProxy"), extras: v("apExtras"),
      codificarCred: c("apCred"), enviarDataFim: c("apDataFim"), filtrarLocal: c("apLocal"),
      gerarPlanejamento: c("apPlan"), ativo: c("apAtivo"), salvarSegredo: c("apSegredo")
    });
    TODAS.forEach((col, i) => { MAP[col] = v("map" + i); });
  }
  function salvar() {
    lerForm();
    const copia = Object.assign({}, API);
    if (!API.salvarSegredo) copia.senha = "";
    lsSet(LS_API, copia); lsSet(LS_MAP, MAP);
  }
  const preencherMapUI = () => TODAS.forEach((c, i) => { const e = $$("map" + i); if (e) e.value = MAP[c] || ""; });

  /* ============================ EVENTOS ============================ */
  function ligarEventos() {
    $$("apSalvar").onclick = () => { salvar(); estado("apStatus", "Configuração salva neste navegador.", "ok"); };

    $$("apUrl").onclick = () => {
      lerForm();
      const box = $$("apUrlBox"); box.style.display = "block";
      const mask = urlLogin().replace(encodeURIComponent(API.senha) || API.senha, "••••••");
      box.innerHTML = `<b>Login:</b> ${escH(mask)}<br><br><b>Relatório:</b> ${escH(
        `${montaURL(API.rotaRelatorio)}?CMD_SCRIPT_PARAMETERS=${JSON.stringify(parametrosScript($$("apDe").value, $$("apAte").value, 0))}&auth_token=…`)}`;
    };

    $$("apLogar").onclick = async () => {
      lerForm();
      if (!API.senha) return estado("apStatus", "Informe a senha do usuário de consulta.", "err");
      estado("apStatus", "Autenticando…", "");
      try {
        const t = await autenticar();
        estado("apStatus", `Login OK — token recebido (${String(t).slice(0, 8)}…). Agora clique em <b>Testar relatório</b>.`, "ok");
        mostrarResposta(ULTIMA_RESP);
      } catch (e) {
        estado("apStatus", "Falha no login: " + escH(e.message) + dicaErro(e.message), "err");
        mostrarResposta(ULTIMA_RESP);
      }
    };

    $$("apTestar").onclick = async () => {
      lerForm();
      if (!API.senha) return estado("apStatus", "Informe a senha do usuário de consulta.", "err");
      estado("apStatus", "Consultando o relatório…", "");
      try {
        const { lista } = await buscarPagina($$("apDe").value, $$("apAte").value, Number(API.paginaInicial) || 0);
        AMOSTRA = lista[0] || null;
        estado("apStatus", `Relatório OK — ${lista.length} ponto(s) atendido(s) na resposta.`, "ok");
        mostrarResposta(AMOSTRA ? JSON.stringify(AMOSTRA, null, 2) : "A API respondeu, mas sem registros no período informado.");
      } catch (e) {
        estado("apStatus", "Falha: " + escH(e.message) + dicaErro(e.message), "err");
        mostrarResposta(ULTIMA_RESP);
      }
    };

    $$("apAuto").onclick = () => {
      if (!AMOSTRA) return estado("apStatus", "Rode <b>Testar relatório</b> primeiro para eu ler o formato do JSON.", "err");
      const n = mapearAuto(); preencherMapUI();
      estado("apStatus", `${n} de ${TODAS.length} coluna(s) mapeada(s) automaticamente.`, "ok");
    };

    $$("apBuscar").onclick = async () => {
      lerForm(); salvar();
      if (!API.senha) return estado("apStatus", "Informe a senha do usuário de consulta.", "err");
      const btn = $$("apBuscar"); btn.disabled = true;
      estado("apStatus", "Autenticando…", "");
      try {
        const de = $$("apDe").value, ate = $$("apAte").value;
        let regs = await buscarTudo(de, ate, n => estado("apStatus", `Baixando… ${n} registro(s).`, ""));
        const bruto = regs.length;
        regs = filtrarPeriodo(regs, de, ate);
        if (!regs.length) { estado("apStatus", `A API devolveu ${bruto} registro(s), nenhum dentro do período selecionado.`, "err"); btn.disabled = false; return; }
        const plan = API.gerarPlanejamento ? wbPlanejamento(regs) : null;
        CACHE = { nome: `API Exati · ${brDia(de)} a ${brDia(ate)}`, wb: wbAtendimentos(regs), wbPlan: plan ? plan.wb : null, qtd: regs.length, bruto, quando: new Date() };
        API.ativo = true; if ($$("apAtivo")) $$("apAtivo").checked = true;
        estado("apStatus", `${regs.length} atendimento(s) prontos (de ${bruto} recebidos). Recalculando o painel…`, "");
        if (typeof window.carregar === "function") await window.carregar();
        estado("apStatus", `${regs.length} atendimento(s) da API aplicados ao painel${plan ? ` · ${plan.linhas} equipe-dia com regional/veículo` : ""}.`, "ok");
      } catch (e) {
        estado("apStatus", "Falha: " + escH(e.message) + dicaErro(e.message), "err");
        mostrarResposta(ULTIMA_RESP);
      }
      btn.disabled = false;
    };

    $$("apXlsx").onclick = () => {
      if (!CACHE) return estado("apStatus", "Nada em cache — busque os atendimentos primeiro.", "err");
      XLSX.writeFile(CACHE.wb, "ExportacaoConsulta_API.xlsx");
    };
    $$("apLimpar").onclick = () => {
      CACHE = null; AMOSTRA = null; TOKEN = ""; ULTIMA_RESP = null;
      estado("apStatus", "Cache e token limpos.", "");
    };

    $$("horAdd").onclick = () => {
      HOR.push({ ano: new Date().getFullYear(), mes: MESES_LISTA[new Date().getMonth()], turno: "T" + (HOR.length + 1),
        ini: "07:30", fim: "16:30", mob: "00:20", desmob: "00:20", desloc: "01:00", interv: "01:30", metaProd: 15 });
      desenharTabelaHorarios();
    };
    $$("horPadrao").onclick = () => {
      HOR = HORARIOS_PADRAO.map(h => Object.assign({}, h)); lsSet(LS_HOR, HOR);
      desenharTabelaHorarios(); estado("horStatus", "Valores padrão restaurados.", "ok");
    };
    $$("horSalvar").onclick = async () => {
      lsSet(LS_HOR, HOR);
      estado("horStatus", "Horários salvos. Recalculando…", "");
      if (typeof window.carregar === "function") await window.carregar();
      estado("horStatus", `Aplicado — ${HOR.map(h => `${h.turno} ${h.ini}→${h.fim} · turno real ${min2hhmm(calcTurno(h).metaDisp)}`).join(" · ")}.`, "ok");
    };
    $$("horXlsx").onclick = () => { const f = wbHorarios(); if (f) XLSX.writeFile(f.wb, "HORARIOS_ajustado.xlsx"); };
  }

  function montar() {
    injetarCSS();
    const a = $$("boxApiExati"), h = $$("boxHorariosCfg");
    if (!a || !h) return;
    a.innerHTML = htmlAPI(); h.innerHTML = htmlHorarios();
    desenharTabelaHorarios(); ligarEventos();
    estado("horStatus", `Pré-setado com ${HOR.length} turno(s): ${HOR.map(t => t.turno).join(", ")}.`, "");
  }

  /* ===================== INTERFACE PARA O script.js ================= */
  window.BI_FONTES = {
    exportacao: () => (API.ativo && CACHE) ? { nome: CACHE.nome, wb: CACHE.wb, daPasta: false } : null,
    planejamento: () => (API.ativo && CACHE && CACHE.wbPlan) ? { nome: CACHE.nome + " · regional/veículo", wb: CACHE.wbPlan, daPasta: false } : null,
    horarios: () => wbHorarios(),
    apiAtiva: () => !!(API.ativo && CACHE),
    resumoApi: () => CACHE ? `${CACHE.nome} · ${CACHE.qtd} de ${CACHE.bruto} registro(s) · baixado ${CACHE.quando.toLocaleString("pt-BR")}` : null,
    horariosAtuais: () => HOR.map(h => Object.assign({}, h, calcTurno(h))),
    buscarTudo, wbAtendimentos, wbPlanejamento, filtrarPeriodo, dataTurno,
    autenticar, urlLogin, ultimaResposta: () => ULTIMA_RESP, config: API, mapa: MAP
  };

  document.addEventListener("DOMContentLoaded", montar);
})();
