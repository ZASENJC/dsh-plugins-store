window.__ModuleLoader__.load({ id: "dsh-plugin-store", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";var Ne=Object.create;var O=Object.defineProperty;var Ae=Object.getOwnPropertyDescriptor;var Re=Object.getOwnPropertyNames;var ze=Object.getPrototypeOf,Ce=Object.prototype.hasOwnProperty;var Ie=(e,s)=>{for(var a in s)O(e,a,{get:s[a],enumerable:!0})},Q=(e,s,a,r)=>{if(s&&typeof s=="object"||typeof s=="function")for(let i of Re(s))!Ce.call(e,i)&&i!==a&&O(e,i,{get:()=>s[i],enumerable:!(r=Ae(s,i))||r.enumerable});return e};var Te=(e,s,a)=>(a=e!=null?Ne(ze(e)):{},Q(s||!e||!e.__esModule?O(a,"default",{value:e,enumerable:!0}):a,e)),Ee=e=>Q(O({},"__esModule",{value:!0}),e);var ot={};Ie(ot,{apply:()=>it,inject:()=>rt});module.exports=Ee(ot);var Le=/^[a-f0-9]{7,64}$/i,X=/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,lt=Object.freeze(["plugin","--profile","web","list","--depth=0","--json"]);function ee(e){return typeof e=="string"&&e.length>0?e:void 0}function te(e){let s=ee(e)?.trim();return s===void 0?null:s.replace(/^(['"])(.*)\1$/,"$2")}function N(e){let s=te(e);if(s===null)return null;let a=/(?:^github:|^git\+https?:\/\/github\.com\/|^https?:\/\/github\.com\/|^git@github\.com:)([^/#:]+\/[^/#]+?)(?:\.git)?(?:#(.+))?$/i.exec(s);return a?{fullName:a[1].toLowerCase(),ref:ee(a[2])?.toLowerCase()}:null}function D(e){let s=te(e)?.replace(/^npm:/i,"");if(s===void 0)return null;let a=/^(@[^/]+\/[^@]+|[^@]+)(?:@(.+))?$/.exec(s);return a===null?null:{name:a[1],version:a[2]}}function Oe(e){let s=e.install?.candidate,a=e.version??e.packageVersion??s?.version;return typeof a=="string"?a:s?.source==="npm"?D(s.target)?.version:void 0}function De(e){let s=e.install?.candidate,a=Array.isArray(s?.args)?s.args[4]:void 0,r=N(a)??N(s?.target),i=e.validation?.sourceSha;return typeof i=="string"&&Le.test(i)?i.toLowerCase():r?.ref}function je(e,s){return!e||!s?!1:e!==s&&!e.startsWith(s)&&!s.startsWith(e)}function se(e,s){let a=e?.install?.candidate;if(a===null||typeof a!="object"||!Array.isArray(s))return null;if(a.source==="github"){let r=N(a.target)?.fullName??String(e.fullName??"").toLowerCase();return s.find(i=>[i.from,i.resolved].some(n=>N(n)?.fullName===r))??null}if(a.source==="npm"){let r=D(a.target)?.name;return r===null?null:s.find(i=>i.name===r||D(i.from)?.name===r||D(i.resolved)?.name===r)??null}return null}function Pe(e,s){let a=X.exec(e??""),r=X.exec(s??"");if(!a||!r)return null;for(let i=1;i<=3;i+=1){let n=Number(a[i])-Number(r[i]);if(n!==0)return n}return a[4]===r[4]?0:a[4]?r[4]?a[4].localeCompare(r[4]):-1:1}function ae(e,s){if(s===null||typeof s!="object")return!1;let a=e?.install?.candidate;if(a?.source==="github"){let r=De(e),i=[s.resolved,s.from].map(N).find(Boolean)?.ref;return!!(r&&i&&je(r,i))}if(a?.source==="npm"){let r=Oe(e),i=Pe(r,s.version);return i!==null&&i>0}return!1}var re=Object.freeze(["https://api.dshmk.com/catalog.json"]),U=Object.freeze({ui:"\u754C\u9762\u4F53\u9A8C",development:"\u5F00\u53D1\u5DE5\u5177",data:"\u6570\u636E\u77E5\u8BC6",other:"\u5176\u4ED6","agent-session":"Agent \u4E0E\u4F1A\u8BDD",lifestyle:"\u751F\u6D3B\u5A31\u4E50",security:"\u5B89\u5168",operations:"\u8FD0\u7EF4",research:"\u7814\u7A76","model-mcp":"\u6A21\u578B\u4E0E MCP",communication:"\u6D88\u606F\u901A\u8BAF"}),ie=Object.freeze({plugin:"\u63D2\u4EF6",application:"\u5E94\u7528",skill:"\u6280\u80FD",unknown:"\u5F85\u8BC6\u522B",directory:"\u76EE\u5F55",collection:"\u63D2\u4EF6\u5408\u96C6",infrastructure:"\u57FA\u7840\u8BBE\u65BD",channel:"\u6E20\u9053\u9002\u914D"}),_e=new Set(["plugin","skill","collection","channel"]),$e=/^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/,oe=/^github:([^#]+)(?:#([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}))?$/i,He=/^[a-f0-9]{40}$/i,Fe=/^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})(?:@[A-Za-z0-9^~<>=*+._-][A-Za-z0-9^~<>=*+._-]{0,127})?$/;function ne(e){return!_e.has(e.projectType)||e.install?.status!=="recognized"?null:e.install.candidate??null}function Z(e){let s=A(e);if(s!==null)return s.command;let a=ne(e);return typeof a?.command=="string"?a.command:null}function Me(e){return!Array.isArray(e?.args)||e.args.length!==5||e.args[0]!=="plugin"||e.args[1]!=="--profile"||e.args[2]!=="web"||e.args[3]!=="add"||typeof e.args[4]!="string"?null:[...e.args]}function We(e,s){if(s==null||s.executable!==!0||!Array.isArray(s.args)||typeof s.target!="string"||typeof e.fullName!="string")return null;let a=Me(s);if(a===null)return null;if(s.source==="github"){let r=oe.exec(a[4]);if(!r||!$e.test(r[1])||r[1].toLowerCase()!==String(e.fullName).toLowerCase()||s.target.toLowerCase()!==e.fullName.toLowerCase())return null}else if(s.source==="npm"){let r=a[4].startsWith("npm:")?a[4].slice(4):a[4];if(!Fe.test(r)||r!==s.target)return null}else return null;return{args:a}}function Be(e){let s=ne(e),a=We(e,s);if(a===null)return null;let r=String(e.validation?.sourceSha??"");return e.validation?.overall==="verified"&&!He.test(r)||s.source==="github"&&e.validation?.overall==="verified"&&oe.exec(a.args[4])?.[2]?.toLowerCase()!==r.toLowerCase()?null:{source:s.source,target:s.target,command:s.source==="github"?`dsh plugin --profile web add ${a.args[4]}`:s.command,args:a.args,executable:!0}}function A(e){return Be(e)}function Ge(e){return[e.name,e.fullName,e.description,...e.topics??[]].join(" ").toLocaleLowerCase()}function Ue(e,s){let a=Number(e.verified)*2;return Number(s.verified)*2-a||s.stars-e.stars||e.fullName.localeCompare(s.fullName)}function le(e,s){let a=s.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return[...e.filter(i=>{if(s.category!=="all"&&i.category!==s.category||s.projectType&&s.projectType!=="all"&&i.projectType!==s.projectType||s.validation&&s.validation!=="all"&&i.validation?.overall!==s.validation||s.installedOnly&&!i.installed)return!1;let n=i.validation?i.validation.overall==="verified":i.verified;if(s.verifiedOnly&&!n)return!1;if(a.length===0)return!0;let o=Ge(i);return a.every(l=>o.includes(l))})].sort((i,n)=>!!i.updateAvailable!=!!n.updateAvailable?Number(n.updateAvailable)-Number(i.updateAvailable):s.sort==="stars"?n.stars-i.stars||i.fullName.localeCompare(n.fullName):s.sort==="updated"?Date.parse(n.pushedAt)-Date.parse(i.pushedAt)||i.fullName.localeCompare(n.fullName):s.sort==="name"?i.name.localeCompare(n.name)||i.fullName.localeCompare(n.fullName):Ue(i,n))}function de(e,s){return e.map(a=>{let r=se(a,s);return{...a,installed:r!==null,updateAvailable:ae(a,r),installedPlugin:r}})}function ce(e){return new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:1}).format(e)}function G(e,s,a){let r=e?.stats?.[s];if(r!==null&&typeof r=="object"&&!Array.isArray(r)){let n=Object.keys(r).filter(Boolean);if(n.length>0)return n}let i=Array.isArray(e?.repositories)?e.repositories:[];return[...new Set(i.map(a).filter(Boolean))]}function pe(e){return{categories:["all",...G(e,"categories",s=>s.category)],projectTypes:G(e,"projectTypes",s=>s.projectType),validationStatuses:G(e,"validationStatuses",s=>s.validation?.overall)}}function ue(e,s){if(typeof e!="string"||e.length===0||s===null||s===void 0)return null;try{let a=new URL(e);return a.pathname=`/plugins/${encodeURIComponent(String(s))}`,a.search="",a.hash="",a.toString()}catch{return null}}function Ze(e){if(e===null||typeof e!="object"||e.schemaVersion!==1||!Array.isArray(e.repositories))throw new Error("\u76EE\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548");return e}var j=class{constructor({fetcher:s=globalThis.fetch?.bind(globalThis),urls:a=re}={}){if(typeof s!="function")throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76EE\u5F55\u8BF7\u6C42");this.fetcher=s,this.url=a[0]??re[0],this.listeners=new Set,this.pending=null,this.snapshot=Object.freeze({status:"idle",catalog:null,error:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));load({force:s=!1}={}){return!s&&this.snapshot.status==="ready"?Promise.resolve():this.pending!==null?this.pending:(this.publish({status:"loading",catalog:this.snapshot.catalog,error:null}),this.pending=this.fetchCatalog({force:s}).then(a=>{this.publish({status:"ready",catalog:a,error:null})}).catch(a=>{this.publish({status:"error",catalog:this.snapshot.catalog,error:a instanceof Error?a.message:String(a)})}).finally(()=>{this.pending=null}),this.pending)}async fetchCatalog({force:s=!1}={}){let a={headers:{Accept:"application/json"}};s&&(a.cache="no-store");let r=await this.fetcher(this.url,a);if(!r.ok)throw new Error(`\u76EE\u5F55\u8BF7\u6C42\u5931\u8D25 (${r.status})`);return Ze(await r.json())}publish(s){this.snapshot=Object.freeze(s);for(let a of this.listeners)a()}};var t=Te(require("react"),1),d=require("@deepseek-ai/dsh-client-ui-primitives");function qe(e){return String(e??"\u672A\u77E5\u5B89\u88C5\u9519\u8BEF").replace(/authorization\s*:\s*bearer\s+[^\s\n]+/gi,"Authorization: Bearer [\u5DF2\u9690\u85CF]").replace(/(access[_-]?token|refresh[_-]?token|api[_-]?key|password)\s*[:=]\s*[^\s\n]+/gi,"$1=[\u5DF2\u9690\u85CF]").slice(-3200)}function Ve({fullName:e,install:s,error:a}){let r=typeof s?.command=="string"?s.command:"\u672A\u77E5\u5B89\u88C5\u53C2\u8003",i=s?.source==="npm"?"npm \u5305":s?.source==="github"?"GitHub \u4ED3\u5E93":"README \u547D\u4EE4";return["\u63D2\u4EF6\u4E00\u952E\u5B89\u88C5\u5931\u8D25\uFF0C\u8BF7\u4F5C\u4E3A AGENT \u5206\u6790\u539F\u56E0\u5E76\u7ED9\u51FA\u53EF\u6267\u884C\u7684\u89E3\u51B3\u65B9\u6848\u3002",`\u4ED3\u5E93\uFF1A${e}`,`\u5B89\u88C5\u6765\u6E90\uFF1A${i}`,`\u5B89\u88C5\u53C2\u8003\uFF1A${r}`,`\u9519\u8BEF\u4FE1\u606F\uFF1A${qe(a)}`,"\u8BF7\u5148\u5224\u65AD\u662F DSH \u73AF\u5883\u3001\u7F51\u7EDC\u3001\u4F9D\u8D56\u8FD8\u662F\u63D2\u4EF6\u672C\u8EAB\u7684\u95EE\u9898\uFF1B\u4E0D\u8981\u76F4\u63A5\u6267\u884C\u7B2C\u4E09\u65B9\u4EE3\u7801\u3002"].join(`
`)}function q(e){return e?.list?.getSnapshot?.().current}function Ye(e,s){let a=q(e);return a&&a!==s?Promise.resolve(a):typeof e?.list?.subscribe!="function"?Promise.reject(new Error("\u65E0\u6CD5\u786E\u8BA4\u65B0\u5EFA\u7684 DSH \u4F1A\u8BDD")):new Promise((r,i)=>{let n=!1,o=()=>{},l,p=(u,m)=>{n||(n=!0,o(),clearTimeout(l),u(m))};o=e.list.subscribe(()=>{let u=q(e);u&&u!==s&&p(r,u)}),l=setTimeout(()=>p(i,new Error("\u65B0\u5EFA DSH \u4F1A\u8BDD\u8D85\u65F6")),5e3)})}async function Je(e,s){let a=q(e);if(typeof e?.create=="function"){let o=await e.create({});return e.open?.(o),o}if(typeof s?.startSession!="function")throw new Error("\u5F53\u524D DSH \u672A\u63D0\u4F9B\u65B0\u5EFA\u4F1A\u8BDD\u80FD\u529B");let r=await s.startSession(),i=typeof r=="string"?r:r?.id;if(typeof i=="string"&&i.length>0)return e.open?.(i),i;let n=await Ye(e,a);return e.open?.(n),n}async function me({sessions:e,workspaces:s,fullName:a,install:r,error:i}){let n=await Je(e,s),o=e?.binding?.(n)?.session;if(typeof o?.prompt!="function")throw new Error("\u65B0\u5EFA\u4F1A\u8BDD\u5C1A\u672A\u51C6\u5907\u597D\u63A5\u6536\u6D88\u606F");let l=await o.prompt([{type:"text",text:Ve({fullName:a,install:r,error:i})}],"queue");if(l?.ok===!1)throw new Error(l.error?.message??"AGENT \u6D88\u606F\u53D1\u9001\u5931\u8D25");return n}var V=24;function Ke(e,s){let a=typeof e=="string"?e:e?.repositoryId;if(typeof a!="string")return null;let r=s.find(i=>String(i.id??`github:${i.repositoryId}`)===a);return r!==void 0&&A(r)!==null?r:null}function Qe({repository:e,detailUrl:s,copied:a,onCopy:r,onInstall:i,onRemove:n,t:o}){let l=Z(e),p=A(e),u=e.installed===!0,m=e.updateAvailable===!0,g=e.validation?.overall??(e.verified?"recorded":"check-pending"),f=e.validation?.label??o(`store.validation.${g}`),x=e.validation?.reason;return t.createElement("article",{className:"dps-card"},s!==null&&t.createElement("a",{className:"dps-card-link",href:s,target:"_blank",rel:"noreferrer","aria-label":`${o("store.openDetails")}: ${e.fullName}`,title:o("store.openDetails")}),t.createElement("div",{className:"dps-card-head"},t.createElement("div",{className:"dps-card-title"},t.createElement("h3",{title:e.name},e.name)),t.createElement("span",{className:"dps-stars"},o("store.stars",{count:ce(e.stars)}))),t.createElement("p",{className:"dps-card-repo",title:e.fullName},e.fullName),t.createElement("p",{className:"dps-card-description"},e.description),x&&(g==="expired"||g==="security-review")&&t.createElement("p",{className:"dps-validation-reason"},x),t.createElement("div",{className:"dps-badges"},t.createElement("span",{className:"dps-badge","data-kind":"validation","data-status":g},f),u&&t.createElement("span",{className:"dps-badge","data-kind":m?"update":"installed"},o(m?"store.updateAvailable":"store.installed")),t.createElement("span",{className:"dps-badge"},U[e.category]??e.category),t.createElement("span",{className:"dps-badge"},ie[e.projectType]??e.projectType)),t.createElement("div",{className:"dps-card-foot"},t.createElement("div",{className:"dps-install-reference"},t.createElement(d.IconCordisPluginOutline14,{size:14}),t.createElement("code",{title:l??o("store.topicListed")},l??o("store.topicListed"))),(l!==null||u)&&t.createElement("div",{className:"dps-card-actions"},p!==null&&t.createElement(d.Button,{className:"dps-install-button",size:"sm",variant:"outline",type:"button",disabled:u&&!m,onClick:()=>i(e)},m?t.createElement(d.IconRefreshOutline16,{size:14}):u?t.createElement(d.IconCheckOutline16,{size:14}):t.createElement(d.IconDownloadOutline16,{size:14}),t.createElement("span",null,o(m?"store.update":u?"store.installed":"store.install"))),u&&t.createElement("button",{className:"dps-icon-button dps-remove-button",type:"button",onClick:()=>n(e),"aria-label":o("store.remove"),title:o("store.remove")},t.createElement(d.IconTrashOutline16,{size:16})),l!==null&&t.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>r(e.repositoryId,l),"aria-label":o(a?"store.copied":"store.copyInstall"),title:o(a?"store.copied":"store.copyInstall")},a?t.createElement(d.IconCheckOutline16,{size:16}):t.createElement(d.IconCopyOutline16,{size:16})))))}function Xe({target:e,onClose:s,onInstalled:a,sessions:r,workspaces:i,t:n}){let[o,l]=t.useState(!1),[p,u]=t.useState("idle"),[m,g]=t.useState(""),[f,x]=t.useState("idle");t.useEffect(()=>{l(!1),u("idle"),g(""),x("idle")},[e?.repositoryId]);let v=e===null?null:A(e),_=v?.command??(e===null?"":Z(e)),b=e?.updateAvailable===!0,z=p==="success",k=()=>{p!=="installing"&&s()},C=async()=>{if(!(e===null||!o||p==="installing")&&v!==null){u("installing"),g("");try{let h=await fetch("/api/dsh-plugin-store/install",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({repositoryId:e.id??`github:${e.repositoryId}`,install:v})}),y=await h.json().catch(()=>({}));if(!h.ok||y.ok!==!0)throw new Error(y.message??`${n("store.installFailed")} (${h.status})`);u("success"),g(y.output??""),a(e.repositoryId)}catch(h){u("error"),g(h instanceof Error?h.message:String(h))}}},$=async()=>{if(!(e===null||p!=="error"||f==="sending"||f==="sent")){x("sending");try{await me({sessions:r,workspaces:i,fullName:e.fullName,install:v,error:m}),x("sent")}catch(h){x("error"),g(y=>`${y}
${h instanceof Error?h.message:String(h)}`)}}};return t.createElement(d.Modal,{open:e!==null,onClose:k,title:n(b?"store.updateRiskTitle":"store.riskTitle"),closeLabel:n("store.cancel"),className:"dps-risk-modal",headless:!0},e!==null&&t.createElement("div",{className:"dps-risk-shell"},t.createElement("header",{className:"dps-risk-header"},t.createElement("div",{className:"dps-risk-title"},t.createElement(d.IconWarningOutline16,{size:18}),t.createElement("h2",null,n(b?"store.updateRiskTitle":"store.riskTitle"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:k,disabled:p==="installing","aria-label":n("store.cancel"),title:n("store.cancel")},t.createElement(d.IconCloseOutline16,{size:16}))),t.createElement("div",{className:"dps-risk-body"},t.createElement("strong",null,n(b?"store.updateRiskLead":"store.riskLead")),t.createElement("p",null,n(b?"store.updateRiskDetail":"store.riskDetail")),t.createElement("div",{className:"dps-risk-repository"},t.createElement("span",null,e.fullName),t.createElement("code",null,_)),!z&&t.createElement("label",{className:"dps-risk-acknowledge"},t.createElement("input",{type:"checkbox",checked:o,disabled:p==="installing",onChange:h=>l(h.target.checked)}),t.createElement("span",null,n("store.riskAcknowledge"))),p==="installing"&&t.createElement("p",{className:"dps-install-status",role:"status"},n(b?"store.updating":"store.installing")),p==="success"&&t.createElement("p",{className:"dps-install-status","data-kind":"success",role:"status"},n(b?"store.updateSuccess":"store.installSuccess")),p==="error"&&t.createElement("p",{className:"dps-install-status","data-kind":"error",role:"alert"},t.createElement("strong",null,n("store.installFailed")),t.createElement("span",null,m)),p==="error"&&t.createElement("p",{className:"dps-install-analysis",role:"status"},n(f==="sent"?"store.analyzeSent":f==="sending"?"store.analyzing":f==="error"?"store.analyzeFailed":"store.analyzeHint")),p==="success"&&m&&t.createElement("pre",{className:"dps-install-output"},m)),t.createElement("footer",{className:"dps-risk-actions"},z?t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",onClick:k},n("store.done")):t.createElement(t.Fragment,null,t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",disabled:p==="installing",onClick:k},n("store.cancel")),p==="error"&&t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",disabled:f==="sending"||f==="sent",onClick:$},n(f==="sent"?"store.analyzeSent":"store.analyzeWithAgent")),t.createElement(d.Button,{size:"sm",variant:"primary",type:"button",disabled:!o||v===null||p==="installing",onClick:C},n(p==="installing"?b?"store.updating":"store.installing":b?"store.confirmUpdate":"store.confirmInstall"))))))}function et({target:e,onClose:s,onRemoved:a,t:r}){let[i,n]=t.useState("idle"),[o,l]=t.useState(""),p=i==="success";t.useEffect(()=>{n("idle"),l("")},[e?.repositoryId]);let u=()=>{i!=="removing"&&s()},m=async()=>{if(!(e===null||i==="removing"||e.installedPlugin?.name===void 0)){n("removing"),l("");try{let g=await fetch("/api/dsh-plugin-store/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:e.installedPlugin.name})}),f=await g.json().catch(()=>({}));if(!g.ok||f.ok!==!0)throw new Error(f.message??`${r("store.removeFailed")} (${g.status})`);n("success"),l(f.output??""),a(e.installedPlugin.name)}catch(g){n("error"),l(g instanceof Error?g.message:String(g))}}};return t.createElement(d.Modal,{open:e!==null,onClose:u,title:r("store.removeTitle"),closeLabel:r("store.cancel"),className:"dps-risk-modal",headless:!0},e!==null&&t.createElement("div",{className:"dps-risk-shell"},t.createElement("header",{className:"dps-risk-header"},t.createElement("div",{className:"dps-risk-title dps-remove-title"},t.createElement(d.IconTrashOutline16,{size:18}),t.createElement("h2",null,r("store.removeTitle"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:u,disabled:i==="removing","aria-label":r("store.cancel"),title:r("store.cancel")},t.createElement(d.IconCloseOutline16,{size:16}))),t.createElement("div",{className:"dps-risk-body"},t.createElement("strong",null,r("store.removeLead")),t.createElement("p",null,r("store.removeDetail")),t.createElement("div",{className:"dps-risk-repository"},t.createElement("span",null,e.fullName),t.createElement("code",null,e.installedPlugin.name)),i==="removing"&&t.createElement("p",{className:"dps-install-status",role:"status"},r("store.removing")),i==="success"&&t.createElement("p",{className:"dps-install-status","data-kind":"success",role:"status"},r("store.removeSuccess")),i==="error"&&t.createElement("p",{className:"dps-install-status","data-kind":"error",role:"alert"},t.createElement("strong",null,r("store.removeFailed")),t.createElement("span",null,o)),i==="success"&&o&&t.createElement("pre",{className:"dps-install-output"},o)),t.createElement("footer",{className:"dps-risk-actions"},p?t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",onClick:u},r("store.done")):t.createElement(t.Fragment,null,t.createElement(d.Button,{size:"sm",variant:"outline",type:"button",disabled:i==="removing",onClick:u},r("store.cancel")),t.createElement(d.Button,{size:"sm",variant:"primary",type:"button",disabled:i==="removing",onClick:m},r(i==="removing"?"store.removing":"store.confirmRemove"))))))}function ge({catalogStore:e,mode:s,requestedInstallTarget:a=null,onInstallRequestConsumed:r,sessions:i,workspaces:n,t:o}){let l=t.useSyncExternalStore(e.subscribe,e.getSnapshot),[p,u]=t.useState(""),[m,g]=t.useState("all"),[f,x]=t.useState("recommended"),[v,_]=t.useState(!1),[b,z]=t.useState(!1),[k,C]=t.useState(V),[$,h]=t.useState(null),[y,H]=t.useState(null),[F,M]=t.useState({status:"loading",plugins:[]}),[ye,Y]=t.useState(null);t.useEffect(()=>{e.load()},[e]),t.useEffect(()=>{C(V)},[p,m,f,v,b]);let I=async()=>{M(c=>({...c,status:"loading"}));try{let c=await fetch("/api/dsh-plugin-store/plugins",{headers:{Accept:"application/json"},cache:"no-store"}),w=await c.json().catch(()=>({}));if(!c.ok||w.ok!==!0||!Array.isArray(w.plugins))throw new Error(w.message??`${o("store.installedLoadFailed")} (${c.status})`);M({status:"ready",plugins:w.plugins})}catch{M({status:"error",plugins:[]})}};t.useEffect(()=>{I()},[]);let T=t.useMemo(()=>de(l.catalog?.repositories??[],F.plugins),[l.catalog,F.plugins]),W=t.useMemo(()=>pe(l.catalog),[l.catalog]);t.useEffect(()=>{W.categories.includes(m)||g("all")},[m,W]),t.useEffect(()=>{let c=Ke(a,T);c!==null&&H(c)},[a,T]);let E=t.useMemo(()=>le(T,{query:p,category:m,sort:f,verifiedOnly:v,installedOnly:b}),[T,p,m,f,v,b]),L=E.slice(0,k),J=l.catalog?.generatedAt?new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(l.catalog.generatedAt)):null,ke=async(c,w)=>{await(0,d.writeClipboard)(w)&&(h(c),window.setTimeout(()=>h(K=>K===c?null:K),1600))},B=()=>(I(),e.load({force:!0})),Se=()=>{H(null),r?.()};return t.createElement(t.Fragment,null,t.createElement("section",{className:"dps-store","data-mode":s,"aria-label":o("header.title")},t.createElement("div",{className:"dps-store-head"},t.createElement("div",{className:"dps-store-meta"},t.createElement("p",null,o("store.results",{visible:L.length,total:E.length})),J&&t.createElement("p",null,o("store.updated",{date:J})),F.status==="error"&&t.createElement("p",{role:"status"},o("store.installedLoadFailed")),t.createElement("p",{className:"dps-disclaimer"},o("store.disclaimer"))),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:B,"aria-label":o("store.refresh"),title:o("store.refresh"),disabled:l.status==="loading"},t.createElement(d.IconRefreshOutline16,{size:16}))),t.createElement("div",{className:"dps-filter-bar"},t.createElement("label",{className:"dps-filter dps-filter-search"},t.createElement("input",{type:"search",value:p,onChange:c=>u(c.target.value),placeholder:o("store.search"),"aria-label":o("store.search")})),t.createElement("label",{className:"dps-filter"},t.createElement("select",{value:m,onChange:c=>g(c.target.value),"aria-label":o("store.category")},W.categories.map(c=>t.createElement("option",{key:c,value:c},c==="all"?o("store.categoryAll"):U[c]??c)))),t.createElement("label",{className:"dps-filter"},t.createElement("select",{value:f,onChange:c=>x(c.target.value),"aria-label":o("store.sort")},t.createElement("option",{value:"recommended"},o("store.sortRecommended")),t.createElement("option",{value:"stars"},o("store.sortStars")),t.createElement("option",{value:"updated"},o("store.sortUpdated")),t.createElement("option",{value:"name"},o("store.sortName")))),t.createElement("label",{className:"dps-check"},t.createElement("input",{type:"checkbox",checked:v,onChange:c=>_(c.target.checked)}),t.createElement("span",null,o("store.verifiedOnly"))),t.createElement("label",{className:"dps-check"},t.createElement("input",{type:"checkbox",checked:b,onChange:c=>z(c.target.checked)}),t.createElement("span",null,o("store.installedOnly")))),t.createElement("div",{className:"dps-catalog-scroll"},l.status==="loading"&&l.catalog===null&&t.createElement("div",{className:"dps-loading",role:"status"},o("store.loading")),l.status==="error"&&l.catalog===null&&t.createElement("div",{className:"dps-error",role:"alert"},t.createElement("div",null,t.createElement("strong",null,o("store.loadFailed")),t.createElement("p",{className:"dps-status"},l.error)),t.createElement("button",{className:"dps-retry",type:"button",onClick:B},o("store.retry"))),l.status==="error"&&l.catalog!==null&&t.createElement("div",{className:"dps-stale",role:"status"},t.createElement("span",null,o("store.refreshFailed"),": ",l.error),t.createElement("button",{className:"dps-retry",type:"button",onClick:B},o("store.retry"))),l.catalog!==null&&E.length===0&&t.createElement("div",{className:"dps-empty"},o("store.empty")),L.length>0&&t.createElement(t.Fragment,null,t.createElement("div",{className:"dps-grid"},L.map(c=>t.createElement(Qe,{key:c.repositoryId,repository:c,detailUrl:ue(e.url,c.repositoryId),copied:$===c.repositoryId,onCopy:ke,onInstall:H,onRemove:w=>Y(w),t:o}))),L.length<E.length&&t.createElement("button",{className:"dps-load-more",type:"button",onClick:()=>C(c=>c+V)},o("store.loadMore"))))),t.createElement(Xe,{target:y,onClose:Se,onInstalled:()=>{I()},sessions:i,workspaces:n,t:o}),t.createElement(et,{target:ye,onClose:()=>Y(null),onRemoved:()=>{I()},t:o}))}function tt({catalogStore:e,dialogController:s,open:a,installRequest:r,sessions:i,workspaces:n,t:o}){return t.createElement(d.Modal,{open:a,onClose:()=>s.close(),title:o("header.title"),closeLabel:o("dialog.close"),className:"dps-modal",headless:!0},t.createElement("div",{className:"dps-modal-shell"},t.createElement("header",{className:"dps-modal-header"},t.createElement("h2",null,o("header.title")),t.createElement("button",{className:"dps-icon-button",type:"button",onClick:()=>s.close(),"aria-label":o("dialog.close"),title:o("dialog.close")},t.createElement(d.IconCloseOutline16,{size:16}))),t.createElement(ge,{catalogStore:e,mode:"dialog",requestedInstallTarget:r,onInstallRequestConsumed:s.consumeInstallRequest,sessions:i,workspaces:n,t:o})))}function fe({dialogController:e,catalogStore:s,sessions:a,workspaces:r,t:i}){let n=t.useSyncExternalStore(e.subscribe,e.getSnapshot);return t.createElement(tt,{catalogStore:s,dialogController:e,open:n.open,installRequest:n.installRequest,sessions:a,workspaces:r,t:i})}function he({catalogStore:e,sessions:s,workspaces:a,t:r}){return t.createElement(ge,{catalogStore:e,mode:"settings",sessions:s,workspaces:a,t:r})}var P=class{constructor(){this.listeners=new Set,this.snapshot=Object.freeze({open:!1,installRequest:null})}getSnapshot=()=>this.snapshot;subscribe=s=>(this.listeners.add(s),()=>this.listeners.delete(s));open(){this.set({open:!0})}openInstall(s){this.set({open:!0,installRequest:s})}consumeInstallRequest=()=>{this.set({installRequest:null})};close(){this.set({open:!1,installRequest:null})}set(s){let a={...this.snapshot,...s};if(!(this.snapshot.open===a.open&&this.snapshot.installRequest===a.installRequest)){this.snapshot=Object.freeze(a);for(let r of this.listeners)r()}}};var S="dsh-plugin-id",st=/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$/;function be({href:e=globalThis.location?.href,historyState:s=globalThis.history?.state,replaceState:a=globalThis.history?.replaceState?.bind(globalThis.history)}={}){if(typeof e!="string")return null;let r;try{r=new URL(e)}catch{return null}let i=new URLSearchParams(r.hash.slice(1)),n;if(i.has(S))n=i.get(S)??"",i.delete(S),r.hash=i.toString();else if(r.searchParams.has(S))n=r.searchParams.get(S)??"",r.searchParams.delete(S);else return null;return a?.(s,"",`${r.pathname}${r.search}${r.hash}`),st.test(n)?{repositoryId:n}:null}var R="plugin-store",ve={"header.open":"\u6253\u5F00\u63D2\u4EF6\u5E02\u573A","header.title":"DSH \u63D2\u4EF6\u5E02\u573A","dialog.close":"\u5173\u95ED\u63D2\u4EF6\u5E02\u573A","settings.tab":"\u63D2\u4EF6\u5E02\u573A","store.search":"\u641C\u7D22\u540D\u79F0\u3001\u4F5C\u8005\u3001\u63CF\u8FF0\u6216\u6807\u7B7E","store.category":"\u5206\u7C7B","store.categoryAll":"\u5168\u90E8\u5206\u7C7B","store.sort":"\u6392\u5E8F","store.sortRecommended":"\u63A8\u8350","store.sortStars":"Star","store.sortUpdated":"\u6700\u8FD1\u66F4\u65B0","store.sortName":"\u540D\u79F0","store.validation.unrecognized":"\u5F85\u8BC6\u522B","store.validation.check-pending":"\u5F85\u7ED3\u6784\u68C0\u67E5","store.validation.check-running":"\u7ED3\u6784\u68C0\u67E5\u4E2D","store.validation.check-failed":"\u7ED3\u6784\u68C0\u67E5\u5931\u8D25","store.validation.sandbox-pending":"\u5F85\u5B9E\u673A\u9A8C\u8BC1","store.validation.sandbox-running":"\u5B9E\u673A\u9A8C\u8BC1\u4E2D","store.validation.sandbox-failed":"\u5B9E\u673A\u9A8C\u8BC1\u5931\u8D25","store.validation.verified":"\u5DF2\u9A8C\u8BC1","store.validation.security-review":"\u5B89\u5168\u590D\u6838\u4E2D","store.validation.expired":"\u9700\u91CD\u65B0\u9A8C\u8BC1","store.validation.recorded":"\u5DF2\u6709\u9A8C\u8BC1\u8BB0\u5F55","store.validation.inconclusive":"\u9700\u8981\u590D\u6838","store.validation.not-applicable":"\u975E\u63D2\u4EF6\u9A8C\u8BC1\u8303\u56F4","store.verifiedOnly":"\u53EA\u770B\u5DF2\u9A8C\u8BC1","store.installedOnly":"\u53EA\u770B\u5DF2\u5B89\u88C5","store.installedLoadFailed":"\u672C\u5730\u63D2\u4EF6\u6E05\u5355\u6682\u4E0D\u53EF\u7528","store.verified":"\u5DF2\u9A8C\u8BC1","store.topicListed":"Topic \u6536\u5F55","store.refresh":"\u5237\u65B0\u76EE\u5F55","store.loading":"\u6B63\u5728\u8F7D\u5165\u63D2\u4EF6\u76EE\u5F55...","store.loadFailed":"\u76EE\u5F55\u8F7D\u5165\u5931\u8D25","store.refreshFailed":"\u76EE\u5F55\u5237\u65B0\u5931\u8D25\uFF0C\u5F53\u524D\u663E\u793A\u7684\u662F\u4E0A\u6B21\u6210\u529F\u8F7D\u5165\u7684\u6570\u636E","store.retry":"\u91CD\u8BD5","store.empty":"\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u7684\u9879\u76EE","store.results":"{visible} / {total} \u4E2A\u9879\u76EE","store.updated":"\u76EE\u5F55\u66F4\u65B0\u4E8E {date}","store.disclaimer":"\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u88C5\u3001\u517C\u5BB9\u6027\u3001\u5B89\u5168\u6027\u6216\u8D28\u91CF\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u3002","store.copyInstall":"\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.copied":"\u5DF2\u590D\u5236\u5B89\u88C5\u53C2\u8003","store.install":"\u5B89\u88C5","store.installed":"\u5DF2\u5B89\u88C5","store.update":"\u66F4\u65B0","store.updateAvailable":"\u6709\u66F4\u65B0","store.updateRiskTitle":"\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u786E\u8BA4","store.updateRiskLead":"\u5373\u5C06\u628A\u7B2C\u4E09\u65B9\u4ED3\u5E93\u7684\u65B0\u7248\u672C\u5B89\u88C5\u5230\u5F53\u524D DSH Web profile\u3002","store.updateRiskDetail":"\u66F4\u65B0\u4F1A\u66FF\u6362\u5F53\u524D profile \u4E2D\u7684\u63D2\u4EF6\u7248\u672C\uFF0C\u5B8C\u6210\u540E\u9700\u8981\u91CD\u542F DSH Web \u624D\u4F1A\u751F\u6548\u3002","store.updating":"\u6B63\u5728\u66F4\u65B0...","store.confirmUpdate":"\u786E\u8BA4\u66F4\u65B0","store.updateSuccess":"\u66F4\u65B0\u5B8C\u6210\u3002\u8BF7\u91CD\u542F DSH Web \u4F7F\u63D2\u4EF6\u751F\u6548\u3002","store.remove":"\u79FB\u9664\u63D2\u4EF6","store.removeTitle":"\u79FB\u9664\u63D2\u4EF6","store.removeLead":"\u5373\u5C06\u4ECE\u5F53\u524D DSH Web profile \u4E2D\u79FB\u9664\u8FD9\u4E2A\u63D2\u4EF6\u3002","store.removeDetail":"\u79FB\u9664\u53EA\u4F1A\u4FEE\u6539\u5F53\u524D profile \u7684\u63D2\u4EF6\u4F9D\u8D56\uFF0C\u5B8C\u6210\u540E\u9700\u8981\u91CD\u542F DSH Web \u624D\u4F1A\u751F\u6548\u3002","store.removing":"\u6B63\u5728\u79FB\u9664...","store.confirmRemove":"\u786E\u8BA4\u79FB\u9664","store.removeSuccess":"\u79FB\u9664\u5B8C\u6210\u3002\u8BF7\u91CD\u542F DSH Web \u4F7F\u53D8\u66F4\u751F\u6548\u3002","store.removeFailed":"\u79FB\u9664\u5931\u8D25","store.riskTitle":"\u7B2C\u4E09\u65B9\u63D2\u4EF6\u98CE\u9669\u786E\u8BA4","store.riskLead":"\u5373\u5C06\u628A\u7B2C\u4E09\u65B9\u4ED3\u5E93\u4EE3\u7801\u5B89\u88C5\u5230\u5F53\u524D DSH Web profile\u3002","store.riskDetail":"\u9879\u76EE\u6536\u5F55\u4E0D\u4EE3\u8868\u5B89\u5168\u5BA1\u67E5\u3001\u517C\u5BB9\u6027\u6216\u8D28\u91CF\u4FDD\u8BC1\u3002\u5B89\u88C5\u540E\u7684\u4EE3\u7801\u53EF\u5728 DSH \u8FDB\u7A0B\u6743\u9650\u8303\u56F4\u5185\u8FD0\u884C\uFF0C\u5B8C\u6210\u540E\u9700\u8981\u91CD\u542F DSH Web \u624D\u4F1A\u751F\u6548\u3002","store.riskAcknowledge":"\u6211\u5DF2\u4E86\u89E3\u98CE\u9669\uFF0C\u5E76\u786E\u8BA4\u5B89\u88C5\u8FD9\u4E2A\u7B2C\u4E09\u65B9\u63D2\u4EF6","store.cancel":"\u53D6\u6D88","store.confirmInstall":"\u786E\u8BA4\u5B89\u88C5","store.installing":"\u6B63\u5728\u5B89\u88C5...","store.installSuccess":"\u5B89\u88C5\u5B8C\u6210\u3002\u8BF7\u91CD\u542F DSH Web \u4F7F\u63D2\u4EF6\u751F\u6548\u3002","store.installFailed":"\u5B89\u88C5\u5931\u8D25","store.analyzeWithAgent":"\u4EA4\u7ED9 AGENT \u5206\u6790","store.analyzeHint":"\u53EF\u4EE5\u5C06\u8FD9\u6B21\u5931\u8D25\u4EA4\u7ED9\u65B0\u5EFA\u7684 AGENT \u4F1A\u8BDD\u5206\u6790\u3002","store.analyzing":"\u6B63\u5728\u521B\u5EFA AGENT \u4F1A\u8BDD...","store.analyzeSent":"\u5DF2\u4EA4\u7ED9 AGENT","store.analyzeFailed":"AGENT \u5206\u6790\u5165\u53E3\u6682\u4E0D\u53EF\u7528","store.done":"\u77E5\u9053\u4E86","store.openDetails":"\u6253\u5F00\u5E02\u573A\u8BE6\u60C5","store.loadMore":"\u52A0\u8F7D\u66F4\u591A","store.stars":"{count} Star"},xe={"header.open":"Open plugin store","header.title":"DSH Plugin Store","dialog.close":"Close plugin store","settings.tab":"Plugin Store","store.search":"Search name, owner, description, or topic","store.category":"Category","store.categoryAll":"All categories","store.sort":"Sort","store.sortRecommended":"Recommended","store.sortStars":"Stars","store.sortUpdated":"Recently updated","store.sortName":"Name","store.validation.unrecognized":"Needs identification","store.validation.check-pending":"Structure check pending","store.validation.check-running":"Checking structure","store.validation.check-failed":"Structure check failed","store.validation.sandbox-pending":"Sandbox validation pending","store.validation.sandbox-running":"Sandbox validation running","store.validation.sandbox-failed":"Sandbox validation failed","store.validation.verified":"Verified","store.validation.security-review":"Security review","store.validation.expired":"Revalidation required","store.validation.recorded":"Validation record available","store.validation.inconclusive":"Needs review","store.validation.not-applicable":"Outside plugin validation","store.verifiedOnly":"Verified only","store.installedOnly":"Installed only","store.installedLoadFailed":"Installed plugin list is unavailable","store.verified":"Verified","store.topicListed":"Topic listed","store.refresh":"Refresh catalog","store.loading":"Loading plugin catalog...","store.loadFailed":"Could not load catalog","store.refreshFailed":"Catalog refresh failed; showing the last successful data","store.retry":"Retry","store.empty":"No projects match these filters","store.results":"{visible} / {total} projects","store.updated":"Catalog updated {date}","store.disclaimer":"Listing does not verify installation, compatibility, security, or quality.","store.copyInstall":"Copy install reference","store.copied":"Install reference copied","store.install":"Install","store.installed":"Installed","store.update":"Update","store.updateAvailable":"Update available","store.updateRiskTitle":"Confirm third-party plugin update","store.updateRiskLead":"This will install a newer third-party repository revision into the current DSH Web profile.","store.updateRiskDetail":"The update replaces the plugin version in this profile. Restart DSH Web before it becomes active.","store.updating":"Updating...","store.confirmUpdate":"Update plugin","store.updateSuccess":"Update complete. Restart DSH Web to activate the plugin.","store.remove":"Remove plugin","store.removeTitle":"Remove plugin","store.removeLead":"This will remove the plugin from the current DSH Web profile.","store.removeDetail":"Only the current profile dependency is changed. Restart DSH Web before the removal becomes active.","store.removing":"Removing...","store.confirmRemove":"Remove plugin","store.removeSuccess":"Removal complete. Restart DSH Web to activate the change.","store.removeFailed":"Removal failed","store.riskTitle":"Third-party plugin risk confirmation","store.riskLead":"This will install third-party repository code into the current DSH Web profile.","store.riskDetail":"A catalog listing is not a security, compatibility, or quality review. Installed code can run with the DSH process permissions, and DSH Web must be restarted before it becomes active.","store.riskAcknowledge":"I understand the risk and want to install this third-party plugin","store.cancel":"Cancel","store.confirmInstall":"Install plugin","store.installing":"Installing...","store.installSuccess":"Installation complete. Restart DSH Web to activate the plugin.","store.installFailed":"Installation failed","store.analyzeWithAgent":"Ask AGENT to analyze","store.analyzeHint":"Send this failure to a new AGENT session for diagnosis.","store.analyzing":"Creating an AGENT session...","store.analyzeSent":"Sent to AGENT","store.analyzeFailed":"AGENT handoff is unavailable","store.done":"Done","store.openDetails":"Open store details","store.loadMore":"Load more","store.stars":"{count} stars"};var at=String.raw`
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

.dps-icon-button:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

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
  grid-template-columns: minmax(220px, 1fr) 160px 140px auto;
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

.dps-badge[data-kind='installed'] {
  color: #6ba8d6;
  background: color-mix(in srgb, #6ba8d6 14%, transparent);
}

.dps-badge[data-kind='update'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
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

.dps-remove-button {
  color: var(--dsw-alias-state-error-primary, #df6d6d);
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

.dps-stale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, #d89450 35%, var(--dsw-alias-border-l1));
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
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

.dps-remove-title {
  color: var(--dsw-alias-state-error-primary, #df6d6d);
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
  .dps-icon-button,
  .dps-retry,
  .dps-load-more {
    transition: none;
  }
}
`;function we(){let e="dsh-plugin-store-styles";if(document.getElementById(e)!==null)return()=>{};let a=document.createElement("style");return a.id=e,a.textContent=at,document.head.append(a),()=>a.remove()}var rt=["slots","locale","sessions","workspaces"];function it(e){let s=new j,a=new P,r=e.locale.bind(R);e.effect(()=>e.locale.register(R,{zh:ve,en:xe}),"plugin-store: dictionaries"),e.effect(()=>we(),"plugin-store: styles"),e.on("command/executed",(n,o,l)=>{o==="store"&&l.kind==="success"&&a.open()}),e.slots.inject("shell.overlay",()=>e.slots.register({name:"shell.overlay",id:"plugin-store-dialog",order:40,locale:R,inject:()=>({catalogStore:s,dialogController:a,sessions:e.sessions,workspaces:e.workspaces})},fe)),e.slots.inject("settings.plugins.tab",()=>e.slots.register({name:"settings.plugins.tab",id:"plugin-store",order:20,label:()=>r("settings.tab"),locale:R,inject:()=>({catalogStore:s,sessions:e.sessions,workspaces:e.workspaces})},he));let i=be();i!==null&&a.openInstall(i)}

return module.exports; } });
