window.__ModuleLoader__.load({ id: "dsh-plugin-store", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";var V=Object.create;var g=Object.defineProperty;var Y=Object.getOwnPropertyDescriptor;var q=Object.getOwnPropertyNames;var J=Object.getPrototypeOf,$=Object.prototype.hasOwnProperty;var Z=(t,s)=>{for(var a in s)g(t,a,{get:s[a],enumerable:!0})},R=(t,s,a,r)=>{if(s&&typeof s=="object"||typeof s=="function")for(let o of q(s))!$.call(t,o)&&o!==a&&g(t,o,{get:()=>s[o],enumerable:!(r=Y(s,o))||r.enumerable});return t};var Q=(t,s,a)=>(a=t!=null?V(J(t)):{},R(s||!t||!t.__esModule?g(a,"default",{value:t,enumerable:!0}):a,t)),K=t=>R(g({},"__esModule",{value:!0}),t);var le={};Z(le,{apply:()=>ne,inject:()=>ie});module.exports=K(le);var W=Object.freeze(["https://dsh.aitreez.com/catalog.json","https://raw.githubusercontent.com/ZASENJC/dsh-plugins-store/main/src/data/catalog.json"]),f=Object.freeze({all:"\u5168\u90E8\u5206\u7C7B",ui:"\u754C\u9762\u4F53\u9A8C",development:"\u5F00\u53D1\u5DE5\u5177",data:"\u6570\u636E\u77E5\u8BC6",other:"\u5176\u4ED6","agent-session":"Agent \u4E0E\u4F1A\u8BDD",lifestyle:"\u751F\u6D3B\u5A31\u4E50",security:"\u5B89\u5168",operations:"\u8FD0\u7EF4",research:"\u7814\u7A76","model-mcp":"\u6A21\u578B\u4E0E MCP",communication:"\u6D88\u606F\u901A\u8BAF"}),j=Object.freeze({plugin:"\u63D2\u4EF6",application:"\u5E94\u7528",skill:"\u6280\u80FD",unknown:"\u5F85\u8BC6\u522B",directory:"\u76EE\u5F55",collection:"\u63D2\u4EF6\u5408\u96C6",infrastructure:"\u57FA\u7840\u8BBE\u65BD",channel:"\u6E20\u9053\u9002\u914D"}),X=new Set(["plugin","skill","collection","channel"]);function E(t){return X.has(t.projectType)?`dsh plugin --profile web add github:${t.fullName}`:null}function ee(t){return[t.name,t.fullName,t.description,...t.topics??[]].join(" ").toLocaleLowerCase()}function te(t,s){let a=Number(t.verified)*2+Number(t.awesomeListed);return Number(s.verified)*2+Number(s.awesomeListed)-a||s.stars-t.stars||t.fullName.localeCompare(s.fullName)}function O(t,s){let a=s.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return[...t.filter(o=>{if(s.category!=="all"&&o.category!==s.category||s.verifiedOnly&&!o.verified)return!1;if(a.length===0)return!0;let l=ee(o);return a.every(d=>l.includes(d))})].sort((o,l)=>s.sort==="stars"?l.stars-o.stars||o.fullName.localeCompare(l.fullName):s.sort==="updated"?Date.parse(l.pushedAt)-Date.parse(o.pushedAt)||o.fullName.localeCompare(l.fullName):s.sort==="name"?o.name.localeCompare(l.name)||o.fullName.localeCompare(l.fullName):te(o,l))}function L(t){return new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:1}).format(t)}function se(t){if(t===null||typeof t!="object"||t.schemaVersion!==1||!Array.isArray(t.repositories))throw new Error("\u76EE\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548");return t}var b=class{constructor({fetcher:s=globalThis.fetch?.bind(globalThis),urls:a=W}={}){if(typeof s!="function")throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76EE\u5F55\u8BF7\u6C42");this.fetcher=s,this.urls=[...a],this.listeners=new Set,this.pending=null,this.snapshot=Object.freeze({status:"idle",catalog:null,error:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));load({force:s=!1}={}){return!s&&this.snapshot.status==="ready"?Promise.resolve():this.pending!==null?this.pending:(this.publish({status:"loading",catalog:this.snapshot.catalog,error:null}),this.pending=this.fetchCatalog().then(a=>{this.publish({status:"ready",catalog:a,error:null})}).catch(a=>{this.publish({status:"error",catalog:this.snapshot.catalog,error:a instanceof Error?a.message:String(a)})}).finally(()=>{this.pending=null}),this.pending)}async fetchCatalog(){let s=new Error("\u6CA1\u6709\u53EF\u7528\u7684\u76EE\u5F55\u6570\u636E\u6E90");for(let a of this.urls)try{let r=await this.fetcher(a,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`\u76EE\u5F55\u8BF7\u6C42\u5931\u8D25 (${r.status})`);return se(await r.json())}catch(r){s=r instanceof Error?r:new Error(String(r))}throw s}publish(s){this.snapshot=Object.freeze(s);for(let a of this.listeners)a()}};var e=Q(require("react"),1),n=require("@deepseek-ai/dsh-client-ui-primitives");var w=24;function ae({repository:t,copied:s,onCopy:a,t:r}){let o=E(t),l=`https://dsh.aitreez.com/plugins/${t.repositoryId}`;return e.createElement("article",{className:"dps-card"},e.createElement("div",{className:"dps-card-head"},e.createElement("div",{className:"dps-card-title"},e.createElement("h3",{title:t.name},t.name)),e.createElement("span",{className:"dps-stars"},r("store.stars",{count:L(t.stars)}))),e.createElement("p",{className:"dps-card-repo",title:t.fullName},t.fullName),e.createElement("p",{className:"dps-card-description"},t.description),e.createElement("div",{className:"dps-badges"},t.verified&&e.createElement("span",{className:"dps-badge","data-kind":"verified"},r("store.verified")),t.awesomeListed&&e.createElement("span",{className:"dps-badge","data-kind":"awesome"},r("store.awesome")),e.createElement("span",{className:"dps-badge"},f[t.category]??f.other),e.createElement("span",{className:"dps-badge"},j[t.projectType]??t.projectType)),e.createElement("div",{className:"dps-card-foot"},e.createElement("div",{className:"dps-install-reference"},e.createElement(n.IconCordisPluginOutline14,{size:14}),e.createElement("code",{title:o??r("store.topicListed")},o??r("store.topicListed"))),e.createElement("div",{className:"dps-card-actions"},o!==null&&e.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>a(t.repositoryId,o),"aria-label":r(s?"store.copied":"store.copyInstall"),title:r(s?"store.copied":"store.copyInstall")},s?e.createElement(n.IconCheckOutline16,{size:16}):e.createElement(n.IconCopyOutline16,{size:16})),e.createElement("a",{className:"dps-icon-button",href:l,target:"_blank",rel:"noreferrer","aria-label":r("store.openDetails"),title:r("store.openDetails")},e.createElement(n.IconCordisPluginOutline14,{size:14})),e.createElement("a",{className:"dps-icon-button",href:t.url,target:"_blank",rel:"noreferrer","aria-label":r("store.openRepository"),title:r("store.openRepository")},e.createElement(n.IconRightUpOutline16,{size:16})))))}function A({catalogStore:t,mode:s,t:a}){let r=e.useSyncExternalStore(t.subscribe,t.getSnapshot),[o,l]=e.useState(""),[d,M]=e.useState("all"),[c,B]=e.useState("recommended"),[u,F]=e.useState(!1),[U,y]=e.useState(w),[G,N]=e.useState(null);e.useEffect(()=>{t.load()},[t]),e.useEffect(()=>{y(w)},[o,d,c,u]);let S=r.catalog?.repositories??[],m=e.useMemo(()=>O(S,{query:o,category:d,sort:c,verifiedOnly:u}),[S,o,d,c,u]),h=m.slice(0,U),C=r.catalog?.generatedAt?new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(r.catalog.generatedAt)):null,H=async(i,v)=>{await(0,n.writeClipboard)(v)&&(N(i),window.setTimeout(()=>N(z=>z===i?null:z),1600))},k=()=>t.load({force:!0});return e.createElement("section",{className:"dps-store","data-mode":s,"aria-label":a("header.title")},e.createElement("div",{className:"dps-store-head"},e.createElement("div",{className:"dps-store-meta"},e.createElement("p",null,a("store.results",{visible:h.length,total:m.length})),C&&e.createElement("p",null,a("store.updated",{date:C})),e.createElement("p",{className:"dps-disclaimer"},a("store.disclaimer"))),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:k,"aria-label":a("store.refresh"),title:a("store.refresh"),disabled:r.status==="loading"},e.createElement(n.IconRefreshOutline16,{size:16}))),e.createElement("div",{className:"dps-filter-bar"},e.createElement("label",{className:"dps-filter dps-filter-search"},e.createElement("input",{type:"search",value:o,onChange:i=>l(i.target.value),placeholder:a("store.search"),"aria-label":a("store.search")})),e.createElement("label",{className:"dps-filter"},e.createElement("select",{value:d,onChange:i=>M(i.target.value),"aria-label":a("store.category")},Object.entries(f).map(([i,v])=>e.createElement("option",{key:i,value:i},v)))),e.createElement("label",{className:"dps-filter"},e.createElement("select",{value:c,onChange:i=>B(i.target.value),"aria-label":a("store.sort")},e.createElement("option",{value:"recommended"},a("store.sortRecommended")),e.createElement("option",{value:"stars"},a("store.sortStars")),e.createElement("option",{value:"updated"},a("store.sortUpdated")),e.createElement("option",{value:"name"},a("store.sortName")))),e.createElement("label",{className:"dps-check"},e.createElement("input",{type:"checkbox",checked:u,onChange:i=>F(i.target.checked)}),e.createElement("span",null,a("store.verifiedOnly")))),e.createElement("div",{className:"dps-catalog-scroll"},r.status==="loading"&&r.catalog===null&&e.createElement("div",{className:"dps-loading",role:"status"},a("store.loading")),r.status==="error"&&r.catalog===null&&e.createElement("div",{className:"dps-error",role:"alert"},e.createElement("div",null,e.createElement("strong",null,a("store.loadFailed")),e.createElement("p",{className:"dps-status"},r.error)),e.createElement("button",{className:"dps-retry",type:"button",onClick:k},a("store.retry"))),r.catalog!==null&&m.length===0&&e.createElement("div",{className:"dps-empty"},a("store.empty")),h.length>0&&e.createElement(e.Fragment,null,e.createElement("div",{className:"dps-grid"},h.map(i=>e.createElement(ae,{key:i.repositoryId,repository:i,copied:G===i.repositoryId,onCopy:H,t:a}))),h.length<m.length&&e.createElement("button",{className:"dps-load-more",type:"button",onClick:()=>y(i=>i+w)},a("store.loadMore")))))}function re({catalogStore:t,dialogController:s,open:a,sessionId:r,t:o}){return e.createElement(n.Modal,{open:a,onClose:()=>s.close(r),title:o("header.title"),closeLabel:o("dialog.close"),className:"dps-modal",headless:!0},e.createElement("div",{className:"dps-modal-shell"},e.createElement("header",{className:"dps-modal-header"},e.createElement("h2",null,o("header.title")),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>s.close(r),"aria-label":o("dialog.close"),title:o("dialog.close")},e.createElement(n.IconCloseOutline16,{size:16}))),e.createElement(A,{catalogStore:t,mode:"dialog",t:o})))}function T({sessionId:t,dialogController:s,catalogStore:a,t:r}){let l=e.useSyncExternalStore(s.subscribe,s.getSnapshot).bySession[String(t)]??!1;return e.createElement(e.Fragment,null,e.createElement("button",{className:"dps-header-button",type:"button",onClick:()=>s.open(t),"aria-label":r("header.open"),title:r("header.open")},e.createElement(n.IconCordisPluginOutline14,{size:16})),e.createElement(re,{catalogStore:a,dialogController:s,open:l,sessionId:t,t:r}))}function I({catalogStore:t,t:s}){return e.createElement(A,{catalogStore:t,mode:"settings",t:s})}var x=class{constructor(){this.listeners=new Set,this.snapshot=Object.freeze({bySession:Object.freeze({})})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));open(s){this.set(s,!0)}close(s){this.set(s,!1)}set(s,a){let r=String(s);if((this.snapshot.bySession[r]??!1)!==a){this.snapshot=Object.freeze({bySession:Object.freeze({...this.snapshot.bySession,[r]:a})});for(let o of this.listeners)o()}}};var p="plugin-store",P={"header.open":"\u6253\u5F00\u63D2\u4EF6\u5546\u5E97","header.title":"DSH \u63D2\u4EF6\u5546\u5E97","dialog.close":"\u5173\u95ED\u63D2\u4EF6\u5546\u5E97","settings.tab":"\u63D2\u4EF6\u5546\u5E97","store.search":"\u641C\u7D22\u540D\u79F0\u3001\u4F5C\u8005\u3001\u63CF\u8FF0\u6216\u6807\u7B7E","store.category":"\u5206\u7C7B","store.sort":"\u6392\u5E8F","store.sortRecommended":"\u63A8\u8350","store.sortStars":"Star","store.sortUpdated":"\u6700\u8FD1\u66F4\u65B0","store.sortName":"\u540D\u79F0","store.verifiedOnly":"\u53EA\u770B\u5DF2\u9A8C\u8BC1","store.verified":"\u5DF2\u9A8C\u8BC1","store.awesome":"\u7CBE\u9009\u76EE\u5F55","store.topicListed":"Topic \u6536\u5F55","store.refresh":"\u5237\u65B0\u76EE\u5F55","store.loading":"\u6B63\u5728\u8F7D\u5165\u63D2\u4EF6\u76EE\u5F55...","store.loadFailed":"\u76EE\u5F55\u8F7D\u5165\u5931\u8D25","store.retry":"\u91CD\u8BD5","store.empty":"\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u7684\u9879\u76EE","store.results":"{visible} / {total} \u4E2A\u9879\u76EE","store.updated":"\u76EE\u5F55\u66F4\u65B0\u4E8E {date}","store.disclaimer":"\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u88C5\u3001\u517C\u5BB9\u6027\u3001\u5B89\u5168\u6027\u6216\u8D28\u91CF\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u3002","store.copyInstall":"\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.copied":"\u5DF2\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.openRepository":"\u6253\u5F00 GitHub \u4ED3\u5E93","store.openDetails":"\u6253\u5F00\u5546\u5E97\u8BE6\u60C5","store.loadMore":"\u52A0\u8F7D\u66F4\u591A","store.stars":"{count} Star"},D={"header.open":"Open plugin store","header.title":"DSH Plugin Store","dialog.close":"Close plugin store","settings.tab":"Plugin Store","store.search":"Search name, owner, description, or topic","store.category":"Category","store.sort":"Sort","store.sortRecommended":"Recommended","store.sortStars":"Stars","store.sortUpdated":"Recently updated","store.sortName":"Name","store.verifiedOnly":"Verified only","store.verified":"Verified","store.awesome":"Curated","store.topicListed":"Topic listed","store.refresh":"Refresh catalog","store.loading":"Loading plugin catalog...","store.loadFailed":"Could not load catalog","store.retry":"Retry","store.empty":"No projects match these filters","store.results":"{visible} / {total} projects","store.updated":"Catalog updated {date}","store.disclaimer":"Listing does not verify installation, compatibility, security, or quality.","store.copyInstall":"Copy install reference","store.copied":"Install reference copied","store.openRepository":"Open GitHub repository","store.openDetails":"Open store details","store.loadMore":"Load more","store.stars":"{count} stars"};var oe=String.raw`
.dps-header-button,
.dps-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 0;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
}

.dps-header-button {
  width: 30px;
  height: 30px;
  border-radius: 6px;
}

.dps-header-button:hover,
.dps-icon-button:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dps-header-button:focus-visible,
.dps-icon-button:focus-visible,
.dps-load-more:focus-visible,
.dps-retry:focus-visible,
.dps-filter input:focus-visible,
.dps-filter select:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l3);
  outline-offset: 1px;
}

