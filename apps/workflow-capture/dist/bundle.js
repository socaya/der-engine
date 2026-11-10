/* @der-app {"appKey":"workflow-capture","displayName":"Workflow capture","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as P,useState as i}from"react";import{useAuth as F,useOrgUnitBinding as W,useOnlineStatus as _,useDerApi as U,ScreenCard as q,StatusPill as $}from"@der/app-sdk";import{Fragment as X,jsx as r,jsxs as t}from"react/jsx-runtime";function K(){let m=F(),p=W(),d=_(),l=U(),[z,C]=i([]),[s,L]=i(""),[g,E]=i([]),[u,I]=i(null),[f,k]=i(null),[b,v]=i(null),[a,n]=i({kind:"idle"}),[N,w]=i(!1),[y,T]=i("");P(()=>{let e=!1;return l.listCaptureWorkflows().then(o=>{e||C(o.workflows.filter(h=>h.enabled))}).catch(()=>{e||C([])}),()=>{e=!0}},[l]);async function x(){if(s===""){E([]);return}n({kind:"loading"});try{let e=await l.listCaptureRuns({workflowId:s});E(e.runs),n({kind:"idle"})}catch(e){n({kind:"error",message:e.message??"Load failed"})}}P(()=>{x(),I(null),k(null),v(null)},[s]);async function O(e){I(e),k(null),v(null),n({kind:"loading"});try{let[o,h]=await Promise.all([l.getCaptureRunForm(e),l.getCaptureRunData(e)]);k(o),v(h),n({kind:"idle"})}catch(o){n({kind:"error",message:o.message??"Load failed"})}}async function B(e){if(e.preventDefault(),!(s===""||y.trim()==="")){n({kind:"starting"});try{let o=await l.startCaptureRun(s,y.trim());n({kind:"ok",message:`Started run ${o.runId.slice(0,8)}\u2026`}),T(""),w(!1),x()}catch(o){n({kind:"error",message:o.message??"Start failed"})}}}async function D(){if(u){n({kind:"advancing"});try{let e=await l.advanceCaptureRun(u);n({kind:"ok",message:e.completedByThisCall?"Run completed.":`Advanced to ${e.currentStepId??"(no next step)"}.`}),x(),O(u)}catch(e){n({kind:"error",message:e.message??"Advance failed"})}}}let c=g.find(e=>e.runId===u)??null;return t(q,{title:"Workflow capture",actions:t("span",{className:"der-wc-heartbeat"+(d.isOnline?"":" der-wc-heartbeat--offline"),"aria-label":d.isOnline?"Connected to DER edge":`Offline \u2014 ${d.queuedCount} queued`,title:d.isOnline?"Connected to DER edge":`Offline \u2014 ${d.queuedCount} queued`,children:[r("span",{className:"der-wc-heartbeat__dot","aria-hidden":"true"}),d.isOnline?"Live sync":`offline (${d.queuedCount} queued)`]}),children:[r("style",{children:`
        .der-wc-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
          margin: 0 0px 12px;
          padding: 10px 20px 10px 20px;
          background: var(--der-surface);
          border-bottom: 1px solid var(--der-border);
          box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
        }
        .der-wc-heartbeat {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--der-success-ink); font-weight: 500;
        }
        .der-wc-heartbeat--offline { color: var(--der-ink-500); }
        .der-wc-heartbeat__dot {
          position: relative;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--der-success-ink); color: var(--der-success-ink);
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
          background: var(--der-ink-400); color: var(--der-ink-400);
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
      `}),t("p",{style:{margin:0,color:"var(--der-ink-500)",fontSize:13},children:["Signed in as ",r("strong",{children:m.displayName})," \u2022 Bound OU",r("code",{style:{marginInline:6},title:p.orgUnitPath,children:p.orgUnitDisplayName||p.orgUnitUid})]}),!p.bound&&r("p",{style:{marginTop:12,color:"var(--der-danger-ink)"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing workflow runs."}),r("div",{className:"der-wc-toolbar","data-test":"der-wc-toolbar",children:t("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end"},children:[t("label",{children:["Workflow",t("select",{value:s,onChange:e=>L(e.target.value),style:A,children:[r("option",{value:"",children:"\u2014 pick a workflow \u2014"}),z.map(e=>r("option",{value:e.workflowId,children:e.displayName},e.workflowId))]})]}),r("button",{type:"button",onClick:()=>w(!0),disabled:!p.bound||s==="",style:S,children:"Start run"})]})}),N&&t("form",{onSubmit:B,style:{marginTop:12,padding:12,border:"1px solid var(--der-border)",borderRadius:3,background:"var(--der-surface-raised)"},children:[t("label",{children:["Business key",r("input",{value:y,onChange:e=>T(e.target.value),placeholder:"e.g. orgUnit:202611 or TEI uid",style:A})]}),r("p",{style:{fontSize:12,color:"var(--der-ink-500)",margin:"6px 0"},children:"Identifies this run uniquely within the workflow."}),t("div",{style:{display:"flex",gap:8},children:[r("button",{type:"submit",disabled:y.trim()===""||a.kind==="starting",style:S,children:a.kind==="starting"?"Starting\u2026":"Start"}),r("button",{type:"button",onClick:()=>w(!1),style:R,children:"Cancel"})]})]}),a.kind==="ok"&&r("div",{style:j,"data-test":"wc-ok",children:a.message}),a.kind==="error"&&r("div",{style:G,"data-test":"wc-err",children:a.message}),t("h3",{style:H,children:["Runs ",g.length>0&&`(${g.length})`]}),g.length===0?r("p",{style:{color:"var(--der-ink-500)",fontSize:13},children:s===""?"Pick a workflow to list runs.":a.kind==="loading"?"Loading\u2026":"No runs for this workflow yet."}):r("ul",{style:{margin:0,padding:0,listStyle:"none"},children:g.map(e=>t("li",{style:{padding:"6px 0",borderBottom:"1px solid var(--der-border-subtle)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:13},children:[t("div",{style:{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0},children:[t("code",{style:{color:"var(--der-ink-800)"},children:[e.runId.slice(0,8),"\u2026"]}),r("span",{style:{color:"var(--der-ink-500)"},children:e.businessKey}),r($,{tone:M(e.state),children:e.state})]}),r("button",{type:"button",onClick:()=>{O(e.runId)},style:u===e.runId?J:R,children:(u===e.runId,"Open")})]},e.runId))}),c&&t("section",{style:{marginTop:16,padding:12,border:"1px solid var(--der-border)",borderRadius:3,background:"var(--der-surface-raised)"},"data-test":"wc-run-card",children:[t("h4",{style:{margin:0,fontSize:14},children:["Run ",r("code",{children:c.runId})]}),t("p",{style:{margin:"6px 0",fontSize:13,color:"var(--der-ink-500)"},children:["Business key ",r("strong",{children:c.businessKey})," \xB7 ","state ",r("strong",{children:c.state})," \xB7 ","step ",r("code",{children:c.currentStepId??"\u2014"})]}),f&&t("p",{style:{margin:"6px 0",fontSize:13},children:["Current step binding: ",r("strong",{children:f.displayName})," \xB7 ",r("code",{children:f.formType})," \xB7 ",r("code",{children:f.bindingUid})]}),b&&Object.keys(b.cells).length>0&&t(X,{children:[t("h5",{style:{margin:"12px 0 4px",fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--der-ink-500)"},children:["Prefill (",Object.keys(b.cells).length," cells)"]}),r("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:12},children:r("tbody",{children:Object.entries(b.cells).map(([e,o])=>t("tr",{style:{borderBottom:"1px solid var(--der-border-subtle)"},children:[r("td",{style:{padding:"4px 4px",color:"var(--der-ink-500)"},children:r("code",{children:e})}),r("td",{style:{padding:"4px 4px"},children:o})]},e))})})]}),r("div",{style:{marginTop:12,display:"flex",gap:8},children:r("button",{type:"button",onClick:()=>{D()},disabled:c.state==="COMPLETED"||c.state==="REJECTED"||a.kind==="advancing",style:S,children:a.kind==="advancing"?"Advancing\u2026":"Advance run"})}),r("p",{style:{marginTop:10,fontSize:12,color:"var(--der-ink-500)"},children:"Field-value editing lands in a later slice-5 follow-up \u2014 use the shell's capture-run form for full write-back today."})]})]})}function M(m){switch(m){case"OPEN":return"success";case"AWAITING":return"warning";case"COMPLETED":return"neutral";case"REJECTED":return"danger"}}var A={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid var(--der-border)",borderRadius:2,fontSize:13,fontFamily:"inherit"},S={padding:"6px 16px",border:"1px solid var(--der-primary-700)",background:"var(--der-primary-ink)",color:"var(--der-surface)",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},R={padding:"6px 16px",border:"1px solid var(--der-border)",background:"var(--der-surface)",color:"var(--der-ink-800)",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},J={...R,background:"var(--der-primary-50)",borderColor:"var(--der-primary-ink)",color:"var(--der-primary-700)"},j={marginTop:12,padding:"8px 12px",background:"var(--der-success-soft)",color:"var(--der-success-ink)",border:"1px solid var(--der-success)",borderRadius:3},G={marginTop:12,padding:"8px 12px",background:"var(--der-danger-soft)",color:"var(--der-danger-ink)",border:"1px solid var(--der-danger)",borderRadius:3},H={marginTop:20,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--der-ink-500)",borderBottom:"1px solid var(--der-border)",paddingBottom:6};export{K as default};
