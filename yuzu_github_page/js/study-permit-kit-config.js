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
    imm1294: {
      title: "IMM 1294 — Study permit application",
      required: true,
      why: "Required for every study permit application from outside Canada."
    },
    imm5646: {
      title: "IMM 5646 — Family information",
      required: true,
      why: "Standard family information form in the outside-Canada study permit kit."
    },
    imm5483: {
      title: "IMM 5483 — Document checklist",
      required: true,
      why: "Checklist of forms and supporting documents for this kit."
    },
    imm5476: {
      title: "IMM 5476 — Use of a representative",
      required: false,
      why: "Included because someone else will prepare or submit the application for you."
    },
    imm5475: {
      title: "IMM 5475 — Authority to release information",
      required: false,
      why: "Included so a friend or family member can inquire with IRCC about your file."
    },
    imm5409: {
      title: "IMM 5409 — Common-law union declaration",
      required: false,
      why: "Included because you are in a common-law relationship."
    },
    imm5707: {
      title: "IMM 5707 — Family information (alternate)",
      required: false,
      why: "Included because you need to declare additional family members living in Canada."
    }
  }
};
