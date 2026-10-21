const navigation = ["Application launcher", "Aggregate reporting", "Event capture", "Tracker", "Recent records", "Connection status"];
export default function App() {
  return <div className="shell"><aside><div className="brand">DER Client</div><nav aria-label="Main navigation">{navigation.map(item => <div className="nav-item" key={item}>{item}</div>)}</nav></aside><main><header><h1>DER Client</h1><p>DHIS2 Edge Runtime • starter workspace</p></header><section className="notice"><h2>Implementation status</h2><p>This is a runnable interface shell. DHIS2 workflow, user identity, central sync and data persistence integration have not been implemented.</p><p>Develop the verified interfaces against a pinned DHIS2 version before marking capabilities complete.</p></section></main></div>;
}
