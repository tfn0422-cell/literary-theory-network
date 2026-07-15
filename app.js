
const state = {
  data:null, layout:"genealogy", colorMode:"cohort",
  scale:1, panX:0, panY:0, selected:null, hovered:null,
  draggingNode:null, draggingCanvas:false, lastMouse:{x:0,y:0},
  showLabels:false, dictionaryOnly:false, showArrows:true
};

const colors = {
  cohort:{C0:"#81978d",C1:"#3f7468",C2:"#2c6870",C3:"#5c5e94",C4:"#925d70",C5:"#b07843"},
  category:{context:"#9b5b45",problem:"#7e4f82",concept:"#346d64",method:"#4e68a0",institution:"#8a7948"},
  relation:{inherit:"#416f62",critique:"#a25854",turn:"#5874a8",history:"#a47b3e",constitute:"#7a638b"},
  community:["#486f64","#8d5e68","#5776a4","#a27646","#6d5993","#5d8976","#996650","#647f9a","#87784f","#7c5d7b"]
};
const els = {};
const nodeMap = new Map();
const adjacency = new Map();
const enabledCohorts = new Set(), enabledCategories = new Set(), enabledRelations = new Set();

async function init(){
  state.data = await fetch("./data.json").then(r=>r.json());
  state.data.nodes.forEach(n=>{nodeMap.set(n.id,n);adjacency.set(n.id,[])});
  state.data.edges.forEach(e=>{
    adjacency.get(e.source).push({...e,other:e.target,direction:"out"});
    adjacency.get(e.target).push({...e,other:e.source,direction:"in"});
  });
  Object.keys(state.data.cohortLabels).forEach(x=>enabledCohorts.add(x));
  Object.keys(state.data.categoryLabels).forEach(x=>enabledCategories.add(x));
  Object.keys(state.data.relationClassLabels).forEach(x=>enabledRelations.add(x));
  cacheEls();
  buildOverview();
  buildCohorts();
  buildFilters();
  buildConceptControls();
  renderConcepts();
  bindNav();
  bindNetworkControls();
  resizeCanvas();
}
function cacheEls(){
  ["networkCanvas","networkTooltip","detailPanel","cohortFilters","categoryFilters","relationFilters",
   "conceptGrid","conceptSearch","conceptCohort","conceptCategory"].forEach(id=>els[id]=document.getElementById(id));
  els.ctx = els.networkCanvas.getContext("2d");
}
function buildOverview(){
  const s=state.data.stats;
  document.getElementById("statNodes").textContent=s.node_count;
  document.getElementById("statEdges").textContent=s.edge_count;
  document.getElementById("statCommunities").textContent=s.communities;
  document.getElementById("statDictionary").textContent=s.dictionary_nodes;
  buildRankList("centralList",state.data.topCentral,"betweenness");
  buildRankList("bridgeList",state.data.topBridges,"cross_cohort_neighbors");
  const cs=Object.keys(state.data.cohortLabels);
  let h="<tr><th>→</th>"+cs.map(c=>`<th>${c}</th>`).join("")+"</tr>";
  cs.forEach(r=>h+=`<tr><th>${r}</th>${cs.map(c=>`<td>${state.data.crossMatrix[r][c]}</td>`).join("")}</tr>`);
  document.getElementById("cohortMatrix").innerHTML=h;
}
function buildRankList(id,ids,metric){
  const box=document.getElementById(id);
  box.innerHTML=ids.map(x=>{
    const n=nodeMap.get(x);
    return `<li data-node="${x}"><span>${n.label}</span> <b>${n.metrics[metric]}</b></li>`
  }).join("");
  box.querySelectorAll("[data-node]").forEach(el=>el.onclick=()=>{
    location.hash="#network"; setTimeout(()=>selectAndFocus(el.dataset.node),200);
  });
}
function buildCohorts(){
  const box=document.getElementById("cohortTimeline");
  box.innerHTML=Object.keys(state.data.cohortMeta).map((c,i)=>{
    const m=state.data.cohortMeta[c];
    const color=colors.cohort[c];
    return `<article class="cohort-card" style="--cohort:${color}">
      <div class="cohort-index">${c} · ${m.short}</div>
      <h3>${m.title}</h3>
      <div class="cohort-years">${m.years}</div>
      <p>${m.summary}</p>
      <div class="keyword-list">${m.keywords.map(k=>`<span>${k}</span>`).join("")}</div>
    </article>`
  }).join("");
}
function buildFilters(){
  els.cohortFilters.innerHTML=Object.entries(state.data.cohortLabels).map(([k,v])=>
    `<label class="filter-row"><input type="checkbox" checked data-kind="cohort" data-key="${k}">
      <span class="legend-dot" style="background:${colors.cohort[k]}"></span><span>${v}</span></label>`).join("");
  els.categoryFilters.innerHTML=Object.entries(state.data.categoryLabels).map(([k,v])=>
    `<label class="filter-row"><input type="checkbox" checked data-kind="category" data-key="${k}">
      <span class="legend-dot" style="background:${colors.category[k]}"></span><span>${v}</span></label>`).join("");
  els.relationFilters.innerHTML=Object.entries(state.data.relationClassLabels).map(([k,v])=>
    `<label class="filter-row"><input type="checkbox" checked data-kind="relation" data-key="${k}">
      <span class="legend-line" style="border-color:${colors.relation[k]}"></span><span>${v}</span></label>`).join("");
  document.querySelectorAll("input[data-kind]").forEach(input=>input.onchange=()=>{
    const set=input.dataset.kind==="cohort"?enabledCohorts:input.dataset.kind==="category"?enabledCategories:enabledRelations;
    input.checked?set.add(input.dataset.key):set.delete(input.dataset.key);
    draw();
  });
}
function buildConceptControls(){
  els.conceptCohort.innerHTML += Object.entries(state.data.cohortLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
  els.conceptCategory.innerHTML += Object.entries(state.data.categoryLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
  [els.conceptSearch,els.conceptCohort,els.conceptCategory].forEach(el=>el.addEventListener("input",renderConcepts));
}
function renderConcepts(){
  const q=els.conceptSearch.value.trim().toLowerCase();
  const c=els.conceptCohort.value,cat=els.conceptCategory.value;
  const list=state.data.nodes.filter(n=>
    (c==="all"||n.cohort===c)&&(cat==="all"||n.category===cat)&&
    (!q||(n.label+" "+n.aliases+" "+n.theorists+" "+n.description).toLowerCase().includes(q))
  );
  els.conceptGrid.innerHTML=list.map(n=>`
    <article class="concept-card" data-node="${n.id}">
      <h3>${n.label}</h3>
      <div class="concept-meta">
        <span>${state.data.cohortMeta[n.cohort].short}</span>
        <span>${state.data.categoryLabels[n.category]}</span>
        ${n.dictionary?'<span>辞典校准</span>':''}
      </div>
      <p>${n.description}</p>
      <div class="concept-theorists">${n.theorists||"—"}${n.aliases?` · ${n.aliases}`:""}</div>
    </article>`).join("");
  els.conceptGrid.querySelectorAll("[data-node]").forEach(el=>el.onclick=()=>{
    location.hash="#network";setTimeout(()=>selectAndFocus(el.dataset.node),200);
  });
}
function bindNav(){
  const toggle=document.getElementById("navToggle"),nav=document.getElementById("mainNav");
  toggle.onclick=()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open))};
  nav.querySelectorAll("a").forEach(a=>a.onclick=()=>nav.classList.remove("open"));
}
function bindNetworkControls(){
  document.getElementById("layoutSelect").onchange=e=>{state.layout=e.target.value;resetView()};
  document.getElementById("colorSelect").onchange=e=>{state.colorMode=e.target.value;draw()};
  document.getElementById("showLabels").onchange=e=>{state.showLabels=e.target.checked;draw()};
  document.getElementById("dictionaryOnly").onchange=e=>{state.dictionaryOnly=e.target.checked;draw()};
  document.getElementById("showArrows").onchange=e=>{state.showArrows=e.target.checked;draw()};
  document.getElementById("resetView").onclick=resetView;
  document.getElementById("fitView").onclick=resetView;
  document.getElementById("zoomIn").onclick=()=>{state.scale=Math.min(4.5,state.scale*1.2);draw()};
  document.getElementById("zoomOut").onclick=()=>{state.scale=Math.max(.34,state.scale/1.2);draw()};
  document.getElementById("exportPng").onclick=()=>{
    draw(); const a=document.createElement("a"); a.download="西方现当代文论概念网络.png";
    a.href=els.networkCanvas.toDataURL("image/png"); a.click();
  };
  document.getElementById("networkSearch").oninput=e=>{
    const q=e.target.value.trim().toLowerCase();
    const hit=state.data.nodes.find(n=>(n.label+" "+n.aliases+" "+n.theorists).toLowerCase().includes(q));
    if(q&&hit)selectAndFocus(hit.id);
  };
  window.addEventListener("resize",resizeCanvas);
  els.networkCanvas.addEventListener("mousemove",onMove);
  els.networkCanvas.addEventListener("mouseleave",()=>{state.hovered=null;state.draggingNode=null;state.draggingCanvas=false;els.networkTooltip.style.display="none";draw()});
  els.networkCanvas.addEventListener("mousedown",onDown);
  window.addEventListener("mouseup",onUp);
  els.networkCanvas.addEventListener("click",onClick);
  els.networkCanvas.addEventListener("wheel",onWheel,{passive:false});
}
function resizeCanvas(){
  const rect=els.networkCanvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1);
  els.networkCanvas.width=Math.floor(rect.width*dpr);els.networkCanvas.height=Math.floor(rect.height*dpr);
  els.ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
