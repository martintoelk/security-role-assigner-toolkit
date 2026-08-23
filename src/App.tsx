import { Button, Checkbox, FluentProvider, Input, Toolbar, ToolbarButton, webLightTheme } from "@fluentui/react-components";
import { useMemo, useRef, useState } from "react";
import { applyRoleChangeOperations, loadSecurityRoleData, RoleChangeCancelledError, type RoleChangeResult } from "./data/dataverse";
import { createRoleChangeOperations, createRoleChangePreview } from "./domain/preview";
import { targetsFor, type ChangeAction, type RoleData, type Target, type TargetType } from "./domain/types";

function includesQuery(name: string, businessUnit: string, query: string) {
    const normalized = query.trim().toLocaleLowerCase();
    return !normalized || `${name} ${businessUnit}`.toLocaleLowerCase().includes(normalized);
}

function selectWithRange<T extends { id: string }>(items: T[], selectedItems: string[], itemId: string, shiftKey: boolean, anchorId: string | undefined, update: (next: string[]) => void): string | undefined {
    const selectedIndex = items.findIndex((item) => item.id === itemId);
    const anchorIndex = anchorId ? items.findIndex((item) => item.id === anchorId) : -1;
    if (shiftKey && selectedIndex >= 0 && anchorIndex >= 0) {
        const [start, end] = [selectedIndex, anchorIndex].sort((left, right) => left - right);
        update([...new Set([...selectedItems, ...items.slice(start, end + 1).map((item) => item.id)])]);
        return anchorId;
    }
    update(selectedItems.includes(itemId) ? selectedItems.filter((id) => id !== itemId) : [...selectedItems, itemId]);
    return itemId;
}

