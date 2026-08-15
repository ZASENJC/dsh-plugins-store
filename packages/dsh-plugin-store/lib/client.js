window.__ModuleLoader__.load({ id: "dsh-plugin-store", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";var ce=Object.create;var R=Object.defineProperty;var pe=Object.getOwnPropertyDescriptor;var ue=Object.getOwnPropertyNames;var ge=Object.getPrototypeOf,me=Object.prototype.hasOwnProperty;var he=(e,s)=>{for(var a in s)R(e,a,{get:s[a],enumerable:!0})},q=(e,s,a,n)=>{if(s&&typeof s=="object"||typeof s=="function")for(let r of ue(s))!me.call(e,r)&&r!==a&&R(e,r,{get:()=>s[r],enumerable:!(n=pe(s,r))||n.enumerable});return e};var fe=(e,s,a)=>(a=e!=null?ce(ge(e)):{},q(s||!e||!e.__esModule?R(a,"default",{value:e,enumerable:!0}):a,e)),be=e=>q(R({},"__esModule",{value:!0}),e);var Ge={};he(Ge,{apply:()=>He,inject:()=>$e});module.exports=be(Ge);var B=Object.freeze(["https://dsh.aitreez.com/catalog.json"]),L=Object.freeze({all:"\u5168\u90E8\u5206\u7C7B",ui:"\u754C\u9762\u4F53\u9A8C",development:"\u5F00\u53D1\u5DE5\u5177",data:"\u6570\u636E\u77E5\u8BC6",other:"\u5176\u4ED6","agent-session":"Agent \u4E0E\u4F1A\u8BDD",lifestyle:"\u751F\u6D3B\u5A31\u4E50",security:"\u5B89\u5168",operations:"\u8FD0\u7EF4",research:"\u7814\u7A76","model-mcp":"\u6A21\u578B\u4E0E MCP",communication:"\u6D88\u606F\u901A\u8BAF"}),U=Object.freeze({plugin:"\u63D2\u4EF6",application:"\u5E94\u7528",skill:"\u6280\u80FD",unknown:"\u5F85\u8BC6\u522B",directory:"\u76EE\u5F55",collection:"\u63D2\u4EF6\u5408\u96C6",infrastructure:"\u57FA\u7840\u8BBE\u65BD",channel:"\u6E20\u9053\u9002\u914D"}),Z=Object.freeze(["unrecognized","check-pending","check-running","check-failed","sandbox-pending","sandbox-running","sandbox-failed","verified","security-review","expired","recorded","inconclusive","not-applicable"]),ve=new Set(["plugin","skill","collection","channel"]),xe=/^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/,we=/^github:([^#]+)(?:#([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}))?$/i,ye=/^[a-f0-9]{40}$/i,ke=/^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})(?:@[A-Za-z0-9^~<>=*+._-][A-Za-z0-9^~<>=*+._-]{0,127})?$/;function V(e){return!ve.has(e.projectType)||e.install?.status!=="recognized"?null:e.install.candidate??null}function P(e){let s=z(e);if(s!==null)return s.command;let a=V(e);return typeof a?.command=="string"?a.command:null}function Se(e){return!Array.isArray(e?.args)||e.args.length!==5||e.args[0]!=="plugin"||e.args[1]!=="--profile"||e.args[2]!=="web"||e.args[3]!=="add"||typeof e.args[4]!="string"?null:[...e.args]}function Ne(e){let s=V(e);if(s===null||s.executable!==!0||!Array.isArray(s.args)||typeof s.target!="string"||typeof e.fullName!="string")return null;let a=String(e.validation?.sourceSha??"");if(e.validation?.overall==="verified"&&!ye.test(a))return null;let n=Se(s);if(n===null)return null;if(s.source==="github"){let r=we.exec(n[4]);if(!r||!xe.test(r[1])||r[1].toLowerCase()!==String(e.fullName).toLowerCase()||s.target.toLowerCase()!==e.fullName.toLowerCase()||e.validation?.overall==="verified"&&r[2]?.toLowerCase()!==a.toLowerCase())return null}else if(s.source==="npm"){let r=n[4].startsWith("npm:")?n[4].slice(4):n[4];if(!ke.test(r)||r!==s.target)return null}else return null;return{source:s.source,target:s.target,command:s.source==="github"?`dsh plugin --profile web add ${n[4]}`:s.command,args:n,executable:!0}}function z(e){return Ne(e)}function ze(e){return[e.name,e.fullName,e.description,...e.topics??[]].join(" ").toLocaleLowerCase()}function Ae(e,s){let a=Number(e.verified)*2;return Number(s.verified)*2-a||s.stars-e.stars||e.fullName.localeCompare(s.fullName)}function W(e,s){let a=s.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return[...e.filter(r=>{if(s.category!=="all"&&r.category!==s.category||s.validation&&s.validation!=="all"&&r.validation?.overall!==s.validation)return!1;let i=r.validation?r.validation.overall==="verified":r.verified;if(s.verifiedOnly&&!i)return!1;if(a.length===0)return!0;let o=ze(r);return a.every(c=>o.includes(c))})].sort((r,i)=>s.sort==="stars"?i.stars-r.stars||r.fullName.localeCompare(i.fullName):s.sort==="updated"?Date.parse(i.pushedAt)-Date.parse(r.pushedAt)||r.fullName.localeCompare(i.fullName):s.sort==="name"?r.name.localeCompare(i.name)||r.fullName.localeCompare(i.fullName):Ae(r,i))}function Y(e){return new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:1}).format(e)}function Ie(e){if(e===null||typeof e!="object"||e.schemaVersion!==1||!Array.isArray(e.repositories))throw new Error("\u76EE\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548");return e}var E=class{constructor({fetcher:s=globalThis.fetch?.bind(globalThis),urls:a=B}={}){if(typeof s!="function")throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76EE\u5F55\u8BF7\u6C42");this.fetcher=s,this.url=a[0]??B[0],this.listeners=new Set,this.pending=null,this.snapshot=Object.freeze({status:"idle",catalog:null,error:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));load({force:s=!1}={}){return!s&&this.snapshot.status==="ready"?Promise.resolve():this.pending!==null?this.pending:(this.publish({status:"loading",catalog:this.snapshot.catalog,error:null}),this.pending=this.fetchCatalog().then(a=>{this.publish({status:"ready",catalog:a,error:null})}).catch(a=>{this.publish({status:"error",catalog:this.snapshot.catalog,error:a instanceof Error?a.message:String(a)})}).finally(()=>{this.pending=null}),this.pending)}async fetchCatalog(){let s=await this.fetcher(this.url,{headers:{Accept:"application/json"}});if(!s.ok)throw new Error(`\u76EE\u5F55\u8BF7\u6C42\u5931\u8D25 (${s.status})`);return Ie(await s.json())}publish(s){this.snapshot=Object.freeze(s);for(let a of this.listeners)a()}};var t=fe(require("react"),1),d=require("@deepseek-ai/dsh-client-ui-primitives");function Ce(e){return String(e??"\u672A\u77E5\u5B89\u88C5\u9519\u8BEF").replace(/authorization\s*:\s*bearer\s+[^\s\n]+/gi,"Authorization: Bearer [\u5DF2\u9690\u85CF]").replace(/(access[_-]?token|refresh[_-]?token|api[_-]?key|password)\s*[:=]\s*[^\s\n]+/gi,"$1=[\u5DF2\u9690\u85CF]").slice(-3200)}function Te({fullName:e,install:s,error:a}){let n=typeof s?.command=="string"?s.command:"\u672A\u77E5\u5B89\u88C5\u53C2\u8003",r=s?.source==="npm"?"npm \u5305":s?.source==="github"?"GitHub \u4ED3\u5E93":"README \u547D\u4EE4";return["\u63D2\u4EF6\u4E00\u952E\u5B89\u88C5\u5931\u8D25\uFF0C\u8BF7\u4F5C\u4E3A AGENT \u5206\u6790\u539F\u56E0\u5E76\u7ED9\u51FA\u53EF\u6267\u884C\u7684\u89E3\u51B3\u65B9\u6848\u3002",`\u4ED3\u5E93\uFF1A${e}`,`\u5B89\u88C5\u6765\u6E90\uFF1A${r}`,`\u5B89\u88C5\u53C2\u8003\uFF1A${n}`,`\u9519\u8BEF\u4FE1\u606F\uFF1A${Ce(a)}`,"\u8BF7\u5148\u5224\u65AD\u662F DSH \u73AF\u5883\u3001\u7F51\u7EDC\u3001\u4F9D\u8D56\u8FD8\u662F\u63D2\u4EF6\u672C\u8EAB\u7684\u95EE\u9898\uFF1B\u4E0D\u8981\u76F4\u63A5\u6267\u884C\u7B2C\u4E09\u65B9\u4EE3\u7801\u3002"].join(`
`)}function $(e){return e?.list?.getSnapshot?.().current}function Re(e,s){let a=$(e);return a&&a!==s?Promise.resolve(a):typeof e?.list?.subscribe!="function"?Promise.reject(new Error("\u65E0\u6CD5\u786E\u8BA4\u65B0\u5EFA\u7684 DSH \u4F1A\u8BDD")):new Promise((n,r)=>{let i=!1,o=()=>{},c,p=(u,m)=>{i||(i=!0,o(),clearTimeout(c),u(m))};o=e.list.subscribe(()=>{let u=$(e);u&&u!==s&&p(n,u)}),c=setTimeout(()=>p(r,new Error("\u65B0\u5EFA DSH \u4F1A\u8BDD\u8D85\u65F6")),5e3)})}async function Ee(e,s){let a=$(e);if(typeof e?.create=="function"){let o=await e.create({});return e.open?.(o),o}if(typeof s?.startSession!="function")throw new Error("\u5F53\u524D DSH \u672A\u63D0\u4F9B\u65B0\u5EFA\u4F1A\u8BDD\u80FD\u529B");let n=await s.startSession(),r=typeof n=="string"?n:n?.id;if(typeof r=="string"&&r.length>0)return e.open?.(r),r;let i=await Re(e,a);return e.open?.(i),i}async function J({sessions:e,workspaces:s,fullName:a,install:n,error:r}){let i=await Ee(e,s),o=e?.binding?.(i)?.session;if(typeof o?.prompt!="function")throw new Error("\u65B0\u5EFA\u4F1A\u8BDD\u5C1A\u672A\u51C6\u5907\u597D\u63A5\u6536\u6D88\u606F");let c=await o.prompt([{type:"text",text:Te({fullName:a,install:n,error:r})}],"queue");if(c?.ok===!1)throw new Error(c.error?.message??"AGENT \u6D88\u606F\u53D1\u9001\u5931\u8D25");return i}var H=24;function Le(e,s){let a=typeof e=="string"?e:e?.repositoryId;if(typeof a!="string")return null;let n=s.find(r=>String(r.id??`github:${r.repositoryId}`)===a);return n!==void 0&&z(n)!==null?n:null}function Oe({repository:e,copied:s,installed:a,onCopy:n,onInstall:r,t:i}){let o=P(e),c=z(e),p=`https://dsh.aitreez.com/plugins/${e.repositoryId}`,u=e.validation?.overall??(e.verified?"recorded":"check-pending"),m=e.validation?.reason;return t.createElement("article",{className:"dps-card"},t.createElement("a",{className:"dps-card-link",href:p,target:"_blank",rel:"noreferrer","aria-label":`${i("store.openDetails")}: ${e.fullName}`,title:i("store.openDetails")}),t.createElement("div",{className:"dps-card-head"},t.createElement("div",{className:"dps-card-title"},t.createElement("h3",{title:e.name},e.name)),t.createElement("span",{className:"dps-stars"},i("store.stars",{count:Y(e.stars)}))),t.createElement("p",{className:"dps-card-repo",title:e.fullName},e.fullName),t.createElement("p",{className:"dps-card-description"},e.description),m&&(u==="expired"||u==="security-review")&&t.createElement("p",{className:"dps-validation-reason"},m),t.createElement("div",{className:"dps-badges"},t.createElement("span",{className:"dps-badge","data-kind":"validation","data-status":u},i(`store.validation.${u}`)),t.createElement("span",{className:"dps-badge"},L[e.category]??L.other),t.createElement("span",{className:"dps-badge"},U[e.projectType]??e.projectType)),t.createElement("div",{className:"dps-card-foot"},t.createElement("div",{className:"dps-install-reference"},t.createElement(d.IconCordisPluginOutline14,{size:14}),t.createElement("code",{title:o??i("store.topicListed")},o??i("store.topicListed"))),o!==null&&t.createElement("div",{className:"dps-card-actions"},c!==null&&t.createElement(d.Button,{className:"dps-install-button",size:"sm",variant:"outline",type:"button",disabled:a,onClick:()=>r(e)},a?t.createElement(d.IconCheckOutline16,{size:14}):t.createElement(d.IconDownloadOutline16,{size:14}),t.createElement("span",null,i(a?"store.installed":"store.install"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>n(e.repositoryId,o),"aria-label":i(s?"store.copied":"store.copyInstall"),title:i(s?"store.copied":"store.copyInstall")},s?t.createElement(d.IconCheckOutline16,{size:16}):t.createElement(d.IconCopyOutline16,{size:16})))))}function _e({target:e,onClose:s,onInstalled:a,sessions:n,workspaces:r,t:i}){let[o,c]=t.useState(!1),[p,u]=t.useState("idle"),[m,v]=t.useState(""),[h,w]=t.useState("idle");t.useEffect(()=>{c(!1),u("idle"),v(""),w("idle")},[e?.repositoryId]);let f=e===null?null:z(e),_=f?.command??(e===null?"":P(e)),x=p==="success",y=()=>{p!=="installing"&&s()},j=async()=>{if(!(e===null||!o||p==="installing")&&f!==null){u("installing"),v("");try{let g=await fetch("/api/dsh-plugin-store/install",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({repositoryId:e.id??`github:${e.repositoryId}`,install:f})}),b=await g.json().catch(()=>({}));if(!g.ok||b.ok!==!0)throw new Error(b.message??`${i("store.installFailed")} (${g.status})`);u("success"),v(b.output??""),a(e.repositoryId)}catch(g){u("error"),v(g instanceof Error?g.message:String(g))}}},A=async()=>{if(!(e===null||p!=="error"||h==="sending"||h==="sent")){w("sending");try{await J({sessions:n,workspaces:r,fullName:e.fullName,install:f,error:m}),w("sent")}catch(g){w("error"),v(b=>`${b}
${g instanceof Error?g.message:String(g)}`)}}};return t.createElement(d.Modal,{open:e!==null,onClose:y,title:i("store.riskTitle"),closeLabel:i("store.cancel"),className:"dps-risk-modal",headless:!0},e!==null&&t.createElement("div",{className:"dps-risk-shell"},t.createElement("header",{className:"dps-risk-header"},t.createElement("div",{className:"dps-risk-title"},t.createElement(d.IconWarningOutline16,{size:18}),t.createElement("h2",null,i("store.riskTitle"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:y,disabled:p==="installing","aria-label":i("store.cancel"),title:i("store.cancel")},t.createElement(d.IconCloseOutline16,{size:16}))),t.createElement("div",{className:"dps-risk-body"},t.createElement("strong",null,i("store.riskLead")),t.createElement("p",null,i("store.riskDetail")),t.createElement("div",{className:"dps-risk-repository"},t.createElement("span",null,e.fullName),t.createElement("code",null,_)),!x&&t.createElement("label",{className:"dps-risk-acknowledge"},t.createElement("input",{type:"checkbox",checked:o,disabled:p==="installing",onChange:g=>c(g.target.checked)}),t.createElement("span",null,i("store.riskAcknowledge"))),p==="installing"&&t.createElement("p",{className:"dps-install-status",role:"status"},i("store.installing")),p==="success"&&t.createElement("p",{className:"dps-install-status","data-kind":"success",role:"status"},i("store.installSuccess")),p==="error"&&t.createElement("p",{className:"dps-install-status","data-kind":"error",role:"alert"},t.createElement("strong",null,i("store.installFailed")),t.createElement("span",null,m)),p==="error"&&t.createElement("p",{className:"dps-install-analysis",role:"status"},i(h==="sent"?"store.analyzeSent":h==="sending"?"store.analyzing":h==="error"?"store.analyzeFailed":"store.analyzeHint")),p==="success"&&m&&t.createElement("pre",{className:"dps-install-output"},m)),t.createElement("footer",{className:"dps-risk-actions"},x?t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",onClick:y},i("store.done")):t.createElement(t.Fragment,null,t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",disabled:p==="installing",onClick:y},i("store.cancel")),p==="error"&&t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",disabled:h==="sending"||h==="sent",onClick:A},i(h==="sent"?"store.analyzeSent":"store.analyzeWithAgent")),t.createElement(d.Button,{size:"sm",variant:"primary",type:"button",disabled:!o||f===null||p==="installing",onClick:j},i(p==="installing"?"store.installing":"store.confirmInstall"))))))}function X({catalogStore:e,mode:s,requestedInstallTarget:a=null,onInstallRequestConsumed:n,sessions:r,workspaces:i,t:o}){let c=t.useSyncExternalStore(e.subscribe,e.getSnapshot),[p,u]=t.useState(""),[m,v]=t.useState("all"),[h,w]=t.useState("all"),[f,_]=t.useState("recommended"),[x,y]=t.useState(!1),[j,A]=t.useState(H),[g,b]=t.useState(null),[re,D]=t.useState(null),[oe,ne]=t.useState(()=>new Set);t.useEffect(()=>{e.load()},[e]),t.useEffect(()=>{A(H)},[p,m,h,f,x]);let I=c.catalog?.repositories??[];t.useEffect(()=>{let l=Le(a,I);l!==null&&D(l)},[a,I]);let C=t.useMemo(()=>W(I,{query:p,category:m,validation:h,sort:f,verifiedOnly:x}),[I,p,m,h,f,x]),T=C.slice(0,j),G=c.catalog?.generatedAt?new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(c.catalog.generatedAt)):null,le=async(l,N)=>{await(0,d.writeClipboard)(N)&&(b(l),window.setTimeout(()=>b(F=>F===l?null:F),1600))},M=()=>e.load({force:!0}),de=()=>{D(null),n?.()};return t.createElement(t.Fragment,null,t.createElement("section",{className:"dps-store","data-mode":s,"aria-label":o("header.title")},t.createElement("div",{className:"dps-store-head"},t.createElement("div",{className:"dps-store-meta"},t.createElement("p",null,o("store.results",{visible:T.length,total:C.length})),G&&t.createElement("p",null,o("store.updated",{date:G})),t.createElement("p",{className:"dps-disclaimer"},o("store.disclaimer"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:M,"aria-label":o("store.refresh"),title:o("store.refresh"),disabled:c.status==="loading"},t.createElement(d.IconRefreshOutline16,{size:16}))),t.createElement("div",{className:"dps-filter-bar"},t.createElement("label",{className:"dps-filter dps-filter-search"},t.createElement("input",{type:"search",value:p,onChange:l=>u(l.target.value),placeholder:o("store.search"),"aria-label":o("store.search")})),t.createElement("label",{className:"dps-filter"},t.createElement("select",{value:h,onChange:l=>w(l.target.value),"aria-label":o("store.validation")},t.createElement("option",{value:"all"},o("store.validation.all")),Z.map(l=>t.createElement("option",{key:l,value:l},o(`store.validation.${l}`))))),t.createElement("label",{className:"dps-filter"},t.createElement("select",{value:m,onChange:l=>v(l.target.value),"aria-label":o("store.category")},Object.entries(L).map(([l,N])=>t.createElement("option",{key:l,value:l},N)))),t.createElement("label",{className:"dps-filter"},t.createElement("select",{value:f,onChange:l=>_(l.target.value),"aria-label":o("store.sort")},t.createElement("option",{value:"recommended"},o("store.sortRecommended")),t.createElement("option",{value:"stars"},o("store.sortStars")),t.createElement("option",{value:"updated"},o("store.sortUpdated")),t.createElement("option",{value:"name"},o("store.sortName")))),t.createElement("label",{className:"dps-check"},t.createElement("input",{type:"checkbox",checked:x,onChange:l=>y(l.target.checked)}),t.createElement("span",null,o("store.verifiedOnly")))),t.createElement("div",{className:"dps-catalog-scroll"},c.status==="loading"&&c.catalog===null&&t.createElement("div",{className:"dps-loading",role:"status"},o("store.loading")),c.status==="error"&&c.catalog===null&&t.createElement("div",{className:"dps-error",role:"alert"},t.createElement("div",null,t.createElement("strong",null,o("store.loadFailed")),t.createElement("p",{className:"dps-status"},c.error)),t.createElement("button",{className:"dps-retry",type:"button",onClick:M},o("store.retry"))),c.catalog!==null&&C.length===0&&t.createElement("div",{className:"dps-empty"},o("store.empty")),T.length>0&&t.createElement(t.Fragment,null,t.createElement("div",{className:"dps-grid"},T.map(l=>t.createElement(Oe,{key:l.repositoryId,repository:l,copied:g===l.repositoryId,installed:oe.has(l.repositoryId),onCopy:le,onInstall:D,t:o}))),T.length<C.length&&t.createElement("button",{className:"dps-load-more",type:"button",onClick:()=>A(l=>l+H)},o("store.loadMore"))))),t.createElement(_e,{target:re,onClose:de,onInstalled:l=>ne(N=>new Set(N).add(l)),sessions:r,workspaces:i,t:o}))}function je({catalogStore:e,dialogController:s,open:a,installRequest:n,sessions:r,workspaces:i,t:o}){return t.createElement(d.Modal,{open:a,onClose:()=>s.close(),title:o("header.title"),closeLabel:o("dialog.close"),className:"dps-modal",headless:!0},t.createElement("div",{className:"dps-modal-shell"},t.createElement("header",{className:"dps-modal-header"},t.createElement("h2",null,o("header.title")),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>s.close(),"aria-label":o("dialog.close"),title:o("dialog.close")},t.createElement(d.IconCloseOutline16,{size:16}))),t.createElement(X,{catalogStore:e,mode:"dialog",requestedInstallTarget:n,onInstallRequestConsumed:s.consumeInstallRequest,sessions:r,workspaces:i,t:o})))}function K({dialogController:e,catalogStore:s,sessions:a,workspaces:n,t:r}){let i=t.useSyncExternalStore(e.subscribe,e.getSnapshot);return t.createElement(je,{catalogStore:s,dialogController:e,open:i.open,installRequest:i.installRequest,sessions:a,workspaces:n,t:r})}function Q({dialogController:e,t:s}){return t.createElement("button",{className:"dps-header-button",type:"button",onClick:()=>e.open(),"aria-label":s("header.open"),title:s("header.open")},t.createElement(d.IconCordisPluginOutline14,{size:16}))}function ee({catalogStore:e,sessions:s,workspaces:a,t:n}){return t.createElement(X,{catalogStore:e,mode:"settings",sessions:s,workspaces:a,t:n})}var O=class{constructor(){this.listeners=new Set,this.snapshot=Object.freeze({open:!1,installRequest:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));open(){this.set({open:!0})}openInstall(s){this.set({open:!0,installRequest:s})}consumeInstallRequest=()=>{this.set({installRequest:null})};close(){this.set({open:!1,installRequest:null})}set(s){let a={...this.snapshot,...s};if(!(this.snapshot.open===a.open&&this.snapshot.installRequest===a.installRequest)){this.snapshot=Object.freeze(a);for(let n of this.listeners)n()}}};var k="dsh-plugin-id",De=/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$/;function te({href:e=globalThis.location?.href,historyState:s=globalThis.history?.state,replaceState:a=globalThis.history?.replaceState?.bind(globalThis.history)}={}){if(typeof e!="string")return null;let n;try{n=new URL(e)}catch{return null}let r=new URLSearchParams(n.hash.slice(1)),i;if(r.has(k))i=r.get(k)??"",r.delete(k),n.hash=r.toString();else if(n.searchParams.has(k))i=n.searchParams.get(k)??"",n.searchParams.delete(k);else return null;return a?.(s,"",`${n.pathname}${n.search}${n.hash}`),De.test(i)?{repositoryId:i}:null}var S="plugin-store",se={"header.open":"\u6253\u5F00\u63D2\u4EF6\u5E02\u573A","header.title":"DSH \u63D2\u4EF6\u5E02\u573A","dialog.close":"\u5173\u95ED\u63D2\u4EF6\u5E02\u573A","settings.tab":"\u63D2\u4EF6\u5E02\u573A","store.search":"\u641C\u7D22\u540D\u79F0\u3001\u4F5C\u8005\u3001\u63CF\u8FF0\u6216\u6807\u7B7E","store.category":"\u5206\u7C7B","store.sort":"\u6392\u5E8F","store.sortRecommended":"\u63A8\u8350","store.sortStars":"Star","store.sortUpdated":"\u6700\u8FD1\u66F4\u65B0","store.sortName":"\u540D\u79F0","store.validation":"\u9A8C\u8BC1\u72B6\u6001","store.validation.all":"\u5168\u90E8\u9A8C\u8BC1\u72B6\u6001","store.validation.unrecognized":"\u5F85\u8BC6\u522B","store.validation.check-pending":"\u5F85\u7ED3\u6784\u68C0\u67E5","store.validation.check-running":"\u7ED3\u6784\u68C0\u67E5\u4E2D","store.validation.check-failed":"\u7ED3\u6784\u68C0\u67E5\u5931\u8D25","store.validation.sandbox-pending":"\u5F85\u5B9E\u673A\u9A8C\u8BC1","store.validation.sandbox-running":"\u5B9E\u673A\u9A8C\u8BC1\u4E2D","store.validation.sandbox-failed":"\u5B9E\u673A\u9A8C\u8BC1\u5931\u8D25","store.validation.verified":"\u5DF2\u9A8C\u8BC1","store.validation.security-review":"\u5B89\u5168\u590D\u6838\u4E2D","store.validation.expired":"\u9700\u91CD\u65B0\u9A8C\u8BC1","store.validation.recorded":"\u5DF2\u6709\u9A8C\u8BC1\u8BB0\u5F55","store.validation.inconclusive":"\u9700\u8981\u590D\u6838","store.validation.not-applicable":"\u975E\u63D2\u4EF6\u9A8C\u8BC1\u8303\u56F4","store.verifiedOnly":"\u53EA\u770B\u5DF2\u9A8C\u8BC1","store.verified":"\u5DF2\u9A8C\u8BC1","store.topicListed":"Topic \u6536\u5F55","store.refresh":"\u5237\u65B0\u76EE\u5F55","store.loading":"\u6B63\u5728\u8F7D\u5165\u63D2\u4EF6\u76EE\u5F55...","store.loadFailed":"\u76EE\u5F55\u8F7D\u5165\u5931\u8D25","store.retry":"\u91CD\u8BD5","store.empty":"\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u7684\u9879\u76EE","store.results":"{visible} / {total} \u4E2A\u9879\u76EE","store.updated":"\u76EE\u5F55\u66F4\u65B0\u4E8E {date}","store.disclaimer":"\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u88C5\u3001\u517C\u5BB9\u6027\u3001\u5B89\u5168\u6027\u6216\u8D28\u91CF\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u3002","store.copyInstall":"\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.copied":"\u5DF2\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.install":"\u5B89\u88C5","store.installed":"\u5DF2\u5B89\u88C5","store.riskTitle":"\u7B2C\u4E09\u65B9\u63D2\u4EF6\u98CE\u9669\u786E\u8BA4","store.riskLead":"\u5373\u5C06\u628A\u7B2C\u4E09\u65B9\u4ED3\u5E93\u4EE3\u7801\u5B89\u88C5\u5230\u5F53\u524D DSH Web profile\u3002","store.riskDetail":"\u9879\u76EE\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u5168\u5BA1\u67E5\u3001\u517C\u5BB9\u6027\u6216\u8D28\u91CF\u4FDD\u8BC1\u3002\u5B89\u88C5\u540E\u7684\u4EE3\u7801\u53EF\u5728 DSH \u8FDB\u7A0B\u6743\u9650\u8303\u56F4\u5185\u8FD0\u884C\uFF0C\u5B8C\u6210\u540E\u9700\u8981\u91CD\u542F DSH Web \u624D\u4F1A\u751F\u6548\u3002","store.riskAcknowledge":"\u6211\u5DF2\u4E86\u89E3\u98CE\u9669\uFF0C\u5E76\u786E\u8BA4\u5B89\u88C5\u8FD9\u4E2A\u7B2C\u4E09\u65B9\u63D2\u4EF6","store.cancel":"\u53D6\u6D88","store.confirmInstall":"\u786E\u8BA4\u5B89\u88C5","store.installing":"\u6B63\u5728\u5B89\u88C5...","store.installSuccess":"\u5B89\u88C5\u5B8C\u6210\u3002\u8BF7\u91CD\u542F DSH Web \u4F7F\u63D2\u4EF6\u751F\u6548\u3002","store.installFailed":"\u5B89\u88C5\u5931\u8D25","store.analyzeWithAgent":"\u4EA4\u7ED9 AGENT \u5206\u6790","store.analyzeHint":"\u53EF\u4EE5\u5C06\u8FD9\u6B21\u5931\u8D25\u4EA4\u7ED9\u65B0\u5EFA\u7684 AGENT \u4F1A\u8BDD\u5206\u6790\u3002","store.analyzing":"\u6B63\u5728\u521B\u5EFA AGENT \u4F1A\u8BDD...","store.analyzeSent":"\u5DF2\u4EA4\u7ED9 AGENT","store.analyzeFailed":"AGENT \u5206\u6790\u5165\u53E3\u6682\u4E0D\u53EF\u7528","store.done":"\u77E5\u9053\u4E86","store.openDetails":"\u6253\u5F00\u5E02\u573A\u8BE6\u60C5","store.loadMore":"\u52A0\u8F7D\u66F4\u591A","store.stars":"{count} Star"},ae={"header.open":"Open plugin store","header.title":"DSH Plugin Store","dialog.close":"Close plugin store","settings.tab":"Plugin Store","store.search":"Search name, owner, description, or topic","store.category":"Category","store.sort":"Sort","store.sortRecommended":"Recommended","store.sortStars":"Stars","store.sortUpdated":"Recently updated","store.sortName":"Name","store.validation":"Validation status","store.validation.all":"All validation states","store.validation.unrecognized":"Needs identification","store.validation.check-pending":"Structure check pending","store.validation.check-running":"Checking structure","store.validation.check-failed":"Structure check failed","store.validation.sandbox-pending":"Sandbox validation pending","store.validation.sandbox-running":"Sandbox validation running","store.validation.sandbox-failed":"Sandbox validation failed","store.validation.verified":"Verified","store.validation.security-review":"Security review","store.validation.expired":"Revalidation required","store.validation.recorded":"Validation record available","store.validation.inconclusive":"Needs review","store.validation.not-applicable":"Outside plugin validation","store.verifiedOnly":"Verified only","store.verified":"Verified","store.topicListed":"Topic listed","store.refresh":"Refresh catalog","store.loading":"Loading plugin catalog...","store.loadFailed":"Could not load catalog","store.retry":"Retry","store.empty":"No projects match these filters","store.results":"{visible} / {total} projects","store.updated":"Catalog updated {date}","store.disclaimer":"Listing does not verify installation, compatibility, security, or quality.","store.copyInstall":"Copy install reference","store.copied":"Install reference copied","store.install":"Install","store.installed":"Installed","store.riskTitle":"Third-party plugin risk confirmation","store.riskLead":"This will install third-party repository code into the current DSH Web profile.","store.riskDetail":"A catalog listing is not a security, compatibility, or quality review. Installed code can run with the DSH process permissions, and DSH Web must be restarted before it becomes active.","store.riskAcknowledge":"I understand the risk and want to install this third-party plugin","store.cancel":"Cancel","store.confirmInstall":"Install plugin","store.installing":"Installing...","store.installSuccess":"Installation complete. Restart DSH Web to activate the plugin.","store.installFailed":"Installation failed","store.analyzeWithAgent":"Ask AGENT to analyze","store.analyzeHint":"Send this failure to a new AGENT session for diagnosis.","store.analyzing":"Creating an AGENT session...","store.analyzeSent":"Sent to AGENT","store.analyzeFailed":"AGENT handoff is unavailable","store.done":"Done","store.openDetails":"Open store details","store.loadMore":"Load more","store.stars":"{count} stars"};var Pe=String.raw`
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
.dps-install-button:focus-visible,
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

.dps-store[data-mode='settings'] .dps-filter-bar {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
}

.dps-store[data-mode='settings'] .dps-filter-search {
  grid-column: 1 / -1;
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
  grid-template-columns: minmax(220px, 1fr) 140px 160px 140px auto;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dps-card {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
}

.dps-card-link {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}

.dps-card-link:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l3);
  outline-offset: -2px;
}

.dps-card:has(.dps-card-link:hover),
.dps-card:has(.dps-card-link:focus-visible) {
  border-color: var(--dsw-alias-border-l3);
  background: var(--dsw-alias-interactive-bg-hover);
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
  min-width: 0;
  justify-content: space-between;
  gap: 10px;
}

.dps-card-head {
  flex: 1 1 240px;
}

.dps-card-title {
  flex: 1 1 auto;
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
  flex: 0 1 180px;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-description {
  flex: 2 1 260px;
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dps-badges {
  flex: 2 1 240px;
  flex-wrap: wrap;
  gap: 5px;
}

.dps-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  border-radius: 999px;
  padding: 1px 7px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
  font-size: 10px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-badge[data-kind='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status$='failed'] {
  color: #df6d6d;
  background: color-mix(in srgb, #df6d6d 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status$='running'] {
  color: #6ba8d6;
  background: color-mix(in srgb, #6ba8d6 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='expired'],
.dps-badge[data-kind='validation'][data-status='inconclusive'],
.dps-badge[data-kind='validation'][data-status='sandbox-pending'],
.dps-badge[data-kind='validation'][data-status='security-review'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='recorded'] {
  color: #8d8bce;
  background: color-mix(in srgb, #8d8bce 14%, transparent);
}

.dps-stars {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.dps-install-reference {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
}

.dps-install-reference > svg {
  flex: 0 0 auto;
}

.dps-install-reference code {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-actions {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  min-width: 0;
  gap: 2px;
}

.dps-card-foot {
  flex: 1 1 100%;
}

.dps-validation-reason {
  flex: 1 1 100%;
  min-width: 0;
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.dps-install-button {
  display: inline-flex;
  min-width: 0;
  height: 28px;
  gap: 4px;
  padding: 0 8px;
  white-space: nowrap;
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

body > :has(> .dps-risk-modal) {
  z-index: 1001;
}

.dps-risk-modal {
  width: min(520px, calc(100vw - 32px));
  max-width: none;
  padding: 0;
  overflow: hidden;
}

.dps-risk-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
}

.dps-risk-header,
.dps-risk-actions,
.dps-risk-title {
  display: flex;
  align-items: center;
}

.dps-risk-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 54px;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.dps-risk-title {
  min-width: 0;
  gap: 8px;
  color: var(--dsw-alias-state-warning-primary, #d89450);
}

.dps-risk-title h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  line-height: 22px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-risk-body {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 18px;
}

.dps-risk-body > strong,
.dps-risk-body > p {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 20px;
}

.dps-risk-body > p {
  color: var(--dsw-alias-label-secondary);
}

.dps-risk-repository {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
}

.dps-risk-repository span,
.dps-risk-repository code,
.dps-install-output {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.dps-risk-repository span {
  font-size: 13px;
  font-weight: 600;
}

.dps-risk-version {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.dps-risk-version select {
  min-width: 0;
  max-width: 100%;
  height: 28px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  padding: 0 7px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
}

.dps-risk-repository code,
.dps-install-output {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 17px;
}

.dps-risk-acknowledge {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.dps-risk-acknowledge input {
  width: 15px;
  height: 15px;
  margin: 2px 0 0;
  accent-color: #4f9f75;
}

.dps-install-status {
  display: grid;
  gap: 3px;
}

.dps-install-status[data-kind='success'] {
  color: var(--dsw-alias-state-success-primary, #5eb98a);
}

.dps-install-status[data-kind='error'] {
  color: var(--dsw-alias-state-error-primary, #df6d6d);
}

.dps-install-analysis {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.dps-install-output {
  max-height: 120px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
}

.dps-risk-actions {
  justify-content: flex-end;
  gap: 8px;
  min-height: 58px;
  padding: 0 18px;
  border-top: 1px solid var(--dsw-alias-border-l1);
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

  .dps-risk-modal {
    width: calc(100vw - 16px);
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

  .dps-store[data-mode='settings'] .dps-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .dps-store[data-mode='settings'] .dps-check {
    grid-column: 1 / -1;
  }

  .dps-card-repo,
  .dps-card-description,
  .dps-badges,
  .dps-card-head { flex-basis: 100%; }

  .dps-risk-version { grid-template-columns: 1fr; gap: 4px; }
}

@media (prefers-reduced-motion: reduce) {
  .dps-header-button,
  .dps-icon-button,
  .dps-retry,
  .dps-load-more {
    transition: none;
  }
}
`;function ie(){let e="dsh-plugin-store-styles";if(document.getElementById(e)!==null)return()=>{};let a=document.createElement("style");return a.id=e,a.textContent=Pe,document.head.append(a),()=>a.remove()}var $e=["slots","locale","sessions","workspaces"];function He(e){let s=new E,a=new O,n=e.locale.bind(S);e.effect(()=>e.locale.register(S,{zh:se,en:ae}),"plugin-store: dictionaries"),e.effect(()=>ie(),"plugin-store: styles"),e.on("command/executed",(i,o,c)=>{o==="store"&&c.kind==="success"&&a.open()}),e.slots.inject("shell.overlay",()=>e.slots.register({name:"shell.overlay",id:"plugin-store-dialog",order:40,locale:S,inject:()=>({catalogStore:s,dialogController:a,sessions:e.sessions,workspaces:e.workspaces})},K)),e.slots.inject("conversation.session.header.utilities",()=>e.slots.register({name:"conversation.session.header.utilities",id:"plugin-store",order:40,locale:S,inject:()=>({dialogController:a})},Q)),e.slots.inject("settings.plugins.tab",()=>e.slots.register({name:"settings.plugins.tab",id:"plugin-store",order:20,label:()=>n("settings.tab"),locale:S,inject:()=>({catalogStore:s,sessions:e.sessions,workspaces:e.workspaces})},ee));let r=te();r!==null&&a.openInstall(r)}

return module.exports; } });
