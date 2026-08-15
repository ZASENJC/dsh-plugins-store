window.__ModuleLoader__.load({ id: "dsh-plugin-store", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";var ie=Object.create;var S=Object.defineProperty;var oe=Object.getOwnPropertyDescriptor;var re=Object.getOwnPropertyNames;var le=Object.getPrototypeOf,ne=Object.prototype.hasOwnProperty;var de=(t,s)=>{for(var i in s)S(t,i,{get:s[i],enumerable:!0})},_=(t,s,i,o)=>{if(s&&typeof s=="object"||typeof s=="function")for(let a of re(s))!ne.call(t,a)&&a!==i&&S(t,a,{get:()=>s[a],enumerable:!(o=oe(s,a))||o.enumerable});return t};var pe=(t,s,i)=>(i=t!=null?ie(le(t)):{},_(s||!t||!t.__esModule?S(i,"default",{value:t,enumerable:!0}):i,t)),ce=t=>_(S({},"__esModule",{value:!0}),t);var Ne={};de(Ne,{apply:()=>Se,inject:()=>ke});module.exports=ce(Ne);var ue=Object.freeze(["https://dsh.aitreez.com/catalog.json","https://raw.githubusercontent.com/ZASENJC/dsh-plugins-store/main/src/data/catalog.json"]),C=Object.freeze({all:"\u5168\u90E8\u5206\u7C7B",ui:"\u754C\u9762\u4F53\u9A8C",development:"\u5F00\u53D1\u5DE5\u5177",data:"\u6570\u636E\u77E5\u8BC6",other:"\u5176\u4ED6","agent-session":"Agent \u4E0E\u4F1A\u8BDD",lifestyle:"\u751F\u6D3B\u5A31\u4E50",security:"\u5B89\u5168",operations:"\u8FD0\u7EF4",research:"\u7814\u7A76","model-mcp":"\u6A21\u578B\u4E0E MCP",communication:"\u6D88\u606F\u901A\u8BAF"}),$=Object.freeze({plugin:"\u63D2\u4EF6",application:"\u5E94\u7528",skill:"\u6280\u80FD",unknown:"\u5F85\u8BC6\u522B",directory:"\u76EE\u5F55",collection:"\u63D2\u4EF6\u5408\u96C6",infrastructure:"\u57FA\u7840\u8BBE\u65BD",channel:"\u6E20\u9053\u9002\u914D"}),q=Object.freeze(["unrecognized","check-pending","check-running","check-failed","sandbox-pending","sandbox-running","sandbox-failed","verified","expired","recorded","inconclusive","not-applicable"]),me=new Set(["plugin","skill","collection","channel"]);function T(t){if(!me.has(t.projectType))return null;let s=t.validation?.overall==="verified"&&/^[a-f0-9]{40}$/i.test(t.validation.sourceSha??"")?`#${t.validation.sourceSha}`:"";return`dsh plugin --profile web add github:${t.fullName}${s}`}function ge(t){return[t.name,t.fullName,t.description,...t.topics??[]].join(" ").toLocaleLowerCase()}function he(t,s){let i=Number(t.verified)*2+Number(t.awesomeListed);return Number(s.verified)*2+Number(s.awesomeListed)-i||s.stars-t.stars||t.fullName.localeCompare(s.fullName)}function M(t,s){let i=s.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return[...t.filter(a=>{if(s.category!=="all"&&a.category!==s.category||s.validation&&s.validation!=="all"&&a.validation?.overall!==s.validation)return!1;let r=a.validation?a.validation.overall==="verified":a.verified;if(s.verifiedOnly&&!r)return!1;if(i.length===0)return!0;let d=ge(a);return i.every(c=>d.includes(c))})].sort((a,r)=>s.sort==="stars"?r.stars-a.stars||a.fullName.localeCompare(r.fullName):s.sort==="updated"?Date.parse(r.pushedAt)-Date.parse(a.pushedAt)||a.fullName.localeCompare(r.fullName):s.sort==="name"?a.name.localeCompare(r.name)||a.fullName.localeCompare(r.fullName):he(a,r))}function V(t){return new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:1}).format(t)}function be(t){if(t===null||typeof t!="object"||t.schemaVersion!==1||!Array.isArray(t.repositories))throw new Error("\u76EE\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548");return t}var N=class{constructor({fetcher:s=globalThis.fetch?.bind(globalThis),urls:i=ue}={}){if(typeof s!="function")throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76EE\u5F55\u8BF7\u6C42");this.fetcher=s,this.urls=[...i],this.listeners=new Set,this.pending=null,this.snapshot=Object.freeze({status:"idle",catalog:null,error:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));load({force:s=!1}={}){return!s&&this.snapshot.status==="ready"?Promise.resolve():this.pending!==null?this.pending:(this.publish({status:"loading",catalog:this.snapshot.catalog,error:null}),this.pending=this.fetchCatalog().then(i=>{this.publish({status:"ready",catalog:i,error:null})}).catch(i=>{this.publish({status:"error",catalog:this.snapshot.catalog,error:i instanceof Error?i.message:String(i)})}).finally(()=>{this.pending=null}),this.pending)}async fetchCatalog(){let s=new Error("\u6CA1\u6709\u53EF\u7528\u7684\u76EE\u5F55\u6570\u636E\u6E90");for(let i of this.urls)try{let o=await this.fetcher(i,{headers:{Accept:"application/json"}});if(!o.ok)throw new Error(`\u76EE\u5F55\u8BF7\u6C42\u5931\u8D25 (${o.status})`);return be(await o.json())}catch(o){s=o instanceof Error?o:new Error(String(o))}throw s}publish(s){this.snapshot=Object.freeze(s);for(let i of this.listeners)i()}};var e=pe(require("react"),1),n=require("@deepseek-ai/dsh-client-ui-primitives");var A=24;function B(t){return t===null?null:{repositoryId:`external:${t}`,fullName:t,projectType:"plugin"}}function fe({repository:t,copied:s,installed:i,onCopy:o,onInstall:a,t:r}){let d=T(t),c=`https://dsh.aitreez.com/plugins/${t.repositoryId}`,u=t.validation?.overall??(t.verified?"recorded":"check-pending");return e.createElement("article",{className:"dps-card"},e.createElement("a",{className:"dps-card-link",href:c,target:"_blank",rel:"noreferrer","aria-label":`${r("store.openDetails")}: ${t.fullName}`,title:r("store.openDetails")}),e.createElement("div",{className:"dps-card-head"},e.createElement("div",{className:"dps-card-title"},e.createElement("h3",{title:t.name},t.name)),e.createElement("span",{className:"dps-stars"},r("store.stars",{count:V(t.stars)}))),e.createElement("p",{className:"dps-card-repo",title:t.fullName},t.fullName),e.createElement("p",{className:"dps-card-description"},t.description),e.createElement("div",{className:"dps-badges"},e.createElement("span",{className:"dps-badge","data-kind":"validation","data-status":u},r(`store.validation.${u}`)),t.awesomeListed&&e.createElement("span",{className:"dps-badge","data-kind":"awesome"},r("store.awesome")),e.createElement("span",{className:"dps-badge"},C[t.category]??C.other),e.createElement("span",{className:"dps-badge"},$[t.projectType]??t.projectType)),e.createElement("div",{className:"dps-card-foot"},e.createElement("div",{className:"dps-install-reference"},e.createElement(n.IconCordisPluginOutline14,{size:14}),e.createElement("code",{title:d??r("store.topicListed")},d??r("store.topicListed"))),d!==null&&e.createElement("div",{className:"dps-card-actions"},e.createElement(n.Button,{className:"dps-install-button",size:"sm",variant:"outline",type:"button",disabled:i,onClick:()=>a(t)},i?e.createElement(n.IconCheckOutline16,{size:14}):e.createElement(n.IconDownloadOutline16,{size:14}),e.createElement("span",null,r(i?"store.installed":"store.install"))),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>o(t.repositoryId,d),"aria-label":r(s?"store.copied":"store.copyInstall"),title:r(s?"store.copied":"store.copyInstall")},s?e.createElement(n.IconCheckOutline16,{size:16}):e.createElement(n.IconCopyOutline16,{size:16})))))}function ve({target:t,onClose:s,onInstalled:i,t:o}){let[a,r]=e.useState(!1),[d,c]=e.useState("idle"),[u,g]=e.useState("");e.useEffect(()=>{r(!1),c("idle"),g("")},[t?.repositoryId]);let m=()=>{d!=="installing"&&s()},z=async()=>{if(!(t===null||!a||d==="installing")){c("installing"),g("");try{let p=await fetch("/api/dsh-plugin-store/install",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName:t.fullName})}),v=await p.json().catch(()=>({}));if(!p.ok||v.ok!==!0)throw new Error(v.message??`${o("store.installFailed")} (${p.status})`);c("success"),g(v.output??""),i(t.repositoryId)}catch(p){c("error"),g(p instanceof Error?p.message:String(p))}}},h=t===null?"":T(t),w=d==="success";return e.createElement(n.Modal,{open:t!==null,onClose:m,title:o("store.riskTitle"),closeLabel:o("store.cancel"),className:"dps-risk-modal",headless:!0},t!==null&&e.createElement("div",{className:"dps-risk-shell"},e.createElement("header",{className:"dps-risk-header"},e.createElement("div",{className:"dps-risk-title"},e.createElement(n.IconWarningOutline16,{size:18}),e.createElement("h2",null,o("store.riskTitle"))),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:m,disabled:d==="installing","aria-label":o("store.cancel"),title:o("store.cancel")},e.createElement(n.IconCloseOutline16,{size:16}))),e.createElement("div",{className:"dps-risk-body"},e.createElement("strong",null,o("store.riskLead")),e.createElement("p",null,o("store.riskDetail")),e.createElement("div",{className:"dps-risk-repository"},e.createElement("span",null,t.fullName),e.createElement("code",null,h)),!w&&e.createElement("label",{className:"dps-risk-acknowledge"},e.createElement("input",{type:"checkbox",checked:a,disabled:d==="installing",onChange:p=>r(p.target.checked)}),e.createElement("span",null,o("store.riskAcknowledge"))),d==="installing"&&e.createElement("p",{className:"dps-install-status",role:"status"},o("store.installing")),d==="success"&&e.createElement("p",{className:"dps-install-status","data-kind":"success",role:"status"},o("store.installSuccess")),d==="error"&&e.createElement("p",{className:"dps-install-status","data-kind":"error",role:"alert"},e.createElement("strong",null,o("store.installFailed")),e.createElement("span",null,u)),d==="success"&&u&&e.createElement("pre",{className:"dps-install-output"},u)),e.createElement("footer",{className:"dps-risk-actions"},w?e.createElement(n.Button,{size:"sm",variant:"outline",type:"button",onClick:m},o("store.done")):e.createElement(e.Fragment,null,e.createElement(n.Button,{size:"sm",variant:"outline",type:"button",disabled:d==="installing",onClick:m},o("store.cancel")),e.createElement(n.Button,{size:"sm",variant:"primary",type:"button",disabled:!a||d==="installing",onClick:z},o(d==="installing"?"store.installing":"store.confirmInstall"))))))}function H({catalogStore:t,mode:s,requestedInstallFullName:i=null,onInstallRequestConsumed:o,t:a}){let r=e.useSyncExternalStore(t.subscribe,t.getSnapshot),[d,c]=e.useState(""),[u,g]=e.useState("all"),[m,z]=e.useState("all"),[h,w]=e.useState("recommended"),[p,v]=e.useState(!1),[Q,L]=e.useState(A),[K,O]=e.useState(null),[X,R]=e.useState(()=>B(i)),[ee,te]=e.useState(()=>new Set);e.useEffect(()=>{t.load()},[t]),e.useEffect(()=>{L(A)},[d,u,m,h,p]),e.useEffect(()=>{let l=B(i);l!==null&&R(l)},[i]);let j=r.catalog?.repositories??[],y=e.useMemo(()=>M(j,{query:d,category:u,validation:m,sort:h,verifiedOnly:p}),[j,d,u,m,h,p]),k=y.slice(0,Q),E=r.catalog?.generatedAt?new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(r.catalog.generatedAt)):null,se=async(l,x)=>{await(0,n.writeClipboard)(x)&&(O(l),window.setTimeout(()=>O(P=>P===l?null:P),1600))},D=()=>t.load({force:!0}),ae=()=>{R(null),o?.()};return e.createElement(e.Fragment,null,e.createElement("section",{className:"dps-store","data-mode":s,"aria-label":a("header.title")},e.createElement("div",{className:"dps-store-head"},e.createElement("div",{className:"dps-store-meta"},e.createElement("p",null,a("store.results",{visible:k.length,total:y.length})),E&&e.createElement("p",null,a("store.updated",{date:E})),e.createElement("p",{className:"dps-disclaimer"},a("store.disclaimer"))),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:D,"aria-label":a("store.refresh"),title:a("store.refresh"),disabled:r.status==="loading"},e.createElement(n.IconRefreshOutline16,{size:16}))),e.createElement("div",{className:"dps-filter-bar"},e.createElement("label",{className:"dps-filter dps-filter-search"},e.createElement("input",{type:"search",value:d,onChange:l=>c(l.target.value),placeholder:a("store.search"),"aria-label":a("store.search")})),e.createElement("label",{className:"dps-filter"},e.createElement("select",{value:m,onChange:l=>z(l.target.value),"aria-label":a("store.validation")},e.createElement("option",{value:"all"},a("store.validation.all")),q.map(l=>e.createElement("option",{key:l,value:l},a(`store.validation.${l}`))))),e.createElement("label",{className:"dps-filter"},e.createElement("select",{value:u,onChange:l=>g(l.target.value),"aria-label":a("store.category")},Object.entries(C).map(([l,x])=>e.createElement("option",{key:l,value:l},x)))),e.createElement("label",{className:"dps-filter"},e.createElement("select",{value:h,onChange:l=>w(l.target.value),"aria-label":a("store.sort")},e.createElement("option",{value:"recommended"},a("store.sortRecommended")),e.createElement("option",{value:"stars"},a("store.sortStars")),e.createElement("option",{value:"updated"},a("store.sortUpdated")),e.createElement("option",{value:"name"},a("store.sortName")))),e.createElement("label",{className:"dps-check"},e.createElement("input",{type:"checkbox",checked:p,onChange:l=>v(l.target.checked)}),e.createElement("span",null,a("store.verifiedOnly")))),e.createElement("div",{className:"dps-catalog-scroll"},r.status==="loading"&&r.catalog===null&&e.createElement("div",{className:"dps-loading",role:"status"},a("store.loading")),r.status==="error"&&r.catalog===null&&e.createElement("div",{className:"dps-error",role:"alert"},e.createElement("div",null,e.createElement("strong",null,a("store.loadFailed")),e.createElement("p",{className:"dps-status"},r.error)),e.createElement("button",{className:"dps-retry",type:"button",onClick:D},a("store.retry"))),r.catalog!==null&&y.length===0&&e.createElement("div",{className:"dps-empty"},a("store.empty")),k.length>0&&e.createElement(e.Fragment,null,e.createElement("div",{className:"dps-grid"},k.map(l=>e.createElement(fe,{key:l.repositoryId,repository:l,copied:K===l.repositoryId,installed:ee.has(l.repositoryId),onCopy:se,onInstall:R,t:a}))),k.length<y.length&&e.createElement("button",{className:"dps-load-more",type:"button",onClick:()=>L(l=>l+A)},a("store.loadMore"))))),e.createElement(ve,{target:X,onClose:ae,onInstalled:l=>te(x=>new Set(x).add(l)),t:a}))}function xe({catalogStore:t,dialogController:s,open:i,installRequest:o,t:a}){return e.createElement(n.Modal,{open:i,onClose:()=>s.close(),title:a("header.title"),closeLabel:a("dialog.close"),className:"dps-modal",headless:!0},e.createElement("div",{className:"dps-modal-shell"},e.createElement("header",{className:"dps-modal-header"},e.createElement("h2",null,a("header.title")),e.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>s.close(),"aria-label":a("dialog.close"),title:a("dialog.close")},e.createElement(n.IconCloseOutline16,{size:16}))),e.createElement(H,{catalogStore:t,mode:"dialog",requestedInstallFullName:o,onInstallRequestConsumed:s.consumeInstallRequest,t:a})))}function F({dialogController:t,catalogStore:s,t:i}){let o=e.useSyncExternalStore(t.subscribe,t.getSnapshot);return e.createElement(xe,{catalogStore:s,dialogController:t,open:o.open,installRequest:o.installRequest,t:i})}function U({dialogController:t,t:s}){return e.createElement("button",{className:"dps-header-button",type:"button",onClick:()=>t.open(),"aria-label":s("header.open"),title:s("header.open")},e.createElement(n.IconCordisPluginOutline14,{size:16}))}function W({catalogStore:t,t:s}){return e.createElement(H,{catalogStore:t,mode:"settings",t:s})}var I=class{constructor(){this.listeners=new Set,this.snapshot=Object.freeze({open:!1,installRequest:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));open(){this.set({open:!0})}openInstall(s){this.set({open:!0,installRequest:s})}consumeInstallRequest=()=>{this.set({installRequest:null})};close(){this.set({open:!1,installRequest:null})}set(s){let i={...this.snapshot,...s};if(!(this.snapshot.open===i.open&&this.snapshot.installRequest===i.installRequest)){this.snapshot=Object.freeze(i);for(let o of this.listeners)o()}}};var b="dsh-plugin-install",we=/^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/;function Y({href:t=globalThis.location?.href,historyState:s=globalThis.history?.state,replaceState:i=globalThis.history?.replaceState?.bind(globalThis.history)}={}){if(typeof t!="string")return null;let o;try{o=new URL(t)}catch{return null}let a=new URLSearchParams(o.hash.slice(1)),r;if(a.has(b))r=a.get(b)??"",a.delete(b),o.hash=a.toString();else if(o.searchParams.has(b))r=o.searchParams.get(b)??"",o.searchParams.delete(b);else return null;return i?.(s,"",`${o.pathname}${o.search}${o.hash}`),we.test(r)?r:null}var f="plugin-store",Z={"header.open":"\u6253\u5F00\u63D2\u4EF6\u5E02\u573A","header.title":"DSH \u63D2\u4EF6\u5E02\u573A","dialog.close":"\u5173\u95ED\u63D2\u4EF6\u5E02\u573A","settings.tab":"\u63D2\u4EF6\u5E02\u573A","store.search":"\u641C\u7D22\u540D\u79F0\u3001\u4F5C\u8005\u3001\u63CF\u8FF0\u6216\u6807\u7B7E","store.category":"\u5206\u7C7B","store.sort":"\u6392\u5E8F","store.sortRecommended":"\u63A8\u8350","store.sortStars":"Star","store.sortUpdated":"\u6700\u8FD1\u66F4\u65B0","store.sortName":"\u540D\u79F0","store.validation":"\u9A8C\u8BC1\u72B6\u6001","store.validation.all":"\u5168\u90E8\u9A8C\u8BC1\u72B6\u6001","store.validation.unrecognized":"\u5F85\u8BC6\u522B","store.validation.check-pending":"\u5F85\u7ED3\u6784\u68C0\u67E5","store.validation.check-running":"\u7ED3\u6784\u68C0\u67E5\u4E2D","store.validation.check-failed":"\u7ED3\u6784\u68C0\u67E5\u5931\u8D25","store.validation.sandbox-pending":"\u5F85\u5B9E\u673A\u9A8C\u8BC1","store.validation.sandbox-running":"\u5B9E\u673A\u9A8C\u8BC1\u4E2D","store.validation.sandbox-failed":"\u5B9E\u673A\u9A8C\u8BC1\u5931\u8D25","store.validation.verified":"\u5DF2\u9A8C\u8BC1","store.validation.expired":"\u9700\u91CD\u65B0\u9A8C\u8BC1","store.validation.recorded":"\u5DF2\u6709\u9A8C\u8BC1\u8BB0\u5F55","store.validation.inconclusive":"\u9700\u8981\u590D\u6838","store.validation.not-applicable":"\u975E\u63D2\u4EF6\u9A8C\u8BC1\u8303\u56F4","store.verifiedOnly":"\u53EA\u770B\u5DF2\u9A8C\u8BC1","store.verified":"\u5DF2\u9A8C\u8BC1","store.awesome":"\u7CBE\u9009\u76EE\u5F55","store.topicListed":"Topic \u6536\u5F55","store.refresh":"\u5237\u65B0\u76EE\u5F55","store.loading":"\u6B63\u5728\u8F7D\u5165\u63D2\u4EF6\u76EE\u5F55...","store.loadFailed":"\u76EE\u5F55\u8F7D\u5165\u5931\u8D25","store.retry":"\u91CD\u8BD5","store.empty":"\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u7684\u9879\u76EE","store.results":"{visible} / {total} \u4E2A\u9879\u76EE","store.updated":"\u76EE\u5F55\u66F4\u65B0\u4E8E {date}","store.disclaimer":"\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u88C5\u3001\u517C\u5BB9\u6027\u3001\u5B89\u5168\u6027\u6216\u8D28\u91CF\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u3002","store.copyInstall":"\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.copied":"\u5DF2\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.install":"\u5B89\u88C5","store.installed":"\u5DF2\u5B89\u88C5","store.riskTitle":"\u7B2C\u4E09\u65B9\u63D2\u4EF6\u98CE\u9669\u786E\u8BA4","store.riskLead":"\u5373\u5C06\u628A\u7B2C\u4E09\u65B9\u4ED3\u5E93\u4EE3\u7801\u5B89\u88C5\u5230\u5F53\u524D DSH Web profile\u3002","store.riskDetail":"\u9879\u76EE\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u5168\u5BA1\u67E5\u3001\u517C\u5BB9\u6027\u6216\u8D28\u91CF\u4FDD\u8BC1\u3002\u5B89\u88C5\u540E\u7684\u4EE3\u7801\u53EF\u5728 DSH \u8FDB\u7A0B\u6743\u9650\u8303\u56F4\u5185\u8FD0\u884C\uFF0C\u5B8C\u6210\u540E\u9700\u8981\u91CD\u542F DSH Web \u624D\u4F1A\u751F\u6548\u3002","store.riskAcknowledge":"\u6211\u5DF2\u4E86\u89E3\u98CE\u9669\uFF0C\u5E76\u786E\u8BA4\u5B89\u88C5\u8FD9\u4E2A\u7B2C\u4E09\u65B9\u63D2\u4EF6","store.cancel":"\u53D6\u6D88","store.confirmInstall":"\u786E\u8BA4\u5B89\u88C5","store.installing":"\u6B63\u5728\u5B89\u88C5...","store.installSuccess":"\u5B89\u88C5\u5B8C\u6210\u3002\u8BF7\u91CD\u542F DSH Web \u4F7F\u63D2\u4EF6\u751F\u6548\u3002","store.installFailed":"\u5B89\u88C5\u5931\u8D25","store.done":"\u77E5\u9053\u4E86","store.openDetails":"\u6253\u5F00\u5E02\u573A\u8BE6\u60C5","store.loadMore":"\u52A0\u8F7D\u66F4\u591A","store.stars":"{count} Star"},G={"header.open":"Open plugin store","header.title":"DSH Plugin Store","dialog.close":"Close plugin store","settings.tab":"Plugin Store","store.search":"Search name, owner, description, or topic","store.category":"Category","store.sort":"Sort","store.sortRecommended":"Recommended","store.sortStars":"Stars","store.sortUpdated":"Recently updated","store.sortName":"Name","store.validation":"Validation status","store.validation.all":"All validation states","store.validation.unrecognized":"Needs identification","store.validation.check-pending":"Structure check pending","store.validation.check-running":"Checking structure","store.validation.check-failed":"Structure check failed","store.validation.sandbox-pending":"Sandbox validation pending","store.validation.sandbox-running":"Sandbox validation running","store.validation.sandbox-failed":"Sandbox validation failed","store.validation.verified":"Verified","store.validation.expired":"Revalidation required","store.validation.recorded":"Validation record available","store.validation.inconclusive":"Needs review","store.validation.not-applicable":"Outside plugin validation","store.verifiedOnly":"Verified only","store.verified":"Verified","store.awesome":"Curated","store.topicListed":"Topic listed","store.refresh":"Refresh catalog","store.loading":"Loading plugin catalog...","store.loadFailed":"Could not load catalog","store.retry":"Retry","store.empty":"No projects match these filters","store.results":"{visible} / {total} projects","store.updated":"Catalog updated {date}","store.disclaimer":"Listing does not verify installation, compatibility, security, or quality.","store.copyInstall":"Copy install reference","store.copied":"Install reference copied","store.install":"Install","store.installed":"Installed","store.riskTitle":"Third-party plugin risk confirmation","store.riskLead":"This will install third-party repository code into the current DSH Web profile.","store.riskDetail":"A catalog listing is not a security, compatibility, or quality review. Installed code can run with the DSH process permissions, and DSH Web must be restarted before it becomes active.","store.riskAcknowledge":"I understand the risk and want to install this third-party plugin","store.cancel":"Cancel","store.confirmInstall":"Install plugin","store.installing":"Installing...","store.installSuccess":"Installation complete. Restart DSH Web to activate the plugin.","store.installFailed":"Installation failed","store.done":"Done","store.openDetails":"Open store details","store.loadMore":"Load more","store.stars":"{count} stars"};var ye=String.raw`
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dps-card {
  position: relative;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 174px;
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
  overflow-wrap: anywhere;
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
.dps-badge[data-kind='validation'][data-status='sandbox-pending'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='recorded'] {
  color: #8d8bce;
  background: color-mix(in srgb, #8d8bce 14%, transparent);
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
`;function J(){let t="dsh-plugin-store-styles";if(document.getElementById(t)!==null)return()=>{};let i=document.createElement("style");return i.id=t,i.textContent=ye,document.head.append(i),()=>i.remove()}var ke=["slots","locale"];function Se(t){let s=new N,i=new I,o=t.locale.bind(f);t.effect(()=>t.locale.register(f,{zh:Z,en:G}),"plugin-store: dictionaries"),t.effect(()=>J(),"plugin-store: styles"),t.on("command/executed",(r,d,c)=>{d==="store"&&c.kind==="success"&&i.open()}),t.slots.inject("shell.overlay",()=>t.slots.register({name:"shell.overlay",id:"plugin-store-dialog",order:40,locale:f,inject:()=>({catalogStore:s,dialogController:i})},F)),t.slots.inject("conversation.session.header.utilities",()=>t.slots.register({name:"conversation.session.header.utilities",id:"plugin-store",order:40,locale:f,inject:()=>({dialogController:i})},U)),t.slots.inject("settings.plugins.tab",()=>t.slots.register({name:"settings.plugins.tab",id:"plugin-store",order:20,label:()=>o("settings.tab"),locale:f,inject:()=>({catalogStore:s})},W));let a=Y();a!==null&&i.openInstall(a)}

return module.exports; } });
