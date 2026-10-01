"use client";
/* eslint-disable react/no-unescaped-entities */

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { groupCount, processTrame } from "../lib/gpec-engine";
import type { GpecDataset, SpreadsheetRow } from "../lib/gpec-engine";

type View = "overview" | "demography" | "prospective" | "skills" | "quality" | "connections";
type AnnualPlanRow = { year: number; retirements: number; other: number; internal: number; external: number; projected: number; action: string };

const NAV: Array<{ id: View; label: string; number: string }> = [
  { id: "overview", label: "Vue d'ensemble", number: "01" },
  { id: "demography", label: "Démographie", number: "02" },
  { id: "prospective", label: "Prospective", number: "03" },
  { id: "skills", label: "Emplois et compétences", number: "04" },
  { id: "quality", label: "Qualité des données", number: "05" },
  { id: "connections", label: "Connexions SQL", number: "06" },
];

const ESTABLISHMENTS: Array<[string, number]> = [
  ["Périmètre employeur", 1859],
  ["CEA", 1638],
  ["CNRS", 1150],
  ["UVSQ", 804],
  ["ONERA", 790],
  ["INRAE", 542],
  ["CentraleSupélec", 440],
  ["Université d'Évry", 431],
  ["AgroParisTech", 262],
  ["ENS Paris-Saclay", 191],
  ["Inria", 65],
];

const DEPARTURES = [176, 165, 150, 179, 215, 227, 202, 189, 207, 210, 224, 239, 207, 210, 189];
const AGE_BANDS: Array<[string, number, number]> = [
  ["65 ans et +", 509, 34],
  ["60-64", 624, 312],
  ["55-59", 688, 344],
  ["50-54", 711, 355],
  ["45-49", 745, 373],
  ["40-44", 611, 305],
  ["35-39", 623, 311],
  ["30-34", 730, 365],
  ["Moins de 30", 355, 177],
];

const META: Record<View, [string, string, string]> = {
  overview: ["Synthèse du périmètre", "Pilotage prospectif des emplois et compétences", "Une lecture commune des effectifs, des départs et des capacités à renouveler."],
  demography: ["Socle RH", "Structure démographique", "Âges, statuts, corps et vivier HDR à l'échelle du site."],
  prospective: ["Scénarios 2026-2040", "Trajectoires de départ et de remplacement", "Ajustez les hypothèses et mesurez immédiatement leur effet sur les effectifs."],
  skills: ["GPEC", "Emplois, compétences et métiers sensibles", "Reliez les départs prévus aux compétences à sécuriser et aux actions RH."],
  quality: ["Fiabilité", "Qualité et traçabilité des données", "Contrôles d'entrée, règles de normalisation et réconciliation des sources."],
  connections: ["Architecture cible", "Connexions aux systèmes des établissements", "Un modèle commun pour intégrer progressivement des sources SQL hétérogènes."],
};

const HORIZON_RATE: Record<number, number> = { 2028: 0.105, 2030: 0.153, 2035: 0.28, 2040: 0.411 };
const fmt = new Intl.NumberFormat("fr-FR");
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return <article className={"kpi " + (tone || "")}><i /><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function Progress({ label, value, tone, detail }: { label: string; value: number; tone?: string; detail?: string }) {
  return <div className="progress"><div><span>{label}</span><b>{detail || value + " %"}</b></div><i><em className={tone || ""} style={{ width: Math.min(value, 100) + "%" }} /></i></div>;
}

function Timeline({ values, horizon, startYear }: { values: number[]; horizon: number; startYear: number }) {
  const max = Math.max(...values, 1);
  return <div className="timeline" aria-label="Départs prévisionnels par année">
    {values.map((value, index) => {
      const year = startYear + index;
      return <div className={year <= horizon ? "year active" : "year"} key={year}>
        <b>{value}</b><i style={{ height: Math.max(4, value / max * 100) + "%" }} /><span>{String(year).slice(2)}</span>
      </div>;
    })}
  </div>;
}