.dps-modal {
  width: min(1040px, calc(100vw - 32px));
  max-width: none;
  height: min(760px, calc(100vh - 32px));
  padding: 0;
  overflow: hidden;
}

.dps-modal-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
}

.dps-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 0 18px 0 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.dps-modal-header h2 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0;
}

.dps-store {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 18px 22px 22px;
  color: var(--dsw-alias-label-primary);
}

.dps-store[data-mode='settings'] {
  min-height: min(680px, calc(100vh - 160px));
  padding: 4px 0 20px;
}

.dps-store-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dps-store-meta {
  min-width: 0;
}

.dps-store-meta p,
.dps-disclaimer,
.dps-status,
.dps-result-count {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
}

.dps-store-meta p:first-child {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}

.dps-icon-button {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.dps-filter-bar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 150px 140px auto;
  gap: 8px;
  align-items: center;
}

.dps-filter {
  min-width: 0;
}

.dps-filter input,
.dps-filter select {
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  padding: 0 10px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
  font-size: 13px;
  letter-spacing: 0;
}

.dps-check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.dps-check input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #4f9f75;
}

.dps-catalog-scroll {
  min-width: 0;
  min-height: 0;
  padding-right: 4px;
  overflow-y: auto;
}

.dps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dps-card {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 174px;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
}