function size(){const dpr=Math.max(1,window.devicePixelRatio||1);return{w:els.networkCanvas.width/dpr,h:els.networkCanvas.height/dpr}}
function visibleNode(n){return enabledCohorts.has(n.cohort)&&enabledCategories.has(n.category)&&(!state.dictionaryOnly||n.dictionary)}
function visibleEdge(e){return visibleNode(nodeMap.get(e.source))&&visibleNode(nodeMap.get(e.target))&&enabledRelations.has(e.relation_class)}
function pos(n){return n.positions[state.layout]}
function toScreen(p){const{w,h}=size(),m=42,bx=m+p.x*(w-2*m),by=m+p.y*(h-2*m);return{x:(bx-w/2)*state.scale+w/2+state.panX,y:(by-h/2)*state.scale+h/2+state.panY}}
function toWorld(s){const{w,h}=size(),m=42,bx=(s.x-state.panX-w/2)/state.scale+w/2,by=(s.y-state.panY-h/2)/state.scale+h/2;return{x:(bx-m)/(w-2*m),y:(by-m)/(h-2*m)}}
function radius(n){return Math.min(15,5.3+Math.sqrt(n.metrics.weighted_degree)*1.24)}
function nColor(n){if(state.colorMode==="cohort")return colors.cohort[n.cohort];if(state.colorMode==="category")return colors.category[n.category];return colors.community[(n.community-1)%colors.community.length]}
function draw(){
  const c=els.ctx,{w,h}=size();c.clearRect(0,0,w,h);c.fillStyle="#f8f6ef";c.fillRect(0,0,w,h);
  if(state.layout==="genealogy"){
    c.save();c.setLineDash([4,5]);c.strokeStyle="rgba(60,80,74,.17)";
    Object.keys(state.data.cohortLabels).forEach((k,i)=>{
      const p=toScreen({x:.075+i*(.85/5),y:.03});
      c.beginPath();c.moveTo(p.x,30);c.lineTo(p.x,h-20);c.stroke();
      c.setLineDash([]);c.font="11px sans-serif";c.fillStyle="rgba(23,58,53,.7)";c.textAlign="center";
      c.fillText(state.data.cohortMeta[k].short,p.x,18);c.setLineDash([4,5]);
    });c.restore();
  }
  const focus=new Set();
  if(state.selected||state.hovered){const id=state.selected||state.hovered;focus.add(id);(adjacency.get(id)||[]).forEach(r=>focus.add(r.other))}
  state.data.edges.forEach(e=>{
    if(!visibleEdge(e))return;
    const a=toScreen(pos(nodeMap.get(e.source))),b=toScreen(pos(nodeMap.get(e.target)));
    const focused=!focus.size||(focus.has(e.source)&&focus.has(e.target)),alpha=focused?.52:.07,col=colors.relation[e.relation_class];
    c.save();c.globalAlpha=alpha;c.strokeStyle=col;c.lineWidth=.7+e.weight*.55;if(e.relation_class==="critique")c.setLineDash([6,4]);
    c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.restore();
    if(state.showArrows)arrow(a,b,col,alpha);
  });
  state.data.nodes.filter(visibleNode).sort((a,b)=>a.metrics.weighted_degree-b.metrics.weighted_degree).forEach(n=>{
    const p=toScreen(pos(n)),r=radius(n),focused=!focus.size||focus.has(n.id);
    c.save();c.globalAlpha=focused?1:.18;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fillStyle=nColor(n);c.fill();
    c.lineWidth=n.id===state.selected?3:n.id===state.hovered?2:1;c.strokeStyle=n.id===state.selected?"#0f2521":n.dictionary?"#fff":"rgba(23,33,31,.55)";c.stroke();c.restore();
    const important=n.metrics.betweenness>=.05||n.metrics.weighted_degree>=16;
    if(state.showLabels||n.id===state.selected||n.id===state.hovered||(important&&state.scale>.82))label(n,p,r,focused);
  });
}
function arrow(a,b,col,alpha){
  const c=els.ctx,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<18)return;
  const ux=dx/len,uy=dy/len,tx=b.x-ux*10,ty=b.y-uy*10;
  c.save();c.globalAlpha=alpha;c.fillStyle=col;c.beginPath();c.moveTo(tx,ty);
  c.lineTo(tx-ux*7-uy*4,ty-uy*7+ux*4);c.lineTo(tx-ux*7+uy*4,ty-uy*7-ux*4);c.closePath();c.fill();c.restore();
}
function label(n,p,r,focused){
  const c=els.ctx;c.save();c.globalAlpha=focused?.97:.18;c.font=(n.id===state.selected?"bold ":"")+"12px sans-serif";
  const tw=Math.min(220,c.measureText(n.label).width+14),x=p.x+r+5,y=p.y-9;
  c.fillStyle="rgba(255,253,247,.9)";roundRect(c,x,y,tw,19,5);c.fill();
  c.fillStyle="#22312d";c.textAlign="left";c.textBaseline="middle";c.fillText(n.label,x+7,y+9.5,tw-12);c.restore();
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function pointer(e){const r=els.networkCanvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function hit(x,y){let best=null,bd=Infinity;state.data.nodes.forEach(n=>{if(!visibleNode(n))return;const p=toScreen(pos(n)),d=Math.hypot(x-p.x,y-p.y);if(d<radius(n)+5&&d<bd){best=n;bd=d}});return best}
function onMove(e){
  const m=pointer(e);
  if(state.draggingNode){state.draggingNode.positions[state.layout]=toWorld(m);draw();return}
  if(state.draggingCanvas){state.panX+=m.x-state.lastMouse.x;state.panY+=m.y-state.lastMouse.y;state.lastMouse=m;draw();return}
  const n=hit(m.x,m.y);state.hovered=n?n.id:null;els.networkCanvas.style.cursor=n?"pointer":"grab";
  if(n){els.networkTooltip.style.display="block";els.networkTooltip.style.left=Math.min(m.x+14,els.networkCanvas.clientWidth-280)+"px";els.networkTooltip.style.top=Math.min(m.y+14,els.networkCanvas.clientHeight-90)+"px";els.networkTooltip.innerHTML=`<b>${n.label}</b><br>${state.data.cohortLabels[n.cohort]}<br>${state.data.categoryLabels[n.category]} · 度数 ${n.metrics.degree}`;}
  else els.networkTooltip.style.display="none";draw();
}
function onDown(e){const m=pointer(e),n=hit(m.x,m.y);state.lastMouse=m;if(n)state.draggingNode=n;else state.draggingCanvas=true}
function onUp(){if(state.draggingNode){state.selected=state.draggingNode.id;renderDetail(state.selected)}state.draggingNode=null;state.draggingCanvas=false}
function onClick(e){const m=pointer(e),n=hit(m.x,m.y);if(n){state.selected=n.id;renderDetail(n.id)}else{state.selected=null;renderEmpty()}draw()}
function onWheel(e){e.preventDefault();const m=pointer(e),before=toWorld(m),factor=e.deltaY<0?1.12:.89;state.scale=Math.max(.34,Math.min(4.5,state.scale*factor));const after=toScreen(before);state.panX+=m.x-after.x;state.panY+=m.y-after.y;draw()}
function resetView(){state.scale=1;state.panX=0;state.panY=0;draw()}
function selectAndFocus(id){state.selected=id;renderDetail(id);focus(id);draw()}
function focus(id){const n=nodeMap.get(id),p=pos(n),{w,h}=size(),m=42,bx=m+p.x*(w-2*m),by=m+p.y*(h-2*m);state.scale=Math.max(1.35,state.scale);state.panX=w/2-(bx-w/2)*state.scale-w/2;state.panY=h/2-(by-h/2)*state.scale-h/2}
function renderEmpty(){els.detailPanel.innerHTML=`<div class="empty-detail"><span class="detail-icon">◎</span><h3>选择一个概念节点</h3><p>点击网络中的节点，即可查看它在代际谱系中的位置、相关理论家与概念关系。</p></div>`}
function renderDetail(id){
  const n=nodeMap.get(id),rels=(adjacency.get(id)||[]).slice().sort((a,b)=>b.weight-a.weight);
  els.detailPanel.innerHTML=`<h3>${n.label}</h3><div class="detail-badges"><span>${state.data.cohortLabels[n.cohort]}</span><span>${state.data.categoryLabels[n.category]}</span><span>社群 ${n.community}</span>${n.dictionary?"<span>辞典校准</span>":""}</div>
  <div class="detail-grid"><div class="k">释义</div><div>${n.description}</div><div class="k">理论家</div><div>${n.theorists||"—"}</div><div class="k">英文／别名</div><div>${n.aliases||"—"}</div><div class="k">度数</div><div>${n.metrics.degree}（加权 ${n.metrics.weighted_degree}）</div><div class="k">介数</div><div>${n.metrics.betweenness}</div><div class="k">跨代邻居</div><div>${n.metrics.cross_cohort_neighbors}</div></div>
  <h3 style="margin-top:22px">直接关系</h3>${rels.map(r=>{const o=nodeMap.get(r.other),a=r.direction==="out"?"→":"←";return`<div class="neighbor-card" data-node="${o.id}"><b>${a} ${o.label}</b><br><span style="color:${colors.relation[r.relation_class]}">${state.data.relationClassLabels[r.relation_class]}</span> · ${r.relation}</div>`}).join("")}`;
  els.detailPanel.querySelectorAll("[data-node]").forEach(el=>el.onclick=()=>selectAndFocus(el.dataset.node));
}
document.addEventListener("DOMContentLoaded",init);
