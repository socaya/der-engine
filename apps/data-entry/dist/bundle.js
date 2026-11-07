/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as D,useRef as te,useState as S}from"react";import{useAuth as Re,useOrgUnitBinding as Oe,useOnlineStatus as Le,useDerApi as He,ScreenCard as qe}from"@der/app-sdk";import{Fragment as bt,jsx as m,jsxs as _}from"react/jsx-runtime";function Pe(){let n=Re(),t=Oe(),d=Le(),i=He(),[l,s]=S("custom"),[e,o]=S([]),[r,c]=S(""),[a,u]=S(""),[p,f]=S(""),[b,g]=S(""),[v,k]=S({kind:"idle"}),[x,C]=S(null),A=te(null),[O,R]=S({}),F=te({}),[we,J]=S([]),[L,V]=S(null),[W,de]=S(!1),[ke,G]=S(new Set),[Ee,Y]=S(new Set),[K,Ne]=S(0),[B,Se]=S([]),[le,Q]=S(!1),ce=te(0),[Te,Ce]=S(null),[Ae,X]=S(!1);D(()=>{let y=h=>{if(h.key!=="?")return;let N=h.target;N&&(N.tagName==="INPUT"||N.tagName==="TEXTAREA")||(h.preventDefault(),X(w=>!w))};return window.addEventListener("keydown",y),()=>window.removeEventListener("keydown",y)},[]);let[H,$e]=S(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});D(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",H)}catch{}},[H]);let[q,Ie]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});D(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),D(()=>{let y=!1;return(async()=>{try{let h=await i.listDataSets();if(y)return;let N=(h.dataSets??[]).map(w=>({id:w.id,label:w.displayName??w.name??w.id,periodType:w.periodType,formType:w.formType})).sort((w,T)=>w.label.localeCompare(T.label));o(N)}catch{}})(),()=>{y=!0}},[]),D(()=>{if(r.trim()===""){C(null),J([]),R({}),F.current={};return}let y=!1;return(async()=>{try{let h=await i.getDataSetMeta(r.trim());if(y)return;let N=!!h.dataEntryForm&&h.formType==="CUSTOM"||h.formType==="SECTION";C({hasCustomForm:N,formId:h.dataEntryForm?.id,displayName:h.displayName??h.name,formType:h.formType,periodType:h.periodType}),s(N?"custom":"structured");try{let w=await i.getDataSetFormMetadata(r.trim());if(y)return;let T=await me(w,i);if(y)return;let z=(T.categoryCombo?.categories??[]).filter(I=>(I.categoryOptions?.length??0)>1).map(I=>({id:I.id,name:I.name??I.id,options:(I.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));J(z);let U={};for(let I of z)I.options[0]&&(U[I.id]=I.options[0].id);R(U),F.current=U}catch{}}catch{y||C(null)}})(),()=>{y=!0}},[r]),D(()=>{if(l!=="custom"||!x?.hasCustomForm||x.formType==="CUSTOM"&&!x.formId)return;let y=A.current;if(!y)return;let h=!1;return(async()=>{k({kind:"submitting"});try{let N=await i.getDataSetFormMetadata(r.trim());if(h)return;let w=await me(N,i);if(h)return;let T="";if(x.formType==="CUSTOM"&&x.formId){try{T=(await i.getDataEntryFormHtml(x.formId)).htmlCode??""}catch(E){T="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",E)}T.trim()||(T=pe(w))}else x.formType==="SECTION"&&(T=pe(w));if(h)return;let z=await i.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(h)return;let U=(w.categoryCombo?.categories??[]).filter(E=>(E.categoryOptions?.length??0)>1).map(E=>({id:E.id,name:E.name??E.id,options:(E.categoryOptions??[]).map(M=>({id:M.id,name:M.name??M.id}))}));J(U);let I={};for(let E of U)E.options[0]&&(I[E.id]=E.options[0].id);R(I),F.current=I,y.replaceChildren();for(let[E,M]of[["selectedDataSetId",r.trim()],["selectedPeriodId",a.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let j=document.createElement("input");j.type="hidden",j.id=E,j.value=M,y.appendChild(j)}for(let[E,M]of Object.entries(I)){let j=document.createElement("input");j.type="hidden",j.id=`category-${E}`,j.value=M,j.setAttribute("data-der-category",E),y.appendChild(j)}let $=document.createElement("div");$.id="contentDiv",y.appendChild($),Ve({dataSetId:r.trim(),periodId:a.trim(),orgUnitId:t.orgUnitUid??"",meta:w,aocSelections:I,validationRules:z.validationRules??[]});for(let E of Ue)ve(E);for(let E of ze)document.querySelector(`script[data-der-custom-form="${E}"]`)||await he(E);Be(),await ct($,T,{stripStyles:H==="der"}),await lt($,r.trim(),a.trim(),t.orgUnitUid??"",i),Je($,()=>r.trim(),()=>a.trim(),()=>t.orgUnitUid??"",()=>({...F.current}),i),$.addEventListener("blur",E=>{let M=E.target;if(M&&M.tagName==="INPUT"&&/-val$/.test(M.getAttribute("name")??"")&&M.value.trim()!==""){let j=a.trim();Y(ee=>ee.has(j)?ee:new Set(ee).add(j))}},!0),We($),tt($,k),rt($),it($,w,Ce),nt($,w),ot($,w),at($,w),Ne(E=>E+1),k({kind:"idle"})}catch(N){k({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{h=!0}},[l,x,r,a,t.orgUnitUid,H]);let De=t.bound&&r.trim()!==""&&a.trim()!==""&&p.trim()!==""&&b.trim()!==""&&v.kind!=="submitting";async function je(y){y.preventDefault(),k({kind:"submitting"});try{await i.submitAggregate({dataSet:r,period:a,orgUnit:t.orgUnitUid,dataValues:[{dataElement:p,value:b}]}),k({kind:"ok",message:`Submitted ${p}=${b} for ${a}.`}),f(""),g("")}catch(h){k({kind:"error",message:h.message??"Submission failed"})}}let ue=a.trim()!=="",Z=r.trim()!=="",P=Z&&ue&&t.bound;D(()=>{if(!r.trim()||!t.bound||!x?.periodType){G(new Set),Y(new Set);return}let y=!1;return(async()=>{let h=xe(x.periodType).map(T=>T.id),[N,w]=await Promise.all([Promise.all(h.map(async T=>{try{return(await i.getCompletion(r.trim(),t.orgUnitUid??"",T)).completed?T:null}catch{return null}})),Promise.all(h.map(async T=>{try{return((await i.readAggregateValues(t.orgUnitUid??"",T,1)).dataValues?.length??0)>0?T:null}catch{return null}}))]);y||(G(new Set(N.filter(T=>T!==null))),Y(new Set(w.filter(T=>T!==null))))})(),()=>{y=!0}},[r,t.orgUnitUid,x?.periodType]),D(()=>{if(!P){V(null);return}let y=!1;return(async()=>{try{let h=await i.getCompletion(r.trim(),t.orgUnitUid??"",a.trim());if(y)return;V({completed:!!h.completed,completedAt:h.completedAt})}catch{y||V({completed:!1})}})(),()=>{y=!0}},[r,a,t.orgUnitUid,P]);async function Me(){if(!P||W)return;let y=!L?.completed;if(y){let h=A.current;if(h){let N=[];for(let w of Array.from(h.querySelectorAll('input[data-compulsory="1"]')))w.value.trim()===""&&N.push(w);if(N.length>0){k({kind:"error",message:`Can't mark complete \u2014 ${N.length} compulsory value${N.length===1?"":"s"} still missing. Run Validate to jump to them.`}),N[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}de(!0);try{let h=await i.markCompletion({dataSet:r.trim(),orgUnit:t.orgUnitUid??"",period:a.trim(),completed:y});V({completed:!!h.completed,completedAt:h.completedAt}),G(N=>{let w=new Set(N);return h.completed?w.add(a.trim()):w.delete(a.trim()),w}),k({kind:"ok",message:h.completed?"Dataset marked complete.":"Dataset reopened."})}catch(h){k({kind:"error",message:`Completion failed: ${h.message}`})}finally{de(!1)}}return _(qe,{dataTest:"der-aggregate-entry",children:[m("style",{children:ft}),_("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[_("div",{className:"der-de-toolbar__head",children:[m("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:_("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[m("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#eef1ff",stroke:"#4a55ce","stroke-width":"5"}),m("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#4a55ce","stroke-width":"5"}),m("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#4a55ce","stroke-width":"3"}),m("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#4a55ce","stroke-width":"3"}),m("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#4a55ce","stroke-width":"3"})]})}),m("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),m("span",{className:"der-de-toolbar__status "+(d.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":d.isOnline?"Online":"Offline",children:d.isOnline?"online":`offline \xB7 ${d.queuedCount} queued`}),_("span",{className:"der-de-toolbar__ou-wrap",children:[m("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),m("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),_("div",{className:"der-de-toolbar__picks",children:[_("label",{className:"der-de-toolbar__field",children:[m("span",{className:"der-de-toolbar__field-label",children:"Data set"}),_("select",{className:"der-de-toolbar__select",value:r,onChange:y=>{c(y.target.value),u("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),e.map(y=>m("option",{value:y.id,children:y.label},y.id))]})]}),we.map(y=>_("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-toolbar__field-label",children:y.name}),_("select",{className:"der-de-toolbar__select",value:O[y.id]??"",onChange:h=>{let N={...O,[y.id]:h.target.value};R(N),F.current=N,Qe(A.current,N)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),y.options.map(h=>m("option",{value:h.id,children:h.name},h.id))]})]},y.id)),_("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[_("span",{className:"der-de-toolbar__field-label",children:["Period",x?.periodType?` \xB7 ${x.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:pt(x?.periodType,a,u,ke,Ee)})]}),m("div",{className:"der-de-toolbar__cell-info",children:m(Xe,{root:A,details:Te,formVersion:K})})]})]}),v.kind==="ok"&&m("div",{style:ut,"data-test":"de-ok",children:v.message}),v.kind==="error"&&m("div",{style:mt,"data-test":"de-err",children:v.message}),!t.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!Z&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&Z&&!ue&&_("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),P&&l==="structured"&&_("form",{onSubmit:je,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[_("label",{children:["Data element UID",m("input",{value:p,onChange:y=>f(y.target.value),style:ie})]}),_("label",{children:["Value",m("input",{value:b,onChange:y=>g(y.target.value),inputMode:"decimal",style:ie})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!De,style:fe,children:v.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),P&&l==="custom"&&m("div",{className:`der-de-form-card der-de-density-${q}`,children:_("div",{className:"der-de-form-split",children:[m(Ye,{targetRef:A,formVersion:K}),m("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),P&&l==="custom"&&_("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Ke,{root:A,formVersion:K}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Ie(y=>y==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${H==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${H==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>$e(y=>y==="der"?"author":"der"),children:H==="der"?"\u2699 DER layout":"\u2699 Author layout"}),L&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:L.completed?`Complete${L.completedAt?" \xB7 "+new Date(L.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{st(A.current,k,(y,h)=>{Se(y),ce.current=h,Q(!0)})},style:be,"data-test":"de-validate-btn",children:"Validate"}),B.length>0&&!le&&_("button",{type:"button",onClick:()=>Q(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[B.length," issue",B.length===1?"":"s"]}),m("button",{type:"button",onClick:()=>X(y=>!y),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Me,disabled:W,style:L?.completed?be:fe,"data-test":"de-complete-btn",children:W?"Saving\u2026":L?.completed?"Reopen":"Mark complete"})]}),m(et,{open:Ae,onClose:()=>X(!1)}),m(Ze,{open:le,issues:B,totalCells:ce.current,onClose:()=>Q(!1),onPick:y=>{let h=A.current?.querySelector(`input[name="${y.inputName}"]`);h&&(h.scrollIntoView({behavior:"smooth",block:"center"}),h.focus(),h.select()),Q(!1)}})]})}var ze=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Ue=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],re=null,ae=null,oe=null;async function me(n,t){re||(re=t.listAllDataElements().then(o=>new Map(o.map(r=>[r.id,r])))),ae||(ae=t.listAllCategoryCombos().then(o=>new Map(o.map(r=>[r.id,r])))),oe||(oe=t.listAllCategoryOptionCombos().then(o=>{let r=new Map;for(let c of o){let a=c.categoryCombo?.id;if(!a)continue;let u=r.get(a);u?u.push(c):r.set(a,[c])}return r}));let[d,i,l]=await Promise.all([re,ae,oe]),s=o=>{if(!o?.id)return;let r=i.get(o.id),c=l.get(o.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:a.categoryOptions??[]})),categories:(r.categories??[]).map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:(a.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:o},e=o=>{let r=d.get(o.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:s(r.categoryCombo)}:o};return{...n,categoryCombo:s(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(o=>({...o,dataElement:o.dataElement?e(o.dataElement):void 0})),sections:(n.sections??[]).map(o=>({...o,dataElements:(o.dataElements??[]).map(r=>e(r))}))}}function pe(n){let t={};for(let o of n.dataSetElements??[])o.dataElement&&(t[o.dataElement.id]=o.dataElement);let d={};for(let o of n.indicators??[])d[o.id]=o;let i=(n.sections??[]).slice().sort((o,r)=>(o.sortOrder??0)-(r.sortOrder??0));if(!i.some(o=>(o.dataElements?.length??0)>0)){let o=(n.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);i=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:o,indicators:[],greyedFields:[]}]}let s=o=>o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),e=[];for(let o of i){let r=new Set;for(let a of o.greyedFields??[])a.dataElement?.id&&a.categoryOptionCombo?.id&&r.add(`${a.dataElement.id}:${a.categoryOptionCombo.id}`);e.push(`<h3 class="formSection">${s(o.name??"")}</h3>`);let c=new Map;for(let a of o.dataElements??[]){let u=t[a.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,f=c.get(p);f||(f={cc:u.categoryCombo,des:[]},c.set(p,f)),f.des.push(u)}for(let a of c.values()){let u=a.cc.categoryOptionCombos??[],p=a.cc.categories??[];e.push('<div class="der-de-table-scroll">'),e.push('<table class="sectionTable" cellspacing="0">');let f=Fe(p,u);if(e.push("<thead>"),f.length>0)for(let b=0;b<f.length;b++){e.push("<tr>"),b===0&&e.push(`<th class="dataElementCell" rowspan="${f.length}">Data elements</th>`);for(let g of f[b]??[])e.push(`<th colspan="${g.span}">${s(g.label)}</th>`);e.push("</tr>")}else{e.push("<tr>"),e.push('<th class="dataElementCell">Data elements</th>');for(let b of u)e.push(`<th>${s(b.name??"")}</th>`);e.push("</tr>")}e.push("</thead><tbody>");for(let b of a.des){e.push("<tr>"),e.push(`<td class="dataElementCell" id="${s(b.id)}-cell">`+s(b.formName??b.name??b.id)+"</td>");for(let g of u){let v=`${b.id}-${g.id}-val`;r.has(`${b.id}:${g.id}`)?e.push('<td class="greyed">\u2014</td>'):e.push(`<td><input type="text" id="${s(v)}" name="${s(v)}" dataelementid="${s(b.id)}" optioncomboid="${s(g.id)}"></td>`)}e.push("</tr>")}for(let b of o.indicators??[]){let g=d[b.id];g&&(e.push('<tr class="indicatorRow">'),e.push(`<td class="dataElementCell">${s(g.name??g.id)}</td>`),e.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${s(g.id)}" readonly></td>`),e.push("</tr>"))}e.push("</tbody></table></div>")}}return e.join(`
`)}function Fe(n,t){if(n.length===0||t.length===0)return[];let d=new Map;for(let e of n)for(let o of e.categoryOptions??[])d.set(o.id,{catId:e.id,name:o.name??o.id});let i=n.length,l=t.map(e=>{let o=new Array(i).fill("");for(let r of e.categoryOptions??[]){let c=d.get(r.id);if(!c)continue;let a=n.findIndex(u=>u.id===c.catId);a>=0&&(o[a]=c.name)}return o});for(let e of l)if(e.some(o=>o===""))return[];let s=[];for(let e=0;e<i;e++){let o=[];for(let r=0;r<l.length;){let c=l[r],a=r+1;for(;a<l.length;){let u=l[a],p=!0;for(let f=0;f<=e;f++)if(c[f]!==u[f]){p=!1;break}if(!p)break;a++}o.push({label:c[e]??"",span:a-r}),r=a}s.push(o)}return s}function Ve(n){let t=globalThis;t.dhis2=t.dhis2??{};let d=t.dhis2;d.de=d.de??{};let i=d.de;i.currentDataSetId=n.dataSetId,i.currentOrganisationUnitId=n.orgUnitId,i.currentPeriodId=n.periodId,i.currentCategorySelections={...n.aocSelections??{}};let l=n.meta??{},s={},e={};if(l.categoryCombo){e[l.categoryCombo.id]=l.categoryCombo;for(let u of l.categoryCombo.categories??[])s[u.id]=u}i.categories=s,i.categoryCombos=e;let o={},r={};for(let u of l.dataSetElements??[]){let p=u.dataElement;p&&(o[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(e[p.categoryCombo.id]=p.categoryCombo))}i.dataElements=o,i.optionSets=r;let c={};for(let u of l.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};i.indicatorFormulas=c;let a={};for(let u of n.validationRules??[])a[u.id]=u;i.validationRules=a,i.lockExceptions=[],i.emptyOrganisationUnits=[],i.significantZeros=[],i.dataSets={[l.id]:{id:l.id,name:l.name??l.displayName??"",periodType:l.periodType,categoryCombo:l.categoryCombo?.id,periodId:n.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Be(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(t,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let t=n.dhis2.period;t.format="yyyy-mm-dd",t.calendar=n.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function Qe(n,t){if(!n)return;for(let[i,l]of Object.entries(t)){let s=n.querySelector(`input[data-der-category="${i}"]`);s||(s=document.createElement("input"),s.type="hidden",s.id=`category-${i}`,s.setAttribute("data-der-category",i),n.appendChild(s)),s.value=l}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...t})}function Je(n,t,d,i,l,s){let e=a=>{let u=/^(.+)-(.+)-val$/.exec(a);return u?{de:u[1],coc:u[2]}:null},o=new WeakMap,r=n.querySelectorAll('input[name$="-val"]');for(let a of Array.from(r))o.set(a,a.value);let c=async a=>{let u=a.target;if(!u||u.tagName!=="INPUT")return;let p=u.getAttribute("name")??"",f=e(p);if(!f)return;let b=t(),g=d(),v=i();if(!b||!g||!v)return;let k=u.value;if(o.get(u)!==k){ne(u,"saving");try{let x=await s.submitAggregate({dataSet:b,period:g,orgUnit:v,attributeOptionComboSelections:l(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:k}]});o.set(u,k),ne(u,x?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ne(u,"error")}}};n.addEventListener("blur",a=>{c(a)},!0)}function We(n){n.addEventListener("keydown",t=>{let d=t;if(d.key!=="Enter")return;let i=d.target;if(!(i instanceof HTMLInputElement))return;let l=i.getAttribute("name")??"",s=/^(.+)-(.+)-val$/.exec(l);if(!s)return;d.preventDefault();let e=s[2],o=Array.from(n.querySelectorAll(`input[name$="-${e}-val"]`)),r=o.indexOf(i);if(r===-1)return;let c=o[r+(d.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Ge(n){let t=Array.from(n.querySelectorAll("h2, h3, h4")).filter(s=>(s.textContent??"").trim().length>0);if(t.length<2)return[];let d=new Set(t),i=[],l=(s,e)=>{for(let o of d)if(o!==e&&s.contains(o))return!0;return!1};return t.forEach((s,e)=>{let o=s.id||`der-de-section-${e}`;s.id=o;let r=null,c=s.parentElement,a=null;for(;c&&c!==n&&!l(c,s);)a=c,c=c.parentElement;if(a&&a.children.length>1&&a!==n)r=a,r.classList.add("der-de-section-slot"),r.dataset.sectionId=o;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=o;let u=t[e+1]??null,p=[],f=s;for(;f&&f!==u;){let b=f.nextSibling;p.push(f),f=b}s.parentNode?.insertBefore(r,s);for(let b of p)r.appendChild(b)}i.push({id:o,label:(s.textContent??"").trim(),slot:r})}),i}function Ye({targetRef:n,formVersion:t}){let[d,i]=S([]),[l,s]=S(""),[e,o]=S({});return D(()=>{let r=n.current;if(!r)return;let c=Ge(r);i(c),s(c[0]?.id??"")},[n,t]),D(()=>{if(d.length===0)return;let r=()=>{let u={};for(let p of d){let f=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),b=f.filter(g=>g.value.trim()!=="").length;u[p.id]={filled:b,total:f.length}}o(u)};r();let c=n.current;if(!c)return;let a=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&r()};return c.addEventListener("input",a,!0),()=>{c.removeEventListener("input",a,!0)}},[n,d]),D(()=>{if(!n.current||d.length===0)return;for(let a of d)a.slot.style.display=a.id===l?"":"none";let c=d.find(a=>a.id===l);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[n,d,l]),d.length<2?null:_("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:d.map(r=>{let c=e[r.id],a=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return m("li",{children:_("button",{type:"button",className:"der-de-section-nav__item"+(l===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>s(r.id),children:[m("span",{className:"der-de-section-nav__label",children:r.label}),c&&c.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${a}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:a==="done"?"\u2713":`${c.filled}/${c.total}`})]})},r.id)})})]})}function Ke({root:n,formVersion:t}){let[d,i]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(D(()=>{let e=()=>{let r=n.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),a=0,u=0,p=0,f=0,b=0;for(let g of c){g.value.trim()!==""&&a++;let v=g.style.outline||"";v.includes("rgb(185, 134, 10)")||v.includes("#b9860a")?u++:v.includes("rgb(206, 123, 0)")||v.includes("#ce7b00")?f++:v.includes("rgb(26, 135, 84)")||v.includes("#1a8754")||v.includes("rgb(183, 220, 199)")||v.includes("#b7dcc7")?p++:(v.includes("rgb(169, 50, 50)")||v.includes("#a93232"))&&b++}i({total:c.length,filled:a,saving:u,saved:p,queued:f,error:b})};e();let o=window.setInterval(e,800);return()=>window.clearInterval(o)},[n,t]),d.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let l=[];l.push(`${d.filled} of ${d.total} filled`),d.saving>0&&l.push(`${d.saving} saving`),d.queued>0&&l.push(`${d.queued} queued`),d.error>0&&l.push(`${d.error} error`);let s=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${s}`,"data-test":"de-save-state",children:l.join(" \xB7 ")})}function Xe({details:n}){let t={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected"},d={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return m("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:m("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:n?_(bt,{children:[m("span",{className:"der-de-live-strip__de",children:n.deName}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__coc",children:n.cocName}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__value",children:n.value||m("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:`der-de-live-strip__state der-de-live-strip__state--${d[n.saveState]}`,children:t[n.saveState]}),n.compulsory&&m("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):m("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function Ze({open:n,issues:t,totalCells:d,onClose:i,onPick:l}){if(D(()=>{if(!n)return;let e=o=>{o.key==="Escape"&&i()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[n,i]),!n)return null;let s=t.length===0;return m("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:e=>{e.target===e.currentTarget&&i()},children:_("div",{className:"der-de-validation "+(s?"der-de-validation--ok":"der-de-validation--err"),children:[_("header",{className:"der-de-validation__head",children:[_("div",{className:"der-de-validation__title",children:[m("span",{className:"der-de-validation__badge","aria-hidden":"true",children:s?"\u2713":"!"}),m("h3",{className:"der-de-validation__heading",children:s?`Validation passed \u2014 all ${d} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${d} cells.`})]}),m("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:i,children:"\xD7"})]}),m("div",{className:"der-de-validation__body",children:s?_("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",m("strong",{children:" Mark complete"})," when you're ready."]}):_("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[m("thead",{children:_("tr",{children:[m("th",{scope:"col",children:"Data element"}),m("th",{scope:"col",children:"Category option combo"}),m("th",{scope:"col",children:"Entered value"}),m("th",{scope:"col",children:"Problem"}),m("th",{scope:"col"})]})}),m("tbody",{children:t.map(e=>_("tr",{"data-test":"de-issues-row",children:[m("td",{children:e.deName}),m("td",{className:"der-de-validation__coc",children:e.cocName}),m("td",{children:m("code",{className:"der-de-validation__value",children:e.value||"\u2014"})}),m("td",{className:"der-de-validation__why",children:e.problem}),m("td",{className:"der-de-validation__jump",children:m("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>l(e),children:"Jump to cell \u2192"})})]},`${e.deId}-${e.cocId}`))})]})})]})})}function et({open:n,onClose:t}){return D(()=>{if(!n)return;let i=l=>{l.key==="Escape"&&t()};return window.addEventListener("keydown",i),()=>window.removeEventListener("keydown",i)},[n,t]),n?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:i=>{i.target===i.currentTarget&&t()},children:_("div",{className:"der-de-shortcuts",children:[_("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([i,l])=>_("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:i})}),m("dd",{children:l})]},i))})]})}):null}function tt(n,t){n.addEventListener("paste",d=>{let i=d.target;if(!i||i.tagName!=="INPUT")return;let l=i.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(l))return;let e=d.clipboardData?.getData("text/plain")??"",o=/\r?\n/.test(e),r=/\t/.test(e);if(!o&&!r)return;let c=e.split(/\r?\n/).filter((x,C,A)=>!(C===A.length-1&&x==="")).map(x=>x.split("	").map(C=>C.trim()));if(c.length===0)return;d.preventDefault();let a=i.closest("[data-section-id]")??n,p=Array.from(a.querySelectorAll("tbody tr")).map(x=>Array.from(x.querySelectorAll('input[name$="-val"]'))),f=-1,b=-1;for(let x=0;x<p.length;x++){let C=p[x].indexOf(i);if(C!==-1){f=x,b=C;break}}if(f===-1)return;let g=0,v=0;for(let x=0;x<c.length;x++){let C=c[x],A=p[f+x];if(!A){v+=C.length;continue}for(let O=0;O<C.length;O++){let R=A[b+O];if(!R){v++;continue}R.value=C[O]??"",R.dispatchEvent(new Event("input",{bubbles:!0})),R.dispatchEvent(new Event("blur",{bubbles:!0})),g++}}let k=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${g} value${g===1?"":"s"} (${k}${v>0?`, ${v} overflow`:""}).`})},!0)}function rt(n){let t=Array.from(n.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let d=[];for(let i of t){let l=i.getAttribute("dataelementid")??"";if(!l)continue;let s=i.closest("div"),o=(()=>{let a=s??i.parentElement;if(!a)return null;let u=a.previousElementSibling;for(;u;){if(/^(H1|H2|H3|H4)$/.test(u.tagName)||u.tagName==="DIV"&&!u.querySelector("table, input")&&(u.textContent??"").trim().length>0)return u;u=u.previousElementSibling}let p=a.closest("[data-section-id]");if(p){let f=p.querySelector("h2, h3, h4");if(f)return f}return null})();if(!o)continue;s?.remove();let r=document.createElement("span");r.className="der-de-matrix-total",r.setAttribute("data-de",l),o.appendChild(r);let c=()=>{let a=0,u=!1,p=Array.from(n.querySelectorAll(`input[dataelementid="${l}"][name$="-val"],input[name^="${l}-"][name$="-val"]`)),f=new Set;for(let b of p){if(f.has(b))continue;f.add(b);let g=parseFloat(b.value);Number.isFinite(g)&&(a+=g,u=!0)}if(u){let b=Number.isInteger(a)?a:Number(a.toFixed(2));r.textContent=` (Total: ${b})`}else r.textContent=""};d.push(c),c()}d.length!==0&&n.addEventListener("input",i=>{let l=i.target;if(!(!l||l.tagName!=="INPUT")&&/-val$/.test(l.getAttribute("name")??""))for(let s of d)s()},!0)}function at(n,t){let d=t.indicators??[];if(d.length===0)return;let i=d.filter(a=>a.numerator&&a.denominator).map(a=>({id:a.id,factor:a.indicatorType?.factor??1,numExpr:a.numerator,denExpr:a.denominator}));if(i.length===0)return;let l=Array.from(n.querySelectorAll("input[indicatorid]")),s=new Map;for(let a of Array.from(n.querySelectorAll('input[name$="-val"]')))s.set(a.getAttribute("name")??"",a);let e=a=>{let u=0;for(let[p,f]of s){if(!p.startsWith(`${a}-`))continue;let b=parseFloat(f.value);Number.isFinite(b)&&(u+=b)}return u},o=a=>a.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,f)=>{if(f){let b=s.get(`${p}-${f}-val`),g=parseFloat(b?.value??"");return Number.isFinite(g)?String(g):"0"}return String(e(p))}),r=a=>{if(!/^[\s\d+\-*/().eE]+$/.test(a))return NaN;try{return Function(`"use strict";return (${a})`)()}catch{return NaN}},c=()=>{for(let a of i){let u=r(o(a.numExpr)),p=r(o(a.denExpr)),f=l.find(g=>g.getAttribute("indicatorid")===a.id);if(!f)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){f.value="";continue}let b=u/p*a.factor;f.value=Number.isInteger(b)?String(b):b.toFixed(2)}};n.addEventListener("input",a=>{let u=a.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function ot(n,t){let d={};for(let i of t.dataSetElements??[])i.dataElement&&(d[i.dataElement.id]=i.dataElement);for(let i of Array.from(n.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(i.getAttribute("name")??"");if(!l)continue;let s=d[l[1]],e=s?.formName??s?.name??l[1],o=s?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===l[2]),r=o?.name??o?.displayName??l[2];i.hasAttribute("aria-label")||i.setAttribute("aria-label",r===l[2]?`${e}`:`${e}, ${r}`),i.getAttribute("data-compulsory")==="1"&&i.setAttribute("aria-required","true")}}function nt(n,t){let d=t.compulsoryDataElementOperands??[],i=new Set;for(let l of d){let s=l.dimensionItem;if(!s)continue;let e=s.split(".");e.length===2&&i.add(`${e[0]}:${e[1]}`)}if(i.size!==0)for(let l of Array.from(n.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(l.getAttribute("name")??"");s&&i.has(`${s[1]}:${s[2]}`)&&l.setAttribute("data-compulsory","1")}}function it(n,t,d){let i={};for(let s of t.dataSetElements??[])s.dataElement&&(i[s.dataElement.id]=s.dataElement);let l=s=>{let e=s.getAttribute("name")??s.id??"",o=/^(.+)-(.+)-val$/.exec(e);if(!o)return null;let r=o[1],c=o[2],a=i[r],u=a?.categoryCombo,p=u?.categoryOptionCombos?.find(C=>C.id===c),f=[],b=p?.name??p?.displayName??c,g=b.split(/,\s*/).filter(Boolean),v=u?.categories??[];g.forEach((C,A)=>{f.push({category:v[A]?.name??v[A]?.displayName??"",option:C})});let k=s.style.outline||"",x=k.includes("rgb(185, 134, 10)")||k.includes("#b9860a")?"saving":k.includes("rgb(206, 123, 0)")||k.includes("#ce7b00")?"queued":k.includes("rgb(26, 135, 84)")||k.includes("#1a8754")||k.includes("rgb(183, 220, 199)")||k.includes("#b7dcc7")?"saved":k.includes("rgb(169, 50, 50)")||k.includes("#a93232")?"error":s.value.trim()===""?"empty":"saved";return{deId:r,cocId:c,deName:a?.name??r,deFormName:a?.formName,valueType:a?.valueType??"TEXT",optionSetId:a?.optionSet?.id,cocName:b,categoryBreakdown:f,value:s.value,saveState:x,inputName:e,compulsory:s.getAttribute("data-compulsory")==="1"}};n.addEventListener("focusin",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let o=l(e);o&&d(o)}},!0),n.addEventListener("input",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let o=l(e);o&&d(o)}},!0)}function st(n,t,d){if(!n)return;let i=globalThis,l=i.dhis2?.de?.dataElements??{},s=i.dhis2?.de?.categoryOptionCombos??{},e=Array.from(n.querySelectorAll('input[name$="-val"]')),o=[];for(let r of e){r.style.outline="";let c=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!c)continue;let a=c[1],u=c[2],p=l[a],f=p?.valueType??"TEXT",b=r.value.trim();if(b===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",o.push({deId:a,cocId:u,valueType:f,value:"",problem:"compulsory value missing",deName:p?.name??a,cocName:s[u]?.name??u,inputName:r.name}));continue}let g=dt(b,f);g&&(r.style.outline="2px solid #c0392b",o.push({deId:a,cocId:u,valueType:f,value:b,problem:g,deName:p?.name??a,cocName:s[u]?.name??u,inputName:r.name}))}d(o,e.length),t({kind:"idle"})}function dt(n,t){let d=Number(n),i=Number.isInteger(d);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(t){case"INTEGER":if(!i)return"must be an integer";break;case"INTEGER_POSITIVE":if(!i||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!i||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!i||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function ne(n,t){let d=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${d}`,n.style.transition="outline 150ms",t==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function lt(n,t,d,i,l){if(!t||!d||!i)return;let s;try{s=(await l.readAggregateValues(i,d,2e3)).dataValues??[]}catch{return}for(let e of s){let o=e.dataElement,r=e.categoryOptionCombo,c=e.value;if(!o||!r||c==null)continue;let a=n.querySelector(`input[name="${o}-${r}-val"]`);a&&(a.value=c)}}function he(n){return new Promise((t,d)=>{let i=document.createElement("script");i.src=n,i.async=!1,i.setAttribute("data-der-custom-form",n),i.onload=()=>t(),i.onerror=()=>d(new Error(`failed to load ${n}`)),document.head.appendChild(i)})}function ve(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=n,t.setAttribute("data-der-custom-form",n),document.head.appendChild(t)}function ge(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function ct(n,t,d={}){let i=d.stripStyles??!0;n.classList.toggle("der-de-custom-form--author",!i);let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let e of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let o=e.getAttribute("href")??"";o&&ve(ge(o))}else{let o=document.createElement("style");o.textContent=e.textContent??"",o.setAttribute("data-der-custom-form","inline"),document.head.appendChild(o)}e.remove()}let s=[];for(let e of Array.from(l.querySelectorAll("script"))){let o=e.getAttribute("src");o?s.push({src:ge(o)}):s.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(l.body.querySelectorAll("*"))){if(i&&e.removeAttribute("style"),e.tagName==="INPUT"){let o=e.getAttribute("id")??"";o.endsWith("-val")&&e.getAttribute("name")!==o&&e.setAttribute("name",o)}if(i&&e.tagName==="TH"){let o=(e.textContent??"").trim();(o==="Reporting item"||o==="Reported count")&&(e.textContent=o==="Reporting item"?"Data elements":"Value")}}for(let e of Array.from(l.body.childNodes))n.appendChild(document.adoptNode(e));for(let e of s)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await he(e.src);else if(e.code){let o=document.createElement("script");o.textContent=e.code,o.setAttribute("data-der-custom-form","inline"),document.head.appendChild(o),o.remove()}}var ie={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},fe={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},be={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ut={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},mt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function pt(n,t,d,i=new Set,l=new Set){let s=(g,v)=>i.has(g)?`\u2713  ${v}`:l.has(g)?`\u25CF  ${v}`:v,e={...ie},o=xe(n);if(o.length===0)return m("input",{value:t,onChange:g=>d(g.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:e});let r=[...o];if(t&&!r.some(g=>g.id===t)){let g=gt(n,t)??t;r.unshift({id:t,label:g})}let c=o[0]?.id??null,a=r.findIndex(g=>g.id===t),u=a===-1||a<r.length-1||!!n,p=t!==""&&(a>0||t!==c),f=()=>{if(!n)return;let g=a>=0&&a<r.length-1?r[a+1]?.id??"":ye(n,t||c||"",-1);g&&d(g)},b=()=>{if(!n||!t||t===c)return;let g=a>0?r[a-1]?.id??"":ye(n,t,1);g&&d(g)};return _("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:f,disabled:!u,className:"der-de-period-btn",children:"\u25C0"}),_("select",{value:t,onChange:g=>d(g.target.value),style:e,children:[m("option",{value:"",children:"Select a period\u2026"}),r.map(g=>m("option",{value:g.id,children:s(g.id,g.label)},g.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:b,disabled:!p,className:"der-de-period-btn",children:"\u25B6"})]})}function ye(n,t,d){let i=l=>String(l).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=Number(t.slice(6,8)),o=new Date(l,s,e+d);return`${o.getFullYear()}${i(o.getMonth()+1)}${i(o.getDate())}`}case"Weekly":{let l=/^(\d{4})W(\d{1,2})$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=se(s)):e>se(s)&&(s+=1,e=1),`${s}W${e}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=l*12+s+d;return`${Math.floor(e/12)}${i((e%12+12)%12+1)}`}case"BiMonthly":{let l=/^(\d{4})(\d{2})B$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=6):e>6&&(s+=1,e=1),`${s}${i(e)}B`}case"Quarterly":{let l=/^(\d{4})Q(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=4):e>4&&(s+=1,e=1),`${s}Q${e}`}case"SixMonthly":{let l=/^(\d{4})S(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=2):e>2&&(s+=1,e=1),`${s}S${e}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+d):"";default:return""}}function gt(n,t){let d=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(n){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(t);return i?`${i[1]} W${String(i[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let i=Number(t.slice(4,6))-1;return`${d[i]??""} ${t.slice(0,4)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(t);if(!i)return null;let l=(Number(i[2])-1)*2;return`${d[l]}\u2013${d[l+1]} ${i[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(t);return i?`${i[1]} ${i[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function xe(n){let t=new Date,d=t.getFullYear(),i=t.getMonth(),l=e=>String(e).padStart(2,"0"),s=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(n){case"Daily":{let e=[];for(let o=0;o<30;o++){let r=new Date(t);r.setDate(r.getDate()-o);let c=`${r.getFullYear()}${l(r.getMonth()+1)}${l(r.getDate())}`,a=`${r.getFullYear()}-${l(r.getMonth()+1)}-${l(r.getDate())}`;e.push({id:c,label:a})}return e}case"Weekly":{let e=[],o=_e(t),r=o.year,c=o.week;for(let a=0;a<12;a++)e.push({id:`${r}W${c}`,label:`${r} W${l(c)}`}),c-=1,c<1&&(r-=1,c=se(r));return e}case"Monthly":{let e=[];for(let o=0;o<24;o++){let r=d,c=i,a=r*12+c-o,u=Math.floor(a/12),p=(a%12+12)%12;e.push({id:`${u}${l(p+1)}`,label:`${s[p]} ${u}`})}return e}case"BiMonthly":{let e=[],o=Math.floor(i/2)+1,r=d,c=o;for(let a=0;a<12;a++){let u=(c-1)*2;e.push({id:`${r}${l(c)}B`,label:`${s[u]}\u2013${s[u+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return e}case"Quarterly":{let e=[],o=Math.floor(i/3)+1,r=d,c=o;for(let a=0;a<8;a++)e.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return e}case"SixMonthly":{let e=[],o=i<6?1:2,r=d,c=o;for(let a=0;a<6;a++)e.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return e}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let e=[];for(let o=0;o<10;o++){let r=d-o;e.push({id:String(r),label:String(r)})}return e}default:return[]}}function _e(n){let t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),d=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-d);let i=new Date(t.getFullYear(),0,1),s=Math.round((t.getTime()-i.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((s+1)/7)}}function se(n){return _e(new Date(n,11,28)).week}var ft=`
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
  font-size: 13px;
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
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-border, #d8dee8) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #fafbfd !important;
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
  line-height: 1.35;
  font-size: 13px;
}
/* Blocked / not-applicable cells \u2014 DHIS2 greyedFields. Soft
 * neutral background + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f5,
    #eef0f5 6px,
    #e5e9ef 6px,
    #e5e9ef 7px
  ) !important;
  color: #9097a8 !important;
  text-align: center;
}
/* Indicator rows \u2014 computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f4f6fa !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid var(--der-border, #d8dee8) !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 13px;
  color: var(--der-ink-900, #101a32);
}
.der-apphost .der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce) !important;
  box-shadow: 0 0 0 2px rgba(74, 85, 206, 0.18);
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
  background: #eef1ff;
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
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 1px var(--der-brand-500, #4a55ce);
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
  border-color: var(--der-brand-500, #4a55ce);
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
  color: #4a55ce;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  color: #2c3597;
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
  border-left-color: #2c6693;
  color: #1f4d70;
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
  color: #1f4d70;
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
  font-size: 12px;
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
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid #d8dee8 !important;
  color: #5b6478 !important;
  font-weight: 500;
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
  background: #f3f5f7 !important;
  font-weight: 500;
  color: #404b5a;
}
.der-de-custom-form .tblep-table input[type="text"],
.der-de-custom-form table input[type="text"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  width: 100% !important;
  padding: 2px 4px !important;
  border: 0;
  background: transparent !important;
  font-size: 12px !important;
  color: #212934 !important;
  font-family: inherit;
}
.der-de-custom-form input[type="text"]:focus {
  outline: 1px solid #2c6693;
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
  font-size: 13px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #e5e9ef;
  padding: var(--der-de-cell-pad, 6px 8px);
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable thead th {
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
  text-align: center;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #fafbfd;
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
  background: #fcf7e6;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f3;
  color: #9aa3b0;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #e5e9ef;
  background: #fff;
  padding: 2px 4px;
  font-size: 13px;
  color: #212934;
  font-family: inherit;
  border-radius: 4px;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 3px rgba(74, 85, 206, 0.15);
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
  color: #1f2779;
  font-weight: 500;
}
/* Custom-form author inputs inherit the same visual language as
 * SECTION-renderer inputs: 1 px border, 4 px radius, indigo
 * focus ring. */
.der-de-custom-form input[name$="-val"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  border: 1px solid #e5e9ef !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  background: #fff !important;
}
.der-de-custom-form input[name$="-val"]:focus,
.der-de-custom-form input[name="entryfield"]:focus,
.der-de-custom-form input[name="total"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce) !important;
  box-shadow: 0 0 0 3px rgba(74, 85, 206, 0.15);
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
  color: #4a55ce;
  font-size: 12px;
  cursor: pointer;
}
.der-de-validation__jump-btn:hover { color: #2c3597; }

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
  color: #1f2779;
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
  color: #1f2779;
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
`;export{Pe as default};
