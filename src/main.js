const S = {
  fxRate: null,
  stocks: [],
  p: { kr:3.0, us:4.5, tx:0.18, div:15, hold:12, yield:2.0 }
};

// 날짜
const d = new Date();
document.getElementById('today-date').textContent =
  d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});

// ── 환율 API (3개 소스 순차 시도, 각 5초 타임아웃) ──────────────────────
const FX_APIS = [
  {
    // 1순위: jsdelivr CDN 기반 — CORS 완전 허용, 무제한
    name: 'jsdelivr CDN',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    get: d => {
      const rate = d?.usd?.krw;
      return (rate && rate > 0) ? rate : null;
    }
  },
  {
    // 2순위: exchangerate-api — CORS 허용, 월 1500회 무료
    name: 'exchangerate-api',
    url: 'https://api.exchangerate-api.com/v4/latest/USD',
    get: d => {
      const rate = d?.rates?.KRW;
      return (rate && rate > 0) ? rate : null;
    }
  },
  {
    // 3순위: open.er-api — CORS 허용, 월 1500회 무료
    name: 'open.er-api',
    url: 'https://open.er-api.com/v6/latest/USD',
    get: d => {
      const rate = d?.rates?.KRW;
      return (rate && rate > 0) ? rate : null;
    }
  }
];

