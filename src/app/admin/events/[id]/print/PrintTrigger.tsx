"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    window.print();
  }, []);
  return (
    <button
      className="no-print"
      style={{
        display: "block",
        margin: "16px auto",
        padding: "8px 24px",
        background: "#6366f1",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
      }}
      onClick={() => window.print()}
    >
      🖨️ Imprimer
    </button>
  );
}