function formatDuration(milliseconds: number) {
    const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
    return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function formatResultSummary(results: RoleChangeResult[]) {
    const applied = results.filter((result) => result.outcome !== "failed").length;
    const fallbacks = results.filter((result) => result.outcome === "applied-with-fallback").length;
    const failures = results.filter((result) => result.outcome === "failed");
    const failureDetails = failures.map((result) => `${result.operation.target.name}: ${result.message}`).join("; ");
    return `${applied} role assignment change(s) applied${fallbacks ? ` (${fallbacks} using a classic-BU role copy)` : ""}; ${failures.length} failed${failures.length ? ` — ${failureDetails}` : ""}.`;
}

function App() {
    const [data, setData] = useState<RoleData>();
    const [mode, setMode] = useState<TargetType>("team");
    const [action, setAction] = useState<ChangeAction>("add");
    const [roleFilter, setRoleFilter] = useState("");
    const [targetFilter, setTargetFilter] = useState("");
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [removeFromAllBusinessUnits, setRemoveFromAllBusinessUnits] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState("");
    const [operationResults, setOperationResults] = useState<RoleChangeResult[]>([]);
    const [progress, setProgress] = useState<{ completed: number; total: number; startedAt: number }>();
    const [loading, setLoading] = useState(false);
    const roleSelectionAnchor = useRef<string | undefined>(undefined);
    const targetSelectionAnchor = useRef<string | undefined>(undefined);
    const operationController = useRef<AbortController>();

    const businessUnitName = (id: string, name?: string) => name || data?.businessUnits.find((businessUnit) => businessUnit.id === id)?.name || id;
    const targets = useMemo(() => data ? targetsFor(data, mode).filter((target) => includesQuery(target.name, businessUnitName(target.businessUnitId, target.businessUnitName), targetFilter)) : [], [data, mode, targetFilter]);
    const roles = useMemo(() => data ? data.roles.filter((role) => includesQuery(role.name, businessUnitName(role.businessUnitId, role.businessUnitName), roleFilter)) : [], [data, roleFilter]);
    const selectedTargetItems = useMemo(() => data ? targetsFor(data, mode).filter((target) => selectedTargets.includes(target.id)) : [], [data, mode, selectedTargets]);
    const preview = useMemo(() => data ? createRoleChangePreview({ action, removeFromAllBusinessUnits, targets: selectedTargetItems, roles: data.roles, selectedRoleIds: selectedRoles, assignments: data.assignments, businessUnitMode: data.businessUnitMode }) : undefined, [action, data, removeFromAllBusinessUnits, selectedRoles, selectedTargetItems]);

    const load = async () => {
        setLoading(true);
        setError("");
        setResult("");
        setOperationResults([]);
        setProgress(undefined);
        try {
            setData(await loadSecurityRoleData());
        } catch (cause) {
            setError(`Could not load the selected Dataverse connection: ${cause instanceof Error ? cause.message : "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    const apply = async (nextAction: ChangeAction) => {
        if (!data) return;
        if (mode !== "team") { setResult("Role changes are currently available for teams only."); return; }
        setAction(nextAction);
        setError("");
        setResult("");
        setOperationResults([]);
        const request = { action: nextAction, removeFromAllBusinessUnits, targets: selectedTargetItems, roles: data.roles, selectedRoleIds: selectedRoles, assignments: data.assignments, businessUnitMode: data.businessUnitMode };
        const operations = createRoleChangeOperations(request);
        if (operations.length === 0) {
            setResult("No changes to apply; the selected roles are already in the requested state.");
            return;
        }
        setLoading(true);
        const startedAt = Date.now();
        const controller = new AbortController();
        operationController.current = controller;
        setProgress({ completed: 0, total: operations.length, startedAt });
        try {
            const results = await applyRoleChangeOperations(operations, (completed, total) => setProgress({ completed, total, startedAt }), controller.signal);
            setData(await loadSecurityRoleData());
            setResult(formatResultSummary(results));
            setOperationResults(results);
        } catch (cause) {
            if (cause instanceof RoleChangeCancelledError) {
                setData(await loadSecurityRoleData());
                setResult("Operation cancelled. Completed changes were retained and assignments refreshed.");
            } else {
                setError(`Could not ${nextAction} the selected role assignments: ${cause instanceof Error ? cause.message : "Unknown error"}`);
            }
        } finally {
            setLoading(false);
            setProgress(undefined);
            operationController.current = undefined;
        }
    };

    const setTargetMode = (nextMode: TargetType) => {
        setMode(nextMode);
        setSelectedTargets([]);
        setTargetFilter("");
        targetSelectionAnchor.current = undefined;
    };
    const targetTitle = mode === "team" ? "Teams" : "Users";
    const targetTypeTitle = mode === "team" ? "Type" : "Disabled";
    const businessUnitModeLabel = data?.businessUnitMode === "modernized" ? "Modernized BU" : "Traditional BU";

    return <FluentProvider theme={webLightTheme} className="fluent-host">
        <main className="tool-shell" aria-labelledby="tool-title">
            <Toolbar className="command-bar" aria-label="Security role assignment commands">
                <ToolbarButton icon={<span className="command-icon refresh-icon">↻</span>} onClick={load} disabled={loading}>
                    {loading ? "Loading…" : "Load / Refresh"}
                </ToolbarButton>
                <Checkbox className="remove-all-toggle" checked={removeFromAllBusinessUnits} disabled={action === "add"} label="Remove from all BUs" onChange={(_, state) => setRemoveFromAllBusinessUnits(Boolean(state.checked))} />
            </Toolbar>

            <header className="tool-heading">
                <div><h1 id="tool-title">BU Security Role Assigner</h1><p>Assign security roles by business unit.</p></div>
                {data && <span className="modernized-mode">▦ {businessUnitModeLabel}</span>}
            </header>

            {error && <p className="error-message" role="alert">{error}</p>}
            {!data && !error && <section className="empty-state"><h2>Ready to load</h2><p>Select <strong>Load / Refresh</strong> to retrieve roles, teams, and users from the active connection.</p></section>}

            {data && <>
                <section className="matrix-layout" aria-label="Role assignment selection">
                    <section className="list-pane" aria-labelledby="roles-heading">
                        <div className="mode-strip"><span className="mode-chip">▦ Mode: {businessUnitModeLabel}</span></div>
                        <h2 id="roles-heading">Security roles (multi-select) — Business Unit shown</h2>
                        <Input className="search-box" contentBefore={<span aria-hidden="true">⌕</span>} placeholder="Search…" value={roleFilter} onChange={(_, state) => setRoleFilter(state.value)} />
                        <div className="data-grid roles-grid" role="listbox" aria-multiselectable="true" aria-label="Security roles">
                            <div className="grid-header" role="presentation"><span>Security Role</span><span>Business Unit</span></div>
                            <div className="grid-body">{roles.map((role) => <RoleRow key={role.id} role={role} businessUnitName={businessUnitName(role.businessUnitId, role.businessUnitName)} checked={selectedRoles.includes(role.id)} onToggle={(shiftKey) => { roleSelectionAnchor.current = selectWithRange(roles, selectedRoles, role.id, shiftKey, roleSelectionAnchor.current, setSelectedRoles); }} />)}</div>
                        </div>
                    </section>

                    <div className="action-column" aria-label="Choose the requested action">
                        <Button appearance={action === "add" ? "primary" : "secondary"} icon={<span className="action-icon add-icon">+</span>} onClick={() => void apply("add")} disabled={loading}>Add roles to {mode === "team" ? "team(s)" : "user(s)"}</Button>
                        <Button appearance={action === "remove" ? "primary" : "secondary"} className="remove-button" icon={<span className="action-icon remove-icon">−</span>} onClick={() => void apply("remove")} disabled={loading}>Remove roles from {mode === "team" ? "team(s)" : "user(s)"}</Button>
                    </div>

                    <section className="list-pane" aria-labelledby="targets-heading">
                        <div className="mode-strip"><Toolbar aria-label="Target type"><ToolbarButton className="mode-switch" aria-pressed={mode === "team"} onClick={() => setTargetMode("team")}>♟ Mode: Teams</ToolbarButton><ToolbarButton className="mode-switch" aria-pressed={mode === "user"} onClick={() => setTargetMode("user")}>● Users</ToolbarButton></Toolbar></div>
                        <h2 id="targets-heading">{targetTitle} (multi-select)</h2>
                        <Input className="search-box" contentBefore={<span aria-hidden="true">⌕</span>} placeholder="Search…" value={targetFilter} onChange={(_, state) => setTargetFilter(state.value)} />
                        <div className="data-grid targets-grid" role="listbox" aria-multiselectable="true" aria-label={targetTitle}>
                            <div className="grid-header" role="presentation"><span>{mode === "team" ? "Team" : "User"}</span><span>Business Unit</span><span>{targetTypeTitle}</span></div>
                            <div className="grid-body">{targets.map((target) => <TargetRow key={target.id} target={target} businessUnitName={businessUnitName(target.businessUnitId, target.businessUnitName)} checked={selectedTargets.includes(target.id)} mode={mode} onToggle={(shiftKey) => { targetSelectionAnchor.current = selectWithRange(targets, selectedTargets, target.id, shiftKey, targetSelectionAnchor.current, setSelectedTargets); }} />)}</div>
                        </div>
                    </section>
                </section>

                <section className="operation-status" aria-live="polite"><strong>{action === "add" ? "Add" : "Remove"} preview</strong><span>{selectedRoles.length} role(s) × {selectedTargetItems.length} {mode}(s)</span><span className="preview-result">{preview?.applyCount ?? 0} change(s) ready; {preview?.skipCount ?? 0} safe skip(s)</span>{action === "remove" && removeFromAllBusinessUnits && <span className="warning-note">All BU copies will be included.</span>}</section>
                {operationResults.length > 0 && <section className="operation-results" aria-label="Team role change results"><h2>Team role change results</h2><ul>{operationResults.map((change, index) => <li key={`${change.operation.target.id}:${change.role.id}:${index}`}><strong>{change.operation.target.name}</strong> — {change.role.name}: {change.outcome === "applied" ? "applied" : change.outcome === "applied-with-fallback" ? "applied with target-BU fallback" : `failed (${change.message})`}</li>)}</ul></section>}
                {progress && <div className="operation-progress-overlay" role="alertdialog" aria-modal="true" aria-label="Applying role assignment changes"><section className="operation-progress"><h2>Applying role changes</h2><progress value={progress.completed} max={progress.total} /><span>{progress.completed === 0 ? `Preparing ${progress.total} change(s)` : `Applied ${progress.completed} of ${progress.total}`}</span><span>{progress.completed === 0 ? "Calculating ETA…" : progress.completed === progress.total ? "Refreshing assignments…" : `About ${formatDuration(((Date.now() - progress.startedAt) / progress.completed) * (progress.total - progress.completed))} remaining`}</span><Button className="cancel-operation" appearance="secondary" onClick={() => operationController.current?.abort()}>Cancel remaining changes</Button></section></div>}
                {result && <p className="success-message" role="status">{result}</p>}
            </>}
        </main>
    </FluentProvider>;
}

function RoleRow({ role, businessUnitName, checked, onToggle }: { role: RoleData["roles"][number]; businessUnitName: string; checked: boolean; onToggle: (shiftKey: boolean) => void }) {
    return <label className={`grid-row ${checked ? "is-selected" : ""}`} role="option" aria-selected={checked}><Checkbox aria-label={`Select ${role.name}`} checked={checked} onChange={(event) => onToggle(event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)} /><span>{role.name}</span><span>{businessUnitName}</span></label>;
}

function TargetRow({ target, businessUnitName, checked, mode, onToggle }: { target: Target; businessUnitName: string; checked: boolean; mode: TargetType; onToggle: (shiftKey: boolean) => void }) {
    const detail = mode === "team" ? target.teamType || "Owner" : target.isDisabled ? "Yes" : "";
    return <label className={`grid-row ${checked ? "is-selected" : ""}`} role="option" aria-selected={checked}><Checkbox aria-label={`Select ${target.name}`} checked={checked} onChange={(event) => onToggle(event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)} /><span>{target.name}</span><span>{businessUnitName}</span><span>{detail}</span></label>;
}

export default App;
