/* =====================================================================
   BI OPE — CWB  ·  v2 (Performance por TEMPO — alinhada à FR-CWB-GL-0001)

   Fontes: Horários (metas) · Exportação Consulta (execução) · Paradas
           Planejamento (opcional) · FR-CWB-GL-0001 (opcional, parâmetros)

   DISPONIBILIDADE = (Tempo total do turno − Σ paradas) / Tempo total
     Tempo total = META DISPONIBILIDADE (turno bruto já sem mobilização,
     desmobilização, locomoção e intervalo).
     Cada parada é recortada à janela do turno.

   PERFORMANCE  = META DE TEMPO (0:23 por atendimento)
                  ÷ [ (Tempo total − Σ paradas) ÷ (produção − impossibilidades) ]
                = (0:23 × válidos) ÷ tempo disponível

   QUALIDADE    = (Realizados − impossibilidades) / Realizados
   OPE          = Disponibilidade × Performance × Qualidade

   A meta de produção por equipe/dia (12/15) permanece apenas como
   referência (coluna "Perf. qtd."), fora do OPE.
   Equipes CCO são excluídas de todos os cálculos.
   ===================================================================== */

   const EST = {
    turnosCfg:{}, turnosWin:[], atend:[], paradas:[], plan:[],
    grupos:[], orfas:[], diag:[], fontes:{}, statusVals:{},
    motivosImposs:new Set(), classificado:false, carregado:false
  };
  
  const CFG = {
    metodo:"meta",          // base do tempo disponível: meta | janela | exec
    fmt:"DD/MM",
    cap:false,              // limitar componentes a 100%
    statusImposs:false,
    criarOrfa:false,
    metaDia:true,           // rateio da meta de quantidade (referência)
    perfBase:"tempo",       // tempo | qtd
    metaTempoMin:23,        // META DE TEMPO por atendimento (0:23)
    metaTempoFonte:"fixa",  // fixa | planilha (META PRODUTIVIDADE)
    recortarParadas:true
  };
  
  /* Padrões alinhados à FR-CWB-GL-0001 (previsto − 0:30 saída − 0:30 retorno − 1:30 descanso) */
  const DEF_TURNOS = {
    M1:{turno:"M1",ini:360, fim:900, cruza:false,previsto:540,metaDisp:390,metaProd:12,metaProdut:23,
        mob:30,desmob:30,desloc:0,interv:90,fonte:"padrão"},
    T1:{turno:"T1",ini:720, fim:1260,cruza:false,previsto:540,metaDisp:390,metaProd:12,metaProdut:23,
        mob:30,desmob:30,desloc:0,interv:90,fonte:"padrão"},
    T2:{turno:"T2",ini:900, fim:1380,cruza:false,previsto:480,metaDisp:330,metaProd:12,metaProdut:23,
        mob:30,desmob:30,desloc:0,interv:90,fonte:"padrão"},
    N1:{turno:"N1",ini:1260,fim:360, cruza:true, previsto:540,metaDisp:390,metaProd:12,metaProdut:23,
        mob:30,desmob:30,desloc:0,interv:90,fonte:"padrão"},
    A: {turno:"A", ini:480, fim:1080,cruza:false,previsto:600,metaDisp:450,metaProd:12,metaProdut:23,
        mob:30,desmob:30,desloc:0,interv:90,fonte:"padrão"},
    /* legado */
    T3:{turno:"T3",ini:1320,fim:360, cruza:true, previsto:480,metaDisp:290,metaProd:15,metaProdut:23,
        mob:20,desmob:20,desloc:60,interv:90,fonte:"padrão"}
  };
  const MESES = {JANEIRO:1,FEVEREIRO:2,MARCO:3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,
                 AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12};
  
  /* ============================ HELPERS ============================ */
  const $ = id => document.getElementById(id);
  const setT   = (id,v)=>{ const e=$(id); if(e) e.textContent=v; };
  const setH   = (id,v)=>{ const e=$(id); if(e) e.innerHTML=v; };
  const setBar = (id,v)=>{ const e=$(id); if(e) e.style.width=(v==null||isNaN(v)?0:Math.min(v*100,100))+"%"; };
  const setC   = (id,c)=>{ const e=$(id); if(e) e.style.color=c; };
  
  const norm = s => String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
  const uniq = a => [...new Set(a)].sort();
  const iso = d => d&&!isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : null;
  const brDate = s => s ? s.split("-").reverse().join("/") : "n/d";
  const brDT = d => d&&!isNaN(d) ? `${brDate(iso(d))} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` : "n/d";
  const hhmm = m => { if(m==null||isNaN(m)) return "—"; const s=m<0?"-":""; m=Math.abs(Math.round(m));
                      return `${s}${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`; };
  const pct = v => v==null||isNaN(v) ? "n/d" : (v*100).toFixed(1)+"%";
  const cor = v => v==null ? "var(--gray)" : v>=.85 ? "var(--ok)" : v>=.7 ? "var(--warn)" : "var(--bad)";
  const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const minDia = d => d.getHours()*60+d.getMinutes();
  const soma = (a,f) => a.reduce((s,x)=>s+(f(x)||0),0);
  const semSufixo = e => String(e??"").replace(" | ENGIE","");
  
  /* equipes ignoradas (CCO = centro de controle, não é equipe de campo) */
  const EQ_IGNORAR = /(^|[^A-Z0-9])CCO([^A-Z0-9]|$)/;
  const ehIgnorada = e => EQ_IGNORAR.test(norm(e));
  
  function textoMetodo(){
    const el=$("cfgMetodo");
    if(el && el.selectedOptions && el.selectedOptions[0]) return el.selectedOptions[0].text;
    return CFG.metodo==="meta" ? "META DISPONIBILIDADE (turno real)"
         : CFG.metodo==="janela" ? "janela de atendimentos" : "tempo de execução apontado";
  }
  
  function serialToDate(n){
    if(typeof n!=="number"||!isFinite(n)) return null;
    const dias=Math.floor(n), frac=n-dias;
    const base=new Date(Date.UTC(1899,11,30));
    base.setUTCDate(base.getUTCDate()+dias);
    const seg=Math.round(frac*86400);
    return new Date(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate(),
                    Math.floor(seg/3600),Math.floor(seg%3600/60),seg%60);
  }
  function parseDT(v){
    if(v==null||v==="") return null;
    if(v instanceof Date) return isNaN(v)?null:v;
    if(typeof v==="number") return v>1 ? serialToDate(v) : null;
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
    if(m) return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
    if(m){
      let a=+m[1],b=+m[2],y=+m[3],dd,mm;
      if(a>12){dd=a;mm=b;} else if(b>12){mm=a;dd=b;}
      else if(CFG.fmt==="DD/MM"){dd=a;mm=b;} else {mm=a;dd=b;}
      if(y<100) y+=2000;
      return new Date(y,mm-1,dd,+(m[4]||0),+(m[5]||0));
    }
    const d=new Date(s); return isNaN(d)?null:d;
  }
  function toMin(v){
    if(v==null||v==="") return null;
    if(typeof v==="number"){
      if(v>0&&v<1) return Math.round(v*1440);
      if(v>=1&&v<3) return Math.round(v*1440);
      return Math.round(v);
    }
    const s=String(v).trim();
    const m=s.match(/^(\d{1,4}):(\d{1,2})(?::(\d{1,2}))?$/);
    if(m) return (+m[1])*60+(+m[2])+Math.round((+m[3]||0)/60);
    const n=parseFloat(s.replace(",","."));
    if(isNaN(n)) return null;
    return n>0&&n<1 ? Math.round(n*1440) : Math.round(n);
  }
  function toHoraMin(v){ const m=toMin(v); return m==null?null:((m%1440)+1440)%1440; }
  const toNum = v => { if(v==null||v==="") return null;
    const n=parseFloat(String(v).replace(/\./g,"").replace(",",".")); return isNaN(n)?null:n; };
  
  /* ===================== LEITURA / FONTES ===================== */
  const PASTA_DADOS = "dados/";
  let MANIFEST = null;
  
  const FALLBACKS = {
    horarios:["Horarios.xlsx","Horários.xlsx","HORARIOS.xlsx","Horarios.xls","Horários.xls"],
    exportacao:["Exportacao Consulta.xlsx","Exportação Consulta.xlsx","ExpoConsulta.xlsx",
                "Exportacao_Consulta.xlsx","exportacao.xlsx"],
    paradas:["Paradas.xlsx","Relatorio de Paradas.xlsx","Relatório de Paradas.xlsx","paradas.xlsx"],
    planejamento:["Planejamento.xlsx","Planejamento e Execucao.xlsx","planejamento.xlsx"],
    diario:["FR-CWB-GL-0001-00 - Diario de Acompanhamento Opera.xlsx",
            "FR-CWB-GL-0001-00 - Diário de Acompanhamento Operacional - PPP Curitiba.xlsx",
            "FR-CWB-GL-0001.xlsx"]
  };
  
  async function lerManifest(){
    if(MANIFEST!==null) return MANIFEST;
    try{
      const r=await fetch(PASTA_DADOS+"manifest.json",{cache:"no-store"});
      MANIFEST = r.ok ? await r.json() : {};
    }catch{ MANIFEST={}; }
    return MANIFEST;
  }
  async function baixarDaPasta(chave){
    const mf=await lerManifest();
    const nomes=[];
    if(mf[chave]) nomes.push(...[].concat(mf[chave]));
    nomes.push(...(FALLBACKS[chave]||[]));
    for(const n of nomes){
      try{
        const r=await fetch(PASTA_DADOS+encodeURIComponent(n),{cache:"no-store"});
        if(!r.ok) continue;
        const buf=await r.arrayBuffer();
        const wb=XLSX.read(new Uint8Array(buf),{type:"array"});
        return {nome:`dados/${n}`, wb, daPasta:true};
      }catch{ /* segue */ }
    }
    return null;
  }
  function lerArquivo(inputId){
    return new Promise((res,rej)=>{
      const el=$(inputId);
      const f=el&&el.files?el.files[0]:null;
      if(!f) return res(null);
      const r=new FileReader();
      r.onload=e=>{ try{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        res({nome:f.name, wb, daPasta:false});
      }catch(err){ rej(err); } };
      r.onerror=rej; r.readAsArrayBuffer(f);
    });
  }
  /* Fontes automáticas (fontes.js): API Exati e HORÁRIOS pré-setado.
     Prioridade:
       exportacao → arquivo enviado > API Exati > pasta dados/
       horarios   → arquivo enviado > pasta dados/ > HORÁRIOS do painel
       demais     → arquivo enviado > pasta dados/                        */
  function fonteExtra(chave){
    const F = window.BI_FONTES;
    if(!F || typeof F[chave]!=="function") return null;
    try{ return F[chave](); }catch(e){ console.warn("Fonte automática falhou:",chave,e); return null; }
  }
  async function obterFonte(inputId, chave){
    const local = await lerArquivo(inputId);
    if(local) return local;
    if(chave==="exportacao"){
      const api = fonteExtra("exportacao");
      if(api) return api;
      return await baixarDaPasta(chave);
    }
    if(chave==="horarios"){
      const painel = fonteExtra("horarios");     /* metas editáveis no painel */
      if(painel) return painel;
      return await baixarDaPasta(chave);
    }
    const pasta = await baixarDaPasta(chave);
    if(pasta) return pasta;
    if(chave==="planejamento") return fonteExtra("planejamento");
    return null;
  }
  
  function paraObjetos(wb, esperados, abaPreferida){
    const abas = abaPreferida && wb.SheetNames.includes(abaPreferida)
      ? [abaPreferida, ...wb.SheetNames.filter(n=>n!==abaPreferida)] : wb.SheetNames;
    for(const nome of abas){
      const aoa=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,raw:true,blankrows:false,defval:null});
      let hi=-1,best=0;
      aoa.slice(0,40).forEach((row,i)=>{
        const cels=(row||[]).map(norm);
        const sc=esperados.reduce((s,e)=>s+(cels.some(c=>c&&c.includes(norm(e)))?1:0),0);
        if(sc>best){best=sc;hi=i;}
      });
      if(hi>=0 && best>=Math.max(2,Math.ceil(esperados.length*.4))){
        const head=aoa[hi].map(h=>h==null?"":String(h).trim());
        const rows=[];
        for(let i=hi+1;i<aoa.length;i++){
          const r=aoa[i]; if(!r||r.every(c=>c==null||c==="")) continue;
          const o={}; head.forEach((h,j)=>{ if(h) o[h]=r[j]; }); rows.push(o);
        }
        return {rows,head,aba:nome,linhaHeader:hi+1};
      }
    }
    return {rows:[],head:[],aba:null,linhaHeader:null};
  }
  function acessor(rows){
    const map={};
    rows.forEach(r=>Object.keys(r).forEach(k=>{ const n=norm(k); if(!(n in map)) map[n]=k; }));
    return (row,...nomes)=>{
      for(const n of nomes){ const k=map[norm(n)];
        if(k!==undefined && row[k]!==""&&row[k]!=null) return row[k]; }
      for(const n of nomes){ const alvo=norm(n);
        for(const nk in map){ if(nk.includes(alvo)){ const v=row[map[nk]];
          if(v!==""&&v!=null) return v; } } }
      return undefined;
    };
  }
  function ffill(rows, get, set){
    let ult=null;
    rows.forEach(r=>{ const v=get(r); if(v!=null&&v!=="") ult=v; else if(ult!=null) set(r,ult); });
  }
  function detectarColunaEquipe(rows){
    const alvo=/man[\s\-_]?ip|equipe|^eq[\s\-_]?\d/i;
    const score={};
    rows.slice(0,400).forEach(r=>Object.keys(r).forEach(k=>{
      const v=String(r[k]??"").trim();
      if(v && alvo.test(v)) score[k]=(score[k]||0)+1;
    }));
    const melhor=Object.entries(score).sort((a,b)=>b[1]-a[1])[0];
    return melhor&&melhor[1]>=Math.max(2,rows.length*.3) ? melhor[0] : null;
  }
  
  /* ---- parâmetros de turno a partir da FR-CWB-GL-0001 (aba Acompanhamento) ---- */
  function turnosDaFRCWB(wb){
    const {rows,aba,linhaHeader}=paraObjetos(wb,
      ["TURNO","HORARIO INICIO TURNO","HORARIO FIM TURNO","META DISPONIBILIDADE",
       "META PRODUCAO","META PRODUTIVIDADE"],"Acompanhamento");
    if(!rows.length) return {cfgs:[],aba,linhaHeader};
    const g=acessor(rows);
    const acc={};
    rows.forEach(r=>{
      const t=String(g(r,"TURNO")??"").trim().toUpperCase();
      if(!t) return;
      const ini=toHoraMin(g(r,"HORARIO INICIO TURNO","HORÁRIO INÍCIO TURNO"));
      const fim=toHoraMin(g(r,"HORARIO FIM TURNO","HORÁRIO FIM TURNO"));
      const prev=toMin(g(r,"TEMPO TOTAL PREVISTO"));
      const mDisp=toMin(g(r,"META DISPONIBILIDADE"));
      const mSaida=toMin(g(r,"META SAIDA DE BASE","META SAÍDA DE BASE"));
      const mRet=toMin(g(r,"META RETORNO BASE"));
      const mDesc=toMin(g(r,"META DESCANSO"));
      const mProd=toNum(g(r,"META PRODUCAO","META PRODUÇÃO"));
      const mProdut=toMin(g(r,"META PRODUTIVIDADE"));
      (acc[t] ||= {votos:{}});
      const voto=(campo,val)=>{ if(val==null||isNaN(val)) return;
        (acc[t].votos[campo] ||= {}); acc[t].votos[campo][val]=(acc[t].votos[campo][val]||0)+1; };
      voto("ini",ini); voto("fim",fim); voto("previsto",prev); voto("metaDisp",mDisp);
      voto("mob",mSaida); voto("desmob",mRet); voto("interv",mDesc);
      voto("metaProd",mProd); voto("metaProdut",mProdut);
    });
    const moda=o=>{ if(!o) return null;
      const e=Object.entries(o).filter(([k])=>k!=="0").sort((a,b)=>b[1]-a[1]);
      const alt=Object.entries(o).sort((a,b)=>b[1]-a[1]);
      return e.length?Number(e[0][0]):(alt.length?Number(alt[0][0]):null); };
    const cfgs=Object.entries(acc).map(([t,v])=>{
      const d=DEF_TURNOS[t]||DEF_TURNOS.M1;
      const ini=moda(v.votos.ini)??d.ini, fim=moda(v.votos.fim)??d.fim;
      const previsto=moda(v.votos.previsto)??d.previsto;
      const mob=moda(v.votos.mob)??d.mob, desmob=moda(v.votos.desmob)??d.desmob,
            interv=moda(v.votos.interv)??d.interv;
      let metaDisp=moda(v.votos.metaDisp);
      if(metaDisp==null||metaDisp<=0) metaDisp=Math.max(0,previsto-mob-desmob-interv);
      return {turno:t,ini,fim,cruza:fim<=ini,previsto,metaDisp,
              metaProd:moda(v.votos.metaProd)??d.metaProd,
              metaProdut:moda(v.votos.metaProdut)??d.metaProdut,
              mob,desmob,desloc:0,interv,ano:null,mes:null,fonte:"FR-CWB-GL-0001"};
    });
    return {cfgs,aba,linhaHeader};
  }
  
  /* ---- selos das fontes automáticas na área de importação ---- */
  function selo(id,txt,cls){ const e=$(id); if(!e) return; e.textContent=txt; e.className="auto "+(cls||""); }
  function atualizarSelos(){
    const F=window.BI_FONTES;
    const api=F&&F.resumoApi&&F.resumoApi();
    if(F&&F.apiAtiva&&F.apiAtiva()) selo("stFonteAtend",api,"ok");
    else if(EST.fontes.exportacao) selo("stFonteAtend",EST.fontes.exportacao.split(" · ").slice(0,2).join(" · "),"ok");
    else selo("stFonteAtend","aguardando busca na API — aba Fontes & Horários","warn");
    if(F&&F.horariosAtuais){
      const h=F.horariosAtuais();
      selo("stFonteHor",`${h.length} turno(s): `+h.map(x=>`${x.turno} ${x.ini}→${x.fim}`).join(" · "),"ok");
    }
  }

  /* ========================== CARGA ========================== */
  async function carregar(){
    const b=$("banner");
    if(b){ b.className="banner warn"; b.innerHTML=`<div class="ic">⌛</div><div>Lendo planilhas…</div>`; }
    EST.diag=[]; EST.fontes={}; EST.statusVals={};
    try{
      const [fh,fe,fp,fpl,fd]=await Promise.all([
        obterFonte("fileHorarios","horarios"),
        obterFonte("fileExportacao","exportacao"),
        obterFonte("fileParadas","paradas"),
        obterFonte("filePlan","planejamento"),
        obterFonte("fileDiario","diario")]);
  
      if(!fe) return erro("Sem dados de atendimento — selecione a planilha <b>Exportação Consulta</b>, use <b>Buscar atendimentos</b> na aba <b>Fontes &amp; Horários</b> (API Exati) ou publique o arquivo em <code>dados/</code>.");
  
      /* ---------- HORÁRIOS ---------- */
      EST.turnosCfg={}; EST.turnosWin=[];
      if(fh){
        const {rows,aba,linhaHeader}=paraObjetos(fh.wb,
          ["TURNO","HORA INICIO","HORA FIM","META DISPONIBILIDADE","META PRODUCAO"]);
        const g=acessor(rows);
        ffill(rows,r=>g(r,"ANO"),(r,v)=>r.ANO=v);
        ffill(rows,r=>g(r,"MES"),(r,v)=>r.MES=v);
        let n=0;
        rows.forEach(r=>{
          const t=String(g(r,"TURNO")??"").trim().toUpperCase();
          if(!t) return;
          const ini=toHoraMin(g(r,"HORA INICIO","HORARIO INICIO TURNO")),
                fim=toHoraMin(g(r,"HORA FIM","HORARIO FIM TURNO"));
          const cfg={
            turno:t,
            ini: ini??DEF_TURNOS[t]?.ini??0,
            fim: fim??DEF_TURNOS[t]?.fim??1439,
            cruza:(ini!=null&&fim!=null)?fim<=ini:(DEF_TURNOS[t]?.cruza??false),
            previsto: toMin(g(r,"TEMPO TOTAL PREVISTO")) ?? DEF_TURNOS[t]?.previsto ?? 540,
            metaDisp: toMin(g(r,"META DISPONIBILIDADE")),
            metaProd: toNum(g(r,"META PRODUCAO")) ?? DEF_TURNOS[t]?.metaProd ?? 12,
            metaProdut: toMin(g(r,"META PRODUTIVIDADE")) ?? null,
            mob: toMin(g(r,"TEMPO MOBILIZACAO","META SAIDA DE BASE")),
            desmob: toMin(g(r,"TEMPO DESMOBILIZACAO","META RETORNO BASE")),
            desloc: toMin(g(r,"TEMPO DESLOCAMENTO")),
            interv: toMin(g(r,"TEMPO INTERVALO","META DESCANSO")),
            ano: toNum(g(r,"ANO")), mes: MESES[norm(g(r,"MES"))] ?? null,
            fonte:"Horários"
          };
          if(cfg.metaDisp==null){
            const desc=(cfg.mob||0)+(cfg.desmob||0)+(cfg.desloc||0)+(cfg.interv||0);
            cfg.metaDisp = Math.max(0,(cfg.previsto||0)-desc) || DEF_TURNOS[t]?.metaDisp || 390;
            cfg.metaDispDerivada = true;
            EST.diag.push(`Horários · turno ${t}: META DISPONIBILIDADE ausente — derivada de TEMPO TOTAL PREVISTO (${hhmm(cfg.previsto)}) menos os descontos (${hhmm(desc)}) = ${hhmm(cfg.metaDisp)}.`);
          }
          if(cfg.mob==null&&cfg.desmob==null&&cfg.desloc==null&&cfg.interv==null){
            const dif=Math.max(0,(cfg.previsto||0)-cfg.metaDisp);
            const d0=DEF_TURNOS[t]||DEF_TURNOS.M1;
            const base=(d0.mob+d0.desmob+d0.desloc+d0.interv)||1;
            cfg.mob=Math.round(dif*d0.mob/base); cfg.desmob=Math.round(dif*d0.desmob/base);
            cfg.desloc=Math.round(dif*d0.desloc/base);
            cfg.interv=dif-cfg.mob-cfg.desmob-cfg.desloc;
            cfg.descEstimado=true;
            EST.diag.push(`Horários · turno ${t}: colunas de mobilização/retorno/deslocamento/intervalo não localizadas — composição estimada pela diferença (${hhmm(dif)}). O indicador usa a META DISPONIBILIDADE informada.`);
          } else {
            cfg.mob=cfg.mob??0; cfg.desmob=cfg.desmob??0; cfg.desloc=cfg.desloc??0; cfg.interv=cfg.interv??0;
            const dif=Math.abs((cfg.previsto-cfg.mob-cfg.desmob-cfg.desloc-cfg.interv)-cfg.metaDisp);
            if(dif>1) EST.diag.push(`Horários · turno ${t}: previsto menos descontos difere da META DISPONIBILIDADE em ${Math.round(dif)} min. O indicador usa o valor da coluna.`);
          }
          if(cfg.metaProdut&&cfg.metaProd){
            const esperado=cfg.metaDisp/cfg.metaProd;
            if(Math.abs(esperado-cfg.metaProdut)>1.5)
              EST.diag.push(`Horários · turno ${t}: META DISPONIBILIDADE ÷ META PRODUÇÃO = ${hhmm(esperado)}, mas META PRODUTIVIDADE informada é ${hhmm(cfg.metaProdut)}.`);
          }
          EST.turnosCfg[`${cfg.ano??"*"}|${cfg.mes??"*"}|${t}`]=cfg;
          EST.turnosCfg[`*|*|${t}`]=cfg;
          n++;
        });
        EST.turnosWin=uniq(Object.values(EST.turnosCfg).map(c=>c.turno))
          .map(t=>EST.turnosCfg[`*|*|${t}`]);
        EST.fontes.horarios=`${fh.nome} · aba "${aba}" · cabeçalho na linha ${linhaHeader} · ${n} turno(s)`;
      }
  
      /* ---------- FR-CWB-GL-0001 (parâmetros alternativos) ---------- */
      if(fd){
        const {cfgs,aba,linhaHeader}=turnosDaFRCWB(fd.wb);
        if(cfgs.length){
          if(!EST.turnosWin.length){
            cfgs.forEach(c=>EST.turnosCfg[`*|*|${c.turno}`]=c);
            EST.turnosWin=cfgs;
            EST.diag.push(`Parâmetros de turno obtidos da FR-CWB-GL-0001 (aba "${aba}"): ${cfgs.map(c=>`${c.turno} ${hhmm(c.ini)}→${hhmm(c.fim)} · turno real ${hhmm(c.metaDisp)}`).join(" · ")}.`);
          } else {
            cfgs.forEach(c=>{
              const at=EST.turnosCfg[`*|*|${c.turno}`];
              if(at && Math.abs((at.metaDisp||0)-(c.metaDisp||0))>1)
                EST.diag.push(`Conferência FR-CWB · turno ${c.turno}: META DISPONIBILIDADE ${hhmm(c.metaDisp)} na FR-CWB × ${hhmm(at.metaDisp)} na planilha Horários (o indicador usa Horários).`);
            });
          }
          EST.fontes.diario=`${fd.nome} · aba "${aba}" · cabeçalho na linha ${linhaHeader} · ${cfgs.length} turno(s) de referência`;
        }
      }
  
      if(!EST.turnosWin.length){
        EST.turnosWin=Object.values(DEF_TURNOS);
        Object.values(DEF_TURNOS).forEach(c=>EST.turnosCfg[`*|*|${c.turno}`]=c);
        EST.diag.push("Horários/FR-CWB não carregados — aplicados parâmetros padrão (M1/T1/N1 6:30, T2 5:30, A 7:30 de turno real).");
      }
  
      /* ---------- EXPORTAÇÃO CONSULTA ---------- */
      {
        const {rows,head,aba,linhaHeader}=paraObjetos(fe.wb,
          ["N ATENDIMENTO","PROTOCOLO","INICIO","CONCLUSAO","MOTIVO","EQUIPE"]);
        const g=acessor(rows);
  
        let colEq=null;
        const cand=["Desc. Equipe","Descricao Equipe","Desc Equipe","Equipe Executora",
                    "Equipe responsavel","Equipe","Turma","Time"];
        for(const c of cand){ const k=head.find(h=>norm(h)===norm(c)); if(k){ colEq=k; break; } }
        if(!colEq) colEq=head.find(h=>norm(h).includes("EQUIPE"))||null;
        if(!colEq){
          colEq=detectarColunaEquipe(rows);
          if(colEq) EST.diag.push(`Exportação: coluna de equipe identificada por conteúdo — "${colEq}". Confira se é a coluna correta.`);
        }
        if(!colEq) EST.diag.push(`Exportação: nenhuma coluna de equipe localizada. Cabeçalhos encontrados: ${head.filter(Boolean).join(" · ")}.`);
  
        /* META DE TEMPO por atendimento — se existir na Exportação, é lida */
        let metaTempoPlan=null;
        rows.slice(0,200).forEach(r=>{
          const v=toMin(g(r,"META DE TEMPO","META TEMPO","META PRODUTIVIDADE","TEMPO META"));
          if(v!=null && v>0 && metaTempoPlan==null) metaTempoPlan=v;
        });
        if(metaTempoPlan!=null){
          CFG.metaTempoMin=metaTempoPlan;
          EST.diag.push(`Exportação: META DE TEMPO por atendimento lida da planilha = ${hhmm(metaTempoPlan)}.`);
        } else {
          EST.diag.push(`META DE TEMPO por atendimento não encontrada nas planilhas — aplicado o parâmetro do contrato: ${hhmm(CFG.metaTempoMin)}.`);
        }
  
        let desc=0;
        EST.atend=rows.map((r,i)=>{
          const dtIni=parseDT(g(r,"Início","Inicio")), dtFim=parseDT(g(r,"Conclusão","Conclusao"));
          const eqRaw=colEq?String(r[colEq]??"").trim():"";
          const st=String(g(r,"Atendimento","Status") ?? "").trim();
          if(st) EST.statusVals[st]=(EST.statusVals[st]||0)+1;
          else   EST.statusVals["(vazio)"]=(EST.statusVals["(vazio)"]||0)+1;
          return {
            n: g(r,"Nº atendimento","N atendimento","Numero atendimento") ?? `L${i+2}`,
            prot: g(r,"Protocolo") ?? "",
            ident: g(r,"Número de identificação","Numero de identificacao") ?? "Desconhecido",
            end: g(r,"Endereço","Endereco") ?? "",
            tipo: g(r,"Tipo de ocorrência","Tipo de ocorrencia") ?? "",
            status: st,
            motivo: String(g(r,"Motivo") ?? "").trim() || "(sem motivo)",
            sol: String(g(r,"Solução","Solucao") ?? "").trim(),
            eq: eqRaw.replace(/\s+/g," ") || "(equipe não informada)",
            dtIni, dtFim
          };
        }).filter(a=>{ if(!a.dtIni){desc++;return false;} return true; });
  
        const ign=EST.atend.filter(a=>ehIgnorada(a.eq));
        if(ign.length){
          const listIgn=uniq(ign.map(a=>a.eq)).join(", ");
          EST.atend=EST.atend.filter(a=>!ehIgnorada(a.eq));
          EST.diag.push(`Exportação: ${ign.length} atendimento(s) da(s) equipe(s) ${esc(listIgn)} <b>excluído(s) de todos os cálculos</b> por regra (CCO).`);
        }
  
        if(desc) EST.diag.push(`Exportação: ${desc} linha(s) descartada(s) por não ter Início válido.`);
        const semFim=EST.atend.filter(a=>!a.dtFim||a.dtFim<a.dtIni).length;
        if(semFim) EST.diag.push(`Exportação: ${semFim} atendimento(s) sem Conclusão válida — contam na produção, mas não no tempo de execução.`);
        const semEq=EST.atend.filter(a=>a.eq==="(equipe não informada)").length;
        if(semEq) EST.diag.push(`Exportação: ${semEq} de ${EST.atend.length} atendimento(s) sem equipe preenchida.`);
        const stList=Object.entries(EST.statusVals).sort((a,b)=>b[1]-a[1])
          .map(([k,v])=>`${esc(k)} (${v})`).join(" · ");
        EST.diag.push(`Exportação · valores da coluna Atendimento: ${stList||"nenhum"}. Use isso para decidir sobre a opção "Status ≠ Atendido conta como impossibilidade".`);
        const nEq=uniq(EST.atend.map(a=>a.eq)).length;
        EST.fontes.exportacao=`${fe.nome} · aba "${aba}" · cabeçalho na linha ${linhaHeader} · ${EST.atend.length} atendimento(s) · ${nEq} equipe(s)${colEq?` · coluna de equipe: "${colEq}"`:" · SEM coluna de equipe"}${ign.length?` · ${ign.length} do CCO excluído(s)`:""}`;
      }
  
      /* ---------- PARADAS ---------- */
      EST.paradas=[];
      if(fp){
        const {rows,aba,linhaHeader}=paraObjetos(fp.wb,
          ["EQUIPE","INICIO DA PARADA","FIM DA PARADA","TIPO DA PARADA","MOTIVO"]);
        const g=acessor(rows);
        ffill(rows,r=>g(r,"Equipe"),(r,v)=>r.Equipe=v);
        let desc=0;
        EST.paradas=rows.map(r=>{
          const dtIni=parseDT(g(r,"Início da parada","Inicio da parada")),
                dtFim=parseDT(g(r,"Fim da parada"));
          return {
            eq:String(g(r,"Equipe")??"").trim()||"(equipe não informada)",
            dtIni,dtFim,
            min: (dtIni&&dtFim&&dtFim>dtIni)?(dtFim-dtIni)/60000:0,
            minEfet: 0,
            tipo:String(g(r,"Tipo da parada")??"").trim()||"—",
            motivo:String(g(r,"Motivo")??"").trim()||"(sem motivo)",
            obs:String(g(r,"Observação","Observacao")??"").trim()
          };
        }).filter(p=>{ if(!p.dtIni||!p.dtFim){desc++;return false;} return true; });
  
        const pIgn=EST.paradas.filter(p=>ehIgnorada(p.eq)).length;
        if(pIgn){
          EST.paradas=EST.paradas.filter(p=>!ehIgnorada(p.eq));
          EST.diag.push(`Paradas: ${pIgn} parada(s) de equipe CCO excluída(s) dos cálculos.`);
        }
        if(desc) EST.diag.push(`Paradas: ${desc} linha(s) descartada(s) por datas inválidas.`);
        EST.fontes.paradas=`${fp.nome} · aba "${aba}" · cabeçalho na linha ${linhaHeader} · ${EST.paradas.length} parada(s)${pIgn?` · ${pIgn} do CCO excluída(s)`:""}`;
      } else EST.diag.push("Relatório de paradas não carregado — sem paradas apontadas a Disponibilidade fica em 100%, pois o tempo total do turno é integral.");
  
      /* ---------- PLANEJAMENTO ---------- */
      EST.plan=[];
      if(fpl){
        const {rows,aba,linhaHeader}=paraObjetos(fpl.wb,
          ["EQUIPE","DATA DE ATUACAO","REGIONAL","VEICULO","TURNO"]);
        const g=acessor(rows);
        EST.plan=rows.map(r=>{
          const d=parseDT(g(r,"Data de atuação","Data de atuacao","Data"));
          let reg=String(g(r,"Regional","Região","Regiao")??"");
          try{ let x=JSON.parse(reg); if(typeof x==="string") x=JSON.parse(x);
               reg=Array.isArray(x)?x:[String(x)]; }
          catch{ reg=reg.replace(/[\[\]"\\]/g,"").split(",").map(s=>s.trim()).filter(Boolean); }
          return { eq:String(g(r,"Equipe")??"").trim(), data:iso(d),
                   turno:String(g(r,"Turno")??"").trim().toUpperCase(),
                   reg, veic:String(g(r,"Veículo","Veiculo")??"").trim(),
                   desp:toNum(g(r,"Protocolos despachados","Total")) };
        }).filter(p=>p.data&&p.eq&&!ehIgnorada(p.eq));
        EST.fontes.plan=`${fpl.nome} · aba "${aba}" · cabeçalho na linha ${linhaHeader} · ${EST.plan.length} linha(s) — referência apenas`;
      }
  
      EST.carregado=true;
      atualizarSelos();
      classificarMotivosPadrao();
      construir();
      inicializarFiltros();
      render();
    }catch(err){ console.error(err); erro("Falha ao ler as planilhas: "+esc(err.message)); }
  }
  function erro(msg){
    atualizarSelos();
    const b=$("banner"); if(!b) return alert(msg.replace(/<[^>]+>/g,""));
    b.className="banner bad";
    b.innerHTML=`<div class="ic">!</div><div>${msg}</div>`;
  }
  
  /* =============== TURNO / JANELAS =============== */
  function turnoDe(d){
    if(!d||isNaN(d)) return {turno:null,data:null,ambiguo:false};
    const m=minDia(d);
    const hits=EST.turnosWin.filter(w=> w.cruza ? (m>=w.ini||m<=w.fim) : (m>=w.ini&&m<=w.fim));
    if(!hits.length) return {turno:null,data:iso(d),ambiguo:false,fora:true};
    hits.sort((a,b)=>a.ini-b.ini);
    const w=hits[0];
    const data=(w.cruza&&m<=w.fim)?iso(addDays(d,-1)):iso(d);
    return {turno:w.turno,data,ambiguo:hits.length>1,alt:hits.map(h=>h.turno)};
  }
  function cfgTurno(t,dataISO){
    if(!dataISO) return EST.turnosCfg[`*|*|${t}`]||DEF_TURNOS[t];
    const [y,m]=dataISO.split("-").map(Number);
    return EST.turnosCfg[`${y}|${m}|${t}`]||EST.turnosCfg[`*|*|${t}`]||DEF_TURNOS[t];
  }
  /* janela real (datas) do turno, para recortar paradas */
  function janelaTurno(dataISO,cfg){
    if(!dataISO||!cfg) return null;
    const [y,m,d]=dataISO.split("-").map(Number);
    const ini=new Date(y,m-1,d,Math.floor(cfg.ini/60),cfg.ini%60);
    let fim=new Date(y,m-1,d,Math.floor(cfg.fim/60),cfg.fim%60);
    if(cfg.cruza||fim<=ini) fim=addDays(fim,1);
    return {ini,fim};
  }
  function minutosNaJanela(p,win){
    if(!win||!p.dtIni||!p.dtFim) return p.min;
    const a=Math.max(p.dtIni.getTime(),win.ini.getTime());
    const b=Math.min(p.dtFim.getTime(),win.fim.getTime());
    return Math.max(0,(b-a)/60000);
  }
  
  /* ===================== IMPOSSIBILIDADES ===================== */
  function classificarMotivosPadrao(){
    const salvo=localStorage.getItem("ope_motivos_imposs");
    if(salvo){ try{ EST.motivosImposs=new Set(JSON.parse(salvo)); EST.classificado=true; return; }catch{} }
    EST.motivosImposs=new Set(uniq(EST.atend.map(a=>a.motivo))
      .filter(m=>/impossib|nao localizad|não localizad|sem acesso|obstru|impedid|recusa|inacess|n executad|nao executad/i.test(m)));
    EST.classificado=true;
  }
  const ehImposs = a =>
    (CFG.statusImposs && a.status && norm(a.status)!=="ATENDIDO") ||
    EST.motivosImposs.has(a.motivo) ||
    /impossib/i.test(a.motivo+" "+a.sol);
  
  /* ===================== CONSTRUÇÃO DOS GRUPOS ===================== */
  function construir(){
    const g={}, key=(d,e,t)=>`${d}|${e}|${t}`;
    const novo=(d,e,t)=>({data:d,eq:e,turno:t,ats:[],paradas:[],paradaMin:0,paradaBruta:0,execMin:0,
                          primIni:null,ultFim:null,ambiguo:false,reg:[],veic:"",desp:null,recortes:0});
    EST.orfas=[];
    let fora=0;
  
    EST.atend.forEach(a=>{
      const t=turnoDe(a.dtIni);
      if(!t.turno){ fora++; return; }
      a.turno=t.turno; a.dataRef=t.data;
      const o=g[key(t.data,a.eq,t.turno)] ||= novo(t.data,a.eq,t.turno);
      o.ats.push(a); o.ambiguo=o.ambiguo||t.ambiguo;
      if(a.dtFim&&a.dtFim>=a.dtIni) o.execMin+=(a.dtFim-a.dtIni)/60000;
      if(!o.primIni||a.dtIni<o.primIni) o.primIni=a.dtIni;
      if(a.dtFim&&(!o.ultFim||a.dtFim>o.ultFim)) o.ultFim=a.dtFim;
    });
    if(fora) EST.diag.push(`${fora} atendimento(s) com horário fora de todas as janelas de turno configuradas.`);
  
    const vincular=(o,p)=>{
      const cfg=cfgTurno(o.turno,o.data);
      const win=CFG.recortarParadas?janelaTurno(o.data,cfg):null;
      p.minEfet=CFG.recortarParadas?minutosNaJanela(p,win):p.min;
      p.recortada=p.minEfet+0.5<p.min;
      if(p.recortada) o.recortes++;
      o.paradas.push(p); o.paradaMin+=p.minEfet; o.paradaBruta+=p.min; p.orfa=false;
    };
  
    EST.paradas.forEach(p=>{
      const t=turnoDe(p.dtIni);
      p.turno=t.turno; p.dataRef=t.data;
      const k=key(t.data,p.eq,t.turno);
      if(g[k]) vincular(g[k],p);
      else if(CFG.criarOrfa&&t.turno){
        const o=g[k]=novo(t.data,p.eq,t.turno);
        vincular(o,p); p.criou=true;
      } else { p.orfa=true; p.minEfet=p.min; EST.orfas.push(p); }
    });
  
    const recort=EST.paradas.filter(p=>p.recortada).length;
    if(recort) EST.diag.push(`${recort} parada(s) recortada(s) à janela do turno — só a fração dentro do turno é descontada da Disponibilidade.`);
  
    if(EST.plan.length){
      const idx={}; EST.plan.forEach(p=>{
        const k=key(p.data,p.eq,p.turno);
        (idx[k] ||= {reg:[],veic:"",desp:0});
        idx[k].reg=uniq(idx[k].reg.concat(p.reg)); idx[k].veic=p.veic||idx[k].veic;
        idx[k].desp+=p.desp||0;
      });
      Object.values(g).forEach(o=>{ const m=idx[key(o.data,o.eq,o.turno)];
        if(m){ o.reg=m.reg; o.veic=m.veic; o.desp=m.desp||null; } });
    }
  
    EST.grupos=Object.values(g).sort((a,b)=>
      a.data.localeCompare(b.data)||a.eq.localeCompare(b.eq)||a.turno.localeCompare(b.turno));
  }
  
  /* ===================== CÁLCULO DOS INDICADORES ===================== */
  function metaTempoDe(T){
    if(CFG.metaTempoFonte==="planilha" && T && T.metaProdut) return T.metaProdut;
    return CFG.metaTempoMin;
  }
  function calcular(){
    /* meta de quantidade por equipe/dia — apenas referência */
    const dia={};
    EST.grupos.forEach(o=>{
      const k=`${o.data}|${o.eq}`;
      const T=cfgTurno(o.turno,o.data)||DEF_TURNOS[o.turno];
      (dia[k] ||= {n:0,meta:0});
      dia[k].n++;
      dia[k].meta=Math.max(dia[k].meta, T?.metaProd ?? 12);
    });
  
    return EST.grupos.map(o=>{
      const T=cfgTurno(o.turno,o.data)||DEF_TURNOS[o.turno]||
              {metaDisp:390,metaProd:12,previsto:540,mob:30,desmob:30,desloc:0,interv:90,metaProdut:23};
      const r={...o};
  
      r.metaDisp=T.metaDisp; r.metaProdutPlan=T.metaProdut; r.previsto=T.previsto;
      r.mob=T.mob??0; r.desmob=T.desmob??0; r.desloc=T.desloc??0; r.interv=T.interv??0;
      r.descDetalhado=!T.descEstimado;
      r.metaTempo=metaTempoDe(T);
  
      const d=dia[`${o.data}|${o.eq}`];
      r.turnosNoDia=d.n; r.metaDiaEquipe=d.meta;
      r.metaProd = CFG.metaDia ? d.meta/d.n : (T.metaProd ?? 12);
      r.rateada  = CFG.metaDia && d.n>1;
  
      /* produção e impossibilidades */
      r.real=o.ats.length;
      r.imposs=0; r.motivos={}; r.motivosImposs={};
      o.ats.forEach(a=>{ r.motivos[a.motivo]=(r.motivos[a.motivo]||0)+1;
        if(ehImposs(a)){ r.imposs++; r.motivosImposs[a.motivo]=(r.motivosImposs[a.motivo]||0)+1; } });
      r.validos=Math.max(0,r.real-r.imposs);            /* produção do dia − impossibilidades */
  
      /* tempo disponível = tempo total − Σ paradas (cada parada recortada ao turno) */
      r.janelaMin=(o.primIni&&o.ultFim&&o.ultFim>o.primIni)?(o.ultFim-o.primIni)/60000:0;
      let base;
      if(CFG.metodo==="meta")        base=r.metaDisp;
      else if(CFG.metodo==="janela") base=r.janelaMin;
      else                           base=o.execMin+o.paradaMin;
      r.tempoTotal=Math.max(0,base||0);
      r.turnoRealMin=Math.max(0,Math.min(r.tempoTotal-o.paradaMin,(r.metaDisp||r.tempoTotal)*2));
  
      /* DISPONIBILIDADE = (tempo total − paradas) / tempo total */
      r.disp=r.tempoTotal?r.turnoRealMin/r.tempoTotal:null;
  
      /* PRODUTIVIDADE REAL e PERFORMANCE por tempo */
      r.produtReal=r.validos?r.turnoRealMin/r.validos:null;     /* min por atendimento válido */
      r.tempoNec=r.metaTempo*r.validos;                          /* tempo necessário na meta   */
      r.perfTempo=r.turnoRealMin>0?r.tempoNec/r.turnoRealMin:null;
      r.perfQtd=r.metaProd?r.real/r.metaProd:null;               /* referência (quantidade)    */
      r.perf=CFG.perfBase==="qtd"?r.perfQtd:r.perfTempo;
  
      /* QUALIDADE */
      r.qual=r.real?r.validos/r.real:null;
  
      const cap=v=>v==null?null:(CFG.cap?Math.min(v,1):v);
      r.dispC=cap(r.disp); r.perfC=cap(r.perf); r.qualC=cap(r.qual);
      r.ope=(r.dispC!=null&&r.perfC!=null)?r.dispC*r.perfC*(r.qualC??1):null;
  
      r.produt=r.real?r.turnoRealMin/r.real:null;                /* HH por atendimento bruto  */
      r.execOS=r.real?o.execMin/r.real:null;
      r.ocup=r.turnoRealMin?o.execMin/r.turnoRealMin:null;
      return r;
    });
  }
  function agregar(gs){
    const s={metaDisp:0,tempoTotal:0,turnoRealMin:0,paradaMin:0,paradaBruta:0,execMin:0,janelaMin:0,
             previsto:0,mob:0,desmob:0,desloc:0,interv:0,descDetalhado:true,
             real:0,imposs:0,validos:0,metaProd:0,tempoNec:0,motivos:{},motivosImposs:{}};
    gs.forEach(g=>{
      s.metaDisp+=g.metaDisp||0; s.tempoTotal+=g.tempoTotal||0;
      s.turnoRealMin+=g.turnoRealMin||0; s.paradaMin+=g.paradaMin||0; s.paradaBruta+=g.paradaBruta||0;
      s.execMin+=g.execMin||0; s.janelaMin+=g.janelaMin||0;
      s.previsto+=g.previsto||0; s.mob+=g.mob||0; s.desmob+=g.desmob||0;
      s.desloc+=g.desloc||0; s.interv+=g.interv||0;
      if(!g.descDetalhado) s.descDetalhado=false;
      s.real+=g.real||0; s.imposs+=g.imposs||0; s.validos+=g.validos||0;
      s.metaProd+=g.metaProd||0; s.tempoNec+=g.tempoNec||0;
      for(const k in g.motivos) s.motivos[k]=(s.motivos[k]||0)+g.motivos[k];
      for(const k in g.motivosImposs) s.motivosImposs[k]=(s.motivosImposs[k]||0)+g.motivosImposs[k];
    });
    const cap=v=>v==null?null:(CFG.cap?Math.min(v,1):v);
    s.disp=s.tempoTotal?s.turnoRealMin/s.tempoTotal:null;
    s.produtReal=s.validos?s.turnoRealMin/s.validos:null;
    s.metaTempo=s.validos?s.tempoNec/s.validos:CFG.metaTempoMin;
    s.perfTempo=s.turnoRealMin>0?s.tempoNec/s.turnoRealMin:null;
    s.perfQtd=s.metaProd?s.real/s.metaProd:null;
    s.perf=CFG.perfBase==="qtd"?s.perfQtd:s.perfTempo;
    s.qual=s.real?s.validos/s.real:null;
    s.dispC=cap(s.disp); s.perfC=cap(s.perf); s.qualC=cap(s.qual);
    s.ope=(s.dispC!=null&&s.perfC!=null)?s.dispC*s.perfC*(s.qualC??1):null;
    s.produt=s.real?s.turnoRealMin/s.real:null;
    s.execOS=s.real?s.execMin/s.real:null;
    s.ocup=s.turnoRealMin?s.execMin/s.turnoRealMin:null;
    s.n=gs.length;
    s.equipeDias=new Set(gs.map(g=>`${g.data}|${g.eq}`)).size;
    s.mediaEqDia=s.equipeDias?s.real/s.equipeDias:null;
    s.metaEqDia=s.equipeDias?s.metaProd/s.equipeDias:null;
    s.rateados=gs.filter(g=>g.rateada).length;
    return s;
  }
  /* agrega no nível equipe/dia */
  function porEquipeDia(gs){
    const m={};
    gs.forEach(g=>{ const k=`${g.data}|${g.eq}`;
      (m[k] ||= {data:g.data,eq:g.eq,turnos:[],real:0,validos:0,meta:0,imposs:0,
                 execMin:0,turnoRealMin:0,tempoTotal:0,tempoNec:0,paradaMin:0});
      m[k].turnos.push(g.turno); m[k].real+=g.real; m[k].validos+=g.validos;
      m[k].meta+=g.metaProd; m[k].imposs+=g.imposs; m[k].execMin+=g.execMin;
      m[k].turnoRealMin+=g.turnoRealMin; m[k].tempoTotal+=g.tempoTotal;
      m[k].tempoNec+=g.tempoNec; m[k].paradaMin+=g.paradaMin; });
    return Object.values(m).map(x=>{
      x.produtReal=x.validos?x.turnoRealMin/x.validos:null;
      x.perfTempo=x.turnoRealMin>0?x.tempoNec/x.turnoRealMin:null;
      x.perfQtd=x.meta?x.real/x.meta:null;
      x.perf=CFG.perfBase==="qtd"?x.perfQtd:x.perfTempo;
      x.disp=x.tempoTotal?x.turnoRealMin/x.tempoTotal:null;
      x.qual=x.real?x.validos/x.real:null;
      x.gap=x.real-x.meta;
      x.execOS=x.real?x.execMin/x.real:null;
      return x; })
      .sort((a,b)=>a.data.localeCompare(b.data)||a.eq.localeCompare(b.eq));
  }
  
  /* ========================= FILTROS ========================= */
  let GRUPOS=[], ULTIMO=[];
  function preencher(id,vals,label){
    const s=$(id); if(!s) return;
    const atual=s.value;
    s.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option>${esc(v)}</option>`).join("");
    if(vals.includes(atual)) s.value=atual;
    s.onchange=render;
  }
  function inicializarFiltros(){
    const datas=uniq([...EST.grupos.map(g=>g.data),
                      ...EST.orfas.map(p=>p.dataRef).filter(Boolean)]);
    preencher("fEquipe",uniq([...EST.grupos.map(g=>g.eq),...EST.orfas.map(p=>p.eq)]),"Todas");
    preencher("fTurno",uniq([...EST.grupos.map(g=>g.turno),
                             ...EST.orfas.map(p=>p.turno).filter(Boolean)]),"Todos");
    const regs=uniq(EST.grupos.flatMap(g=>g.reg));
    preencher("fRegional",regs,"Todas"); if($("fRegional")) $("fRegional").disabled=!regs.length;
    if(datas.length){
      ["fDe","fAte"].forEach((id,i)=>{ const el=$(id); if(!el) return;
        el.min=datas[0]; el.max=datas.at(-1); el.value=i?datas.at(-1):datas[0]; el.onchange=render; });
    }
  }
  const val = id => { const e=$(id); return e?e.value:""; };
  const dentro=(d,de,ate)=>(!de||d>=de)&&(!ate||d<=ate);
  function filtrar(){
    const de=val("fDe"),ate=val("fAte"),e=val("fEquipe"),t=val("fTurno"),r=val("fRegional");
    return GRUPOS.filter(g=>dentro(g.data,de,ate)&&(!e||g.eq===e)&&(!t||g.turno===t)&&(!r||g.reg.includes(r)));
  }
  function filtrarOrfas(){
    const de=val("fDe"),ate=val("fAte"),e=val("fEquipe"),t=val("fTurno"),r=val("fRegional");
    if(r) return [];
    return EST.orfas.filter(p=>dentro(p.dataRef,de,ate)&&(!e||p.eq===e)&&(!t||p.turno===t));
  }
  
  /* ========================= GRÁFICOS ========================= */
  function chartBarras(el,cats,series,opt={}){
    if(!el) return;
    const W=opt.W||760,H=opt.H||262,pl=opt.pl||48,pr=10,pt=12,pb=opt.pb||42;
    el.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const iw=W-pl-pr, ih=H-pt-pb, ep=!!opt.pct;
    let max=opt.max||0;
    if(!opt.max){
      cats.forEach((c,i)=>{ if(opt.stack) max=Math.max(max,soma(series,s=>s.vals[i]));
        else series.forEach(s=>max=Math.max(max,s.vals[i]||0)); });
      if(ep) max=Math.max(max,1);
      if(!max) max=1;
    }
    const y=v=>pt+ih-ih*(v/max);
    let s="";
    [0,.25,.5,.75,1].forEach(f=>{ const v=f*max;
      s+=`<line x1="${pl}" y1="${y(v)}" x2="${W-pr}" y2="${y(v)}" stroke="#eef1f8"/>
          <text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#8a91a4">${ep?(v*100).toFixed(0)+"%":Math.round(v)}</text>`; });
    if(ep&&max>1) s+=`<line x1="${pl}" y1="${y(1)}" x2="${W-pr}" y2="${y(1)}" stroke="#b9c1d4" stroke-dasharray="4 3"/>
                      <text x="${W-pr}" y="${y(1)-4}" text-anchor="end" font-size="9" fill="#8a91a4">meta 100%</text>`;
    s+=`<line x1="${pl}" y1="${pt+ih}" x2="${W-pr}" y2="${pt+ih}" stroke="#dfe4f0"/>`;
    if(!cats.length) s+=`<text x="${pl+iw/2}" y="${pt+ih/2}" text-anchor="middle" font-size="12" fill="#8a91a4">Sem dados no filtro</text>`;
    const bw=iw/Math.max(cats.length,1);
    cats.forEach((c,i)=>{
      const x0=pl+i*bw;
      if(opt.stack){
        let acc=0;
        series.forEach(se=>{ const v=se.vals[i]||0; if(v<=0) return;
          const h=ih*(v/max);
          s+=`<rect x="${x0+bw*.22}" y="${y(acc+v)}" width="${bw*.56}" height="${h}" fill="${se.color}"
               ><title>${esc(opt.catLabel?opt.catLabel(c):c)} · ${esc(se.k)}: ${opt.fmt?opt.fmt(v):v}</title></rect>`;
          acc+=v; });
      } else {
        const bar=(bw*.74)/series.length;
        series.forEach((se,j)=>{
          const v=se.vals[i];
          if(v==null){ s+=`<text x="${x0+bw*.13+j*bar+bar/2}" y="${pt+ih-4}" text-anchor="middle" font-size="8" fill="#8a91a4">n/d</text>`; return; }
          const h=Math.max(0,ih*(Math.min(v,max)/max));
          s+=`<rect x="${x0+bw*.13+j*bar}" y="${pt+ih-h}" width="${Math.max(bar-2,1)}" height="${h}" fill="${se.color}" rx="2"
               ><title>${esc(opt.catLabel?opt.catLabel(c):c)} · ${esc(se.k)}: ${opt.fmt?opt.fmt(v):v}</title></rect>`; });
      }
      s+=`<text x="${x0+bw/2}" y="${pt+ih+15}" text-anchor="middle" font-size="10" fill="#4a5168">${esc(opt.catLabel?opt.catLabel(c):c)}</text>`;
      if(opt.sub) s+=`<text x="${x0+bw/2}" y="${pt+ih+27}" text-anchor="middle" font-size="9" fill="#8a91a4">${esc(opt.sub(i))}</text>`;
    });
    el.innerHTML=s;
  }
  function legenda(el,series){
    if(!el) return;
    el.innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.k)}</span>`).join("");
  }
  function gauge(el,v,rot){
    if(!el) return;
    el.setAttribute("viewBox","0 0 200 118");
    const r=78,cx=100,cy=100;
    const arc=(a1,a2,col)=>{ const p=a=>[cx+r*Math.cos(Math.PI*(1-a)),cy-r*Math.sin(Math.PI*(1-a))];
      const [x1,y1]=p(a1),[x2,y2]=p(a2);
      return `<path d="M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round"/>`; };
    const f=v==null?0:Math.max(0,Math.min(1,v));
    el.innerHTML=arc(.001,1,"#eceff7")+(f>0?arc(.001,Math.max(f,.004),cor(v)):"")+
      `<text x="100" y="92" text-anchor="middle" font-size="31" font-weight="700" fill="${cor(v)}">${pct(v)}</text>
       <text x="100" y="110" text-anchor="middle" font-size="10.5" fill="#6b7385">${esc(rot||"")}${v>1?" · acima da meta":""}</text>`;
  }
  function hbars(el,itens,fmt,opt={}){
    if(!el) return;
    if(!itens.length){ el.innerHTML='<div class="sub">Sem dados no filtro.</div>'; return; }
    const max=opt.max||Math.max(...itens.map(i=>Math.abs(i.v)||0),1e-9);
    el.innerHTML=itens.map(i=>`
      <div class="hbar"><div class="lb" title="${esc(i.k)}">${esc(i.k)}</div>
        <div class="track"><i style="width:${Math.min(100,Math.abs(i.v||0)/max*100).toFixed(1)}%;background:${i.c||cor(i.v)}"></i></div>
        <div class="v">${fmt(i.v,i)}</div></div>`).join("");
  }
  function donut(el,leg,itens){
    if(!el) return;
    const cols=["#00AAFF","#009B8D","#7B52AB","#1b2f7a","#e8a11c","#d9453d","#4a5168","#12683a"];
    const tot=soma(itens,i=>i.v);
    let ang=-Math.PI/2,s="";
    itens.forEach((i,k)=>{
      const a=tot?i.v/tot*2*Math.PI:0,e=ang+a,R=90,r=54,c=100;
      const P=(rad,an)=>[c+rad*Math.cos(an),c+rad*Math.sin(an)];
      const [x1,y1]=P(R,ang),[x2,y2]=P(R,e),[x3,y3]=P(r,e),[x4,y4]=P(r,ang);
      s+=`<path d="M${x1} ${y1} A${R} ${R} 0 ${a>Math.PI?1:0} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${a>Math.PI?1:0} 0 ${x4} ${y4} Z"
           fill="${cols[k%cols.length]}"><title>${esc(i.k)}: ${i.v}</title></path>`;
      ang=e; });
    s+=`<text x="100" y="96" text-anchor="middle" font-size="24" font-weight="700" fill="#1d2333">${tot}</text>
        <text x="100" y="114" text-anchor="middle" font-size="10" fill="#6b7385">atendimentos</text>`;
    el.innerHTML=s;
    if(leg) leg.innerHTML=itens.map((i,k)=>`<div style="margin-bottom:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cols[k%cols.length]};margin-right:6px"></span>${esc(i.k)} — <b>${i.v}</b> (${tot?(i.v/tot*100).toFixed(1):0}%)</div>`).join("")||"—";
  }
  function tabela(el,cols,rows,cls){
    if(!el) return;
    el.innerHTML=`<thead><tr>${cols.map(c=>`<th class="${c.num?"num":""}">${c.t}</th>`).join("")}</tr></thead>
      <tbody>${rows.length?rows.map(r=>`<tr class="${cls?cls(r):""}">${cols.map(c=>`<td class="${c.num?"num":""}">${c.f(r)}</td>`).join("")}</tr>`).join("")
      :`<tr><td colspan="${cols.length}" style="color:#6b7385">Sem registros para o filtro.</td></tr>`}</tbody>`;
  }
  const badge=v=>`<span class="tag" style="background:${cor(v)}">${pct(v)}</span>`;
  const porChave=(obj,c)=>Object.entries(obj).map(([k,v])=>({k,v,c})).sort((a,b)=>b.v-a.v);
  
  /* ============ COMPOSIÇÃO DO TURNO (aba Disponibilidade) ============ */
  function renderComposicao(a){
    if(!$("tComposicao")) return;
    const rows=[
      {it:"Tempo total previsto do turno",        v:a.previsto,      t:"base"},
      {it:"− Saída de base / mobilização",        v:-a.mob,          t:"desc"},
      {it:"− Retorno à base / desmobilização",    v:-a.desmob,       t:"desc"},
      {it:"− Deslocamento / locomoção",           v:-a.desloc,       t:"desc"},
      {it:"− Descanso / intervalo",               v:-a.interv,       t:"desc"},
      {it:"= Tempo total do turno (META DISP.)",  v:a.metaDisp,      t:"sub"},
      {it:"− Paradas (recortadas ao turno)",      v:-a.paradaMin,    t:"desc"},
      {it:"= Tempo disponível efetivo",           v:a.turnoRealMin,  t:"tot"},
      {it:"Tempo necessário na meta (0:23 × válidos)", v:a.tempoNec, t:"sub"}
    ];
    tabela($("tComposicao"),[
      {t:"Item",f:r=>r.it},
      {t:"Minutos",num:1,f:r=>Math.round(r.v||0)},
      {t:"H:MM",num:1,f:r=>hhmm(r.v)},
      {t:"% do tempo total",num:1,f:r=>a.tempoTotal?pct(Math.abs(r.v||0)/a.tempoTotal):"—"}
    ],rows,r=>r.t==="tot"?"ok":(r.t==="sub"?"amb":""));
  
    const dif=Math.abs((a.previsto-a.mob-a.desmob-a.desloc-a.interv)-a.metaDisp);
    setH("dCompNota", !a.descDetalhado
      ? "Colunas de saída de base, retorno, deslocamento e descanso não localizadas — composição estimada pela diferença entre o previsto e a META DISPONIBILIDADE. O indicador usa sempre o valor da coluna."
      : (dif<=1 ? "Composição confere com a META DISPONIBILIDADE (mesma lógica da FR-CWB-GL-0001: previsto − 0:30 saída − 0:30 retorno − 1:30 descanso)."
                : `Divergência de ${Math.round(dif)} min entre os descontos e a META DISPONIBILIDADE — o indicador usa o valor da coluna.`));
  }
  
  /* ====== POR QUE NÃO 100%? — decomposição do tempo disponível ======
     Identidade exata (não altera nenhum cálculo do OPE):
       Disponível D = Tempo necessário na meta
                    + Excesso de execução nos válidos
                    + Execução gasta em impossibilidades
                    + Tempo sem OS apontada
       Performance = Nec ÷ D  →  cada parcela acima é a perda em pp.   */
  function decomporPerf(x){
    const D = x.turnoRealMin||0, E = x.execMin||0;
    const R = x.real||0, I = x.imposs||0, V = x.validos||0;
    const Nec = x.tempoNec||0;
    const Eimp = R ? E*I/R : 0;          /* execução proporcional às impossibilidades */
    const Eval = E - Eimp;               /* execução nos atendimentos válidos          */
    const excesso = Eval - Nec;          /* válidos que passaram da meta de tempo      */
    const fora = D - E;                  /* tempo disponível sem OS apontada           */
    const sh = v => D ? v/D : null;
    return {D,E,Nec,Eimp,Eval,excesso,fora,V,I,R,
            pNec:sh(Nec), pExc:sh(excesso), pImp:sh(Eimp), pFora:sh(fora),
            perf: D ? Nec/D : null};
  }
  const pp = v => v==null||isNaN(v) ? "—" : (v>=0?"−":"+")+(Math.abs(v)*100).toFixed(1)+" pp";

  function renderPorque(a, gs, eqs, porEq, eqDia, metaT){
    if(!$("tPerfPorque")) return;
    const c = decomporPerf(a);
    const rows = [
      {it:"Tempo disponível efetivo (base do indicador)", v:c.D,       t:"base", imp:null},
      {it:`Tempo produtivo na meta — ${c.V} válidos × ${hhmm(metaT)}`, v:c.Nec, t:"prod", imp:c.pNec},
      {it:"Excesso de execução nos válidos (negativo = ritmo melhor que a meta)", v:c.excesso, t:"perda", imp:c.pExc},
      {it:`Execução gasta em impossibilidades (${c.I} OS)`, v:c.Eimp,  t:"perda", imp:c.pImp},
      {it:"Tempo sem OS apontada (deslocamento, espera, apontamento faltante)", v:c.fora, t:"perda", imp:c.pFora}
    ];
    tabela($("tPerfPorque"),[
      {t:"Componente",f:r=>r.it},
      {t:"Minutos",num:1,f:r=>Math.round(r.v||0)},
      {t:"H:MM",num:1,f:r=>hhmm(r.v)},
      {t:"% do disponível",num:1,f:r=>c.D?pct(Math.abs(r.v||0)/c.D):"—"},
      {t:"Efeito na performance",num:1,f:r=>r.t==="base"?"—":(r.t==="prod"?"+"+(r.imp*100).toFixed(1)+" pp":pp(r.imp))}
    ],rows,r=>r.t==="prod"?"prod":(r.t==="perda"?"perda":""));

    /* ranking das causas */
    const causas=[
      {k:"Excesso de tempo por atendimento", v:Math.max(0,c.pExc||0)},
      {k:"Impossibilidades consumindo tempo", v:Math.max(0,c.pImp||0)},
      {k:"Tempo sem OS apontada",            v:Math.max(0,c.pFora||0)}
    ].sort((x,y)=>y.v-x.v);
    hbars($("chPerfPerda"),causas.map(x=>({k:x.k,v:x.v,c:"var(--bad)"})),v=>pp(v));

    /* pior causa por equipe */
    const perdaEq = eqs.map((e,i)=>{
      const d=decomporPerf(porEq[i]);
      const cand=[["excesso de tempo",d.pExc],["impossibilidades",d.pImp],["tempo sem OS",d.pFora]]
                  .filter(x=>x[1]!=null).sort((x,y)=>y[1]-x[1])[0]||["—",0];
      return {k:`${semSufixo(e)} — ${cand[0]}`, v:Math.max(0,cand[1]||0)};
    }).sort((x,y)=>y.v-x.v);
    hbars($("chPerfPerdaEq"),perdaEq.map(x=>({...x,c:"var(--warn)"})),v=>pp(v));

    /* nota automática */
    const maior=causas[0];
    const txt=[];
    if(a.perf!=null && a.perf>=1){
      txt.push(`Performance de <b>${pct(a.perfC)}</b>: o tempo necessário na meta já supera o tempo disponível — a equipe entregou mais do que o ritmo contratual exige.`);
    } else {
      txt.push(`Performance de <b>${pct(a.perfC)}</b> — faltam <b>${pp(1-(a.perf??0)).replace("−","")}</b> para 100%. Maior causa: <b>${maior.k.toLowerCase()}</b> (${pp(maior.v)}).`);
    }
    if(c.fora<0) txt.push("Atenção: a soma das OS excede o tempo disponível — há sobreposição de atendimentos ou apontamento fora da janela do turno.");
    txt.push(`Produtividade real de <b>${hhmm(a.produtReal)}</b> por atendimento válido contra a meta de <b>${hhmm(metaT)}</b>.`);
    txt.push(`Base do tempo disponível: ${textoMetodo()} — ${hhmm(a.tempoTotal)} de tempo total menos ${hhmm(a.paradaMin)} de parada.`);
    if(CFG.metodo==="meta") txt.push("Como a base é a META DISPONIBILIDADE, o tempo sem OS apontada reúne deslocamento entre pontos, espera e qualquer período não registrado na Exportação.");
    setH("pPorqueNota", txt.join(" "));

    /* detalhe por equipe/dia */
    const det = eqDia.map(x=>({...x, d:decomporPerf(x)}))
                     .sort((x,y)=>(x.d.perf??9)-(y.d.perf??9));
    tabela($("tPorqueEqDia"),[
      {t:"Data",f:r=>brDate(r.data)},{t:"Equipe",f:r=>esc(semSufixo(r.eq))},
      {t:"Turnos",f:r=>r.turnos.join(", ")},
      {t:"Disponível",num:1,f:r=>hhmm(r.d.D)},
      {t:"Necessário na meta",num:1,f:r=>hhmm(r.d.Nec)},
      {t:"Excesso execução",num:1,f:r=>hhmm(r.d.excesso)},
      {t:"Impossibilidades",num:1,f:r=>hhmm(r.d.Eimp)},
      {t:"Sem OS apontada",num:1,f:r=>hhmm(r.d.fora)},
      {t:"Perda excesso",num:1,f:r=>pp(r.d.pExc)},
      {t:"Perda imposs.",num:1,f:r=>pp(r.d.pImp)},
      {t:"Perda sem OS",num:1,f:r=>pp(r.d.pFora)},
      {t:"Performance",num:1,f:r=>badge(CFG.cap?Math.min(r.d.perf??0,1):r.d.perf)},
      {t:"Causa principal",f:r=>{
         const cand=[["Excesso de tempo",r.d.pExc],["Impossibilidades",r.d.pImp],["Tempo sem OS",r.d.pFora]]
                     .filter(x=>x[1]!=null).sort((x,y)=>y[1]-x[1])[0];
         return cand&&cand[1]>0?esc(cand[0]):"—"; }}
    ],det,r=>(r.d.perf!=null&&r.d.perf>=1)?"ok":"");
  }

  /* ========================= RENDER ========================= */
  function render(){
    if(!EST.carregado) return;
    GRUPOS=calcular();
    const gs=filtrar(); ULTIMO=gs;
    const orfas=filtrarOrfas();
    const a=agregar(gs);
    const datas=uniq(gs.map(g=>g.data));
    const eqs=uniq(gs.map(g=>g.eq));
    const porData=datas.map(d=>agregar(gs.filter(g=>g.data===d)));
    const porEq=eqs.map(e=>agregar(gs.filter(g=>g.eq===e)));
    const ats=gs.flatMap(g=>g.ats);
    const impos=ats.filter(ehImposs);
    const paradas=gs.flatMap(g=>g.paradas);
    const parTodas=[...paradas.map(x=>({...x,orfa:false})),...orfas];
    const lblData=d=>brDate(d).slice(0,5);
    const eqDia=porEquipeDia(gs);
    const metaT=CFG.metaTempoMin;
  
    /* banner */
    const b=$("banner"); const amb=gs.filter(g=>g.ambiguo).length;
    const av=[]; if(!EST.paradas.length) av.push("sem relatório de paradas");
    if(orfas.length) av.push(`${orfas.length} parada(s) órfã(s)`);
    if(amb) av.push(`${amb} turno(s) em faixa de sobreposição`);
    if(eqs.includes("(equipe não informada)")) av.push("há atendimentos sem equipe");
    if(b){
      b.className=av.length?"banner warn":"banner ok";
      b.innerHTML=`<div class="ic">${av.length?"!":"✓"}</div><div><b>Base processada.</b>
        ${gs.length} turno(s) · ${a.equipeDias} equipe-dia · ${eqs.length} equipe(s) · ${a.real} atendimento(s) (${a.validos} válidos).
        ${av.length?"Atenção: "+av.join(" · ")+".":""}
        <div class="chips"><span class="chip">Tempo total: ${textoMetodo()}</span>
        <span class="chip">Performance por ${CFG.perfBase==="qtd"?"quantidade (referência)":"tempo · meta "+hhmm(metaT)+"/atendimento"}</span>
        <span class="chip">${CFG.recortarParadas?"Paradas recortadas ao turno":"Paradas integrais"}</span>
        <span class="chip">${CFG.cap?"Componentes limitados a 100%":"Superação da meta permitida"}</span>
        <span class="chip">Equipes CCO ignoradas</span>
        <span class="chip">${EST.motivosImposs.size} motivo(s) como impossibilidade</span></div></div>`;
    }
  
    /* ---------- GERAL ---------- */
    gauge($("gOpe"),a.ope,"OPE do filtro");
    const p=$("gOpePill");
    if(p){ p.textContent=a.ope==null?"n/d":a.ope>=.85?"Bom":a.ope>=.7?"Atenção":"Crítico";
           p.style.background=cor(a.ope); }
    setH("gOpeSub",`${pct(a.dispC)} × ${pct(a.perfC)} × ${pct(a.qualC)}`);
    const kpi=(id,v,sub,bar)=>{ setT(id,pct(v)); setT(id+"Sub",sub); setBar(bar,v); };
    kpi("gDisp",a.dispC,`${hhmm(a.turnoRealMin)} disponíveis de ${hhmm(a.tempoTotal)} de tempo total`,"gDispBar");
    kpi("gPerf",a.perfC,`Meta ${hhmm(metaT)}/atend. ÷ produtividade real ${hhmm(a.produtReal)}`,"gPerfBar");
    kpi("gQual",a.qualC,a.real?`${a.imposs} impossibilidade(s) em ${a.real}`:"Sem atendimentos","gQualBar");
  
    setT("kTurnoReal",hhmm(a.turnoRealMin));
    setT("kTurnoRealSub",`Tempo total ${hhmm(a.tempoTotal)} − ${hhmm(a.paradaMin)} de parada`);
    setT("kExec",hhmm(a.execMin));
    setT("kExecSub",`Soma de (Conclusão − Início) de ${a.real} OS · exclui deslocamento e mobilização`);
    setT("kOcup",pct(a.ocup));
    setT("kOcupSub","Execução ÷ tempo disponível — baixa ocupação indica tempo não apontado, não ociosidade");
    setBar("kOcupBar",a.ocup);
    setT("kParada",hhmm(a.paradaMin));
    setT("kParadaSub",`${paradas.length} evento(s) vinculado(s)`+
      (a.paradaBruta>a.paradaMin+0.5?` · ${hhmm(a.paradaBruta-a.paradaMin)} fora da janela do turno`:"")+
      (orfas.length?` · ${orfas.length} órfã(s), ${hhmm(soma(orfas,x=>x.min))} fora do cálculo`:""));
    setT("kReal",a.real);
    setT("kRealSub",`${a.validos} válidos · ${eqs.length} equipe(s) · ${datas.length} data(s)`);
    setT("kProdut",hhmm(a.produtReal));
    setT("kProdutSub",`Produtividade real por atendimento válido · meta ${hhmm(metaT)}`);
    setT("kExecOS",hhmm(a.execOS));
    setT("kExecOSSub","Duração média no ponto de serviço");
    setT("kGrupos",gs.length);
    setT("kGruposSub",`${a.equipeDias} equipe-dia · ${amb} em sobreposição de turno`);
  
    const serGeral=[{k:"OPE",color:"#1b2f7a",vals:porData.map(x=>x.ope)},
                    {k:"Disponibilidade",color:"#00AAFF",vals:porData.map(x=>x.dispC)},
                    {k:"Performance",color:"#009B8D",vals:porData.map(x=>x.perfC)},
                    {k:"Qualidade",color:"#7B52AB",vals:porData.map(x=>x.qualC)}];
    chartBarras($("chGeralData"),datas,serGeral,{pct:true,catLabel:lblData,fmt:pct,
      sub:i=>porData[i].ope==null?"n/d":(porData[i].ope*100).toFixed(0)+"%"});
    legenda($("legGeralData"),serGeral);
    hbars($("chGeralEquipe"),eqs.map((e,i)=>({k:semSufixo(e),v:porEq[i].ope})).sort((x,y)=>(y.v??-1)-(x.v??-1)),pct);
  
    tabela($("tOPE"),[
      {t:"Data",f:r=>brDate(r.data)},{t:"Equipe",f:r=>esc(semSufixo(r.eq))},
      {t:"Turno",f:r=>r.turno+(r.ambiguo?' <span class="tag" style="background:var(--warn)">amb.</span>':"")},
      {t:"Regional",f:r=>esc(r.reg.join(", ")||"—")},
      {t:"Tempo total (min)",num:1,f:r=>Math.round(r.tempoTotal)},
      {t:"Paradas (min)",num:1,f:r=>r.paradaMin.toFixed(0)},
      {t:"Disponível (min)",num:1,f:r=>r.turnoRealMin.toFixed(0)},
      {t:"Execução (min)",num:1,f:r=>r.execMin.toFixed(0)},
      {t:"Ocup.",num:1,f:r=>pct(r.ocup)},{t:"Disp.",num:1,f:r=>badge(r.dispC)},
      {t:"Realiz.",num:1,f:r=>r.real},{t:"Imposs.",num:1,f:r=>r.imposs},
      {t:"Válidos",num:1,f:r=>r.validos},
      {t:"Produt. real",num:1,f:r=>hhmm(r.produtReal)},
      {t:"Meta tempo",num:1,f:r=>hhmm(r.metaTempo)},
      {t:"Perf.",num:1,f:r=>badge(r.perfC)},
      {t:"Perf. qtd. (ref.)",num:1,f:r=>pct(r.perfQtd)},
      {t:"Qual.",num:1,f:r=>badge(r.qualC)},
      {t:"OPE",num:1,f:r=>badge(r.ope)}
    ],gs,r=>r.ambiguo?"amb":"ok");
  
    /* ---------- DISPONIBILIDADE ---------- */
    kpi("dKpi",a.dispC,`${hhmm(a.turnoRealMin)} de ${hhmm(a.tempoTotal)} · perda de ${hhmm(a.tempoTotal-a.turnoRealMin)}`,"dKpiBar");
    setT("dProg",hhmm(a.tempoTotal));
    setT("dProgSub",`${gs.length} turno(s) · bruto ${hhmm(a.previsto)} − ${hhmm(a.mob+a.desmob+a.desloc+a.interv)} de saída de base, retorno e descanso`);
    setT("dReal",hhmm(a.turnoRealMin));
    setT("dRealSub",`Tempo total − ${hhmm(a.paradaMin)} de parada · base: ${textoMetodo()}`);
    setT("dParada",hhmm(a.paradaMin));
    setT("dParadaSub",a.tempoTotal?`${pct(a.paradaMin/a.tempoTotal)} do tempo total · ${paradas.length} evento(s) vinculado(s)`:"—");
    renderComposicao(a);
  
    const serDisp=[{k:"Tempo disponível efetivo",color:"#00AAFF",vals:porData.map(x=>x.turnoRealMin)},
                   {k:"Paradas",color:"#d9453d",vals:porData.map(x=>x.paradaMin)},
                   {k:"Tempo necessário na meta",color:"#009B8D",vals:porData.map(x=>x.tempoNec)}];
    chartBarras($("chDispData"),datas,serDisp,{catLabel:lblData,fmt:v=>hhmm(v),
      sub:i=>porData[i].disp==null?"":(porData[i].disp*100).toFixed(0)+"%"});
    legenda($("legDispData"),serDisp);
    hbars($("chDispEquipe"),eqs.map((e,i)=>({k:semSufixo(e),v:porEq[i].dispC})).sort((x,y)=>(y.v??-1)-(x.v??-1)),pct);
  
    const sufixo=x=>x.orfa?" (órfã)":"";
    const pMot={}; parTodas.forEach(x=>{const k=x.motivo+sufixo(x);pMot[k]=(pMot[k]||0)+(x.orfa?x.min:x.minEfet);});
    hbars($("chDispMotivo"),Object.entries(pMot).map(([k,v])=>({k,v,
      c:k.includes("(órfã)")?"var(--gray)":"var(--bad)"})).sort((x,y)=>y.v-x.v),v=>v.toFixed(0)+" min");
    const pEq={}; parTodas.forEach(x=>{const k=semSufixo(x.eq)+sufixo(x);pEq[k]=(pEq[k]||0)+(x.orfa?x.min:x.minEfet);});
    hbars($("chDispParadaEq"),Object.entries(pEq).map(([k,v])=>({k,v,
      c:k.includes("(órfã)")?"var(--gray)":"var(--bad)"})).sort((x,y)=>y.v-x.v),v=>v.toFixed(0)+" min");
    setH("dNota", !parTodas.length
      ? "Nenhuma parada no período filtrado. Se o relatório de paradas foi carregado, verifique se as datas coincidem com as dos atendimentos."
      : (orfas.length
          ? `${paradas.length} parada(s) vinculada(s), ${hhmm(a.paradaMin)} efetivos dentro do turno — descontados do tempo total. <b>${orfas.length} órfã(s)</b>, ${hhmm(soma(orfas,x=>x.min))}, em cinza e <b>fora do cálculo</b>: não há turno com execução na mesma data/equipe/turno.`
          : "Todas as paradas do filtro estão vinculadas a um turno com execução; cada uma é recortada à janela do turno."));
  
    tabela($("tParadas"),[
      {t:"Equipe",f:r=>esc(semSufixo(r.eq))},{t:"Início",f:r=>brDT(r.dtIni)},
      {t:"Fim",f:r=>brDT(r.dtFim)},
      {t:"Duração (min)",num:1,f:r=>r.min.toFixed(0)},
      {t:"No turno (min)",num:1,f:r=>(r.orfa?r.min:r.minEfet).toFixed(0)+(r.recortada?" *":"")},
      {t:"Tipo",f:r=>esc(r.tipo)},{t:"Motivo",f:r=>esc(r.motivo)},
      {t:"Turno atribuído",f:r=>`${r.turno||"—"} de ${brDate(r.dataRef)}`},
      {t:"Vínculo",f:r=>r.orfa?`<span class="tag" style="background:var(--bad)">Órfã</span>`
                              :`<span class="tag" style="background:var(--ok)">Vinculada</span>`},
      {t:"Observação",f:r=>esc(r.obs||"—")}
    ],parTodas.slice().sort((x,y)=>x.dtIni-y.dtIni),r=>r.orfa?"orfa":"");
  
    /* ---------- PERFORMANCE (por tempo) ---------- */
    kpi("pKpi",a.perfC,`Meta ${hhmm(metaT)} ÷ produtividade real ${hhmm(a.produtReal)} · ${a.validos} válidos em ${hhmm(a.turnoRealMin)}`,"pKpiBar");
    setT("pReal",a.real);
    setT("pRealSub",`${a.validos} válidos (produção − impossibilidades) · ${eqs.length} equipe(s) × ${datas.length} data(s)`);
    setT("pMeta",hhmm(a.tempoNec));
    setT("pMetaSub",`Tempo necessário na meta: ${a.validos} válidos × ${hhmm(metaT)}`);
    const gapT=(a.metaTempo??metaT)-(a.produtReal??0);
    setT("pGap",(a.produtReal==null?"—":(gapT>=0?"+":"−")+hhmm(Math.abs(gapT))));
    setC("pGap",gapT>=0?"var(--ok)":"var(--bad)");
    setT("pGapSub",gapT>=0?"Produtividade melhor que a meta de tempo":"Tempo por atendimento acima da meta");
  
    /* equipes necessárias × disponíveis — agora por tempo */
    const dias=datas.map(d=>{
      const sub=gs.filter(g=>g.data===d);
      const agr=agregar(sub);
      const capTurno=uniq(sub.map(g=>g.metaDisp)).reduce((s,x)=>s+x,0)/Math.max(uniq(sub.map(g=>g.metaDisp)).length,1)||390;
      return {d, real:agr.real, validos:agr.validos, tempoNec:agr.tempoNec,
              disp:new Set(sub.map(g=>g.eq)).size,
              nec:Math.ceil(agr.tempoNec/Math.max(capTurno,1))};
    });
    const mNec=dias.length?soma(dias,x=>x.nec)/dias.length:null;
    const mDisp=dias.length?soma(dias,x=>x.disp)/dias.length:null;
    setT("pEqNec",mNec==null?"—":mNec.toFixed(1));
    setT("pEqNecSub",dias.length
      ? `Média por dia · ${hhmm(a.tempoNec)} de trabalho na meta ÷ turno real · pico de ${Math.max(...dias.map(x=>x.nec))}`
      : "Sem dados no filtro");
    setT("pEqDisp",mDisp==null?"—":mDisp.toFixed(1));
    setT("pEqDispSub",dias.length
      ? `Média por dia · ${eqs.length} equipe(s) distinta(s) com produção apontada`
      : "Sem dados no filtro");
    setT("pExecOS",hhmm(a.execOS));
    setT("pExecOSSub",a.real?`${hhmm(a.execMin)} em ${a.real} OS · meta de tempo ${hhmm(metaT)}`:"Sem atendimentos no filtro");
    const saldo=(mDisp??0)-(mNec??0);
    setT("pCap",(saldo>0?"+":"")+saldo.toFixed(1));
    setC("pCap",saldo>=0?"var(--ok)":"var(--bad)");
    setT("pCapSub",dias.length
      ? (saldo>=0?`Folga média de ${saldo.toFixed(1)} equipe/dia frente à carga na meta de tempo`
                :`Déficit médio de ${Math.abs(saldo).toFixed(1)} equipe/dia frente à carga na meta de tempo`)
      : "Sem dados no filtro");
  
    setT("pMedia",a.produtReal==null?"—":hhmm(a.produtReal));
    setC("pMedia",(a.produtReal??1e9)<=metaT?"var(--ok)":"var(--bad)");
    setT("pMediaSub",`Produtividade real por atendimento válido · meta ${hhmm(metaT)}`);
    setT("pEqDia",a.equipeDias);
    setT("pEqDiaSub",`${eqs.length} equipe(s) × ${datas.length} data(s) com produção`);
    const naMeta=eqDia.filter(x=>x.produtReal!=null&&x.produtReal<=metaT).length;
    setT("pNaMeta",`${naMeta}/${eqDia.length}`);
    setT("pNaMetaSub",eqDia.length?`${pct(naMeta/eqDia.length)} dos equipe-dia dentro da meta de ${hhmm(metaT)}`:"—");
    if(eqDia.length){
      const comp=eqDia.filter(x=>x.produtReal!=null).sort((x,y)=>x.produtReal-y.produtReal);
      if(comp.length){
        const mx=comp[0], mn=comp.at(-1);
        setT("pExtremos",`${hhmm(mx.produtReal)} / ${hhmm(mn.produtReal)}`);
        setT("pExtremosSub",`melhor ${semSufixo(mx.eq)} em ${brDate(mx.data)} · pior ${semSufixo(mn.eq)} em ${brDate(mn.data)}`);
      }
    } else { setT("pExtremos","—"); setT("pExtremosSub","Sem dados no filtro"); }
  
    const serPerf=[{k:"Tempo necessário (meta)",color:"#009B8D",vals:porData.map(x=>x.tempoNec)},
                   {k:"Tempo disponível",color:"#c9cfdd",vals:porData.map(x=>x.turnoRealMin)}];
    chartBarras($("chPerfData"),datas,serPerf,{catLabel:lblData,fmt:v=>hhmm(v),
      sub:i=>porData[i].perf==null?"":(porData[i].perf*100).toFixed(0)+"%"});
    legenda($("legPerfData"),serPerf);
  
    const serEq=[{k:"Necessárias (carga na meta)",color:"#e8a11c",vals:dias.map(x=>x.nec)},
                 {k:"Disponíveis",color:"#009B8D",vals:dias.map(x=>x.disp)}];
    chartBarras($("chPerfEq"),datas,serEq,{catLabel:lblData,
      sub:i=>`${dias[i].disp-dias[i].nec>0?"+":""}${dias[i].disp-dias[i].nec}`});
    legenda($("legPerfEq"),serEq);
  
    hbars($("chPerfEquipe"),eqs.map((e,i)=>({k:semSufixo(e),v:porEq[i].perfC}))
      .sort((x,y)=>(y.v??-1)-(x.v??-1)),v=>pct(v));
    hbars($("chPerfEqDia"),eqDia.filter(x=>x.produtReal!=null).map(x=>({
        k:`${brDate(x.data).slice(0,5)} · ${semSufixo(x.eq)}`,
        v:x.produtReal, c:x.produtReal<=metaT?"var(--ok)":(x.produtReal<=metaT*1.3?"var(--warn)":"var(--bad)")
      })).sort((x,y)=>x.v-y.v),
      (v)=>`${hhmm(v)} / ${hhmm(metaT)}`);
    hbars($("chPerfQtdEq"),eqs.map((e,i)=>({k:semSufixo(e),v:porEq[i].validos,c:"var(--teal)"}))
      .sort((x,y)=>y.v-x.v),v=>v);
    donut($("chPerfMotivo"),$("legPerfMotivo"),porChave(a.motivos));
    renderPorque(a,gs,eqs,porEq,eqDia,metaT);
  
    tabela($("tPerf"),[
      {t:"Data",f:r=>brDate(r.data)},{t:"Equipe",f:r=>esc(semSufixo(r.eq))},
      {t:"Turno",f:r=>r.turno},
      {t:"Tempo total",num:1,f:r=>hhmm(r.tempoTotal)},
      {t:"Paradas",num:1,f:r=>hhmm(r.paradaMin)},
      {t:"Disponível",num:1,f:r=>hhmm(r.turnoRealMin)},
      {t:"Realizados",num:1,f:r=>r.real},
      {t:"Imposs.",num:1,f:r=>r.imposs},
      {t:"Válidos",num:1,f:r=>r.validos},
      {t:"Produt. real",num:1,f:r=>hhmm(r.produtReal)},
      {t:"Meta tempo",num:1,f:r=>hhmm(r.metaTempo)},
      {t:"Tempo necessário",num:1,f:r=>hhmm(r.tempoNec)},
      {t:"Performance",num:1,f:r=>badge(r.perfC)},
      {t:"Perf. qtd. (ref.)",num:1,f:r=>pct(r.perfQtd)},
      {t:"Meta qtd.",num:1,f:r=>r.metaProd.toFixed(r.rateada?1:0)+(r.rateada?" *":"")},
      {t:"Despachados (ref.)",num:1,f:r=>r.desp??"—"},
      {t:"Médio/OS",num:1,f:r=>hhmm(r.execOS)}
    ],gs,r=>r.ambiguo?"amb":"ok");
  
    tabela($("tEqDia"),[
      {t:"Data",f:r=>brDate(r.data)},{t:"Equipe",f:r=>esc(semSufixo(r.eq))},
      {t:"Turnos",f:r=>r.turnos.join(", ")},
      {t:"Tempo total",num:1,f:r=>hhmm(r.tempoTotal)},
      {t:"Paradas",num:1,f:r=>hhmm(r.paradaMin)},
      {t:"Disponível",num:1,f:r=>hhmm(r.turnoRealMin)},
      {t:"Realizados",num:1,f:r=>r.real},{t:"Imposs.",num:1,f:r=>r.imposs},
      {t:"Válidos",num:1,f:r=>r.validos},
      {t:"Produt. real",num:1,f:r=>hhmm(r.produtReal)},
      {t:"Performance",num:1,f:r=>badge(CFG.cap?Math.min(r.perf??0,1):r.perf)},
      {t:"Disp.",num:1,f:r=>badge(CFG.cap?Math.min(r.disp??0,1):r.disp)},
      {t:"Qual.",num:1,f:r=>badge(r.qual)},
      {t:"Situação",f:r=>(r.produtReal!=null&&r.produtReal<=metaT)
          ?`<span class="tag" style="background:var(--ok)">Na meta</span>`
          :`<span class="tag" style="background:var(--bad)">Acima da meta</span>`}
    ],eqDia,r=>(r.produtReal!=null&&r.produtReal<=metaT)?"ok":"");
  
    /* ---------- QUALIDADE ---------- */
    kpi("qKpi",a.qualC,a.real?`${a.imposs} impossibilidade(s) em ${a.real} atendimento(s) → ${a.validos} válidos`:"Sem atendimentos","qKpiBar");
    setT("qReal",a.real); setT("qRealSub",`Atendimentos na Exportação · ${a.validos} válidos alimentam a Performance`);
    setT("qImposs",a.imposs);
    setT("qImpossSub",a.real?`${pct(a.imposs/a.real)} do total`:"—");
    setT("qMotivosN",EST.motivosImposs.size);
    setT("qMotivosNSub",`de ${uniq(EST.atend.map(x=>x.motivo)).length} motivo(s) distintos na base`);
    const serQual=[{k:"Impossibilidades",color:"#7B52AB",vals:porData.map(x=>x.imposs)},
                   {k:"Atendimentos válidos",color:"#dcd3e8",vals:porData.map(x=>x.validos)}];
    chartBarras($("chQualData"),datas,serQual,{stack:true,catLabel:lblData,
      sub:i=>porData[i].qual==null?"":(porData[i].qual*100).toFixed(0)+"%"});
    legenda($("legQualData"),serQual);
    hbars($("chQualMotivo"),porChave(a.motivosImposs,"var(--purple)"),v=>v);
    const iEq={}; impos.forEach(x=>{const k=semSufixo(x.eq);iEq[k]=(iEq[k]||0)+1;});
    hbars($("chQualEquipe"),porChave(iEq,"var(--purple)"),v=>v);
    renderMotivos();
    tabela($("tImposs"),[
      {t:"Nº",f:r=>esc(r.n)},{t:"Protocolo",f:r=>esc(r.prot)},{t:"Motivo",f:r=>esc(r.motivo)},
      {t:"Status",f:r=>esc(r.status||"—")},{t:"Solução",f:r=>esc(r.sol||"—")},
      {t:"Endereço",f:r=>esc(r.end)},{t:"Início",f:r=>brDT(r.dtIni)},
      {t:"Equipe",f:r=>esc(semSufixo(r.eq))},{t:"Turno",f:r=>r.turno}
    ],impos.slice().sort((x,y)=>y.dtIni-x.dtIni));
  
    /* ---------- DADOS ---------- */
    setH("resumoFontes",`<ul>
      <li><b>Horários:</b> ${EST.fontes.horarios||"não carregada"}</li>
      <li><b>API Exati:</b> ${(window.BI_FONTES&&window.BI_FONTES.resumoApi())||"não utilizada nesta carga"}</li>
      <li><b>Atendimentos (API Exati / arquivo):</b> ${EST.fontes.exportacao||"—"}</li>
      <li><b>Paradas:</b> ${EST.fontes.paradas||"não carregada"}</li>
      <li><b>Planejamento:</b> ${EST.fontes.plan||"não carregado"}</li>
      <li><b>FR-CWB-GL-0001 (referência):</b> ${EST.fontes.diario||"não carregada"}</li>
      <li><b>Pasta <code>dados/</code>:</b> lida automaticamente quando a página é servida por HTTP; use <code>dados/manifest.json</code> para apontar os nomes dos arquivos.</li>
      <li><b>Fórmulas:</b> Disponibilidade = (tempo total − Σ paradas) ÷ tempo total · Performance = ${hhmm(metaT)} ÷ [(tempo total − Σ paradas) ÷ (produção − impossibilidades)] · Qualidade = válidos ÷ produção.</li>
      <li><b>Regra de exclusão:</b> equipes CCO são removidas de atendimentos, paradas e planejamento antes de qualquer cálculo.</li></ul>`);
    tabela($("tTurnos"),[
      {t:"Turno",f:r=>r.turno},{t:"Ano/Mês",f:r=>`${r.ano??"todos"}/${r.mes??"todos"}`},
      {t:"Janela",f:r=>`${hhmm(r.ini)} → ${hhmm(r.fim)}${r.cruza?" (+1d)":""}`},
      {t:"Previsto",num:1,f:r=>hhmm(r.previsto)},
      {t:"Saída base",num:1,f:r=>hhmm(r.mob)},{t:"Retorno",num:1,f:r=>hhmm(r.desmob)},
      {t:"Deslocam.",num:1,f:r=>hhmm(r.desloc)},{t:"Descanso",num:1,f:r=>hhmm(r.interv)},
      {t:"Tempo total (meta disp.)",num:1,f:r=>`${hhmm(r.metaDisp)} (${r.metaDisp} min)${r.metaDispDerivada?" *":""}`},
      {t:"Meta produção (ref.)",num:1,f:r=>r.metaProd},
      {t:"Meta produtividade planilha",num:1,f:r=>hhmm(r.metaProdut)},
      {t:"Meta de tempo aplicada",num:1,f:r=>hhmm(metaTempoDe(r))},
      {t:"Conferência (disp÷prod)",num:1,f:r=>r.metaProd?hhmm(r.metaDisp/r.metaProd):"—"},
      {t:"Fonte",f:r=>r.fonte+(r.descEstimado?" (descontos estimados)":"")}
    ],uniq(Object.keys(EST.turnosCfg).filter(k=>k.startsWith("*|*|"))).map(k=>EST.turnosCfg[k]));
    setH("diagBox",EST.diag.length?`<ul>${EST.diag.slice(0,80).map(d=>`<li>${d}</li>`).join("")}</ul>`
      :"Nenhuma inconsistência detectada na leitura.");
    tabela($("tAtend"),[
      {t:"Nº",f:r=>esc(r.n)},{t:"Protocolo",f:r=>esc(r.prot)},{t:"Identificação",f:r=>esc(r.ident)},
      {t:"Endereço",f:r=>esc(r.end)},{t:"Tipo",f:r=>esc(r.tipo)},{t:"Motivo",f:r=>esc(r.motivo)},
      {t:"Solução",f:r=>esc(r.sol)},{t:"Início",f:r=>brDT(r.dtIni)},{t:"Conclusão",f:r=>brDT(r.dtFim)},
      {t:"Execução (min)",num:1,f:r=>r.dtFim&&r.dtFim>=r.dtIni?((r.dtFim-r.dtIni)/60000).toFixed(0):"—"},
      {t:"Turno",f:r=>r.turno||"—"},{t:"Equipe",f:r=>esc(semSufixo(r.eq))},
      {t:"Classificação",f:r=>ehImposs(r)?`<span class="tag" style="background:var(--bad)">Impossibilidade</span>`
                                         :`<span class="tag" style="background:var(--ok)">Válido</span>`}
    ],ats.slice().sort((x,y)=>y.dtIni-x.dtIni));
  }
  
  function renderMotivos(){
    const box=$("motivosBox"); if(!box) return;
    const cont={}; EST.atend.forEach(a=>cont[a.motivo]=(cont[a.motivo]||0)+1);
    box.innerHTML=Object.entries(cont).sort((a,b)=>b[1]-a[1]).map(([m,q])=>{
      const on=EST.motivosImposs.has(m);
      return `<label class="mchip ${on?"on":""}"><input type="checkbox" data-motivo="${esc(m)}" ${on?"checked":""}>
              ${esc(m)} <b>${q}</b></label>`;}).join("")||'<div class="sub">Carregue a Exportação Consulta.</div>';
    box.querySelectorAll("input").forEach(i=>i.onchange=()=>{
      i.checked?EST.motivosImposs.add(i.dataset.motivo):EST.motivosImposs.delete(i.dataset.motivo);
      localStorage.setItem("ope_motivos_imposs",JSON.stringify([...EST.motivosImposs]));
      render();
    });
  }
  
  /* ========================= CSV ========================= */
  function exportarCSV(){
    if(!ULTIMO.length) return alert("Não há dados no filtro para exportar.");
    const h=["Data","Equipe","Turno","TurnosNoDia","TurnoAmbiguo","Regional",
      "TempoTotalMin","ParadaMin_NoTurno","ParadaMin_Bruta","DisponivelMin","ExecucaoMin",
      "Disponibilidade%","Realizados","Impossibilidades","Validos",
      "ProdutividadeRealMin","MetaTempoMin","TempoNecessarioMin","Performance%",
      "PerformanceQtd%","MetaQtd","Qualidade%","Ocupacao%","OPE%",
      "BaseTempoTotal","RecorteParadas","LimiteCem"];
    const n=v=>v==null?"n/d":(v*100).toFixed(1).replace(".",",");
    const d=v=>v==null?"n/d":String(Math.round(v)).replace(".",",");
    const L=ULTIMO.map(r=>[brDate(r.data),r.eq,r.turno,r.turnosNoDia,r.ambiguo?"SIM":"NAO",
      r.reg.join("/"),Math.round(r.tempoTotal),r.paradaMin.toFixed(0),r.paradaBruta.toFixed(0),
      r.turnoRealMin.toFixed(0),r.execMin.toFixed(0),n(r.dispC),
      r.real,r.imposs,r.validos,d(r.produtReal),r.metaTempo,Math.round(r.tempoNec),
      n(r.perfC),n(r.perfQtd),r.metaProd.toFixed(r.rateada?1:0),n(r.qualC),n(r.ocup),n(r.ope),
      CFG.metodo,CFG.recortarParadas?"SIM":"NAO",CFG.cap?"SIM":"NAO"]);
    const O=filtrarOrfas().map(p=>["PARADA ORFA",p.eq,p.turno||"—","","","","",
      p.min.toFixed(0),p.min.toFixed(0),"","","","","","","","","","","","","","","",CFG.metodo,"",""]);
    const csv=[h,...L,...O].map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
    a.download="OPE_detalhamento.csv"; a.click();
  }
  
  /* ========================= EVENTOS ========================= */
  const on = (id,ev,fn)=>{ const e=$(id); if(e) e[ev]=fn; };
  
  on("btnCarregar","onclick",carregar);
  on("btnIrFontes","onclick",()=>{
    const btn=document.querySelector('.tab-btn[data-tab="fontes"]');
    if(btn){ btn.click(); btn.scrollIntoView({behavior:"smooth",block:"center"}); }
  });
  on("btnPasta","onclick",carregar);
  on("btnCSV","onclick",exportarCSV);
  on("btnReset","onclick",()=>{ inicializarFiltros(); render(); });
  on("cfgMetodo","onchange",e=>{ CFG.metodo=e.target.value; render(); });
  on("cfgFmt","onchange",e=>{ CFG.fmt=e.target.value;
    alert('Formato de data alterado. Clique em "Carregar dados" para reler as planilhas.'); });
  on("cfgMetaDia","onchange",e=>{ CFG.metaDia=e.target.checked; render(); });
  on("cfgCap","onchange",e=>{ CFG.cap=e.target.checked; render(); });
  on("cfgStatus","onchange",e=>{ CFG.statusImposs=e.target.checked; render(); });
  on("cfgOrfa","onchange",e=>{ CFG.criarOrfa=e.target.checked;
    if(EST.carregado){ construir(); inicializarFiltros(); render(); } });
  /* novos controles (opcionais no HTML) */
  on("cfgPerfBase","onchange",e=>{ CFG.perfBase=e.target.value; render(); });
  on("cfgMetaTempo","onchange",e=>{ const v=toMin(e.target.value);
    if(v&&v>0){ CFG.metaTempoMin=v; render(); } });
  on("cfgMetaTempoFonte","onchange",e=>{ CFG.metaTempoFonte=e.target.value; render(); });
  on("cfgRecorte","onchange",e=>{ CFG.recortarParadas=e.target.checked;
    if(EST.carregado){ construir(); inicializarFiltros(); render(); } });
  
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b===btn));
    document.querySelectorAll(".panel").forEach(pn=>pn.classList.toggle("active",pn.id==="panel-"+btn.dataset.tab));
  });
  
  /* tentativa de carga automática pela pasta dados/ */
  document.addEventListener("DOMContentLoaded",async()=>{
    atualizarSelos();
    const F=window.BI_FONTES;
    const mf=await lerManifest();
    if((F&&F.apiAtiva&&F.apiAtiva()) || (mf && Object.keys(mf).length)) carregar();
  });
  