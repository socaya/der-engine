/* @der-app {"appKey":"workflow-capture","displayName":"Workflow capture","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as P,useState as i}from"react";import{useAuth as F,useOrgUnitBinding as W,useOnlineStatus as _,useDerApi as U,ScreenCard as q,StatusPill as $}from"@der/app-sdk";import{Fragment as X,jsx as t,jsxs as n}from"react/jsx-runtime";function K(){let m=F(),u=W(),d=_(),l=U(),[z,C]=i([]),[s,L]=i(""),[g,E]=i([]),[p,I]=i(null),[f,k]=i(null),[b,w]=i(null),[a,o]=i({kind:"idle"}),[N,x]=i(!1),[y,T]=i("");P(()=>{let e=!1;return l.listCaptureWorkflows().then(r=>{e||C(r.workflows.filter(v=>v.enabled))}).catch(()=>{e||C([])}),()=>{e=!0}},[l]);async function h(){if(s===""){E([]);return}o({kind:"loading"});try{let e=await l.listCaptureRuns({workflowId:s});E(e.runs),o({kind:"idle"})}catch(e){o({kind:"error",message:e.message??"Load failed"})}}P(()=>{h(),I(null),k(null),w(null)},[s]);async function O(e){I(e),k(null),w(null),o({kind:"loading"});try{let[r,v]=await Promise.all([l.getCaptureRunForm(e),l.getCaptureRunData(e)]);k(r),w(v),o({kind:"idle"})}catch(r){o({kind:"error",message:r.message??"Load failed"})}}async function B(e){if(e.preventDefault(),!(s===""||y.trim()==="")){o({kind:"starting"});try{let r=await l.startCaptureRun(s,y.trim());o({kind:"ok",message:`Started run ${r.runId.slice(0,8)}\u2026`}),T(""),x(!1),h()}catch(r){o({kind:"error",message:r.message??"Start failed"})}}}async function D(){if(p){o({kind:"advancing"});try{let e=await l.advanceCaptureRun(p);o({kind:"ok",message:e.completedByThisCall?"Run completed.":`Advanced to ${e.currentStepId??"(no next step)"}.`}),h(),O(p)}catch(e){o({kind:"error",message:e.message??"Advance failed"})}}}let c=g.find(e=>e.runId===p)??null;return n(q,{title:"Workflow capture",actions:n("span",{className:"der-wc-heartbeat"+(d.isOnline?"":" der-wc-heartbeat--offline"),"aria-label":d.isOnline?"Connected to DER edge":`Offline \u2014 ${d.queuedCount} queued`,title:d.isOnline?"Connected to DER edge":`Offline \u2014 ${d.queuedCount} queued`,children:[t("span",{className:"der-wc-heartbeat__dot","aria-hidden":"true"}),d.isOnline?"Live sync":`offline (${d.queuedCount} queued)`]}),children:[t("style",{children:`
        .der-wc-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
          margin: 0 0px 12px;
          padding: 10px 20px 10px 20px;
          background: #ffffff;
          border-bottom: 1px solid #e5e9ef;
          box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
        }
        .der-wc-heartbeat {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: #117a44; font-weight: 500;
        }
        .der-wc-heartbeat--offline { color: #6e7a8a; }
        .der-wc-heartbeat__dot {
          position: relative;
          width: 8px; height: 8px; border-radius: 50%;
          background: #117a44; color: #117a44;
          box-shadow: 0 0 0 2px rgba(17, 122, 68, 0.18);
        }
        .der-wc-heartbeat__dot::before {
          content: '';
          position: absolute;
          left: 50%; top: 50%;
          width: 8px; height: 8px;
          margin: -4px 0 0 -4px;
          border-radius: 50%;
          border: 2px solid currentColor;
          opacity: 0;
          pointer-events: none;
          animation: der-wc-pulse-ring 2.4s cubic-bezier(0.2,0.6,0.4,1) infinite;
        }
        .der-wc-heartbeat--offline .der-wc-heartbeat__dot {
          background: #94a3b8; color: #94a3b8;
          box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.18);
        }
        .der-wc-heartbeat--offline .der-wc-heartbeat__dot::before {
          animation: none;
        }
        @keyframes der-wc-pulse-ring {
          0%  { transform: scale(1);   opacity: 0.6; }
          70% { opacity: 0; }
          100%{ transform: scale(3.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .der-wc-heartbeat__dot::before { animation: none; }
        }
      `}),n("p",{style:{margin:0,color:"#6e7a8a",fontSize:13},children:["Signed in as ",t("strong",{children:m.displayName})," \u2022 Bound OU",t("code",{style:{marginInline:6},title:u.orgUnitPath,children:u.orgUnitDisplayName||u.orgUnitUid})]}),!u.bound&&t("p",{style:{marginTop:12,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing workflow runs."}),t("div",{className:"der-wc-toolbar","data-test":"der-wc-toolbar",children:n("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end"},children:[n("label",{children:["Workflow",n("select",{value:s,onChange:e=>L(e.target.value),style:A,children:[t("option",{value:"",children:"\u2014 pick a workflow \u2014"}),z.map(e=>t("option",{value:e.workflowId,children:e.displayName},e.workflowId))]})]}),t("button",{type:"button",onClick:()=>x(!0),disabled:!u.bound||s==="",style:S,children:"Start run"})]})}),N&&n("form",{onSubmit:B,style:{marginTop:12,padding:12,border:"1px solid #d7dde5",borderRadius:3,background:"#fafbfc"},children:[n("label",{children:["Business key",t("input",{value:y,onChange:e=>T(e.target.value),placeholder:"e.g. orgUnit:202611 or TEI uid",style:A})]}),t("p",{style:{fontSize:12,color:"#6e7a8a",margin:"6px 0"},children:"Identifies this run uniquely within the workflow."}),n("div",{style:{display:"flex",gap:8},children:[t("button",{type:"submit",disabled:y.trim()===""||a.kind==="starting",style:S,children:a.kind==="starting"?"Starting\u2026":"Start"}),t("button",{type:"button",onClick:()=>x(!1),style:R,children:"Cancel"})]})]}),a.kind==="ok"&&t("div",{style:j,"data-test":"wc-ok",children:a.message}),a.kind==="error"&&t("div",{style:G,"data-test":"wc-err",children:a.message}),n("h3",{style:H,children:["Runs ",g.length>0&&`(${g.length})`]}),g.length===0?t("p",{style:{color:"#6e7a8a",fontSize:13},children:s===""?"Pick a workflow to list runs.":a.kind==="loading"?"Loading\u2026":"No runs for this workflow yet."}):t("ul",{style:{margin:0,padding:0,listStyle:"none"},children:g.map(e=>n("li",{style:{padding:"6px 0",borderBottom:"1px solid #eef0f3",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:13},children:[n("div",{style:{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0},children:[n("code",{style:{color:"#2c3e50"},children:[e.runId.slice(0,8),"\u2026"]}),t("span",{style:{color:"#6e7a8a"},children:e.businessKey}),t($,{tone:M(e.state),children:e.state})]}),t("button",{type:"button",onClick:()=>{O(e.runId)},style:p===e.runId?J:R,children:(p===e.runId,"Open")})]},e.runId))}),c&&n("section",{style:{marginTop:16,padding:12,border:"1px solid #d7dde5",borderRadius:3,background:"#fafbfc"},"data-test":"wc-run-card",children:[n("h4",{style:{margin:0,fontSize:14},children:["Run ",t("code",{children:c.runId})]}),n("p",{style:{margin:"6px 0",fontSize:13,color:"#6e7a8a"},children:["Business key ",t("strong",{children:c.businessKey})," \xB7 ","state ",t("strong",{children:c.state})," \xB7 ","step ",t("code",{children:c.currentStepId??"\u2014"})]}),f&&n("p",{style:{margin:"6px 0",fontSize:13},children:["Current step binding: ",t("strong",{children:f.displayName})," \xB7 ",t("code",{children:f.formType})," \xB7 ",t("code",{children:f.bindingUid})]}),b&&Object.keys(b.cells).length>0&&n(X,{children:[n("h5",{style:{margin:"12px 0 4px",fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em",color:"#6e7a8a"},children:["Prefill (",Object.keys(b.cells).length," cells)"]}),t("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:12},children:t("tbody",{children:Object.entries(b.cells).map(([e,r])=>n("tr",{style:{borderBottom:"1px solid #eef0f3"},children:[t("td",{style:{padding:"4px 4px",color:"#6e7a8a"},children:t("code",{children:e})}),t("td",{style:{padding:"4px 4px"},children:r})]},e))})})]}),t("div",{style:{marginTop:12,display:"flex",gap:8},children:t("button",{type:"button",onClick:()=>{D()},disabled:c.state==="COMPLETED"||c.state==="REJECTED"||a.kind==="advancing",style:S,children:a.kind==="advancing"?"Advancing\u2026":"Advance run"})}),t("p",{style:{marginTop:10,fontSize:12,color:"#6e7a8a"},children:"Field-value editing lands in a later slice-5 follow-up \u2014 use the shell's capture-run form for full write-back today."})]})]})}function M(m){switch(m){case"OPEN":return"success";case"AWAITING":return"warning";case"COMPLETED":return"neutral";case"REJECTED":return"danger"}}var A={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},S={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},R={padding:"6px 16px",border:"1px solid #d7dde5",background:"#fff",color:"#2c3e50",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},J={...R,background:"#eaf1f8",borderColor:"#2c6693",color:"#1f4d70"},j={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},G={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3},H={marginTop:20,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em",color:"#6e7a8a",borderBottom:"1px solid #d7dde5",paddingBottom:6};export{K as default};