.dps-card-head,
.dps-card-foot,
.dps-card-title,
.dps-badges,
.dps-card-actions,
.dps-install-reference {
  display: flex;
  align-items: center;
}

.dps-card-head,
.dps-card-foot {
  justify-content: space-between;
  gap: 10px;
}

.dps-card-title {
  min-width: 0;
  gap: 8px;
}

.dps-card-title h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-repo {
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dps-badges {
  flex-wrap: wrap;
  gap: 5px;
}

.dps-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  box-sizing: border-box;
  border-radius: 999px;
  padding: 1px 7px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}

.dps-badge[data-kind='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='awesome'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
}

.dps-stars {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.dps-install-reference {
  min-width: 0;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
}

.dps-install-reference code {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-actions {
  flex: 0 0 auto;
  gap: 2px;
}

.dps-card-actions a {
  text-decoration: none;
}

.dps-empty,
.dps-error,
.dps-loading {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}

.dps-error {
  gap: 10px;
}

.dps-retry,
.dps-load-more {
  min-height: 32px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  padding: 0 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dps-load-more {
  display: block;
  margin: 12px auto 2px;
}

@media (max-width: 760px) {
  .dps-modal {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
  }

  .dps-store {
    padding: 14px 12px 16px;
  }

  .dps-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .dps-filter-search {
    grid-column: 1 / -1;
  }

  .dps-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dps-header-button,
  .dps-icon-button,
  .dps-retry,
  .dps-load-more {
    transition: none;
  }
}
`;function _(){let t="dsh-plugin-store-styles";if(document.getElementById(t)!==null)return()=>{};let a=document.createElement("style");return a.id=t,a.textContent=oe,document.head.append(a),()=>a.remove()}var ie=["slots","locale"];function ne(t){let s=new b,a=new x,r=t.locale.bind(p);t.effect(()=>t.locale.register(p,{zh:P,en:D}),"plugin-store: dictionaries"),t.effect(()=>_(),"plugin-store: styles"),t.on("command/executed",(o,l,d)=>{l==="store"&&d.kind==="success"&&a.open(o)}),t.slots.inject("conversation.session.header.utilities",()=>t.slots.register({name:"conversation.session.header.utilities",id:"plugin-store",order:40,locale:p,inject:()=>({catalogStore:s,dialogController:a})},T)),t.slots.inject("settings.plugins.tab",()=>t.slots.register({name:"settings.plugins.tab",id:"plugin-store",order:20,label:()=>r("settings.tab"),locale:p,inject:()=>({catalogStore:s})},I))}

return module.exports; } });
