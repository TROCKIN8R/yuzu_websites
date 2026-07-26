/**
 * Study permit kit demo config (public keys only).
 */
window.STUDY_PERMIT_KIT_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    kitFunction: "study-permit-kit"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  },
  forms: {
    imm1294: { title: "IMM 1294 — Study permit application", required: true },
    imm5646: { title: "IMM 5646 — Family information", required: true },
    imm5483: { title: "IMM 5483 — Document checklist", required: true },
    imm5476: { title: "IMM 5476 — Use of a representative", required: false },
    imm5475: { title: "IMM 5475 — Authority to release information", required: false },
    imm5409: { title: "IMM 5409 — Common-law union declaration", required: false },
    imm5707: { title: "IMM 5707 — Family information (alternate)", required: false }
  }
};
