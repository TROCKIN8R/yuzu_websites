const WORK_PERMIT_TYPES = new Set(["ELMO", "LMOS", "OWP", "Other", "SAWP", "SBC", "OPEN", "EMPLOYER", "LMIA"]);

function cleanText(value: unknown, max = 120): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function digits(value: unknown, len: number): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, len);
}

export function validateWorkAnswers(
  raw: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  const location = cleanText(raw.applicationLocation, 20).toLowerCase();
  if (location !== "outside" && location !== "inside") {
    return { ok: false, error: "Select whether you are applying from outside or inside Canada." };
  }

  const permitType = cleanText(raw.workPermitType, 20).toUpperCase();
  if (!permitType) {
    return { ok: false, error: "Select a work permit type." };
  }

  const employer = cleanText(raw.employerName);
  if (!employer) return { ok: false, error: "Enter your employer name." };

  const jobTitle = cleanText(raw.jobTitle);
  if (!jobTitle) return { ok: false, error: "Enter your job title." };

  const jobDesc = cleanText(raw.jobDescription, 500);
  if (!jobDesc) return { ok: false, error: "Enter a brief job description." };

  const workCity = cleanText(raw.workCity);
  if (!workCity) return { ok: false, error: "Enter the city where you will work." };

  const workProvince = cleanText(raw.workProvince, 40);
  if (!workProvince) return { ok: false, error: "Enter the province where you will work." };

  for (const [label, y, m, d] of [
    ["work start", raw.workFromYear, raw.workFromMonth, raw.workFromDay],
    ["work end", raw.workToYear, raw.workToMonth, raw.workToDay],
  ] as const) {
    const year = digits(y, 4);
    const month = digits(m, 2);
    const day = digits(d, 2);
    if (year.length !== 4 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      return { ok: false, error: `Enter a valid ${label} date.` };
    }
  }

  if (location === "inside") {
    const anyFlag = raw.applyingRestore || raw.applyingExtend || raw.applyingNewEmployer || raw.applyingTrp;
    if (!anyFlag) {
      return { ok: false, error: "Select at least one reason you are applying (extend, new employer, restore status, or TRP)." };
    }
  }

  return { ok: true };
}
