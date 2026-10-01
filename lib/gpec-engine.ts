export type SpreadsheetCell = string | number | boolean | Date | null | undefined;
export type SpreadsheetRow = SpreadsheetCell[];

export type Gender = "Femme" | "Homme";
export type CorpsGroup = "PR" | "MCF" | "Autre";
export type EmploymentStatus = "TIT" | "CDD" | "CDI";
export type MissionGroup = "Recherche" | "Enseignement" | "Autres";
export type HdrStatus = "OUI" | "NON";
export type FundingType = "ETAT" | "RESSOURCES PROPRES" | "AUTRES";

export interface AgentRecord {
  id: string;
  establishment: string;
  gender: Gender;
  birthYear: number;
  age: number;
  ageBand: string;
  corpsSource: string;
  corpsDetail: string;
  corpsGroup: CorpsGroup;
  status: EmploymentStatus;
  missionSource: string;
  jobGroup: "Chercheur" | "Enseignant";
  missionGroup: MissionGroup;
  departureYear: number;
  hdr: HdrStatus;
  funding: FundingType;
}

export interface ImportIssue {
  row: number;
  field: string;
  message: string;
  level: "warning" | "rejected";
}

export interface GpecDataset {
  sourceFile: string;
  referenceYear: number;
  legalRetirementAge: number;
  ageLimit: number;
  sourceRows: number;
  acceptedRows: number;
  rejectedRows: number;
  agents: AgentRecord[];
  issues: ImportIssue[];
  completeness: Record<string, number>;
}

export interface ProcessingOptions {
  sourceFile?: string;
  referenceYear?: number;
  legalRetirementAge?: number;
  ageLimit?: number;
}

const text = (value: SpreadsheetCell) => String(value ?? "").replace(/\u00a0/g, " ").trim();
const folded = (value: SpreadsheetCell) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export function extractYear(value: SpreadsheetCell): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getFullYear();
  if (typeof value === "number") return value > 1900 && value < 2100 ? Math.trunc(value) : 0;
  const raw = text(value);
  if (!raw) return 0;
  if (/^\d{4}$/.test(raw)) {
    const year = Number(raw);
    return year > 1900 && year < 2100 ? year : 0;
  }
  const match = raw.match(/(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/);
  if (match) return Number(match[1]);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getFullYear();
}

export function mapHdr(value: SpreadsheetCell): HdrStatus {
  const normalized = folded(value);
  return ["OUI", "VRAI", "O", "1", "TRUE"].includes(normalized) ? "OUI" : "NON";
}

export function mapStatus(value: SpreadsheetCell): EmploymentStatus {
  const normalized = folded(value);
  if (normalized.includes("TITULAIRE")) return "TIT";
  if (normalized.includes("CDD")) return "CDD";
  return "CDI";
}

export function mapMission(value: SpreadsheetCell): MissionGroup {
  const normalized = folded(value);
  if (normalized.includes("RECHERCHE") || normalized.includes("CHERCHEUR")) return "Recherche";
  if (normalized.includes("ENSEIGNEMENT")) return "Enseignement";
  return "Autres";
}

export function mapJob(value: SpreadsheetCell): "Chercheur" | "Enseignant" {
  return folded(value).includes("CHERCHEUR") ? "Chercheur" : "Enseignant";
}

export function mapFunding(value: SpreadsheetCell): FundingType {
  const normalized = folded(value);
  if (normalized === "ETAT") return "ETAT";
  if (normalized === "RESSOURCES PROPRES" || normalized === "RP") return "RESSOURCES PROPRES";
  return "AUTRES";
}

export function mapGender(value: SpreadsheetCell): Gender {
  const normalized = folded(value);
  if (["FEMININ", "MME", "FEMME"].includes(normalized)) return "Femme";
  return "Homme";
}

export function mapCorpsDetail(value: SpreadsheetCell): string {
  const original = text(value);
  const normalized = folded(value);
  if (!normalized || normalized === "NON RENSEIGNE") return "Non renseigné";
  if (normalized.includes("COLLEGE A")) return "Professeur";
  if (normalized.includes("COLLEGE B")) return "Maître de Conférences";

  const mcfPriorityTerms = [
    "CHARGE DE RECHERCHE",
    "CHERCHEUR SUR CONTRAT RECHERCHE",
    "CONTRACTUEL CHERCHEUR LRU",
    "CONTRACTUEL ENSEIGNANT CHERCHEUR LRU",
    "CONTRACTUEL EPST CHERCHEUR",
    "CONTRACTUEL RECHERCHE CHARGE DE MISSION",
    "ENSEIGNANT-CHERCHEUR ASSIMILE",
    "ENSEIGNANT-CHERCHEUR CDI A",
  ];
  if (mcfPriorityTerms.some((term) => normalized.includes(term)) || /(^|\s)CR(\s|$)/.test(normalized)) {
    return "Maître de Conférences";
  }

  const professorPriorityTerms = [
    "ASSISTANT HOSPITALIER UNIVERSITAIRE",
    "ASTRONOME",
    "CHEF DE CLINIQUE",
    "CHERCHEUR INVITE",
    "ENSEIGNANT-CHERCHEUR PR CDD",
    "INGENIEUR",
    "IPEF",
    "PHYSICIEN",
    "CHERCHEUR",
  ];
  if (professorPriorityTerms.some((term) => normalized.includes(term))) return "Professeur";

  if (
    /(^|\s)(PR|PU|DR)(\s|$)/.test(normalized) ||
    normalized.includes("PHU") ||
    normalized.includes("PROFESSEUR") ||
    normalized.includes("PCEA") ||
    normalized.includes("DIRECTEUR DE RECHERCHE")
  ) return "Professeur";

  if (
    normalized.includes("MAITRE DE CONFERENCE") ||
    normalized.includes("MCF") ||
    /(^|\s)CR(\s|$)/.test(normalized) ||
    normalized.includes("RANG B") ||
    normalized.includes("MC CLASSE") ||
    normalized.includes("MC HORS") ||
    normalized.includes("MAITRE")
  ) return "Maître de Conférences";

  return original;
}