// 타임아웃 fetch 헬퍼
function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchFX() {
  for (const api of FX_APIS) {
    try {
      const res = await fetchWithTimeout(api.url, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const rate = api.get(data);
      if (rate && rate > 500 && rate < 3000) {  // 상식적 범위 검증
        console.log(`[환율] ${api.name} 성공: ${rate}`);
        return { rate, source: api.name };
      }
    } catch (e) {
      console.warn(`[환율] ${api.name} 실패:`, e.message);
    }
  }
  return null;
}

function applyFXRate(rate, source, isManual = false) {
  S.fxRate = rate;
  const fmt = v => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  document.getElementById('fx-spot').textContent = fmt(rate);
  document.getElementById('fx-spot').style.color = '';
  document.getElementById('fx-display').textContent = fmt(rate) + '원';
  document.getElementById('rate-badge').textContent = isManual ? '수동입력' : '실시간';
  document.getElementById('rate-badge').className = 'fx-badge live';
  const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('rate-time').textContent =
    (isManual ? '' : source + ' · ') + timeStr + ' 기준';
  document.getElementById('score-updated').textContent = timeStr + ' 업데이트';
  document.getElementById('manual-fx-bar').style.display = 'none';
  updateAll();
}

function showManualFXInput() {
  document.getElementById('fx-spot').textContent = 'API 조회 실패';
  document.getElementById('fx-spot').style.color = '#ff7b6b';
  document.getElementById('rate-badge').textContent = '수동입력 필요';
  document.getElementById('rate-badge').className = 'fx-badge stale';
  document.getElementById('rate-time').textContent = '';
  document.getElementById('score-updated').textContent = '환율 입력 필요';
  document.getElementById('manual-fx-bar').style.display = 'flex';
}

function applyManualFX() {
  const val = parseFloat(document.getElementById('manual-fx-input').value);
  if (!val || val < 800 || val > 2500) {
    document.getElementById('manual-fx-input').style.borderColor = '#c8392b';
    setTimeout(() => document.getElementById('manual-fx-input').style.borderColor = '', 1500);
    return;
  }
  applyFXRate(val, '수동입력', true);
}

async function initFX() {
  document.getElementById('fx-spot').textContent = '로딩 중...';
  const result = await fetchFX();
  if (result) {
    applyFXRate(result.rate, result.source, false);
  } else {
    showManualFXInput();
  }
}

function calcCostsFor(p){
  const hedgePct = Math.max(0, p.us - p.kr) * (p.hold/12);
  const txPct = p.tx * 2;
  const divPct = p.yield * (p.div/100) * (p.hold/12);
  const totalPct = hedgePct + txPct + divPct;
  return {hedgePct, txPct, divPct, totalPct};
}
function calcCosts(){ return calcCostsFor(S.p); }

function calcStock(krwPrice){
  if(!S.fxRate) return null;
  const usdSpot = krwPrice / S.fxRate;
  const c = calcCosts();
  return {
    usdSpot,
    hedgeUSD: usdSpot * c.hedgePct/100,
    txUSD:    usdSpot * c.txPct/100,
    divUSD:   usdSpot * c.divPct/100,
    totalUSD: usdSpot * c.totalPct/100,
    effectiveUSD: usdSpot * (1 + c.totalPct/100),
    ...c
  };
}

function calcScoreFor(fxRate, p){
  const {totalPct} = calcCostsFor(p);
  const costScore = Math.max(0, 40 - totalPct * 5);
  let fxScore;
  if(fxRate < 1200) fxScore=20;
  else if(fxRate<=1350) fxScore=30;
  else if(fxRate<=1450) fxScore=24;
  else fxScore=16;
  const rateDiff = p.us - p.kr;
  let rateScore;
  if(rateDiff<=0) rateScore=30;
  else if(rateDiff<=1) rateScore=24;
  else if(rateDiff<=2) rateScore=16;
  else rateScore=8;
  return {total:Math.round(costScore+fxScore+rateScore), costScore, fxScore, rateScore};
}
function calcScore(){
  if(!S.fxRate) return null;
  return calcScoreFor(S.fxRate, S.p);
}

function updateAll(){
  if(!S.fxRate) return;
  const costs = calcCosts();
  const score = calcScore();

  // 환율 띠
  document.getElementById('fx-hedge-display').textContent = costs.hedgePct.toFixed(2)+'%';
  document.getElementById('fx-total-cost').textContent = costs.totalPct.toFixed(2)+'%';

  // 스코어카드
  const sc = score.total;
  document.getElementById('score-number').textContent = sc;
  document.getElementById('score-circle').className =
    'score-circle '+(sc>=65?'high':sc>=45?'medium':'low');

  if(sc>=65){
    document.getElementById('score-label').textContent='매력적인 투자처';
    document.getElementById('score-verdict').textContent=
      `현재 환율과 금리 환경에서 외국인 투자자는 한국 주식을 비교적 매력적으로 볼 가능성이 높습니다. 총 거래 마찰 비용이 ${costs.totalPct.toFixed(1)}%로 관리 가능한 수준이며, 한국 증시의 저평가 메리트가 비용을 상쇄할 수 있습니다.`;
    document.getElementById('score-tag').textContent='✦ 외국인에게 매력적';
    document.getElementById('score-tag').className='score-tag tag-attractive';
  } else if(sc>=45){
    document.getElementById('score-label').textContent='보통 수준의 매력도';
    document.getElementById('score-verdict').textContent=
      `총 거래 비용이 ${costs.totalPct.toFixed(1)}%로 부담스럽지 않지만, 금리차에 따른 환헤지 비용이 수익을 일부 잠식합니다. 외국인 입장에서 한국 주식은 밸류에이션 매력은 있으나 비용 개선이 필요한 상황입니다.`;
    document.getElementById('score-tag').textContent='△ 중립 — 선택적 매수';
    document.getElementById('score-tag').className='score-tag tag-neutral';
  } else {
    document.getElementById('score-label').textContent='비용 부담 구간';
    document.getElementById('score-verdict').textContent=
      `총 거래 마찰 비용이 ${costs.totalPct.toFixed(1)}%로 상당히 높습니다. 금리차 및 환율 불안으로 인해 외국인 투자자가 한국 주식 매수에 신중할 수 있는 환경입니다.`;
    document.getElementById('score-tag').textContent='✕ 비용 부담 — 관망 우세';
    document.getElementById('score-tag').className='score-tag tag-caution';
  }

  // 지표 그리드
  const rateDiff = (S.p.us-S.p.kr).toFixed(1);
  const rdc = parseFloat(rateDiff)<=0?'pos':parseFloat(rateDiff)>1.5?'neg':'neu';
  const fxc = S.fxRate>1450?'neg':S.fxRate<1250?'pos':'neu';
  document.getElementById('metrics-grid').innerHTML = `
    <div class="metric-item">
      <div class="metric-label">USD/KRW 환율</div>
      <div class="metric-value ${fxc}">${S.fxRate.toLocaleString('ko-KR',{maximumFractionDigits:0})}원</div>
      <div class="metric-desc">${S.fxRate>1450?'원화 약세 — 주가 저렴하나 환리스크 ↑':S.fxRate<1250?'원화 강세 — 외국인 환차익 기대':'중립 구간'}</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:${score.fxScore/30*100}%;background:${S.fxRate>1450?'var(--negative)':S.fxRate<1250?'var(--positive)':'var(--warn)'}"></div></div>
    </div>
    <div class="metric-item">
      <div class="metric-label">한미 금리차 (미국–한국)</div>
      <div class="metric-value ${rdc}">${parseFloat(rateDiff)>=0?'+':''}${rateDiff}%p</div>
      <div class="metric-desc">${parseFloat(rateDiff)>0?'미국 금리가 높아 환헤지 비용 발생':'한국 금리 ≥ 미국 — 헤지 비용 없거나 이득'}</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:${score.rateScore/30*100}%;background:${parseFloat(rateDiff)<=0?'var(--positive)':parseFloat(rateDiff)>1.5?'var(--negative)':'var(--warn)'}"></div></div>
    </div>
    <div class="metric-item">
      <div class="metric-label">환헤지 비용 (${S.p.hold}개월)</div>
      <div class="metric-value ${costs.hedgePct>2?'neg':'pos'}">${costs.hedgePct.toFixed(2)}%</div>
      <div class="metric-desc">연간 수익의 ${costs.hedgePct.toFixed(2)}%를 헤지 비용으로 지불</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:${Math.min(100,costs.hedgePct/5*100)}%;background:${costs.hedgePct>2?'var(--negative)':'var(--positive)'}"></div></div>
    </div>
    <div class="metric-item">
      <div class="metric-label">총 거래 마찰 비용</div>
      <div class="metric-value ${costs.totalPct>5?'neg':costs.totalPct>2.5?'neu':'pos'}">${costs.totalPct.toFixed(2)}%</div>
      <div class="metric-desc">이 이상 주가가 올라야 손익분기 달성</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:${Math.min(100,costs.totalPct/10*100)}%;background:${costs.totalPct>5?'var(--negative)':costs.totalPct>2.5?'var(--warn)':'var(--positive)'}"></div></div>
    </div>
    <div class="metric-item">
      <div class="metric-label">거래세 (왕복)</div>
      <div class="metric-value neu">${costs.txPct.toFixed(3)}%</div>
      <div class="metric-desc">미국 0% vs 한국 ${S.p.tx}% (매수·매도 각)</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:40%;background:var(--warn)"></div></div>
    </div>
    <div class="metric-item">
      <div class="metric-label">매력도 종합 점수</div>
      <div class="metric-value ${sc>=65?'pos':sc>=45?'neu':'neg'}">${sc}점</div>
      <div class="metric-desc">100점 기준 / 환율·금리·비용 종합</div>
      <div class="metric-bar-wrap"><div class="metric-bar-fill" style="width:${sc}%;background:${sc>=65?'var(--positive)':sc>=45?'var(--warn)':'var(--negative)'}"></div></div>
    </div>`;

  // 비용 막대
  const base = 100;
  document.getElementById('bar-base').style.flex = base;
  document.getElementById('bar-hedge').style.flex = Math.max(0.2, costs.hedgePct);
  document.getElementById('bar-tx').style.flex = Math.max(0.1, costs.txPct);
  document.getElementById('bar-div').style.flex = Math.max(0.1, costs.divPct);
  document.getElementById('bar-cost-label').textContent = `총 비용 ${costs.totalPct.toFixed(2)}%`;

  // 인사이트
  updateInsights(costs);
  document.getElementById('tx-cost-stat').textContent = costs.txPct.toFixed(3)+'%';
  renderTable();
}

function updateInsights(costs){
  if(!S.fxRate) return;
  const fxCard = document.getElementById('insight-fx');
  const fmtR = S.fxRate.toLocaleString('ko-KR',{maximumFractionDigits:0});
  if(S.fxRate>1450){
    fxCard.className='insight-card neutral';
    document.getElementById('insight-fx-body').innerHTML=`현재 환율 <strong>${fmtR}원/달러</strong>는 역사적 고환율 구간입니다. 외국인 입장에서 한국 주식을 <strong>상대적으로 싸게</strong> 살 수 있지만, 원화 변동성 리스크가 크게 느껴질 수 있습니다.`;
    document.getElementById('insight-fx-stat').innerHTML=`현재: <strong>${fmtR}원</strong> · 고환율로 주가 체감은 저렴하나 변동성 주의`;
  } else if(S.fxRate<1250){
    fxCard.className='insight-card positive';
    document.getElementById('insight-fx-body').innerHTML=`현재 환율 <strong>${fmtR}원/달러</strong>는 원화 강세 구간입니다. 외국인이 나중에 USD로 환전할 때 <strong>환차익</strong>을 기대할 수 있어 투자 매력이 높아집니다.`;
    document.getElementById('insight-fx-stat').innerHTML=`현재: <strong>${fmtR}원</strong> · 원화 강세 — 환차익 기대 가능`;
  } else {
    fxCard.className='insight-card';
    document.getElementById('insight-fx-body').innerHTML=`현재 환율 <strong>${fmtR}원/달러</strong>는 중립 구간입니다. 외국인에게 환율 측면의 특별한 메리트나 리스크는 크지 않은 상태입니다.`;
    document.getElementById('insight-fx-stat').innerHTML=`현재: <strong>${fmtR}원</strong> · 중립 구간`;
  }
  const hedgeCard = document.getElementById('insight-hedge');
  const rd = S.p.us - S.p.kr;
  if(rd<=0){
    hedgeCard.className='insight-card positive';
    document.getElementById('insight-hedge-body').innerHTML=`한국 금리가 미국보다 높거나 같아 <strong>환헤지 비용이 0에 가깝거나 오히려 이득</strong>입니다. 외국인이 환리스크 없이 한국 주식에 투자하기 유리한 드문 환경입니다.`;
    document.getElementById('insight-hedge-stat').innerHTML=`금리차: <strong>한국 유리</strong> · 헤지 비용: <strong>${costs.hedgePct.toFixed(2)}%</strong>`;
  } else if(rd<=1.5){
    hedgeCard.className='insight-card';
    document.getElementById('insight-hedge-body').innerHTML=`미국과 한국의 금리차가 <strong>${rd.toFixed(1)}%p</strong>로 적당한 수준입니다. 연간 헤지 비용 ${costs.hedgePct.toFixed(2)}%는 한국 주식의 배당수익률로 상당 부분 커버 가능합니다.`;
    document.getElementById('insight-hedge-stat').innerHTML=`금리차: <strong>+${rd.toFixed(1)}%p</strong> · 헤지 비용: <strong>${costs.hedgePct.toFixed(2)}%</strong>`;
  } else {
    hedgeCard.className='insight-card negative';
    document.getElementById('insight-hedge-body').innerHTML=`미국 금리가 한국보다 <strong>${rd.toFixed(1)}%p 높아</strong> 환헤지 비용 부담이 큽니다. 연간 ${costs.hedgePct.toFixed(2)}%의 비용이 외국인 실질 수익을 상당히 감소시킵니다.`;
    document.getElementById('insight-hedge-stat').innerHTML=`금리차: <strong>+${rd.toFixed(1)}%p (미국 유리)</strong> · 헤지 비용: <strong>${costs.hedgePct.toFixed(2)}%</strong>`;
  }
}

function renderTable(){
  const tbody = document.getElementById('table-body');
  if(S.stocks.length===0){
    tbody.innerHTML=`<tr><td colspan="10"><div class="empty-table"><div class="icon">📈</div><p>종목을 추가하거나 '대표 종목 불러오기'를 눌러보세요</p></div></td></tr>`;
    return;
  }
  if(!S.fxRate){
    tbody.innerHTML=`<tr><td colspan="10"><div class="empty-table"><div class="icon">⌛</div><p>환율 데이터 로딩 중...</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = S.stocks.map((s,i)=>{
    const c = calcStock(s.price);
    if(!c) return '';
    const cls = c.totalPct<3?'high':c.totalPct<6?'medium':'low';
    const label = c.totalPct<3?'✦ 매력적':c.totalPct<6?'△ 보통':'✕부담';
    const effColor = c.totalPct<3?'var(--positive)':c.totalPct<6?'var(--warn)':'var(--negative)';
    return `<tr>
      <td><div class="sname">${esc(s.name)}</div><div class="scode">${esc(s.code)}</div></td>
      <td style="color:var(--ink3)">₩${s.price.toLocaleString('ko-KR')}</td>
      <td>$${c.usdSpot.toFixed(4)}</td>
      <td class="cost-col">
        <div class="tip"><span style="cursor:help;text-decoration:underline dotted;text-underline-offset:2px">−$${c.hedgeUSD.toFixed(4)}</span>
          <div class="tip-content">
            <div class="tip-row"><span>미국 금리</span><span>${S.p.us}%</span></div>
            <div class="tip-row"><span>한국 금리</span><span>${S.p.kr}%</span></div>
            <div class="tip-row"><span>보유기간</span><span>${S.p.hold}개월</span></div>
            <div class="tip-sep"></div>
            <div class="tip-row"><span>헤지 비율</span><span>${c.hedgePct.toFixed(2)}%</span></div>
          </div>
        </div>
        <span class="cost-pct">${c.hedgePct.toFixed(2)}%</span>
      </td>
      <td style="color:var(--accent-gold);font-size:12px">−$${c.txUSD.toFixed(4)}<span class="cost-pct">${c.txPct.toFixed(3)}%</span></td>
      <td style="color:#6b7c9a;font-size:12px">−$${c.divUSD.toFixed(4)}<span class="cost-pct">${c.divPct.toFixed(2)}%</span></td>
      <td style="font-size:13px;color:var(--ink2)">${c.totalPct.toFixed(2)}%</td>
      <td><span class="effective-col" style="color:${effColor}">$${c.effectiveUSD.toFixed(4)}</span></td>
      <td><span class="attract-badge ${cls}">${label}</span></td>
      <td><button class="del-btn" onclick="removeStock(${i})">✕</button></td>
    </tr>`;
  }).join('');
}

function addStock(){
  const name = document.getElementById('in-name').value.trim();
  const code = document.getElementById('in-code').value.trim();
  const price = parseFloat(document.getElementById('in-price').value);
  if(!name||isNaN(price)||price<=0){
    ['in-name','in-price'].forEach(id=>{
      const el=document.getElementById(id);
      el.style.borderColor='var(--negative)';
      setTimeout(()=>el.style.borderColor='',1200);
    });
    return;
  }
  S.stocks.push({name, code:code||'—', price});
  document.getElementById('in-name').value='';
  document.getElementById('in-code').value='';
  document.getElementById('in-price').value='';
  renderTable();
}

function removeStock(i){ S.stocks.splice(i,1); renderTable(); }

function loadSamples(){
  S.stocks=[
    {name:'삼성전자', code:'005930', price:74000},
    {name:'SK하이닉스', code:'000660', price:196000},
    {name:'LG에너지솔루션', code:'373220', price:320000},
    {name:'포스코홀딩스', code:'005490', price:390000},
    {name:'현대자동차', code:'005380', price:235000},
    {name:'NAVER', code:'035420', price:178000},
    {name:'카카오', code:'035720', price:36000},
    {name:'셀트리온', code:'068270', price:170000},
  ];
  renderTable();
}

function applyParams(){
  S.p.kr    = parseFloat(document.getElementById('p-kr').value)||3.0;
  S.p.us    = parseFloat(document.getElementById('p-us').value)||4.5;
  S.p.tx    = parseFloat(document.getElementById('p-tx').value)||0.18;
  S.p.div   = parseFloat(document.getElementById('p-div').value)||15;
  S.p.hold  = parseInt(document.getElementById('p-hold').value)||12;
  S.p.yield = parseFloat(document.getElementById('p-yield').value)||2.0;
  updateAll();
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('in-price').addEventListener('keydown', e=>{ if(e.key==='Enter') addStock(); });

// ── 시나리오 시뮬레이터 ──────────────────────────────────────────
S.scenarios = [];
let scenarioCounter = 0;

const PRESETS = {
  bullish:  { name:'낙관', fxRate:1200, kr:3.5, us:3.5 },
  base:     { name:'현재 기준', fxRate:null, kr:null, us:null }, // null = 현재 값 사용
  bearish:  { name:'비관', fxRate:1500, kr:2.5, us:5.5 }
};

function loadPreset(type){
  const preset = PRESETS[type];
  const fx = preset.fxRate ?? S.fxRate ?? 1380;
  const kr = preset.kr ?? S.p.kr;
  const us = preset.us ?? S.p.us;
  document.getElementById('sl-fx').value = fx;
  document.getElementById('sl-kr').value = kr;
  document.getElementById('sl-us').value = us;
  updateSliderLabels();
  // 프리셋 버튼 활성 표시
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.preset-btn.${type}`)?.classList.add('active');
}

function updateSliderLabels(){
  const fx = parseFloat(document.getElementById('sl-fx').value);
  const kr = parseFloat(document.getElementById('sl-kr').value);
  const us = parseFloat(document.getElementById('sl-us').value);
  document.getElementById('sl-fx-val').textContent = fx.toLocaleString('ko-KR');
  document.getElementById('sl-kr-val').textContent = kr.toFixed(2) + '%';
  document.getElementById('sl-us-val').textContent = us.toFixed(2) + '%';
}

function addCustomScenario(){
  if(S.scenarios.length >= 4) return;
  const fxRate = parseFloat(document.getElementById('sl-fx').value);
  const kr = parseFloat(document.getElementById('sl-kr').value);
  const us = parseFloat(document.getElementById('sl-us').value);
  const rateDiff = us - kr;
  // 프리셋 이름 매칭
  let name;
  const activePreset = document.querySelector('.preset-btn.active');
  if(activePreset){
    const type = activePreset.classList.contains('bullish') ? 'bullish'
               : activePreset.classList.contains('bearish') ? 'bearish' : 'base';
    name = PRESETS[type].name;
  } else {
    scenarioCounter++;
    name = '커스텀 #' + scenarioCounter;
  }
  // 중복 방지: 같은 조건이면 추가하지 않음
  const dup = S.scenarios.find(s => s.fxRate === fxRate && s.kr === kr && s.us === us);
  if(dup) return;

  const p = { ...S.p, kr, us };
  S.scenarios.push({ name, fxRate, kr, us, p });
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  renderScenarios();
}

function removeScenario(i){
  S.scenarios.splice(i, 1);
  renderScenarios();
}

function renderScenarios(){
  const grid = document.getElementById('scenario-grid');
  const compare = document.getElementById('scenario-compare');
  const btn = document.getElementById('btn-add-scenario');
  const msg = document.getElementById('scenario-limit-msg');

  if(S.scenarios.length >= 4){
    btn.disabled = true;
    msg.textContent = '최대 4개까지 비교할 수 있습니다';
  } else {
    btn.disabled = false;
    msg.textContent = '';
  }

  if(S.scenarios.length === 0){
    grid.innerHTML = '<div class="scenario-empty"><div class="icon">🔬</div><p>프리셋을 선택하거나 슬라이더를 조정한 뒤<br>\'시나리오 추가\'를 눌러보세요</p></div>';
    compare.classList.add('hidden');
    return;
  }

  grid.innerHTML = S.scenarios.map((s, i) => {
    const p = { ...S.p, kr: s.kr, us: s.us };
    const costs = calcCostsFor(p);
    const score = calcScoreFor(s.fxRate, p);
    const sc = score.total;
    const cls = sc >= 65 ? 'high' : sc >= 45 ? 'medium' : 'low';
    const tag = sc >= 65 ? '✦ 매력적' : sc >= 45 ? '△ 보통' : '✕ 부담';
    const tagCls = sc >= 65 ? 'high' : sc >= 45 ? 'medium' : 'low';
    const rateDiff = s.us - s.kr;
    return `<div class="scenario-card">
      <div class="scenario-card-head">
        <div class="scenario-card-name">${esc(s.name)}</div>
        <button type="button" class="scenario-card-del" onclick="removeScenario(${i})">✕</button>
      </div>
      <div class="scenario-card-conditions">
        환율: ${s.fxRate.toLocaleString('ko-KR')}원<br>
        한국 금리: ${s.kr.toFixed(2)}% · 미국 금리: ${s.us.toFixed(2)}%<br>
        금리차: ${rateDiff >= 0 ? '+' : ''}${rateDiff.toFixed(2)}%p
      </div>
      <div class="scenario-score-wrap">
        <div class="scenario-score-circle ${cls}">
          <span class="scenario-score-num">${sc}</span>
          <span class="scenario-score-label">/100</span>
        </div>
        <div class="scenario-score-info">
          <div class="total-cost">총 비용 ${costs.totalPct.toFixed(2)}%</div>
          <div class="cost-detail">
            헤지 ${costs.hedgePct.toFixed(2)}% · 거래세 ${costs.txPct.toFixed(3)}% · 배당세 ${costs.divPct.toFixed(2)}%
          </div>
        </div>
      </div>
      <span class="attract-badge ${tagCls}">${tag}</span>
    </div>`;
  }).join('');

  // 비교 바 차트
  if(S.scenarios.length >= 2){
    compare.classList.remove('hidden');
    document.getElementById('scenario-compare-bars').innerHTML = S.scenarios.map((s, i) => {
      const p = { ...S.p, kr: s.kr, us: s.us };
      const score = calcScoreFor(s.fxRate, p);
      const sc = score.total;
      const color = sc >= 65 ? 'var(--positive)' : sc >= 45 ? 'var(--warn)' : 'var(--negative)';
      return `<div class="compare-bar-row">
        <div class="compare-bar-name">${esc(s.name)}</div>
        <div class="compare-bar-track">
          <div class="compare-bar-fill" style="width:${sc}%;background:${color}">${sc}점</div>
        </div>
        <div class="compare-bar-score" style="color:${color}">${sc}/100</div>
      </div>`;
    }).join('');
  } else {
    compare.classList.add('hidden');
  }
}

// 슬라이더 이벤트 바인딩
['sl-fx','sl-kr','sl-us'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    updateSliderLabels();
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  });
});

initFX();
setInterval(initFX, 5*60*1000);
