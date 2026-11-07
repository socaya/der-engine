/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as L,useRef as ie,useState as T}from"react";import{useAuth as ze,useOrgUnitBinding as Be,useOnlineStatus as Ve,useDerApi as Qe,ScreenCard as Ge}from"@der/app-sdk";import{Fragment as W,jsx as u,jsxs as v}from"react/jsx-runtime";function Je(){let o=ze(),t=Be(),l=Ve(),e=Qe(),[s,n]=T("custom"),[r,d]=T([]),[i,m]=T(""),[a,c]=T(""),[p,g]=T(""),[f,x]=T(""),[h,N]=T({kind:"idle"}),[_,C]=T(null),A=ie(null),[R,O]=T({}),z=ie({}),[Te,X]=T([]),[P,B]=T(null),[K,me]=T(!1),[Ce,ee]=T(new Set),[Ae,te]=T(new Set),[V,pe]=T(""),[Q,$e]=T(0),[G,Ie]=T([]),[ge,J]=T(!1),fe=ie(0),[De,Le]=T(null),[Me,re]=T({localSaved:!1,central:null}),[Re,Oe]=T(0),[je,ae]=T(!1);L(()=>{let b=y=>{if(y.key!=="?")return;let k=y.target;k&&(k.tagName==="INPUT"||k.tagName==="TEXTAREA")||(y.preventDefault(),ae(w=>!w))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[H,Ue]=T(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});L(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",H)}catch{}},[H]);let[q,Pe]=T(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});L(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),L(()=>{let b=!1;return(async()=>{if(!t.bound||!t.orgUnitUid){d([]);return}try{let y=await e.listDataSets(t.orgUnitUid);if(b)return;let k=(y.dataSets??[]).map(w=>({id:w.id,label:w.displayName??w.name??w.id,periodType:w.periodType,formType:w.formType})).sort((w,E)=>w.label.localeCompare(E.label));d(k)}catch{}})(),()=>{b=!0}},[t.bound,t.orgUnitUid]),L(()=>{if(i.trim()===""){C(null),X([]),O({}),z.current={};return}let b=!1;return(async()=>{try{let y=await e.getDataSetMeta(i.trim());if(b)return;let k=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:k,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType,openFuturePeriods:y.openFuturePeriods??0}),n(k?"custom":"structured");try{let w=await e.getDataSetFormMetadata(i.trim());if(b)return;let E=await ye(w,e);if(b)return;let j=(E.categoryCombo?.categories??[]).filter(D=>(D.categoryOptions?.length??0)>1).map(D=>({id:D.id,name:D.name??D.id,options:(D.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));X(j);let U={};for(let D of j)D.options[0]&&(U[D.id]=D.options[0].id);O(U),z.current=U}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[i]),L(()=>{if(s!=="custom"||!_?.hasCustomForm||_.formType==="CUSTOM"&&!_.formId)return;let b=A.current;if(!b)return;let y=!1;return(async()=>{N({kind:"submitting"});try{let k=await e.getDataSetFormMetadata(i.trim());if(y)return;let w=await ye(k,e);if(y)return;let E="";if(_.formType==="CUSTOM"&&_.formId){try{E=(await e.getDataEntryFormHtml(_.formId)).htmlCode??""}catch(S){E="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",S)}E.trim()||(E=he(w))}else _.formType==="SECTION"&&(E=he(w));if(y)return;let j=await e.listValidationRules(i.trim()).catch(()=>({validationRules:[]}));if(y)return;let U=(w.categoryCombo?.categories??[]).filter(S=>(S.categoryOptions?.length??0)>1).map(S=>({id:S.id,name:S.name??S.id,options:(S.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));X(U);let D={};for(let S of U)S.options[0]&&(D[S.id]=S.options[0].id);O(D),z.current=D,b.replaceChildren();for(let[S,I]of[["selectedDataSetId",i.trim()],["selectedPeriodId",a.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let M=document.createElement("input");M.type="hidden",M.id=S,M.value=I,b.appendChild(M)}for(let[S,I]of Object.entries(D)){let M=document.createElement("input");M.type="hidden",M.id=`category-${S}`,M.value=I,M.setAttribute("data-der-category",S),b.appendChild(M)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Xe({dataSetId:i.trim(),periodId:a.trim(),orgUnitId:t.orgUnitUid??"",meta:w,aocSelections:D,validationRules:j.validationRules??[]});for(let S of We)ke(S);for(let S of Ze)document.querySelector(`script[data-der-custom-form="${S}"]`)||await Ee(S);Ke(),await Et($,E,{stripStyles:H==="der"}),await _t($,i.trim(),a.trim(),t.orgUnitUid??"",e),tt($,()=>i.trim(),()=>a.trim(),()=>t.orgUnitUid??"",()=>({...z.current}),e,S=>{re(I=>({...I,localSaved:!0,central:I.central==="CENTRAL_ACCEPTED"&&S==="saved"?"PENDING":I.central})),Oe(I=>I+1)}),$.addEventListener("blur",S=>{let I=S.target;if(I&&I.tagName==="INPUT"&&/-val$/.test(I.getAttribute("name")??"")&&I.value.trim()!==""){let M=a.trim();te(ne=>ne.has(M)?ne:new Set(ne).add(M))}},!0),rt($),mt($,N),pt($),vt($,w,Le),ht($,w),bt($,w),yt($),ft($,w),gt($,w),$e(S=>S+1),N({kind:"idle"})}catch(k){N({kind:"error",message:`custom form failed to render: ${k.message}`})}})(),()=>{y=!0}},[s,_,i,a,t.orgUnitUid,H]);let He=t.bound&&i.trim()!==""&&a.trim()!==""&&p.trim()!==""&&f.trim()!==""&&h.kind!=="submitting";async function qe(b){b.preventDefault(),N({kind:"submitting"});try{await e.submitAggregate({dataSet:i,period:a,orgUnit:t.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),N({kind:"ok",message:`Submitted ${p}=${f} for ${a}.`}),g(""),x("")}catch(y){N({kind:"error",message:y.message??"Submission failed"})}}let be=a.trim()!=="",oe=i.trim()!=="",F=oe&&be&&t.bound;L(()=>{let b=A.current;if(!b)return;let y=V.trim().toLowerCase(),k=Array.from(b.querySelectorAll("tbody tr"));for(let w of k){if(!y){w.style.display="";continue}let j=((w.querySelector(".dataElementCell")??w.querySelector("td"))?.textContent??"").toLowerCase();w.style.display=j.includes(y)?"":"none"}},[V,Q]),L(()=>{let b=t.orgUnitUid??"";if(!i.trim()||!b||!a.trim()){re(E=>E.central==null&&!E.updatedAt?E:{...E,central:null});return}let y=!1,k=null,w=async()=>{try{let E=await e.readAggregateFormSyncState(i.trim(),b,a.trim());if(y)return;re(U=>({localSaved:U.localSaved||E.state!=null,central:E.state,updatedAt:E.updatedAt})),(E.state==="PENDING"||E.state==="IN_FLIGHT"||E.state==="RETRYABLE")&&(k=setTimeout(()=>void w(),4e3))}catch{}};return w(),()=>{y=!0,k&&clearTimeout(k)}},[i,a,t.orgUnitUid,Re]),L(()=>{if(!i.trim()||!t.bound||!_?.periodType){ee(new Set),te(new Set);return}let b=!1;return(async()=>{let y=Ne(_.periodType,_.openFuturePeriods??0).map(E=>E.id),[k,w]=await Promise.all([Promise.all(y.map(async E=>{try{return(await e.getCompletion(i.trim(),t.orgUnitUid??"",E)).completed?E:null}catch{return null}})),Promise.all(y.map(async E=>{try{return((await e.readAggregateValues(t.orgUnitUid??"",E,1)).dataValues?.length??0)>0?E:null}catch{return null}}))]);b||(ee(new Set(k.filter(E=>E!==null))),te(new Set(w.filter(E=>E!==null))))})(),()=>{b=!0}},[i,t.orgUnitUid,_?.periodType]),L(()=>{if(!F){B(null);return}let b=!1;return(async()=>{try{let y=await e.getCompletion(i.trim(),t.orgUnitUid??"",a.trim());if(b)return;B({completed:!!y.completed,completedAt:y.completedAt})}catch{b||B({completed:!1})}})(),()=>{b=!0}},[i,a,t.orgUnitUid,F]);async function Fe(){if(!F||K)return;let b=!P?.completed;if(b){let y=A.current;if(y){let k=[];for(let w of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))w.value.trim()===""&&k.push(w);if(k.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${k.length} compulsory value${k.length===1?"":"s"} still missing. Run Validate to jump to them.`}),k[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}me(!0);try{let y=await e.markCompletion({dataSet:i.trim(),orgUnit:t.orgUnitUid??"",period:a.trim(),completed:b});B({completed:!!y.completed,completedAt:y.completedAt}),ee(k=>{let w=new Set(k);return y.completed?w.add(a.trim()):w.delete(a.trim()),w}),N({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){N({kind:"error",message:`Completion failed: ${y.message}`})}finally{me(!1)}}return v(Ge,{dataTest:"der-aggregate-entry",children:[u("style",{children:Ct}),v("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[v("div",{className:"der-de-toolbar__head",children:[u("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:v("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[u("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),u("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),u("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),u("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),u("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),u("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),u("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),v("span",{className:"der-de-toolbar__ou-wrap",children:[u("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),u("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),v("div",{className:"der-de-toolbar__picks",children:[v("label",{className:"der-de-toolbar__field",children:[u("span",{className:"der-de-toolbar__field-label",children:"Data set"}),v("select",{className:"der-de-toolbar__select",value:i,onChange:b=>{m(b.target.value),c("")},"data-test":"der-de-dataset-picker",children:[u("option",{value:"",children:"Select a data set\u2026"}),r.map(b=>u("option",{value:b.id,children:b.label},b.id))]})]}),Te.map(b=>v("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[u("span",{className:"der-de-toolbar__field-label",children:b.name}),v("select",{className:"der-de-toolbar__select",value:R[b.id]??"",onChange:y=>{let k={...R,[b.id]:y.target.value};O(k),z.current=k,et(A.current,k)},"data-test":"de-aoc-select",children:[u("option",{value:"",children:"Select\u2026"}),b.options.map(y=>u("option",{value:y.id,children:y.name},y.id))]})]},b.id)),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[v("span",{className:"der-de-toolbar__field-label",children:["Period",_?.periodType?` \xB7 ${_.periodType}`:""]}),u("span",{className:"der-de-period-wrap",children:St(_?.periodType,a,c,Ce,Ae,_?.openFuturePeriods??0)})]}),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[u("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),v("span",{className:"der-de-toolbar__filter",children:[u("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:V,onChange:b=>pe(b.target.value),"data-test":"de-filter-input"}),V&&u("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>pe(""),children:"\xD7"})]})]}),u("div",{className:"der-de-toolbar__cell-info",children:u(it,{root:A,details:De,formVersion:Q,formSync:Me})})]})]}),h.kind==="ok"&&u("div",{style:kt,"data-test":"de-ok",children:h.message}),h.kind==="error"&&u("div",{style:Nt,"data-test":"de-err",children:h.message}),!t.bound&&u("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!oe&&u("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&oe&&!be&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",_?.formType==="SECTION"?"section":"data entry"," form."]}),F&&s==="structured"&&v("form",{onSubmit:qe,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",u("input",{value:p,onChange:b=>g(b.target.value),style:ce})]}),v("label",{children:["Value",u("input",{value:f,onChange:b=>x(b.target.value),inputMode:"decimal",style:ce})]}),u("div",{style:{gridColumn:"1 / -1"},children:u("button",{type:"submit",disabled:!He,style:xe,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),F&&s==="custom"&&u("div",{className:`der-de-form-card der-de-density-${q}`,children:v("div",{className:"der-de-form-split",children:[u(ot,{targetRef:A,formVersion:Q}),u("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),F&&s==="custom"&&v("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[u(nt,{root:A,formVersion:Q}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Pe(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${H==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${H==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>Ue(b=>b==="der"?"author":"der"),children:H==="der"?"\u2699 DER layout":"\u2699 Author layout"}),P&&u("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:P.completed?`Complete${P.completedAt?" \xB7 "+new Date(P.completedAt).toLocaleString():""}`:"Open for edits"}),u("button",{type:"button",onClick:()=>{xt(A.current,N,(b,y)=>{Ie(b),fe.current=y,J(!0)})},style:_e,"data-test":"de-validate-btn",children:"Validate"}),G.length>0&&!ge&&v("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[G.length," issue",G.length===1?"":"s"]}),u("button",{type:"button",onClick:()=>ae(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),u("button",{type:"button",onClick:Fe,disabled:K,style:P?.completed?_e:xe,"data-test":"de-complete-btn",children:K?"Saving\u2026":P?.completed?"Reopen":"Mark complete"})]}),u(ut,{open:je,onClose:()=>ae(!1)}),u(ct,{open:ge,issues:G,totalCells:fe.current,onClose:()=>J(!1),onPick:b=>{let y=A.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select()),J(!1)}})]})}var Ze=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],We=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],se=null,de=null,le=null;async function ye(o,t){se||(se=t.listAllDataElements().then(d=>new Map(d.map(i=>[i.id,i])))),de||(de=t.listAllCategoryCombos().then(d=>new Map(d.map(i=>[i.id,i])))),le||(le=t.listAllCategoryOptionCombos().then(d=>{let i=new Map;for(let m of d){let a=m.categoryCombo?.id;if(!a)continue;let c=i.get(a);c?c.push(m):i.set(a,[m])}return i}));let[l,e,s]=await Promise.all([se,de,le]),n=d=>{if(!d?.id)return;let i=e.get(d.id),m=s.get(d.id)??[];return i?{id:i.id,name:i.name??i.displayName,categoryOptionCombos:m.map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:a.categoryOptions??[]})),categories:(i.categories??[]).map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:(a.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:d},r=d=>{let i=l.get(d.id);return i?{id:i.id,name:i.name??i.displayName,formName:i.formName,valueType:i.valueType,categoryCombo:n(i.categoryCombo)}:d};return{...o,categoryCombo:n(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?r(d.dataElement):void 0})),sections:(o.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(i=>r(i))}))}}function he(o){let t={};for(let d of o.dataSetElements??[])d.dataElement&&(t[d.dataElement.id]=d.dataElement);let l={};for(let d of o.indicators??[])l[d.id]=d;let e=(o.sections??[]).slice().sort((d,i)=>(d.sortOrder??0)-(i.sortOrder??0));if(!e.some(d=>(d.dataElements?.length??0)>0)){let d=(o.dataSetElements??[]).map(i=>i.dataElement).filter(i=>!!i);e=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let n=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let d of e){let i=new Set;for(let a of d.greyedFields??[])a.dataElement?.id&&a.categoryOptionCombo?.id&&i.add(`${a.dataElement.id}:${a.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${n(d.name??"")}</h3>`);let m=new Map;for(let a of d.dataElements??[]){let c=t[a.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,g=m.get(p);g||(g={cc:c.categoryCombo,des:[]},m.set(p,g)),g.des.push(c)}for(let a of m.values()){let c=a.cc.categoryOptionCombos??[],p=a.cc.categories??[];r.push('<div class="der-de-table-scroll">'),r.push('<table class="sectionTable" cellspacing="0">');let g=Ye(p,c);if(r.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){r.push("<tr>"),f===0&&r.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let x of g[f]??[])r.push(`<th colspan="${x.span}">${n(x.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push('<th class="dataElementCell">Data elements</th>');for(let f of c)r.push(`<th>${n(f.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let f of a.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${n(f.id)}-cell">`+n(f.formName??f.name??f.id)+"</td>");for(let x of c){let h=`${f.id}-${x.id}-val`;i.has(`${f.id}:${x.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${n(h)}" name="${n(h)}" dataelementid="${n(f.id)}" optioncomboid="${n(x.id)}"></td>`)}r.push("</tr>")}for(let f of d.indicators??[]){let x=l[f.id];x&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${n(x.name??x.id)}</td>`),r.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${n(x.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table></div>")}}return r.join(`
`)}function Ye(o,t){if(o.length===0||t.length===0)return[];let l=new Map;for(let r of o)for(let d of r.categoryOptions??[])l.set(d.id,{catId:r.id,name:d.name??d.id});let e=o.length,s=t.map(r=>{let d=new Array(e).fill("");for(let i of r.categoryOptions??[]){let m=l.get(i.id);if(!m)continue;let a=o.findIndex(c=>c.id===m.catId);a>=0&&(d[a]=m.name)}return d});for(let r of s)if(r.some(d=>d===""))return[];let n=[];for(let r=0;r<e;r++){let d=[];for(let i=0;i<s.length;){let m=s[i],a=i+1;for(;a<s.length;){let c=s[a],p=!0;for(let g=0;g<=r;g++)if(m[g]!==c[g]){p=!1;break}if(!p)break;a++}d.push({label:m[r]??"",span:a-i}),i=a}n.push(d)}return n}function Xe(o){let t=globalThis;t.dhis2=t.dhis2??{};let l=t.dhis2;l.de=l.de??{};let e=l.de;e.currentDataSetId=o.dataSetId,e.currentOrganisationUnitId=o.orgUnitId,e.currentPeriodId=o.periodId,e.currentCategorySelections={...o.aocSelections??{}};let s=o.meta??{},n={},r={};if(s.categoryCombo){r[s.categoryCombo.id]=s.categoryCombo;for(let c of s.categoryCombo.categories??[])n[c.id]=c}e.categories=n,e.categoryCombos=r;let d={},i={};for(let c of s.dataSetElements??[]){let p=c.dataElement;p&&(d[p.id]=p,p.optionSet&&(i[p.optionSet.id]=p.optionSet),p.categoryCombo&&(r[p.categoryCombo.id]=p.categoryCombo))}e.dataElements=d,e.optionSets=i;let m={};for(let c of s.indicators??[])m[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};e.indicatorFormulas=m;let a={};for(let c of o.validationRules??[])a[c.id]=c;e.validationRules=a,e.lockExceptions=[],e.emptyOrganisationUnits=[],e.significantZeros=[],e.dataSets={[s.id]:{id:s.id,name:s.name??s.displayName??"",periodType:s.periodType,categoryCombo:s.categoryCombo?.id,periodId:o.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ke(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(t,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let t=o.dhis2.period;t.format="yyyy-mm-dd",t.calendar=o.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function et(o,t){if(!o)return;for(let[e,s]of Object.entries(t)){let n=o.querySelector(`input[data-der-category="${e}"]`);n||(n=document.createElement("input"),n.type="hidden",n.id=`category-${e}`,n.setAttribute("data-der-category",e),o.appendChild(n)),n.value=s}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...t})}function tt(o,t,l,e,s,n,r){let d=c=>{let p=/^(.+)-(.+)-val$/.exec(c);return p?{de:p[1],coc:p[2]}:null},i=new WeakMap,m=o.querySelectorAll('input[name$="-val"]');for(let c of Array.from(m))i.set(c,c.value);let a=async c=>{let p=c.target;if(!p||p.tagName!=="INPUT")return;let g=p.getAttribute("name")??"",f=d(g);if(!f)return;let x=t(),h=l(),N=e();if(!x||!h||!N)return;let _=p.value;if(i.get(p)===_)return;let C=p.getAttribute("data-valuetype")??"TEXT";if(_!==""&&ue(_,C)){Z(p,"error");return}Z(p,"saving");try{let A=await n.submitAggregate({dataSet:x,period:h,orgUnit:N,attributeOptionComboSelections:s(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:_}]});i.set(p,_);let R=A?.status==="OFFLINE_QUEUED"?"queued":"saved";Z(p,R),r?.(R)}catch{Z(p,"error")}};o.addEventListener("blur",c=>{a(c)},!0)}function rt(o){let t=(e,s)=>{let n=e.getAttribute("name")??"",r=/^(.+)-(.+)-val$/.exec(n);if(!r)return;let d=r[2],i=Array.from(o.querySelectorAll(`input[name$="-${d}-val"]`)),m=i.indexOf(e);if(m===-1)return;let a=i[m+s];a&&(a.focus(),a.select())},l=(e,s)=>{let n=e.closest("tr");if(!n)return;let r=Array.from(n.querySelectorAll('input[name$="-val"]')),d=r.indexOf(e);if(d===-1)return;let i=r[d+s];i&&(i.focus(),i.select())};o.addEventListener("keydown",e=>{let s=e,n=s.target;if(n instanceof HTMLInputElement&&/-val$/.test(n.getAttribute("name")??"")&&!(s.metaKey||s.ctrlKey||s.altKey)){if(s.key==="Enter"){s.preventDefault(),t(n,s.shiftKey?-1:1);return}if(s.key==="ArrowUp"||s.key==="ArrowDown"){s.preventDefault(),t(n,s.key==="ArrowUp"?-1:1);return}if(s.key==="ArrowLeft"||s.key==="ArrowRight"){let r=n.selectionStart===0&&n.selectionEnd===0,d=n.selectionStart===n.value.length&&n.selectionEnd===n.value.length;s.key==="ArrowLeft"&&r?(s.preventDefault(),l(n,-1)):s.key==="ArrowRight"&&d&&(s.preventDefault(),l(n,1))}}})}function at(o){let t=Array.from(o.querySelectorAll("h2, h3, h4")).filter(n=>(n.textContent??"").trim().length>0);if(t.length<2)return[];let l=new Set(t),e=[],s=(n,r)=>{for(let d of l)if(d!==r&&n.contains(d))return!0;return!1};return t.forEach((n,r)=>{let d=n.id||`der-de-section-${r}`;n.id=d;let i=null,m=n.parentElement,a=null;for(;m&&m!==o&&!s(m,n);)a=m,m=m.parentElement;if(a&&a.children.length>1&&a!==o)i=a,i.classList.add("der-de-section-slot"),i.dataset.sectionId=d;else{i=document.createElement("div"),i.className="der-de-section-slot",i.dataset.sectionId=d;let c=t[r+1]??null,p=[],g=n;for(;g&&g!==c;){let f=g.nextSibling;p.push(g),g=f}n.parentNode?.insertBefore(i,n);for(let f of p)i.appendChild(f)}e.push({id:d,label:(n.textContent??"").trim(),slot:i})}),e}function ot({targetRef:o,formVersion:t}){let[l,e]=T([]),[s,n]=T(""),[r,d]=T({});return L(()=>{let i=o.current;if(!i)return;let m=at(i);e(m),n(m[0]?.id??"")},[o,t]),L(()=>{if(l.length===0)return;let i=()=>{let c={};for(let p of l){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(x=>x.value.trim()!=="").length;c[p.id]={filled:f,total:g.length}}d(c)};i();let m=o.current;if(!m)return;let a=c=>{let p=c.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&i()};return m.addEventListener("input",a,!0),()=>{m.removeEventListener("input",a,!0)}},[o,l]),L(()=>{if(!o.current||l.length===0)return;for(let a of l)a.slot.style.display=a.id===s?"":"none";let m=l.find(a=>a.id===s);m&&m.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,l,s]),l.length<2?null:v("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[u("div",{className:"der-de-section-nav__title",children:"Sections"}),u("ul",{className:"der-de-section-nav__list",children:l.map(i=>{let m=r[i.id],a=!m||m.total===0||m.filled===0?"muted":m.filled===m.total?"done":"partial";return u("li",{children:v("button",{type:"button",className:"der-de-section-nav__item"+(s===i.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>n(i.id),children:[u("span",{className:"der-de-section-nav__label",children:i.label}),m&&m.total>0&&u("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${a}`,"data-test":"de-section-nav-ratio",title:`${m.filled} of ${m.total} cells filled`,children:a==="done"?"\u2713":`${m.filled}/${m.total}`})]})},i.id)})})]})}function nt({root:o,formVersion:t}){let[l,e]=T({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(L(()=>{let r=()=>{let i=o.current;if(!i)return;let m=Array.from(i.querySelectorAll('input[name$="-val"]')),a=0,c=0,p=0,g=0,f=0;for(let x of m){x.value.trim()!==""&&a++;let h=x.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?c++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?g++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?p++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&f++}e({total:m.length,filled:a,saving:c,saved:p,queued:g,error:f})};r();let d=window.setInterval(r,800);return()=>window.clearInterval(d)},[o,t]),l.total===0)return u("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let s=[];s.push(`${l.filled} of ${l.total} filled`),l.saving>0&&s.push(`${l.saving} saving`),l.queued>0&&s.push(`${l.queued} queued`),l.error>0&&s.push(`${l.error} error`);let n=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return u("span",{className:`der-de-savepill der-de-savepill--${n}`,"data-test":"de-save-state",children:s.join(" \xB7 ")})}function it({details:o,formSync:t}){let l={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},e={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return u("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:u("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:o?v(W,{children:[u("span",{className:"der-de-live-strip__de",children:o.deName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__coc",children:o.cocName}),o.value&&v(W,{children:[u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__value",children:o.value}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:`der-de-live-strip__state der-de-live-strip__state--${e[o.saveState]}`,children:l[o.saveState]}),(o.lastUpdated||o.lastUpdatedBy)&&v(W,{children:[u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),v("span",{className:"der-de-live-strip__audit","data-test":"de-live-audit",title:o.lastUpdated?new Date(o.lastUpdated).toLocaleString():void 0,children:[o.lastUpdated?wt(o.lastUpdated):"earlier",o.lastUpdatedBy&&v(W,{children:[" by ",u("strong",{children:o.lastUpdatedBy})]})]})]})]}),u(st,{formSync:t,cellState:o.saveState}),o.compulsory&&u("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):u("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function st({formSync:o,cellState:t}){let l=t==="saved"||t==="queued",e=t==="saved"||t==="queued"?"lit":t==="saving"?"pending":t==="error"?"error":"muted",s=o.central,n=l?s==="CENTRAL_ACCEPTED"?"lit":s==="PENDING"||s==="IN_FLIGHT"||s==="RETRYABLE"||s==="UNKNOWN_OUTCOME"?"pending":s==="CENTRAL_REJECTED"||s==="CONFLICT_REVIEW"||s==="QUARANTINED"||s==="REQUIRES_APPROVAL"?"error":"muted":"muted",r=e==="lit"?"Saved on edge (DER)":e==="pending"?"Saving on edge\u2026":e==="error"?"Rejected by edge":"No value entered yet",d=n==="lit"?"Synced to Central DHIS2":n==="pending"?`Sync in progress (${s})`:n==="error"?`Central reported ${s}`:l?"Awaiting Central sync":"No value entered yet";return v("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+e,title:r,"data-test":"de-sync-der","data-state":e,children:[u(dt,{}),u("span",{className:"der-de-sync-logos__dot is-"+e,"aria-hidden":"true"})]}),v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+n,title:d,"data-test":"de-sync-central","data-state":n,children:[u(lt,{}),u("span",{className:"der-de-sync-logos__dot is-"+n,"aria-hidden":"true"})]})]})}function dt(){return u("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",fillRule:"evenodd",children:[u("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),u("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),u("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),u("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),u("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),u("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),u("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),u("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),u("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),u("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),u("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),u("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),u("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function lt(){return u("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",children:[u("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),u("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),u("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function ct({open:o,issues:t,totalCells:l,onClose:e,onPick:s}){if(L(()=>{if(!o)return;let r=d=>{d.key==="Escape"&&e()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[o,e]),!o)return null;let n=t.length===0;return u("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:r=>{r.target===r.currentTarget&&e()},children:v("div",{className:"der-de-validation "+(n?"der-de-validation--ok":"der-de-validation--err"),children:[v("header",{className:"der-de-validation__head",children:[v("div",{className:"der-de-validation__title",children:[u("span",{className:"der-de-validation__badge","aria-hidden":"true",children:n?"\u2713":"!"}),u("h3",{className:"der-de-validation__heading",children:n?`Validation passed \u2014 all ${l} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${l} cells.`})]}),u("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:e,children:"\xD7"})]}),u("div",{className:"der-de-validation__body",children:n?v("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",u("strong",{children:" Mark complete"})," when you're ready."]}):v("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[u("thead",{children:v("tr",{children:[u("th",{scope:"col",children:"Data element"}),u("th",{scope:"col",children:"Category option combo"}),u("th",{scope:"col",children:"Entered value"}),u("th",{scope:"col",children:"Problem"}),u("th",{scope:"col"})]})}),u("tbody",{children:t.map(r=>v("tr",{"data-test":"de-issues-row",children:[u("td",{children:r.deName}),u("td",{className:"der-de-validation__coc",children:r.cocName}),u("td",{children:u("code",{className:"der-de-validation__value",children:r.value||"\u2014"})}),u("td",{className:"der-de-validation__why",children:r.problem}),u("td",{className:"der-de-validation__jump",children:u("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>s(r),children:"Jump to cell \u2192"})})]},`${r.deId}-${r.cocId}`))})]})})]})})}function ut({open:o,onClose:t}){return L(()=>{if(!o)return;let e=s=>{s.key==="Escape"&&t()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[o,t]),o?u("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:e=>{e.target===e.currentTarget&&t()},children:v("div",{className:"der-de-shortcuts",children:[v("header",{className:"der-de-shortcuts__head",children:[u("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),u("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),u("dl",{className:"der-de-shortcuts__list",children:[["Enter / \u2193","Next row (same COC column)"],["Shift + Enter / \u2191","Previous row"],["\u2190 / \u2192","Previous / next COC column (same row)"],["Tab / Shift + Tab","Next / previous cell (DOM order)"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([e,s])=>v("div",{className:"der-de-shortcuts__row",children:[u("dt",{children:u("kbd",{children:e})}),u("dd",{children:s})]},e))})]})}):null}function mt(o,t){o.addEventListener("paste",l=>{let e=l.target;if(!e||e.tagName!=="INPUT")return;let s=e.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(s))return;let r=l.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(r),i=/\t/.test(r);if(!d&&!i)return;let m=r.split(/\r?\n/).filter((_,C,A)=>!(C===A.length-1&&_==="")).map(_=>_.split("	").map(C=>C.trim()));if(m.length===0)return;l.preventDefault();let a=e.closest("[data-section-id]")??o,p=Array.from(a.querySelectorAll("tbody tr")).map(_=>Array.from(_.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let _=0;_<p.length;_++){let C=p[_].indexOf(e);if(C!==-1){g=_,f=C;break}}if(g===-1)return;let x=0,h=0;for(let _=0;_<m.length;_++){let C=m[_],A=p[g+_];if(!A){h+=C.length;continue}for(let R=0;R<C.length;R++){let O=A[f+R];if(!O){h++;continue}O.value=C[R]??"",O.dispatchEvent(new Event("input",{bubbles:!0})),O.dispatchEvent(new Event("blur",{bubbles:!0})),x++}}let N=m.length===1?`${m[0].length}-cell row`:m[0]?.length===1?`${m.length}-cell column`:`${m.length}\xD7${m[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${x} value${x===1?"":"s"} (${N}${h>0?`, ${h} overflow`:""}).`})},!0)}function pt(o){let t=Array.from(o.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let l=[];for(let e of t){let s=e.getAttribute("dataelementid")??"";if(!s)continue;let n=e.closest("div"),d=(()=>{let a=n??e.parentElement;if(!a)return null;let c=a.previousElementSibling;for(;c;){if(/^(H1|H2|H3|H4)$/.test(c.tagName)||c.tagName==="DIV"&&!c.querySelector("table, input")&&(c.textContent??"").trim().length>0)return c;c=c.previousElementSibling}let p=a.closest("[data-section-id]");if(p){let g=p.querySelector("h2, h3, h4");if(g)return g}return null})();if(!d)continue;n?.remove();let i=document.createElement("span");i.className="der-de-matrix-total",i.setAttribute("data-de",s),d.appendChild(i);let m=()=>{let a=0,c=!1,p=Array.from(o.querySelectorAll(`input[dataelementid="${s}"][name$="-val"],input[name^="${s}-"][name$="-val"]`)),g=new Set;for(let f of p){if(g.has(f))continue;g.add(f);let x=parseFloat(f.value);Number.isFinite(x)&&(a+=x,c=!0)}if(c){let f=Number.isInteger(a)?a:Number(a.toFixed(2));i.textContent=` (Total: ${f})`}else i.textContent=""};l.push(m),m()}l.length!==0&&o.addEventListener("input",e=>{let s=e.target;if(!(!s||s.tagName!=="INPUT")&&/-val$/.test(s.getAttribute("name")??""))for(let n of l)n()},!0)}function gt(o,t){let l=t.indicators??[];if(l.length===0)return;let e=l.filter(a=>a.numerator&&a.denominator).map(a=>({id:a.id,factor:a.indicatorType?.factor??1,numExpr:a.numerator,denExpr:a.denominator}));if(e.length===0)return;let s=Array.from(o.querySelectorAll("input[indicatorid]")),n=new Map;for(let a of Array.from(o.querySelectorAll('input[name$="-val"]')))n.set(a.getAttribute("name")??"",a);let r=a=>{let c=0;for(let[p,g]of n){if(!p.startsWith(`${a}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(c+=f)}return c},d=a=>a.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,g)=>{if(g){let f=n.get(`${p}-${g}-val`),x=parseFloat(f?.value??"");return Number.isFinite(x)?String(x):"0"}return String(r(p))}),i=a=>{if(!/^[\s\d+\-*/().eE]+$/.test(a))return NaN;try{return Function(`"use strict";return (${a})`)()}catch{return NaN}},m=()=>{for(let a of e){let c=i(d(a.numExpr)),p=i(d(a.denExpr)),g=s.find(x=>x.getAttribute("indicatorid")===a.id);if(!g)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){g.value="";continue}let f=c/p*a.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};o.addEventListener("input",a=>{let c=a.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&m()},!0),m()}function ft(o,t){let l={};for(let e of t.dataSetElements??[])e.dataElement&&(l[e.dataElement.id]=e.dataElement);for(let e of Array.from(o.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!s)continue;let n=l[s[1]],r=n?.formName??n?.name??s[1],d=n?.categoryCombo?.categoryOptionCombos?.find(m=>m.id===s[2]),i=d?.name??d?.displayName??s[2];e.hasAttribute("aria-label")||e.setAttribute("aria-label",i===s[2]?`${r}`:`${r}, ${i}`),e.getAttribute("data-compulsory")==="1"&&e.setAttribute("aria-required","true")}}function bt(o,t){let l={};for(let e of t.dataSetElements??[])e.dataElement&&(l[e.dataElement.id]=e.dataElement);for(let e of Array.from(o.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!s)continue;let n=l[s[1]]?.valueType??"TEXT";switch(e.setAttribute("data-valuetype",n),n){case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":e.setAttribute("inputmode","numeric"),e.setAttribute("pattern","-?\\d*");break;case"NUMBER":case"UNIT_INTERVAL":case"PERCENTAGE":e.setAttribute("inputmode","decimal"),e.setAttribute("pattern","-?\\d*(\\.\\d+)?");break;case"EMAIL":e.setAttribute("inputmode","email"),e.setAttribute("type","email");break;case"PHONE_NUMBER":e.setAttribute("inputmode","tel"),e.setAttribute("type","tel");break;case"URL":e.setAttribute("inputmode","url"),e.setAttribute("type","url");break;case"DATE":e.setAttribute("type","date");break;case"TIME":e.setAttribute("type","time");break;case"DATETIME":e.setAttribute("type","datetime-local");break;default:break}}}function yt(o){let t=l=>{let e=l.value;if(e===""){l.removeAttribute("data-de-invalid"),l.removeAttribute("title");return}let s=l.getAttribute("data-valuetype")??"TEXT",n=ue(e,s);n?(l.setAttribute("data-de-invalid","1"),l.setAttribute("title",n)):(l.removeAttribute("data-de-invalid"),l.removeAttribute("title"))};o.addEventListener("input",l=>{let e=l.target;!e||e.tagName!=="INPUT"||/-val$/.test(e.getAttribute("name")??"")&&t(e)},!0);for(let l of Array.from(o.querySelectorAll('input[name$="-val"]')))t(l)}function ht(o,t){let l=t.compulsoryDataElementOperands??[],e=new Set;for(let s of l){let n=s.dimensionItem;if(!n)continue;let r=n.split(".");r.length===2&&e.add(`${r[0]}:${r[1]}`)}if(e.size!==0)for(let s of Array.from(o.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(s.getAttribute("name")??"");n&&e.has(`${n[1]}:${n[2]}`)&&s.setAttribute("data-compulsory","1")}}function vt(o,t,l){let e={};for(let n of t.dataSetElements??[])n.dataElement&&(e[n.dataElement.id]=n.dataElement);let s=n=>{let r=n.getAttribute("name")??n.id??"",d=/^(.+)-(.+)-val$/.exec(r);if(!d)return null;let i=d[1],m=d[2],a=e[i],c=a?.categoryCombo,p=c?.categoryOptionCombos?.find(C=>C.id===m),g=[],f=p?.name??p?.displayName??m,x=f.split(/,\s*/).filter(Boolean),h=c?.categories??[];x.forEach((C,A)=>{g.push({category:h[A]?.name??h[A]?.displayName??"",option:C})});let N=n.style.outline||"",_=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":n.value.trim()===""?"empty":"saved";return{deId:i,cocId:m,deName:a?.name??i,deFormName:a?.formName,valueType:a?.valueType??"TEXT",optionSetId:a?.optionSet?.id,cocName:f,categoryBreakdown:g,value:n.value,saveState:_,inputName:r,compulsory:n.getAttribute("data-compulsory")==="1",lastUpdated:n.getAttribute("data-updated")??void 0,lastUpdatedBy:n.getAttribute("data-updated-by")??void 0}};o.addEventListener("focusin",n=>{let r=n.target;if(r&&r.tagName==="INPUT"){let d=s(r);d&&l(d)}},!0),o.addEventListener("input",n=>{let r=n.target;if(r&&r.tagName==="INPUT"){let d=s(r);d&&l(d)}},!0)}function xt(o,t,l){if(!o)return;let e=globalThis,s=e.dhis2?.de?.dataElements??{},n=e.dhis2?.de?.categoryOptionCombos??{},r=Array.from(o.querySelectorAll('input[name$="-val"]')),d=[];for(let i of r){i.style.outline="";let m=/^(.+)-(.+)-val$/.exec(i.getAttribute("name")??"");if(!m)continue;let a=m[1],c=m[2],p=s[a],g=p?.valueType??"TEXT",f=i.value.trim();if(f===""){i.getAttribute("data-compulsory")==="1"&&(i.style.outline="2px solid #c0392b",d.push({deId:a,cocId:c,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??a,cocName:n[c]?.name??c,inputName:i.name}));continue}let x=ue(f,g);x&&(i.style.outline="2px solid #c0392b",d.push({deId:a,cocId:c,valueType:g,value:f,problem:x,deName:p?.name??a,cocName:n[c]?.name??c,inputName:i.name}))}l(d,r.length),t({kind:"idle"})}function ue(o,t){let l=Number(o),e=Number.isInteger(l);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(t){case"INTEGER":if(!e)return"must be an integer";break;case"INTEGER_POSITIVE":if(!e||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!e||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!e||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function Z(o,t){let l=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${l}`,o.style.transition="outline 150ms",t==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function _t(o,t,l,e,s){if(!t||!l||!e)return;let n;try{n=(await s.readAggregateValues(e,l,2e3)).dataValues??[]}catch{return}for(let r of n){let d=r.dataElement,i=r.categoryOptionCombo,m=r.value;if(!d||!i||m==null)continue;let a=o.querySelector(`input[name="${d}-${i}-val"]`);a&&(a.value=m,r.lastUpdated&&a.setAttribute("data-updated",r.lastUpdated),r.storedByUsername&&a.setAttribute("data-updated-by",r.storedByUsername))}}function wt(o){let t=Date.parse(o);if(!Number.isFinite(t))return o;let l=Date.now()-t;if(l<0)return new Date(t).toLocaleString();let e=Math.floor(l/6e4);if(e<1)return"just now";if(e<60)return`${e} min ago`;let s=Math.floor(e/60);if(s<24)return`${s} h ago`;let n=Math.floor(s/24);return n<30?`${n} d ago`:new Date(t).toLocaleDateString()}function Ee(o){return new Promise((t,l)=>{let e=document.createElement("script");e.src=o,e.async=!1,e.setAttribute("data-der-custom-form",o),e.onload=()=>t(),e.onerror=()=>l(new Error(`failed to load ${o}`)),document.head.appendChild(e)})}function ke(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=o,t.setAttribute("data-der-custom-form",o),document.head.appendChild(t)}function ve(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Et(o,t,l={}){let e=l.stripStyles??!0;o.classList.toggle("der-de-custom-form--author",!e);let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let r of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let d=r.getAttribute("href")??"";d&&ke(ve(d))}else{let d=document.createElement("style");d.textContent=r.textContent??"",d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d)}r.remove()}let n=[];for(let r of Array.from(s.querySelectorAll("script"))){let d=r.getAttribute("src");d?n.push({src:ve(d)}):n.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(s.body.querySelectorAll("*"))){if(e&&r.removeAttribute("style"),r.tagName==="INPUT"){let d=r.getAttribute("id")??"";d.endsWith("-val")&&r.getAttribute("name")!==d&&r.setAttribute("name",d)}if(e&&r.tagName==="TH"){let d=(r.textContent??"").trim();(d==="Reporting item"||d==="Reported count")&&(r.textContent=d==="Reporting item"?"Data elements":"Value")}}for(let r of Array.from(s.body.childNodes))o.appendChild(document.adoptNode(r));for(let r of n)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await Ee(r.src);else if(r.code){let d=document.createElement("script");d.textContent=r.code,d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d),d.remove()}}var ce={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},xe={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},_e={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},kt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},Nt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function St(o,t,l,e=new Set,s=new Set,n=0){let r=(h,N)=>e.has(h)?`\u2713  ${N}`:s.has(h)?`\u25CF  ${N}`:N,d={...ce},i=Ne(o,n);if(i.length===0)return u("input",{value:t,onChange:h=>l(h.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:d});let m=[...i];if(t&&!m.some(h=>h.id===t)){let h=Tt(o,t)??t;m.unshift({id:t,label:h})}let a=i[0]?.id??null,c=m.findIndex(h=>h.id===t),p=c===-1||c<m.length-1||!!o,g=t!==""&&(c>0||t!==a),f=()=>{if(!o)return;let h=c>=0&&c<m.length-1?m[c+1]?.id??"":we(o,t||a||"",-1);h&&l(h)},x=()=>{if(!o||!t||t===a)return;let h=c>0?m[c-1]?.id??"":we(o,t,1);h&&l(h)};return v("span",{className:"der-de-period-nav",children:[u("button",{type:"button","aria-label":"Previous period",onClick:f,disabled:!p,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:t,onChange:h=>l(h.target.value),style:d,children:[u("option",{value:"",children:"Select a period\u2026"}),m.map(h=>u("option",{value:h.id,children:r(h.id,h.label)},h.id))]}),u("button",{type:"button","aria-label":"Next period",onClick:x,disabled:!g,className:"der-de-period-btn",children:"\u25B6"})]})}function we(o,t,l){let e=s=>String(s).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(t))return"";let s=Number(t.slice(0,4)),n=Number(t.slice(4,6))-1,r=Number(t.slice(6,8)),d=new Date(s,n,r+l);return`${d.getFullYear()}${e(d.getMonth()+1)}${e(d.getDate())}`}case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(t);if(!s)return"";let n=Number(s[1]),r=Number(s[2])+l;return r<1?(n-=1,r=Y(n)):r>Y(n)&&(n+=1,r=1),`${n}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let s=Number(t.slice(0,4)),n=Number(t.slice(4,6))-1,r=s*12+n+l;return`${Math.floor(r/12)}${e((r%12+12)%12+1)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(t);if(!s)return"";let n=Number(s[1]),r=Number(s[2])+l;return r<1?(n-=1,r=6):r>6&&(n+=1,r=1),`${n}${e(r)}B`}case"Quarterly":{let s=/^(\d{4})Q(\d)$/.exec(t);if(!s)return"";let n=Number(s[1]),r=Number(s[2])+l;return r<1?(n-=1,r=4):r>4&&(n+=1,r=1),`${n}Q${r}`}case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(t);if(!s)return"";let n=Number(s[1]),r=Number(s[2])+l;return r<1?(n-=1,r=2):r>2&&(n+=1,r=1),`${n}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+l):"";default:return""}}function Tt(o,t){let l=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(t);return e?`${e[1]} W${String(e[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let e=Number(t.slice(4,6))-1;return`${l[e]??""} ${t.slice(0,4)}`}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(t);if(!e)return null;let s=(Number(e[2])-1)*2;return`${l[s]}\u2013${l[s+1]} ${e[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(t);return e?`${e[1]} ${e[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function Ne(o,t=0){let l=new Date,e=l.getFullYear(),s=l.getMonth(),n=i=>String(i).padStart(2,"0"),r=["January","February","March","April","May","June","July","August","September","October","November","December"],d=Math.max(0,1-Math.max(0,t));switch(o){case"Daily":{let i=[];for(let m=d;m<30+d;m++){let a=new Date(l);a.setDate(a.getDate()-m);let c=`${a.getFullYear()}${n(a.getMonth()+1)}${n(a.getDate())}`,p=`${a.getFullYear()}-${n(a.getMonth()+1)}-${n(a.getDate())}`;i.push({id:c,label:p})}return i}case"Weekly":{let i=[],m=Se(l),a=m.year,c=m.week;for(let p=0;p<d;p++)c-=1,c<1&&(a-=1,c=Y(a));for(let p=0;p<12;p++)i.push({id:`${a}W${c}`,label:`${a} W${n(c)}`}),c-=1,c<1&&(a-=1,c=Y(a));return i}case"Monthly":{let i=[];for(let m=d;m<24+d;m++){let a=e,c=s,p=a*12+c-m,g=Math.floor(p/12),f=(p%12+12)%12;i.push({id:`${g}${n(f+1)}`,label:`${r[f]} ${g}`})}return i}case"BiMonthly":{let i=[],m=Math.floor(s/2)+1,a=e,c=m;for(let p=0;p<d;p++)c-=1,c<1&&(a-=1,c=6);for(let p=0;p<12;p++){let g=(c-1)*2;i.push({id:`${a}${n(c)}B`,label:`${r[g]}\u2013${r[g+1]} ${a}`}),c-=1,c<1&&(a-=1,c=6)}return i}case"Quarterly":{let i=[],m=Math.floor(s/3)+1,a=e,c=m;for(let p=0;p<d;p++)c-=1,c<1&&(a-=1,c=4);for(let p=0;p<8;p++)i.push({id:`${a}Q${c}`,label:`${a} Q${c}`}),c-=1,c<1&&(a-=1,c=4);return i}case"SixMonthly":{let i=[],m=s<6?1:2,a=e,c=m;for(let p=0;p<d;p++)c-=1,c<1&&(a-=1,c=2);for(let p=0;p<6;p++)i.push({id:`${a}S${c}`,label:`${a} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(a-=1,c=2);return i}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let i=[];for(let m=d;m<10+d;m++){let a=e-m;i.push({id:String(a),label:String(a)})}return i}default:return[]}}function Se(o){let t=new Date(o.getFullYear(),o.getMonth(),o.getDate()),l=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-l);let e=new Date(t.getFullYear(),0,1),n=Math.round((t.getTime()-e.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((n+1)/7)}}function Y(o){return Se(new Date(o,11,28)).week}var Ct=`
/* Flat-UI reset \u2014 the data-entry app renders inside the AppHost
 * wrapper and matches the admin-ui's zero-radius / solid-ink
 * table language. Any radius we still want on an individual
 * element must re-declare it explicitly after this rule. */
.der-apphost .der-de-toolbar *,
.der-apphost .der-de-actionbar *,
.der-apphost .der-de-form-card *,
.der-apphost .der-de-section-nav *,
.der-apphost .der-de-details-drawer,
.der-apphost .der-de-details-drawer * {
  border-radius: 0 !important;
}

/* Section tables \u2014 adopt the admin-ui ea-table look: collapsed
 * borders, uppercase 13 px sticky thead with a 2 px underline,
 * no cell borders, subtle hover tint. */
.der-apphost .der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  table-layout: auto;
  font-size: 14px;
  margin: 0;
}
.der-apphost .der-de-form-card .sectionTable th,
.der-apphost .der-de-form-card .sectionTable td {
  padding: 6px 8px;
  border: 0 !important;
  text-align: left;
  vertical-align: middle;
  background: transparent !important;
}
.der-apphost .der-de-form-card .sectionTable thead th {
  background: transparent !important;
  color: var(--der-ink-700, #2a3447);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #f0f3fb !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
/* Matrix title total badge \u2014 "(Total: 19)" appended to the
 * title of each disaggregated matrix. Updates live from input
 * events on inputs sharing the same dataelementid. */
.der-de-matrix-total {
  margin-left: 6px;
  font-weight: 400;
  color: var(--der-ink-500, #5b6478);
  font-size: 0.92em;
}

/* Inline live strip \u2014 mounted on the right of the picks row
 * (Dataset \xB7 AOC \xB7 Period). No row of its own; shares the
 * baseline of the selects. */
.der-de-toolbar__cell-info {
  margin-left: auto;
  align-self: flex-end;
  padding-bottom: 4px;
  max-width: 560px;
  overflow: hidden;
}
.der-de-live-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--der-ink-700, #2a3447);
}
.der-de-live-strip__cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--der-ink-700, #2a3447);
  font-size: 12px;
}
.der-de-live-strip__de {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-de-live-strip__coc {
  color: var(--der-ink-500, #5b6478);
}
.der-de-live-strip__value {
  color: var(--der-ink-900, #101a32);
  font-family: ui-monospace, monospace;
}
.der-de-live-strip__empty {
  color: var(--der-ink-300, #9097a8);
  font-style: normal;
}
.der-de-live-strip__sep {
  color: var(--der-ink-300, #9097a8);
}
.der-de-live-strip__state--muted  { color: #5b6478; }
.der-de-live-strip__state--saved  { color: #1b8243; }
.der-de-live-strip__state--saving { color: #9b5a00; }
.der-de-live-strip__state--queued { color: #9b5a00; }
.der-de-live-strip__state--error  { color: #c0392b; }
.der-de-live-strip__required {
  color: #9b5a00;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.der-de-live-strip__audit {
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
}
.der-de-live-strip__audit strong {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-de-sync-logos {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}
.der-de-sync-logos__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: 0;
  line-height: 1;
}
.der-de-sync-logos__pin svg { flex-shrink: 0; }
/* Each brand mark keeps its native dark hue \u2014 status is communicated
 * by the small square dot next to it, not by recolouring the logo. */
.der-de-sync-logos__pin--der    { color: #0B3558; }
.der-de-sync-logos__pin--central { color: #0080d4; }
/* Square status dot, 8 px. Green = saved/synced, orange = pending,
 * red = error, gray = empty. */
.der-de-sync-logos__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background: #c6ccd7;
}
.der-de-sync-logos__dot.is-muted   { background: #c6ccd7; }
.der-de-sync-logos__dot.is-lit     { background: #1b8243; }
.der-de-sync-logos__dot.is-pending { background: #c6680a; }
.der-de-sync-logos__dot.is-error   { background: #a3322c; }
.der-de-sync-logos__svg {
  display: block;
  flex-shrink: 0;
}
.der-de-live-strip__hint {
  color: var(--der-ink-500, #5b6478);
  font-style: italic;
}
.der-apphost .der-de-form-card .sectionTable .dataElementCell {
  background: transparent !important;
  color: var(--der-ink-900, #101a32);
  font-weight: 400;
  min-width: 220px;
  padding: 4px 8px !important;
}
.der-apphost .der-de-form-card .sectionTable tbody tr {
  border: 0 !important;
  min-height: 32px;
}
.der-apphost .der-de-form-card .sectionTable tbody tr:hover td,
.der-apphost .der-de-form-card .sectionTable tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
.der-apphost .der-de-form-card .sectionTable tbody td {
  padding: 3px 8px !important;
  color: var(--der-ink-900, #101a32) !important;
  line-height: 1.4;
  font-size: 14px;
}
/* Blocked / not-applicable cells \u2014 DHIS2 greyedFields. Soft
 * indigo-tinted wash + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f9,
    #eef0f9 6px,
    #dde3f1 6px,
    #dde3f1 7px
  ) !important;
  color: #8893b1 !important;
  text-align: center;
}
/* Indicator rows \u2014 computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f0f3fb !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #aaa !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 14px;
  color: var(--der-ink-900, #101a32);
}
.der-apphost .der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
}

/* Solid-ink pills \u2014 no pastel tint, just coloured text on
 * transparent background with a thin bottom underline. */
.der-apphost .der-de-toolbar__status,
.der-apphost .der-de-savepill,
.der-apphost .der-de-section-nav__ratio,
.der-apphost .der-de-completion-pill,
.der-apphost .der-de-issues-chip {
  background: transparent !important;
  padding: 0 4px !important;
  border: 0 !important;
}
.der-apphost .der-de-toolbar__status--on    { color: #1b8243 !important; }
.der-apphost .der-de-toolbar__status--off   { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--saved        { color: #1b8243 !important; }
.der-apphost .der-de-savepill--saving       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--queued       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--error        { color: #c0392b !important; }
.der-apphost .der-de-section-nav__ratio--muted   { color: #5b6478 !important; }
.der-apphost .der-de-section-nav__ratio--partial { color: #9b5a00 !important; }
.der-apphost .der-de-section-nav__ratio--done    { color: #1b8243 !important; }

/* Single sticky toolbar \u2014 replaces the old title + chip strip.
 * SOLID background so scrolling long forms doesn't show the
 * grid through the header. */
.der-de-toolbar {
  position: sticky;
  top: 52px;
  z-index: 5;
  margin: 0 -20px 12px;
  padding: 10px 20px 10px;
  background: #ffffff;
  border-bottom: 1px solid #e5e9ef;
  box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
}
.der-de-toolbar__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.der-de-toolbar__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #e6f1fb;
  flex: 0 0 auto;
}
.der-de-toolbar__title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: #101a32;
  letter-spacing: -0.01em;
}
.der-de-toolbar__status {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0;
  background: transparent;
}
.der-de-toolbar__status::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  vertical-align: 1px;
  background: currentColor;
}
.der-de-toolbar__status--on  { color: #1b8243; }
.der-de-toolbar__status--off { color: #9b5a00; }
.der-de-toolbar__ou-wrap {
  margin-left: auto;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  max-width: 360px;
}
.der-de-toolbar__ou-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9097a8;
}
.der-de-toolbar__ou {
  color: #101a32;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.der-de-toolbar__picks {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.der-de-toolbar__field {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
}
.der-de-toolbar__field--period {
  min-width: 260px;
}
.der-de-toolbar__field--filter {
  min-width: 240px;
  max-width: 320px;
}
.der-de-toolbar__filter {
  display: inline-flex;
  width: 100%;
  position: relative;
}
.der-de-toolbar__filter-input {
  width: 100%;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  background: #fff;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__filter-input:hover { border-color: #9aa3b8; }
.der-de-toolbar__filter-input:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
.der-de-toolbar__filter-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  cursor: pointer;
  color: #6e7a8a;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}
.der-de-toolbar__field-label {
  font-size: 11px;
  color: #6e7a8a;
  letter-spacing: 0.04em;
}
.der-de-toolbar__select,
.der-apphost .der-de-period-nav select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  border-radius: 0;
  background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='%235b6478' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>")
    no-repeat right 8px center;
  background-size: 10px 6px;
  box-shadow: none;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__select:hover,
.der-apphost .der-de-period-nav select:hover {
  border-color: #9aa3b8;
}
.der-de-toolbar__select:focus,
.der-apphost .der-de-period-nav select:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Back-compat kill switch for legacy .der-de-chip classes. */
.der-de-chip, .der-de-chip-signed,
.der-de-chip-label, .der-de-chip-value {
  display: none !important;
}
.der-de-select,
.der-de-period-wrap > * {
  font-size: 13px;
  font-family: inherit;
}
.der-de-select:focus,
.der-de-period-wrap > *:focus {
  outline: none;
  border-color: var(--der-brand-500, #147CD7);
}
/* Compound prev-[select]-next. No wrapping border; each child
 * carries its own 1 px outline so the three items read as one
 * unit without a second enclosing frame. */
.der-de-period-nav {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  width: 100%;
}
.der-de-period-nav select {
  flex: 1 1 auto;
  padding: 4px 8px;
  border: 1px solid #d8dee8;
  background: #fff;
  color: #101a32;
  border-radius: 4px;
}
.der-de-period-btn {
  background: transparent;
  border: 0;
  color: #147CD7;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  color: #0a5497;
  background: #e6f1fb;
}
.der-de-period-btn:disabled {
  color: #c0c7d2;
  cursor: not-allowed;
}
.der-de-placeholder {
  padding: 32px 16px;
  text-align: center;
  color: #6e7a8a;
  font-size: 14px;
  background: #fff;
  border: 1px dashed #d7dde5;
  border-radius: 3px;
}
/* Layout envelope \u2014 the AppHost's ScreenCard body is a flex
 * column whose height fills the viewport below the shell topbar
 * + sticky toolbar. The form card grows to fill the remaining
 * space (flex: 1) so a short form still pushes the actionbar to
 * the screen bottom; a long form grows the column naturally and
 * the actionbar follows the content (not the viewport). */
.der-apphost .der-screen-card__body {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--der-topbar-h, 52px));
}
.der-de-form-card {
  padding: 0;
  background: transparent;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.45;
}
.der-de-form-card h2,
.der-de-form-card h3,
.der-de-form-card h4,
.der-de-custom-form h3,
.der-de-custom-form .formSection,
.der-de-custom-form h3.formSection {
  font-size: 16px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  letter-spacing: 0;
}
.der-de-custom-form p,
.der-de-custom-form label,
.der-de-custom-form td,
.der-de-custom-form th,
.der-de-form-card p,
.der-de-form-card label {
  font-size: 14px;
}
.der-de-form-split {
  flex: 1 1 auto;
}
.der-de-actionbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px -20px 0;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e5e9ef;
}
.der-de-savepill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.der-de-savepill--muted  { background: #eef0f3; color: #6e7a8a; }
.der-de-savepill--saved  { background: #e8f4ee; color: #136436; }
.der-de-savepill--saving { background: #fbf4e0; color: #8a6b00; }
.der-de-savepill--queued { background: #fbeedd; color: #874a00; }
.der-de-savepill--error  { background: #fbeaea; color: #8a2525; }
.der-de-form-split {
  display: block;
}
.der-de-section-nav { display: none; }
@media (min-width: 1024px) {
  .der-de-form-split {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 15px;
    align-items: start;
  }
  .der-de-section-nav {
    display: block;
    position: sticky;
    top: 140px;
    align-self: start;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    padding: 10px 6px;
    background: #f7f8fc;
    border-radius: 10px;
  }
}
.der-de-section-nav__title {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
  margin: 0 8px 8px;
}
.der-de-section-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-section-nav__item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  padding: 8px 10px;
  margin: 0;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 4px 4px 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.35;
  cursor: pointer;
}
.der-de-section-nav__label {
  flex: 1 1 auto;
}
.der-de-section-nav__ratio {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.der-de-section-nav__ratio--muted   { background: #eef0f5; color: #6e7a8a; }
.der-de-section-nav__ratio--partial { background: #fef0d8; color: #9b5a00; }
.der-de-section-nav__ratio--done    { background: #e3f7eb; color: #1b8243; }
.der-de-section-nav__item:hover {
  background: #eef0f3;
}
.der-de-section-nav__item--active {
  background: #eef4fa;
  border-left-color: #147CD7;
  color: #0a5497;
  font-weight: 500;
}
/* One section at a time. Each slot stretches to fill the form
 * column so the operator sees exactly the section they picked
 * \u2014 no accidental scroll into neighbours. */
.der-de-section-slot {
  margin: 0 0 12px;
}
/* Custom form visual integration. The inline-style strip in
 * applyFormAssets neutralises TBLP/legacy template colours +
 * rounded chrome; these rules give the author's table structure
 * DER's compact grid design back. */
.der-de-custom-form h1,
.der-de-custom-form h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: #0a5497;
  border-bottom: 1px solid #e5e9ef;
  padding-bottom: 6px;
}
.der-de-custom-form .tblep-root,
.der-de-custom-form .tblep-head,
.der-de-custom-form .tblep-panel {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  margin: 0 0 16px !important;
}
/* Author-authored decorations shipped inside CUSTOM
 * dataEntryForm.htmlCode (TBLP + legacy DHIS2 custom forms).
 * These duplicate signal the DER data-entry chrome already
 * surfaces \u2014 dataset title (toolbar), section nav numbering,
 * section headers \u2014 and introduce visual styles that fight the
 * shared DER UI. Hide everything but the semantic structure
 * (sections + tables + inputs) so operators see one consistent
 * language regardless of who authored the form. */
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-kicker,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-num,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-h1,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-lead,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-note,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-muted,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-head,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-foot {
  display: none !important;
}
/* Author mode \u2014 let the DHIS2 custom-form HTML render natively.
 * Only the .tblep-table border suppression in DER mode is
 * undone; author tables retain their own 1 px row borders +
 * background accents. */
.der-de-custom-form--author .tblep-root,
.der-de-custom-form--author .tblep-head,
.der-de-custom-form--author .tblep-panel,
.der-de-custom-form--author .tblep-table th,
.der-de-custom-form--author .tblep-table td,
.der-de-custom-form--author table th,
.der-de-custom-form--author table td {
  padding: revert !important;
  border: revert !important;
  background: revert !important;
  color: revert !important;
  margin: revert !important;
  border-radius: revert !important;
}
.der-de-custom-form--author input[name$="-val"],
.der-de-custom-form--author input[name="entryfield"],
.der-de-custom-form--author input[name="total"] {
  border: revert !important;
  border-radius: revert !important;
  padding: revert !important;
  background: revert !important;
  font-size: revert !important;
  color: revert !important;
}
.der-de-custom-form .tblep-table,
.der-de-custom-form table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 14px;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form .tblep-table td,
.der-de-custom-form table th,
.der-de-custom-form table td {
  padding: 4px 8px !important;
  border: 0 !important;
  text-align: left !important;
  vertical-align: middle;
  background: transparent !important;
  font-size: 14px;
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  color: var(--der-ink-700, #2a3447) !important;
  font-weight: 500;
  font-size: 14px;
}
.der-de-custom-form .tblep-table tbody tr {
  border: 0 !important;
}
.der-de-custom-form .tblep-table tbody tr:hover td,
.der-de-custom-form .tblep-table tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form table th {
  background: transparent !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
.der-de-custom-form .tblep-table input[type="text"],
.der-de-custom-form table input[type="text"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  width: 100% !important;
  padding: 2px 4px !important;
  border: 1px solid #aaa !important;
  background: #fff !important;
  font-size: 14px !important;
  color: #212934 !important;
  font-family: inherit;
}
.der-de-custom-form input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
  background: #fff !important;
}
.der-de-completion-pill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 12px;
  background: #eef0f3;
  color: #404b5a;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0 20px;
  font-size: 14px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #e5e9ef;
  padding: var(--der-de-cell-pad, 6px 8px);
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable thead th {
  background: transparent;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
  text-align: center;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: transparent;
  min-width: var(--der-de-de-col, 200px);
  text-align: left;
}
/* Each table lives inside a container that normally fits the
   viewport (categories nest with colspan rather than forcing a
   wide flat matrix). Only scroll horizontally as a last resort
   when the operator chose Comfortable density on a very wide
   combo (Age \xD7 Sex \xD7 Status + 50+ DEs). */
.der-de-form-card .der-de-table-scroll {
  overflow-x: auto;
  margin: 6px 0 16px;
  background: transparent;
}
.der-de-form-card .der-de-table-scroll .sectionTable {
  margin: 0;
  width: 100%;
  border-collapse: collapse;
}
.der-de-form-card .sectionTable .indicatorRow td {
  background: #f0f3fb;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f9;
  color: #8893b1;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #aaa;
  background: #fff;
  padding: 2px 4px;
  font-size: 14px;
  color: #212934;
  font-family: inherit;
  border-radius: 4px;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Compulsory cells \u2014 DHIS2 marks these with an amber left
 * rule so operators can tell at a glance which fields block
 * "Mark complete". Applies to both SECTION-renderer inputs and
 * CUSTOM author inputs (we tag them the same way). */
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"],
.der-de-custom-form input[data-compulsory="1"] {
  border-left: 3px solid #9b5a00 !important;
}
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"]:placeholder-shown,
.der-de-custom-form input[data-compulsory="1"]:placeholder-shown {
  background: #fef0d8 !important;
}
/* Row-level focus tint \u2014 SECTION renderer tables + CUSTOM
 * author tables both get a subtle indigo wash when the row
 * contains focus or is being hovered, so the operator always
 * knows which row they are typing into. */
.der-de-form-card .sectionTable tbody tr:hover,
.der-de-form-card .sectionTable tbody tr:focus-within,
.der-de-custom-form table tbody tr:hover,
.der-de-custom-form table tbody tr:focus-within {
  background: #eef4fa;
}
.der-de-form-card .sectionTable tbody tr:focus-within
  .dataElementCell,
.der-de-custom-form table tbody tr:focus-within td:first-child {
  color: #083f72;
  font-weight: 500;
}
/* Custom-form author inputs inherit the same visual language as
 * SECTION-renderer inputs: 1 px border, 4 px radius, indigo
 * focus ring. */
.der-de-custom-form input[name$="-val"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  border: 1px solid #aaa !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  background: #fff !important;
}
.der-de-custom-form input[name$="-val"]:focus,
.der-de-custom-form input[name="entryfield"]:focus,
.der-de-custom-form input[name="total"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Realtime value-type validation \u2014 attachLiveValidation stamps
 * data-de-invalid="1" + title=<reason> on inputs that don't
 * match their data element's valueType. */
.der-de-custom-form input[data-de-invalid="1"],
.der-apphost .der-de-form-card input[data-de-invalid="1"] {
  border-color: #c0392b !important;
  background: #fbeaea !important;
  box-shadow: inset 0 0 0 1px #c0392b;
}
.der-de-custom-form input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card .sectionTable input[type="text"][data-de-invalid="1"]:focus {
  border-color: #c0392b !important;
  box-shadow: inset 0 0 0 2px #c0392b !important;
}
.der-de-form-card h3.formSection {
  margin: 0 0 8px;
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--der-ink-900, #101a32);
  border: 0;
  letter-spacing: -0.01em;
}
/* Compact density \u2014 the default. Dense enough to show large
   multi-dimensional disaggregations without a horizontal
   scroll in most cases. */
.der-de-form-card.der-de-density-compact {
  --der-de-cell-pad: 3px 6px;
  --der-de-de-col: 180px;
  --der-de-de-col-max: 260px;
}
.der-de-form-card.der-de-density-compact .sectionTable {
  font-size: 12px;
}
.der-de-form-card.der-de-density-compact .sectionTable input[type="text"] {
  font-size: 12px;
  padding: 1px 3px;
}
.der-de-form-card.der-de-density-compact h3.formSection {
  font-size: 15px;
}
/* Comfortable density \u2014 roomier spacing for operators on
   tablets or anyone who wants a bigger tap target. */
.der-de-form-card.der-de-density-comfortable {
  --der-de-cell-pad: 8px 10px;
  --der-de-de-col: 240px;
  --der-de-de-col-max: 360px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable {
  font-size: 14px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable input[type="text"] {
  font-size: 14px;
  padding: 4px 6px;
}
.der-de-form-card.der-de-density-comfortable h3.formSection {
  font-size: 17px;
}
.der-de-density-btn {
  padding: 4px 10px;
  border: 1px solid #c0c7cf;
  border-radius: 10px;
  background: #fff;
  color: #404b5a;
  font-size: 12px;
  cursor: pointer;
}
.der-de-density-btn:hover {
  background: #f3f5f7;
}
.der-de-issues-chip {
  padding: 4px 10px;
  border: 1px solid #e0bcbc;
  border-radius: 10px;
  background: #fbeaea;
  color: #8a2525;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
/* Validation modal \u2014 large centered dialog. Replaces the
 * right-rail drawer: easier to read many issues at once +
 * surfaces a clean success state. */
.der-de-validation-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.der-de-validation {
  background: #fff;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
}
.der-de-validation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-validation__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.der-de-validation__heading {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #101a32;
}
.der-de-validation__badge {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.der-de-validation--ok .der-de-validation__badge {
  background: #1b8243;
}
.der-de-validation--err .der-de-validation__badge {
  background: #c0392b;
}
.der-de-validation__close {
  background: transparent; border: 0; cursor: pointer;
  color: #5b6478; font-size: 22px; line-height: 1;
}
.der-de-validation__body {
  padding: 16px 20px 20px;
  overflow-y: auto;
}
.der-de-validation__ok-prose {
  margin: 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.5;
}
.der-de-validation__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.der-de-validation__table th,
.der-de-validation__table td {
  padding: 8px 10px;
  text-align: left;
  color: #101a32;
  border-bottom: 1px solid #eef0f3;
}
.der-de-validation__table thead th {
  font-size: 12px;
  font-weight: 500;
  color: #5b6478;
  border-bottom: 2px solid #d8dee8;
}
.der-de-validation__coc { color: #5b6478; }
.der-de-validation__value {
  display: inline-block;
  padding: 1px 6px;
  background: #fbeaea;
  color: #8a2525;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.der-de-validation__why { color: #8a2525; }
.der-de-validation__jump-btn {
  background: transparent;
  border: 0;
  color: #147CD7;
  font-size: 12px;
  cursor: pointer;
}
.der-de-validation__jump-btn:hover { color: #0a5497; }

.der-de-shortcuts-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}
.der-de-shortcuts {
  background: #fff;
  border-radius: 12px;
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
  overflow: hidden;
}
.der-de-shortcuts__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-shortcuts__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #083f72;
}
.der-de-shortcuts__close {
  background: transparent; border: 0; cursor: pointer;
  font-size: 22px; line-height: 1; color: #6e7a8a;
}
.der-de-shortcuts__list {
  margin: 0;
  padding: 10px 18px 16px;
}
.der-de-shortcuts__row {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f5f7;
}
.der-de-shortcuts__row:last-child { border-bottom: 0; }
.der-de-shortcuts__row dt { margin: 0; }
.der-de-shortcuts__row dd { margin: 0; color: #404b5a; font-size: 13px; }
.der-de-shortcuts kbd {
  display: inline-block;
  padding: 2px 8px;
  background: #eef0f5;
  border: 1px solid #d8dee8;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #101a32;
  box-shadow: 0 1px 0 rgba(16, 26, 50, 0.1);
}
.der-de-details-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 320px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e5e9ef;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(16, 26, 50, 0.08);
  z-index: 8;
}
.der-de-details-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-details-drawer__title {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
}
.der-de-details-drawer__close {
  padding: 0 6px;
  background: transparent; border: 0; cursor: pointer;
  color: #6e7a8a; font-size: 20px; line-height: 1;
}
.der-de-details-drawer__body {
  padding: 12px 14px;
  overflow-y: auto;
}
.der-de-details-drawer__empty {
  padding: 16px 14px;
  margin: 0;
  color: #6e7a8a;
  font-size: 13px;
}
.der-de-details-drawer__de {
  font-size: 14px;
  font-weight: 500;
  color: #083f72;
  margin-bottom: 6px;
}
.der-de-details-drawer__compulsory {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #fef0d8;
  color: #9b5a00;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  vertical-align: middle;
}
.der-de-details-drawer__state {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  margin-bottom: 12px;
}
.der-de-details-drawer__state--muted  { background: #eef0f5; color: #475061; }
.der-de-details-drawer__state--saved  { background: #e3f7eb; color: #1b8243; }
.der-de-details-drawer__state--saving { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--queued { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--error  { background: #fee2e2; color: #c0392b; }
.der-de-details-drawer__meta {
  display: grid;
  grid-template-columns: 90px 1fr;
  row-gap: 6px;
  column-gap: 10px;
  margin: 0;
  font-size: 12px;
}
.der-de-details-drawer__meta dt {
  color: #6e7a8a;
  font-weight: 400;
}
.der-de-details-drawer__meta dd {
  margin: 0;
  color: #101a32;
  overflow-wrap: anywhere;
}
.der-de-details-drawer__meta dd code {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #475061;
}
.der-de-details-drawer__empty-val {
  color: #9097a8;
}
.der-de-details-drawer__breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-details-drawer__breakdown li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
  font-size: 12px;
}
.der-de-details-drawer__cat {
  color: #6e7a8a;
}
.der-de-details-drawer__opt {
  color: #101a32;
  font-weight: 500;
}
.der-de-issues-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 360px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e0bcbc;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(28, 46, 70, 0.12);
  z-index: 10;
}
.der-de-issues-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fbeaea;
  border-bottom: 1px solid #e0bcbc;
}
.der-de-issues-drawer__title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #8a2525;
}
.der-de-issues-drawer__close {
  padding: 0 6px;
  background: transparent;
  border: 0;
  color: #8a2525;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.der-de-issues-drawer__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.der-de-issues-drawer__item {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  border: 0;
  border-bottom: 1px solid #eef0f3;
  background: transparent;
  color: #212934;
  cursor: pointer;
}
.der-de-issues-drawer__item:hover {
  background: #fdf5f5;
}
.der-de-issues-drawer__de {
  font-size: 13px;
  font-weight: 500;
}
.der-de-issues-drawer__coc {
  font-size: 11px;
  color: #6e7a8a;
}
.der-de-issues-drawer__why {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #8a2525;
}
.der-de-issues-drawer__value {
  padding: 1px 6px;
  border-radius: 3px;
  background: #fbeaea;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #8a2525;
}
`;export{Je as default};
