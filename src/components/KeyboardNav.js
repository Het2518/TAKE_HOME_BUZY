"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Global keyboard shortcuts:
//  / → focus the search input (if one exists on the page)
//  g d → go to Dashboard
//  g p → go to Projects
//  g t → go to All Tasks
//  g m → go to My Tasks
//  g a → go to Activity
//  g l → go to Alerts
//  g e → go to Email Digest
//  ? → toggle keyboard help modal
//  Escape → blur focused input / close modal

export function useKeyboardNav() {
  const router = useRouter();
  const buffer = useRef("");
  const bufferTimer = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      // Ignore if typing in an input/textarea/select
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag) && e.key !== "Escape") return;

      // Escape: blur focused element, close modal
      if (e.key === "Escape") {
        document.activeElement?.blur();
        // Close any open modal overlay
        document.getElementById("kb-help-modal")?.classList.remove("visible");
        return;
      }

      // / key: focus the search input if one exists
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const search = document.querySelector("input[type='search'], input[placeholder*='earch'], input[placeholder*='ilter']");
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      // ? key: toggle help modal
      if (e.key === "?" && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById("kb-help-modal")?.classList.toggle("visible");
        return;
      }

      // Two-key sequences: g + letter
      buffer.current += e.key.toLowerCase();
      clearTimeout(bufferTimer.current);
      bufferTimer.current = setTimeout(() => { buffer.current = ""; }, 1000);

      const routes = {
        "gd": "/dashboard",
        "gp": "/projects",
        "gt": "/tasks",
        "gm": "/my-tasks",
        "ga": "/activity",
        "gl": "/alerts",
        "ge": "/digest",
        "gb": "/board",
      };

      const match = routes[buffer.current];
      if (match) {
        buffer.current = "";
        clearTimeout(bufferTimer.current);
        router.push(match);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}

// Render this component anywhere inside the dashboard layout to activate shortcuts + show the help modal
export function KeyboardShortcutsModal() {
  useKeyboardNav();

  const shortcuts = [
    ["/", "Focus search"],
    ["? ", "Toggle this help"],
    ["Esc", "Blur / close"],
    ["g d", "Dashboard"],
    ["g p", "Projects"],
    ["g t", "All Tasks"],
    ["g m", "My Tasks"],
    ["g a", "Activity"],
    ["g l", "Alerts"],
    ["g e", "Email Digest"],
    ["g b", "Board"],
  ];

  return (
    <>
      <style>{`
        #kb-help-modal {
          display: none;
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.5);
          align-items: center; justify-content: center;
        }
        #kb-help-modal.visible { display: flex; }
        #kb-help-inner {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 24px; min-width: 320px;
        }
      `}</style>
      <div id="kb-help-modal" onClick={(e) => { if (e.target.id === "kb-help-modal") e.target.classList.remove("visible"); }}>
        <div id="kb-help-inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <strong>Keyboard Shortcuts</strong>
            <button className="secondary" style={{ padding: "2px 8px" }} onClick={() => document.getElementById("kb-help-modal")?.classList.remove("visible")}>✕</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {shortcuts.map(([key, label]) => (
                <tr key={key}>
                  <td style={{ padding: "4px 0", width: 80 }}>
                    <kbd style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", fontSize: 12, fontFamily: "monospace" }}>
                      {key}
                    </kbd>
                  </td>
                  <td style={{ padding: "4px 0", fontSize: 13, color: "var(--text-dim)" }}>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