export function mapCorpsGroup(detail: string): CorpsGroup {
  const normalized = folded(detail);
  if (
    normalized === "PROFESSEUR" ||
    normalized === "PR" ||
    normalized.includes("PR CLASSE EXCEPTIONNELLE") ||
    normalized.includes("PR 1ERE CLASSE") ||
    normalized.includes("PR 2EME CLASSE")
  ) return "PR";
  if (normalized === "MAITRE DE CONFERENCES" || normalized === "MCF") return "MCF";
  return "Autre";
}

function ratio(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

export function processTrame(rows: SpreadsheetRow[], options: ProcessingOptions = {}): GpecDataset {
  const referenceYear = options.referenceYear ?? new Date().getFullYear();
  const legalRetirementAge = options.legalRetirementAge ?? 65;
  const ageLimit = options.ageLimit ?? 70;
  const dataRows = rows.slice(1).filter((row) => row.slice(0, 20).some((value) => text(value) !== ""));
  const agents: AgentRecord[] = [];
  const issues: ImportIssue[] = [];
  const present = { establishment: 0, agentId: 0, birthYear: 0, job: 0, corps: 0, hdr: 0, funding: 0 };

  dataRows.forEach((row, index) => {
    const sourceRow = index + 2;
    const establishment = text(row[0]);
    const agentId = text(row[3]);
    const birthYear = extractYear(row[5]);
    const jobSource = text(row[6]);
    const corpsSiham = text(row[8]);
    const corpsOutside = text(row[9]);
    const corpsSource = corpsSiham || corpsOutside || "Non renseigné";

    if (establishment) present.establishment += 1;
    if (agentId) present.agentId += 1;
    if (birthYear) present.birthYear += 1;
    if (jobSource) present.job += 1;
    if (corpsSiham || corpsOutside) present.corps += 1;
    if (text(row[18])) present.hdr += 1;
    if (text(row[19])) present.funding += 1;

    if (!birthYear) {
      issues.push({ row: sourceRow, field: "ANNEE_NAISS", message: "Année de naissance absente ou invalide", level: "rejected" });
      return;
    }
    const age = referenceYear - birthYear;
    if (age > ageLimit) {
      issues.push({ row: sourceRow, field: "AGE", message: "Âge supérieur à la limite de " + ageLimit + " ans", level: "rejected" });
      return;
    }
    const genderSource = folded(row[4]);
    if (genderSource && !["FEMININ", "MME", "FEMME", "HOMME", "MASCULIN", "MR", "MR.", "M", "M.", "MONSIEUR"].includes(genderSource)) {
      issues.push({ row: sourceRow, field: "GENRE", message: "Valeur non reconnue, classée Homme selon la règle VBA", level: "warning" });
    }
    const corpsDetail = mapCorpsDetail(corpsSource);
    const missionSource = text(row[10]);
    agents.push({
      id: agentId,
      establishment,
      gender: mapGender(row[4]),
      birthYear,
      age,
      ageBand: Math.floor(age / 5) * 5 + "-" + (Math.floor(age / 5) * 5 + 4),
      corpsSource,
      corpsDetail,
      corpsGroup: mapCorpsGroup(corpsDetail),
      status: mapStatus(row[7]),
      missionSource,
      jobGroup: mapJob(row[6]),
      missionGroup: mapMission(row[10]),
      departureYear: birthYear + legalRetirementAge,
      hdr: mapHdr(row[18]),
      funding: mapFunding(row[19]),
    });
  });

  const total = dataRows.length;
  const rejectedRows = issues.filter((issue) => issue.level === "rejected").length;
  return {
    sourceFile: options.sourceFile ?? "Classeur importé",
    referenceYear,
    legalRetirementAge,
    ageLimit,
    sourceRows: total,
    acceptedRows: agents.length,
    rejectedRows,
    agents,
    issues,
    completeness: {
      establishment: ratio(present.establishment, total),
      agentId: ratio(present.agentId, total),
      birthYear: ratio(present.birthYear, total),
      job: ratio(present.job, total),
      corps: ratio(present.corps, total),
      hdr: ratio(present.hdr, total),
      funding: ratio(present.funding, total),
    },
  };
}

export function groupCount<T>(rows: T[], getter: (row: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = getter(row) || "Non renseigné";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
