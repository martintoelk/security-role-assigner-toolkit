import { useMemo, useState } from "react";
import { loadSecurityRoleData } from "./data/dataverse";
import { createRoleChangePreview, filterByText } from "./domain/preview";
import { targetsFor, type ChangeAction, type RoleData, type TargetType } from "./domain/types";

function App() {
    const [data, setData] = useState<RoleData>();
    const [mode, setMode] = useState<TargetType>("team");
    const [action, setAction] = useState<ChangeAction>("add");
    const [filter, setFilter] = useState("");
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [removeFromAllBusinessUnits, setRemoveFromAllBusinessUnits] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const businessUnitName = (id: string) => data?.businessUnits.find((unit) => unit.id === id)?.name ?? id;
    const targets = useMemo(() => data ? filterByText(targetsFor(data, mode), filter) : [], [data, filter, mode]);
    const preview = useMemo(() => data ? createRoleChangePreview({ action, removeFromAllBusinessUnits, targets: targetsFor(data, mode).filter((target) => selectedTargets.includes(target.id)), roles: data.roles, selectedRoleIds: selectedRoles, assignments: data.assignments }) : undefined, [action, data, mode, removeFromAllBusinessUnits, selectedRoles, selectedTargets]);
    const load = async () => { setLoading(true); setError(""); try { setData(await loadSecurityRoleData()); } catch { setError("Could not load the selected Dataverse connection. Check the connection and try again."); } finally { setLoading(false); } };
    const toggle = (items: string[], value: string, update: (next: string[]) => void) => update(items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
    return (
        <main className="foundation" aria-labelledby="tool-title">
            <h1 id="tool-title">BU Security Role Assigner</h1>
            <p>Read-only preflight preview. This screen never changes Dataverse role assignments.</p>
            <button onClick={load} disabled={loading}>{loading ? "Loading…" : "Load selected sandbox"}</button>
            {error && <p role="alert">{error}</p>}
            {data && <>
                <fieldset><legend>Target type</legend><label><input type="radio" checked={mode === "team"} onChange={() => { setMode("team"); setSelectedTargets([]); }} /> Teams</label><label><input type="radio" checked={mode === "user"} onChange={() => { setMode("user"); setSelectedTargets([]); }} /> Users</label></fieldset>
                <label>Filter {mode}s <input value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
                <section><h2>Select {mode}s</h2>{targets.map((target) => <label key={target.id}><input type="checkbox" checked={selectedTargets.includes(target.id)} onChange={() => toggle(selectedTargets, target.id, setSelectedTargets)} /> {target.name} (BU: {businessUnitName(target.businessUnitId)})</label>)}</section>
                <section><h2>Select roles</h2>{data.roles.map((role) => <label key={role.id}><input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggle(selectedRoles, role.id, setSelectedRoles)} /> {role.name} (BU: {businessUnitName(role.businessUnitId)})</label>)}</section>
                <fieldset><legend>Requested action</legend><label><input type="radio" checked={action === "add"} onChange={() => setAction("add")} /> Add roles</label><label><input type="radio" checked={action === "remove"} onChange={() => setAction("remove")} /> Remove roles</label><label><input type="checkbox" checked={removeFromAllBusinessUnits} onChange={(event) => setRemoveFromAllBusinessUnits(event.target.checked)} /> Remove from all BUs</label></fieldset>
                {preview && <section><h2>Preflight preview</h2><p>{preview.applyCount} changes would apply; {preview.skipCount} idempotent skips.</p><ul>{preview.items.map((item) => <li key={`${item.target.id}-${item.role.id}`}>{item.target.name} (BU: {businessUnitName(item.target.businessUnitId)}): {item.role.name} — {item.detail}</li>)}</ul></section>}
            </>}
        </main>
    );
}

export default App;