function Pyramid({ bands }: { bands: Array<[string, number, number]> }) {
  const max = Math.max(...bands.flatMap((row) => [row[1], row[2]]), 1);
  return <div className="pyramid">
    <div className="pyramid-head"><span>Hommes</span><span>Âge</span><span>Femmes</span></div>
    {bands.map(([label, men, women]) => <div className="pyramid-row" key={label}>
      <div className="pyramid-bar left"><i style={{ width: men / max * 100 + "%" }} /><small>{fmt.format(men)}</small></div>
      <b>{label}</b>
      <div className="pyramid-bar right"><i style={{ width: women / max * 100 + "%" }} /><small>{fmt.format(women)}</small></div>
    </div>)}
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [etab, setEtab] = useState("Tous les établissements");
  const [corps, setCorps] = useState("Tous les corps");
  const [mission, setMission] = useState("Toutes les missions");
  const [horizon, setHorizon] = useState(2030);
  const [retirementAge, setRetirementAge] = useState(65);
  const [replacement, setReplacement] = useState(85);
  const [attrition, setAttrition] = useState(1.8);
  const [mobility, setMobility] = useState(18);
  const [recruitmentLead, setRecruitmentLead] = useState(14);
  const [strategy, setStrategy] = useState("Équilibre");
  const [dataset, setDataset] = useState<GpecDataset | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const establishmentOptions = useMemo(() => dataset
    ? groupCount(dataset.agents, (agent) => agent.establishment).map(([name]) => name)
    : ESTABLISHMENTS.map(([name]) => name), [dataset]);

  const filteredAgents = useMemo(() => dataset?.agents.filter((agent) =>
    (etab === "Tous les établissements" || agent.establishment === etab) &&
    (corps === "Tous les corps" || agent.corpsGroup === corps) &&
    (mission === "Toutes les missions" || agent.missionGroup === mission)
  ) ?? [], [dataset, etab, corps, mission]);

  const metrics = useMemo(() => {
    if (dataset) {
      const total = filteredAgents.length;
      const meanAge = total ? filteredAgents.reduce((sum, agent) => sum + agent.age, 0) / total : 0;
      const departures = filteredAgents.filter((agent) => {
        const year = agent.birthYear + retirementAge;
        return year >= dataset.referenceYear && year <= horizon;
      }).length;
      return {
        total,
        meanAge,
        departures,
        women: filteredAgents.filter((agent) => agent.gender === "Femme").length,
        hdr: filteredAgents.filter((agent) => agent.hdr === "OUI").length,
        state: filteredAgents.filter((agent) => agent.funding === "ETAT").length,
        titular: filteredAgents.filter((agent) => agent.status === "TIT").length,
        cdi: filteredAgents.filter((agent) => agent.status === "CDI").length,
        cdd: filteredAgents.filter((agent) => agent.status === "CDD").length,
        pr: filteredAgents.filter((agent) => agent.corpsGroup === "PR").length,
        mcf: filteredAgents.filter((agent) => agent.corpsGroup === "MCF").length,
        other: filteredAgents.filter((agent) => agent.corpsGroup === "Autre").length,
      };
    }
    const etabTotal = etab === "Tous les établissements" ? 8172 : (ESTABLISHMENTS.find((row) => row[0] === etab)?.[1] || 0);
    const corpsRatio = corps === "PR" ? 3657 / 8172 : corps === "MCF" ? 3617 / 8172 : corps === "Autre" ? 898 / 8172 : 1;
    const missionRatio = mission === "Recherche" ? 6411 / 8172 : mission === "Autres" ? 1761 / 8172 : 1;
    const total = Math.round(etabTotal * corpsRatio * missionRatio);
    const ageDelta = corps === "PR" ? 3.6 : corps === "MCF" ? -1.8 : 0;
    const meanAge = 46.9 + ageDelta;
    const rate = Math.max(0, Math.min(0.72, HORIZON_RATE[horizon] + (65 - retirementAge) * 0.022));
    const departures = Math.round(total * rate);
    const womenRate = corps === "PR" ? 0.27 : corps === "MCF" ? 0.39 : 0.333;
    const women = Math.round(total * womenRate);
    const hdrRate = corps === "PR" ? 0.32 : corps === "MCF" ? 0.07 : 0.178;
    return {
      total, meanAge, departures, women, hdr: Math.round(total * hdrRate), state: Math.round(total * 3476 / 8172),
      titular: Math.round(total * 3914 / 8172), cdi: Math.round(total * 2811 / 8172), cdd: Math.round(total * 1447 / 8172),
      pr: Math.round(total * 3657 / 8172), mcf: Math.round(total * 3617 / 8172), other: Math.round(total * 898 / 8172),
    };
  }, [dataset, filteredAgents, etab, corps, mission, horizon, retirementAge]);

  const activeScope = [etab, corps, mission].filter((value) => !value.startsWith("Tous") && !value.startsWith("Toutes")).join(" · ") || "Périmètre complet";

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const reset = () => {
    setEtab("Tous les établissements");
    setCorps("Tous les corps");
    setMission("Toutes les missions");
  };

  const download = (name: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSummary = () => {
    download("synthese-gpec.csv", [
      "Indicateur;Valeur",
      "Périmètre;" + activeScope,
      "Scénario;" + strategy,
      "Horizon;" + horizon,
      "Effectif initial;" + metrics.total,
      "Âge moyen;" + metrics.meanAge.toFixed(1),
      "Départs retraite;" + metrics.departures,
      "Autres sorties;" + otherExits,
      "Mobilités internes;" + internalMoves,
      "Recrutements externes;" + externalRecruitments,
      "Effectif projeté;" + projected,
      "Population HDR;" + metrics.hdr,
    ].join("\n"));
    notify("Synthèse exportée au format CSV");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      notify("Choisissez le classeur Excel .xlsm ou .xlsx contenant la feuille Trame.");
      input.value = "";
      return;
    }
    setImporting(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const rows = await readSheet(file, "Trame");
      const imported = processTrame(rows as SpreadsheetRow[], {
        sourceFile: file.name,
        referenceYear: new Date().getFullYear(),
        legalRetirementAge: retirementAge,
        ageLimit: 70,
      });
      setDataset(imported);
      reset();
      setView("overview");
      notify(fmt.format(imported.acceptedRows) + " agents intégrés localement. " + fmt.format(imported.rejectedRows) + " lignes écartées.");
    } catch {
      notify("Import impossible. Vérifiez la présence et la structure de la feuille Trame.");
    } finally {
      setImporting(false);
      input.value = "";
    }
  };

  const copySql = async () => {
    const sql = [
      "CREATE TABLE agents_snapshot (",
      "  snapshot_date DATE NOT NULL,",
      "  etablissement_id TEXT NOT NULL,",
      "  agent_hash TEXT NOT NULL,",
      "  birth_year INTEGER,",
      "  gender_code TEXT,",
      "  job_family_code TEXT,",
      "  employment_status TEXT,",
      "  hdr_status BOOLEAN,",
      "  funding_type TEXT",
      ");",
    ].join("\n");
    await navigator.clipboard.writeText(sql);
    notify("Modèle SQL copié");
  };

  const meta = META[view];
  const scale = metrics.total / 8172;
  const baseYear = dataset?.referenceYear ?? 2026;
  const years = horizon - baseYear + 1;
  const departureValues = useMemo(() => {
    if (dataset) {
      return Array.from({ length: 2040 - baseYear + 1 }, (_, index) => {
        const year = baseYear + index;
        return filteredAgents.filter((agent) => agent.birthYear + retirementAge === year).length;
      });
    }
    const shift = 65 - retirementAge;
    return DEPARTURES.map((_, index) => {
      const source = Math.max(0, Math.min(DEPARTURES.length - 1, index - shift));
      return Math.round(DEPARTURES[source] * scale);
    });
  }, [dataset, filteredAgents, retirementAge, baseYear, scale]);

  const ageBands = useMemo<Array<[string, number, number]>>(() => {
    if (!dataset) return AGE_BANDS.map(([label, men, women]) => [label, Math.round(men * scale), Math.round(women * scale)]);
    const definitions: Array<[string, (age: number) => boolean]> = [
      ["65 ans et +", (age) => age >= 65],
      ["60-64", (age) => age >= 60 && age < 65],
      ["55-59", (age) => age >= 55 && age < 60],
      ["50-54", (age) => age >= 50 && age < 55],
      ["45-49", (age) => age >= 45 && age < 50],
      ["40-44", (age) => age >= 40 && age < 45],
      ["35-39", (age) => age >= 35 && age < 40],
      ["30-34", (age) => age >= 30 && age < 35],
      ["Moins de 30", (age) => age < 30],
    ];
    return definitions.map(([label, matches]) => [
      label,
      filteredAgents.filter((agent) => agent.gender === "Homme" && matches(agent.age)).length,
      filteredAgents.filter((agent) => agent.gender === "Femme" && matches(agent.age)).length,
    ]);
  }, [dataset, filteredAgents, scale]);

  const establishmentRanking = useMemo(() => {
    if (!dataset) return ESTABLISHMENTS;
    const comparable = dataset.agents.filter((agent) =>
      (corps === "Tous les corps" || agent.corpsGroup === corps) &&
      (mission === "Toutes les missions" || agent.missionGroup === mission)
    );
    return groupCount(comparable, (agent) => agent.establishment);
  }, [dataset, corps, mission]);

  const otherExits = Math.round(metrics.total * (attrition / 100) * years);
  const totalExits = metrics.departures + otherExits;
  const internalMoves = Math.round(totalExits * (mobility / 100));
  const externalRecruitments = Math.round(Math.max(0, totalExits - internalMoves) * (replacement / 100));
  const residualGap = Math.max(0, totalExits - internalMoves - externalRecruitments);
  const coverage = totalExits ? Math.round(((internalMoves + externalRecruitments) / totalExits) * 100) : 100;
  const qualityScore = dataset ? percent(dataset.acceptedRows, dataset.sourceRows) : 78;
  const maxEstablishment = establishmentRanking[0]?.[1] || 1;
  const importWarnings = dataset?.issues.filter((issue) => issue.level === "warning").length ?? 0;

  const annualPlan = Array.from({ length: years }, (_, index) => index).reduce<AnnualPlanRow[]>((plan, index) => {
    const year = baseYear + index;
    const retirements = departureValues[index] ?? 0;
    const other = Math.round(metrics.total * (attrition / 100));
    const internal = Math.round((retirements + other) * (mobility / 100));
    const external = Math.round(Math.max(0, retirements + other - internal) * (replacement / 100));
    const openingWorkforce = plan[index - 1]?.projected ?? metrics.total;
    const projectedWorkforce = Math.max(0, openingWorkforce - retirements - other + internal + external);
    const action = year === baseYear
      ? "Fiabiliser les données"
      : year <= baseYear + 2
        ? "Sécuriser les compétences critiques"
        : retirements > 80 * scale
          ? "Accélérer transmission et recrutement"
          : "Ajuster le plan de renouvellement";
    return [...plan, { year, retirements, other, internal, external, projected: projectedWorkforce, action }];
  }, []);
  const projected = annualPlan[annualPlan.length - 1]?.projected ?? metrics.total;

  const applyStrategy = (name: string) => {
    setStrategy(name);
    if (name === "Compétences critiques") {
      setReplacement(100);
      setMobility(25);
      setRecruitmentLead(10);
    } else if (name === "Maîtrise de la masse salariale") {
      setReplacement(65);
      setMobility(15);
      setRecruitmentLead(16);
    } else {
      setReplacement(85);
      setMobility(18);
      setRecruitmentLead(14);
    }
  };

  return <div className="app-shell">
    <aside className={"sidebar " + (menuOpen ? "open" : "")}>
      <div className="brand">
        <img src="./logo-upsaclay.png" alt="Université Paris-Saclay" />
        <div><span>Portail</span><strong>ProspectivRH</strong></div>
      </div>
      <nav aria-label="Navigation principale">
        <p>Pilotage</p>
        {NAV.slice(0, 4).map((item) => <button className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMenuOpen(false); }} key={item.id}><span>{item.number}</span>{item.label}</button>)}
        <p className="nav-second">Données</p>
        {NAV.slice(4).map((item) => <button className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMenuOpen(false); }} key={item.id}><span>{item.number}</span>{item.label}</button>)}
      </nav>
      <div className="sidebar-note"><i /><div><strong>{dataset ? "Classeur local chargé" : "Données de démonstration"}</strong><span>{dataset ? dataset.sourceFile + " · " + fmt.format(dataset.acceptedRows) + " agents" : "Référentiel 2026 · v0.1"}</span></div></div>
    </aside>

    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
        <div><span>Conférence RH</span><b>Université Paris-Saclay</b></div>
        <aside><button onClick={() => setView("quality")}>{dataset ? "Import local actif" : "Actualisé aujourd'hui"}</button><i>DRH</i></aside>
      </header>

      <section className="filters" aria-label="Filtres communs">
        <label>Établissement<select value={etab} onChange={(event) => setEtab(event.target.value)}><option>Tous les établissements</option>{establishmentOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Corps<select value={corps} onChange={(event) => setCorps(event.target.value)}><option>Tous les corps</option><option>PR</option><option>MCF</option><option>Autre</option></select></label>
        <label>Mission<select value={mission} onChange={(event) => setMission(event.target.value)}><option>Toutes les missions</option><option>Recherche</option><option>Autres</option></select></label>
        <label>Horizon<select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value="2028">2028</option><option value="2030">2030</option><option value="2035">2035</option><option value="2040">2040</option></select></label>
        <button onClick={reset}>Réinitialiser</button>
      </section>

      <div className="page">
        <section className="page-title">
          <div><p>{meta[0]}</p><h1>{meta[1]}</h1><span>{meta[2]}</span></div>
          <div><button className="button secondary" onClick={exportSummary}>Exporter</button><button className="button primary" onClick={() => setView("prospective")}>Nouveau scénario</button></div>
        </section>

        {view === "overview" && <>
          <section className="kpis">
            <Kpi label="Effectif analysé" value={fmt.format(metrics.total)} detail={etab === "Tous les établissements" ? establishmentOptions.length + " établissements" : "Périmètre filtré"} />
            <Kpi label="Âge moyen" value={metrics.meanAge.toFixed(1).replace(".", ",") + " ans"} detail="Médiane du site : 47 ans" tone="blue" />
            <Kpi label={"Départs d'ici " + horizon} value={fmt.format(metrics.departures)} detail={percent(metrics.departures, metrics.total) + " % de l'effectif"} tone="orange" />
            <Kpi label="Vivier HDR" value={fmt.format(metrics.hdr)} detail={percent(metrics.hdr, metrics.total) + " % des effectifs"} tone="teal" />
          </section>

          <section className="insight">
            <div><span>Point d'attention</span><strong>{percent(metrics.departures, metrics.total)}%</strong></div>
            <article><h2>Le renouvellement doit se préparer par métier, pas seulement en volume</h2><p>Les départs cumulés touchent différemment l'encadrement doctoral, les expertises scientifiques rares et les fonctions d'appui. Le scénario central couvre {replacement}% des sorties.</p></article>
            <button onClick={() => setView("skills")}>Voir les métiers sensibles</button>
          </section>

          <section className="two-columns">
            <article className="panel wide">
              <header><div><p>Trajectoire</p><h2>Départs à la retraite par année</h2></div><small>Âge cible : {retirementAge} ans</small></header>
              <Timeline values={departureValues} horizon={horizon} startYear={baseYear} />
              <footer><span>{baseYear}</span><p>Projection sans correction de mobilité, promotion ou recrutement.</p><span>2040</span></footer>
            </article>
            <article className="panel">
              <header><div><p>Équilibre</p><h2>Repères du collectif</h2></div></header>
              <div className="donuts">
                <div><i style={{ background: "conic-gradient(#c60b46 " + percent(metrics.women, metrics.total) * 3.6 + "deg, #e7eaec 0)" }}><b>{percent(metrics.women, metrics.total)}%</b></i><span>Femmes</span></div>
                <div><i style={{ background: "conic-gradient(#00afaa " + percent(metrics.state, metrics.total) * 3.6 + "deg, #e7eaec 0)" }}><b>{percent(metrics.state, metrics.total)}%</b></i><span>Financement État</span></div>
              </div>
              <Progress label="Professeurs et assimilés" value={percent(metrics.pr, metrics.total)} />
              <Progress label="MCF et assimilés" value={percent(metrics.mcf, metrics.total)} tone="blue" />
              <Progress label="Autres corps" value={percent(metrics.other, metrics.total)} tone="orange" />
            </article>
          </section>

          <section className="two-columns equal">
            <article className="panel">
              <header><div><p>Lecture par établissement</p><h2>Effectifs du périmètre</h2></div><button onClick={() => setView("demography")}>Analyse détaillée</button></header>
              <div className="ranking">{establishmentRanking.slice(0, 6).map((row) => <div key={row[0]}><span>{row[0]}</span><i><b style={{ width: row[1] / maxEstablishment * 100 + "%" }} /></i><strong>{fmt.format(row[1])}</strong></div>)}</div>
            </article>
            <article className="panel priorities">
              <header><div><p>Décisions à préparer</p><h2>Prochain dialogue RH</h2></div></header>
              <button onClick={() => setView("prospective")}><span>01</span><div><b>Scénario de remplacement 2030</b><small>Arbitrer le taux cible par métier</small></div><em>Ouvrir</em></button>
              <button onClick={() => setView("skills")}><span>02</span><div><b>Transmission des compétences rares</b><small>Identifier les binômes et les viviers</small></div><em>Ouvrir</em></button>
              <button onClick={() => setView("quality")}><span>03</span><div><b>Fiabilisation des référentiels</b><small>Aligner corps, disciplines et financements</small></div><em>Ouvrir</em></button>
            </article>
          </section>
        </>}

        {view === "demography" && <>
          <section className="kpis">
            <Kpi label="Effectif analysé" value={fmt.format(metrics.total)} detail="Après application des filtres" />
            <Kpi label="Part des femmes" value={percent(metrics.women, metrics.total) + " %"} detail={fmt.format(metrics.women) + " personnes"} tone="orange" />
            <Kpi label="Titulaires" value={percent(metrics.titular, metrics.total) + " %"} detail="Part du périmètre filtré" tone="blue" />
            <Kpi label="Population HDR" value={percent(metrics.hdr, metrics.total) + " %"} detail="Capacité d'encadrement" tone="teal" />
          </section>
          <section className="two-columns">
            <article className="panel wide"><header><div><p>Répartition miroir</p><h2>Pyramide des âges</h2></div><small>Hommes · Femmes</small></header><Pyramid bands={ageBands} /></article>
            <article className="panel"><header><div><p>Structure</p><h2>Statuts et corps</h2></div></header>
              <h3>Statuts</h3><Progress label="Titulaires" value={percent(metrics.titular, metrics.total)} /><Progress label="CDI" value={percent(metrics.cdi, metrics.total)} tone="teal" /><Progress label="CDD" value={percent(metrics.cdd, metrics.total)} tone="orange" />
              <h3>Corps simplifiés</h3><Progress label="PR" value={percent(metrics.pr, metrics.total)} /><Progress label="MCF" value={percent(metrics.mcf, metrics.total)} tone="blue" /><Progress label="Autre" value={percent(metrics.other, metrics.total)} tone="orange" />
            </article>
          </section>
          <section className="panel discipline"><header><div><p>Champs scientifiques</p><h2>Répartition indicative</h2></div><small>Référentiel MESR à fiabiliser</small></header>
            <div>{["Sciences", "Santé", "Lettres et sciences humaines", "Droit et science politique", "Sciences économiques", "Interdisciplinaire"].map((name, index) => <article key={name}><span>{"0" + (index + 1)}</span><b>{name}</b><strong>{fmt.format(Math.round(metrics.total * [0.32, 0.2, 0.17, 0.1, 0.09, 0.12][index]))}</strong></article>)}</div>
          </section>
        </>}

        {view === "prospective" && <>
          <section className="strategy-presets">
            {[
              ["Équilibre", "Maintenir les capacités avec un mix recrutement et mobilité"],
              ["Compétences critiques", "Sécuriser rapidement les expertises rares et les transmissions"],
              ["Maîtrise de la masse salariale", "Prioriser les remplacements et absorber une part des vacances"],
            ].map(([name, description]) => (
              <button key={name} className={strategy === name ? "active" : ""} onClick={() => applyStrategy(name)}>
                <span>{name}</span><small>{description}</small>
              </button>
            ))}
          </section>

          <section className="scenario">
            <aside>
              <p>Hypothèses du scénario</p><h2>{strategy}</h2>
              <label>Âge de départ <b>{retirementAge} ans</b><input type="range" min="62" max="70" value={retirementAge} onChange={(event) => setRetirementAge(Number(event.target.value))} /></label>
              <label>Autres sorties annuelles <b>{attrition.toFixed(1)} %</b><input type="range" min="0" max="5" step="0.1" value={attrition} onChange={(event) => setAttrition(Number(event.target.value))} /></label>
              <label>Couverture par mobilité <b>{mobility} %</b><input type="range" min="0" max="50" value={mobility} onChange={(event) => setMobility(Number(event.target.value))} /></label>
              <label>Remplacement externe <b>{replacement} %</b><input type="range" min="0" max="120" value={replacement} onChange={(event) => setReplacement(Number(event.target.value))} /></label>
              <label>Délai de recrutement <b>{recruitmentLead} mois</b><input type="range" min="4" max="24" value={recruitmentLead} onChange={(event) => setRecruitmentLead(Number(event.target.value))} /></label>
              <label>Horizon<select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value="2028">2028</option><option value="2030">2030</option><option value="2035">2035</option><option value="2040">2040</option></select></label>
              <div><span>Effectif projeté en {horizon}</span><strong>{fmt.format(projected)}</strong><small>{projected - metrics.total >= 0 ? "+" : ""}{fmt.format(projected - metrics.total)} postes</small></div>
              <button className="button primary" onClick={() => notify("Scénario enregistré dans cette session")}>Enregistrer</button>
            </aside>
            <article className="panel">
              <header><div><p>Prospective des départs</p><h2>Vague de renouvellement à anticiper</h2></div><small>Horizon {horizon}</small></header>
              <Timeline values={departureValues} horizon={horizon} startYear={baseYear} />
              <section className="scenario-totals"><div><span>Départs retraite</span><b>{fmt.format(metrics.departures)}</b></div><div><span>Autres sorties</span><b>{fmt.format(otherExits)}</b></div><div><span>Mobilités internes</span><b>{fmt.format(internalMoves)}</b></div><div><span>Recrutements externes</span><b>{fmt.format(externalRecruitments)}</b></div></section>
              <div className="coverage-bar">
                <div><span>Couverture des besoins</span><strong>{coverage} %</strong></div>
                <progress max="100" value={Math.min(100, coverage)} />
                <small>{fmt.format(residualGap)} poste{residualGap > 1 ? "s" : ""} restant à arbitrer sur la période</small>
              </div>
            </article>
          </section>

          <section className="panel renewal-plan">
            <header><div><p>Planification</p><h2>Plan de renouvellement annuel</h2></div><button onClick={() => download("plan-renouvellement.csv", [["Année","Retraites","Autres sorties","Mobilités","Recrutements","Effectif projeté","Action"], ...annualPlan.map((row) => [String(row.year),String(row.retirements),String(row.other),String(row.internal),String(row.external),String(row.projected),row.action])].map((row) => row.join(";")).join("\n"))}>Exporter le plan</button></header>
            <div className="renewal-table">
              <div className="renewal-head"><span>Année</span><span>Retraites</span><span>Autres sorties</span><span>Mobilités</span><span>Recrutements</span><span>Effectif projeté</span><span>Priorité</span></div>
              {annualPlan.map((row) => <div key={row.year}><b>{row.year}</b><span>{row.retirements}</span><span>{row.other}</span><span>{row.internal}</span><span>{row.external}</span><b>{fmt.format(row.projected)}</b><span>{row.action}</span></div>)}
            </div>
          </section>

          <section className="renewal-actions">
            <article><span>01</span><div><h3>Anticiper</h3><p>Ouvrir les recrutements critiques {recruitmentLead} mois avant la date cible et constituer un vivier.</p></div></article>
            <article><span>02</span><div><h3>Transmettre</h3><p>Créer des binômes sur les postes sensibles et formaliser les savoirs avant les départs.</p></div></article>
            <article><span>03</span><div><h3>Développer</h3><p>Préparer {fmt.format(internalMoves)} mobilités ou promotions internes grâce aux parcours de compétences.</p></div></article>
            <article><span>04</span><div><h3>Arbitrer</h3><p>Réexaminer chaque trimestre les vacances, les postes à maintenir et les mutualisations possibles.</p></div></article>
          </section>

          <section className="prospective-method">
            <article className="panel">
              <p>Lecture du modèle</p><h2>De l'estimation à la décision</h2>
              <ul><li>Les départs retraite varient avec l'âge de départ choisi.</li><li>Les autres sorties sont projetées à taux constant.</li><li>La mobilité couvre une part des besoins avant le recrutement externe.</li><li>L'écart final devient un volume à arbitrer, et non une disparition automatique de postes.</li></ul>
            </article>
            <article className="panel attention">
              <p>À connecter ensuite</p><h2>Données SQL attendues</h2>
              <ul><li>Dates de naissance et historiques de sortie.</li><li>Postes, emplois-types, compétences et criticité.</li><li>Délais réels de recrutement et viviers internes.</li><li>Plafonds d'emploi, masse salariale et décisions budgétaires.</li></ul>
            </article>
          </section>
        </>}

        {view === "skills" && <>
          <section className="skills-banner"><div><p>Lecture GPEC</p><h2>Quatre familles de métiers concentrent les besoins de transmission</h2><span>Le score croise volume de départs, rareté des compétences et délai moyen de remplacement.</span></div><aside><small>Postes à sécuriser</small><strong>{fmt.format(Math.round(metrics.departures * 0.28))}</strong><span>d'ici {horizon}</span></aside></section>
          <section className="panel jobs"><header><div><p>Cartographie des risques</p><h2>Métiers sensibles</h2></div><small>Scénario : départ à {retirementAge} ans</small></header>
            <div className="job-table"><div className="job-head"><span>Famille de métiers</span><span>Effectif</span><span>Départs</span><span>Couverture</span><span>Criticité</span><span>Action proposée</span></div>
              {[
                ["Direction scientifique et HDR", .18, .34, 46, "Élevée", "Binômes de transmission"],
                ["Ingénierie de plateformes", .12, .21, 38, "Élevée", "Recrutement ciblé"],
                ["Données et calcul scientifique", .09, .14, 52, "Modérée", "Parcours de formation"],
                ["Montage de projets européens", .06, .12, 61, "Modérée", "Mobilité inter-établissements"],
                ["Enseignement et recherche", .41, .47, 74, "Suivie", "Planification annuelle"],
              ].map((row) => <div key={String(row[0])}><b>{row[0]}</b><span>{fmt.format(Math.round(metrics.total * Number(row[1])))}</span><span>{fmt.format(Math.round(metrics.departures * Number(row[2])))}</span><span><i><em style={{ width: row[3] + "%" }} /></i>{row[3]}%</span><em className={row[4] === "Élevée" ? "high" : row[4] === "Modérée" ? "medium" : "low"}>{row[4]}</em><button onClick={() => notify("Action ouverte : " + row[5])}>{row[5]}</button></div>)}
            </div>
          </section>
          <section className="two-columns equal">
            <article className="panel"><header><div><p>Écart de compétences</p><h2>Besoins à trois ans</h2></div></header><Progress label="Données, IA et calcul" value={82} tone="orange" /><Progress label="Pilotage de programmes" value={71} /><Progress label="Encadrement doctoral" value={65} tone="blue" /><Progress label="Valorisation et partenariats" value={59} tone="teal" /></article>
            <article className="panel action-plan"><header><div><p>Plan d'action</p><h2>Leviers proposés</h2></div></header>
              <button onClick={() => notify("Parcours transmission ajouté")}><span>Transmission</span><b>Créer 64 binômes avant juin 2027</b><small>Priorité haute</small></button>
              <button onClick={() => notify("Campagne ciblée ajoutée")}><span>Recrutement</span><b>Ouvrir 28 postes sur les expertises rares</b><small>Priorité haute</small></button>
              <button onClick={() => notify("Programme mobilité ajouté")}><span>Mobilité</span><b>Mutualiser les viviers entre établissements</b><small>À cadrer</small></button>
            </article>
          </section>
        </>}

        {view === "quality" && <>
          <section className="quality-hero">
            <div><span>Score d'intégration</span><strong>{qualityScore}<small>/100</small></strong><p>{dataset ? fmt.format(dataset.acceptedRows) + " lignes exploitables après application des règles VBA." : "Chargez la feuille Trame pour calculer le score réel."}</p></div>
            <article><span>{dataset ? "Import local contrôlé" : "Contrôle à réaliser"}</span><h2>{dataset ? fmt.format(dataset.acceptedRows) + " agents intégrés depuis la feuille Trame" : "La source et le cache analytique doivent être réconciliés"}</h2><p>{dataset ? fmt.format(dataset.sourceRows) + " lignes source analysées, " + fmt.format(dataset.rejectedRows) + " rejetées et " + fmt.format(importWarnings) + " avertissements. Le fichier reste dans la mémoire de ce navigateur." : "Le classeur fourni contient 7 347 lignes renseignées dans la trame et 8 172 lignes dans la table nettoyée. Importez la trame pour recalculer le périmètre sans utiliser le cache Excel."}</p><button onClick={() => fileRef.current?.click()}>{dataset ? "Choisir un autre fichier" : "Importer la trame"}</button></article>
          </section>
          <section className="two-columns equal">
            <article className="panel"><header><div><p>Complétude source</p><h2>Champs du modèle commun</h2></div></header><Progress label="Établissement" value={dataset?.completeness.establishment ?? 100} tone="teal" /><Progress label="Identifiant pseudonymisé" value={dataset?.completeness.agentId ?? 100} tone="teal" /><Progress label="Année de naissance" value={dataset?.completeness.birthYear ?? 100} tone="teal" /><Progress label="Métier" value={dataset?.completeness.job ?? 77} tone="orange" /><Progress label="Corps ou grade" value={dataset?.completeness.corps ?? 91} tone="blue" /><Progress label="HDR" value={dataset?.completeness.hdr ?? 49} tone="orange" /><Progress label="Type de financement" value={dataset?.completeness.funding ?? 54} tone="orange" /></article>
            <article className="panel rules"><header><div><p>Normalisation issue du VBA</p><h2>Règles transcrites</h2></div><small>7 fonctions métier</small></header>
              <div><b>Naissance</b><span>Année, date et limite d'âge sont contrôlées</span><em>Actif</em></div>
              <div><b>Genre</b><span>Féminin, Mme et Femme deviennent « Femme »</span><em>Actif</em></div>
              <div><b>Statut</b><span>Titulaire, CDD et CDI rejoignent le référentiel commun</span><em>Actif</em></div>
              <div><b>Corps</b><span>PR, MCF et assimilés suivent les règles du module VBA</span><em>Actif</em></div>
              <div><b>Mission</b><span>Recherche, enseignement et autres missions</span><em>Actif</em></div>
              <div><b>HDR</b><span>Oui, vrai et 1 deviennent « OUI »</span><em>Actif</em></div>
              <div><b>Financement</b><span>État, ressources propres et autres financements</span><em>Actif</em></div>
            </article>
          </section>
          {dataset && dataset.issues.length > 0 && <section className="panel import-report"><header><div><p>Journal d'import</p><h2>Premières lignes à contrôler</h2></div><small>{fmt.format(dataset.issues.length)} anomalies ou avertissements</small></header><div className="issue-list"><div><b>Ligne</b><b>Champ</b><b>Contrôle</b></div>{dataset.issues.slice(0, 8).map((issue, index) => <div key={issue.row + "-" + index}><span>{issue.row}</span><span>{issue.field}</span><span>{issue.message}</span></div>)}</div></section>}
          <section className="import-box"><div><p>Alimentation locale</p><h2>Importer la feuille Trame du classeur Excel</h2><span>Le fichier .xlsm ou .xlsx est lu dans votre navigateur. Les règles VBA sont appliquées sans téléversement vers un serveur.</span></div><input ref={fileRef} type="file" accept=".xlsm,.xlsx" hidden onChange={importFile} /><aside>{dataset && <button className="button secondary" onClick={() => { setDataset(null); reset(); notify("Jeu de données retiré de la session"); }}>Retirer les données</button>}<button className="button primary" disabled={importing} onClick={() => fileRef.current?.click()}>{importing ? "Analyse en cours…" : "Choisir un classeur"}</button></aside></section>
        </>}

        {view === "connections" && <>
          <section className="architecture"><div><p>Principe d'intégration</p><h2>Chaque établissement garde son système. Le portail harmonise les données utiles.</h2><span>Les connecteurs alimentent un modèle canonique, daté et pseudonymisé.</span></div><aside>{[["01", "Extraire", "SQL · API · fichier"], ["02", "Contrôler", "Qualité · rejets"], ["03", "Harmoniser", "Référentiels communs"], ["04", "Analyser", "GPEC · scénarios"]].map((step) => <div key={step[0]}><span>{step[0]}</span><b>{step[1]}</b><small>{step[2]}</small></div>)}</aside></section>
          <section className="panel connectors"><header><div><p>Catalogue</p><h2>Sources à connecter</h2></div><button className="button primary" onClick={() => notify("Demande de connecteur créée")}>Ajouter une source</button></header><div>
            <article><span>SQL</span><h3>SIHAM Université</h3><p>Agents, affectations, corps et positions.</p><footer><b>CADRÉ</b><small>Mensuel</small></footer></article>
            <article><span>SQL</span><h3>SIRH établissements</h3><p>Adaptateurs par schéma source.</p><footer><b className="pending">À CONFIGURER</b><small>11 sources</small></footer></article>
            <article><span>API</span><h3>Référentiels métiers</h3><p>Emplois, compétences et niveaux.</p><footer><b className="pending">À CHOISIR</b><small>Commun</small></footer></article>
            <article><span>FICHIER</span><h3>Données complémentaires</h3><p>Financements, HDR et disciplines.</p><footer><b>DISPONIBLE</b><small>CSV contrôlé</small></footer></article>
          </div></section>
          <section className="two-columns schema">
            <article className="panel"><header><div><p>Modèle canonique</p><h2>Tables principales</h2></div><button onClick={copySql}>Copier le SQL</button></header><div className="schema-list">{[["agents_snapshot", "Photographie RH datée"], ["etablissements", "Codes sources et droits"], ["emplois_competences", "Référentiel partagé"], ["affectations", "Unités et disciplines"], ["scenarios_gpec", "Hypothèses et résultats"], ["source_runs", "Chargements et rejets"]].map((row) => <div key={row[0]}><b>{row[0]}</b><span>{row[1]}</span></div>)}</div></article>
            <article className="security"><p>Protection des données</p><h2>Architecture conçue pour le principe de minimisation</h2><ul><li>Identifiant agent haché avant centralisation</li><li>Aucun nom ou prénom dans le modèle analytique</li><li>Droits par établissement et périmètre</li><li>Historique des imports et des règles</li><li>Agrégation minimale des petits effectifs</li></ul><button onClick={() => notify("Note d'architecture ajoutée aux livrables")}>Préparer la note d'architecture</button></article>
          </section>
        </>}

        <footer className="page-footer"><p>{dataset ? "Classeur traité dans ce navigateur. Les données ne sont ni envoyées ni conservées après fermeture. Aucun identifiant individuel n'est publié." : "Données de démonstration construites à partir des agrégats du classeur fourni. Aucun identifiant individuel n'est publié."}</p><span>Université Paris-Saclay · ProspectivRH</span></footer>
      </div>
    </main>

    {toast && <div className="toast" role="status">{toast}</div>}
    {menuOpen && <button className="overlay" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
  </div>;
}
