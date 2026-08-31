"use client";
import { useEffect, useState } from "react";

// Highlight @mentions in comment text — wraps @word in a styled span
function highlightMentions(text, users = []) {
  if (!text) return text;
  const nameSet = new Set(users.map((u) => u.name.split(" ")[0].toLowerCase()));
  return text.split(/(@\w+)/g).map((part, i) => {
    if (part.startsWith("@")) {
      const handle = part.slice(1).toLowerCase();
      const isMatch = nameSet.size === 0 || nameSet.has(handle);
      return (
        <span
          key={i}
          style={{
            color: "var(--accent)",
            fontWeight: 600,
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            borderRadius: 4,
            padding: "0 3px",
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// Autocomplete dropdown when user types @
function MentionInput({ value, onChange, users, placeholder }) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");

  function handleChange(e) {
    onChange(e);
    const v = e.target.value;
    const atIdx = v.lastIndexOf("@");
    if (atIdx !== -1 && atIdx === v.length - 1) {
      // Just typed @
      setQuery("");
      setShow(true);
    } else if (atIdx !== -1 && v.slice(atIdx).match(/^@\w+$/)) {
      setQuery(v.slice(atIdx + 1).toLowerCase());
      setShow(true);
    } else {
      setShow(false);
    }
  }

  function insertMention(name) {
    const firstName = name.split(" ")[0];
    const atIdx = value.lastIndexOf("@");
    const newValue = value.slice(0, atIdx) + `@${firstName} `;
    onChange({ target: { value: newValue } });
    setShow(false);
  }

  const filtered = users.filter((u) => u.name.toLowerCase().includes(query));

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{ width: "100%" }}
        onBlur={() => setTimeout(() => setShow(false), 150)}
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: "absolute", bottom: "110%", left: 0, right: 0,
          background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", zIndex: 100, maxHeight: 160, overflowY: "auto",
        }}>
          {filtered.map((u) => (
            <div
              key={u.id}
              onMouseDown={() => insertMention(u.name)}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
              className="hover-row"
            >
              @{u.name.split(" ")[0]} <span style={{ color: "var(--text-dim)" }}>{u.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { highlightMentions, MentionInput };
