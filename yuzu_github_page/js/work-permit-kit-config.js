/**
 * Work permit kit config (public keys only).
 */
window.WORK_PERMIT_KIT_CONFIG = {
  supabase: {
    url: "https://mwgbeolcgigvpufjmodz.supabase.co",
    anonKey: "sb_publishable_PtrGVwhCJX4MJ5_Ic8TyGQ_m6qU41nl",
    kitFunction: "work-permit-kit"
  },
  turnstile: {
    siteKey: "0x4AAAAAADkvLG6-bWbBy8DY"
  },
  forms: {
    imm1295: {
      title: "IMM 1295 — Work permit application (outside Canada)",
      required: true,
      why: "Primary application when applying from outside Canada."
    },
    imm5710: {
      title: "IMM 5710 — Application to change conditions / extend stay",
      required: true,
      why: "Primary application when applying from inside Canada."
    },
    imm5707: {
      title: "IMM 5707 — Family information",
      required: true,
      why: "Required family information for temporary residence applications."
    },
    imm5488: {
      title: "IMM 5488 — Document checklist (outside Canada)",
      required: true,
      why: "Checklist of forms and supporting documents for outside-Canada work permits."
    },
    imm5556: {
      title: "IMM 5556 — Document checklist (inside Canada)",
      required: true,
      why: "Checklist of forms and supporting documents for inside-Canada work permits."
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
    }
  }
};
