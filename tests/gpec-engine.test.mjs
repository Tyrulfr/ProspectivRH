import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYear,
  mapCorpsDetail,
  mapCorpsGroup,
  mapFunding,
  mapHdr,
  mapMission,
  mapStatus,
  processTrame,
} from "../lib/gpec-engine.ts";

const headers = [
  "Etablissement", "COMPOSANTE", "DEPARTEMENT", "Codification agent", "Genre", "Année naissance",
  "Métier", "Statut", "Corps SIHAM", "Corps hors SIHAM", "Mission", "?", "Discipline", "Laboratoire",
  "Position", "Quotité", "Ancienneté établissement", "Ancienneté corps", "HDR", "Type de financement",
];

test("les mappings reprennent les règles du module VBA", () => {
  assert.equal(extractYear(new Date("1978-04-12")), 1978);
  assert.equal(extractYear("née en 1984"), 1984);
  assert.equal(mapHdr("vrai"), "OUI");
  assert.equal(mapHdr("non"), "NON");
  assert.equal(mapStatus("Agent titulaire"), "TIT");
  assert.equal(mapStatus("Contrat CDD"), "CDD");
  assert.equal(mapMission("enseignement et recherche"), "Recherche");
  assert.equal(mapFunding("RP"), "RESSOURCES PROPRES");
  assert.equal(mapCorpsDetail("Contractuel chercheur LRU"), "Maître de Conférences");
  assert.equal(mapCorpsDetail("Directeur de recherche"), "Professeur");
  assert.equal(mapCorpsGroup("Maître de Conférences"), "MCF");
});

test("la feuille Trame est filtrée et normalisée comme le traitement Clean", () => {
  const rows = [
    headers,
    ["UPS", null, null, "A-01", "Mme", 1970, "Chercheur", "Titulaire", "Directeur de recherche", null, "Activité de recherche", null, null, null, null, null, null, null, "Oui", "Etat"],
    ["UPS", null, null, "A-02", "M", 1980, "Enseignant", "CDD", "Chargé de recherche", null, "Enseignement", null, null, null, null, null, null, null, "False", "RP"],
    ["UPS", null, null, "A-03", "Mme", null, "Chercheur", "CDI", "PR", null, "Recherche", null, null, null, null, null, null, null, "Oui", "Etat"],
    ["UPS", null, null, "A-04", "M", 1940, "Chercheur", "CDI", "PR", null, "Recherche", null, null, null, null, null, null, null, "Oui", "Etat"],
  ];
  const result = processTrame(rows, { referenceYear: 2026, legalRetirementAge: 65, ageLimit: 70, sourceFile: "test.xlsm" });

  assert.equal(result.sourceRows, 4);
  assert.equal(result.acceptedRows, 2);
  assert.equal(result.rejectedRows, 2);
  assert.deepEqual(result.agents.map((agent) => agent.gender), ["Femme", "Homme"]);
  assert.deepEqual(result.agents.map((agent) => agent.corpsGroup), ["PR", "MCF"]);
  assert.deepEqual(result.agents.map((agent) => agent.departureYear), [2035, 2045]);
  assert.equal(result.completeness.birthYear, 75);
});
