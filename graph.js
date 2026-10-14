const canvas = document.getElementById("graphCanvas");
const ctx = canvas.getContext("2d");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const fitBtn = document.getElementById("fitBtn");
const resetBtn = document.getElementById("resetBtn");
const loadBtn = document.getElementById("loadBtn");
const sampleBtn = document.getElementById("sampleBtn");
const inputData = document.getElementById("inputData");
const infoPanel = document.getElementById("infoPanel");
const statusPanel = document.getElementById("statusPanel");

const FAMILY_STYLES = {
  Sharma: { color: "#ff9a66", anchor: { x: 40, y: 120 } },
  Iyer: { color: "#ffe44d", anchor: { x: -280, y: -140 } },
  Reddy: { color: "#7CFC00", anchor: { x: -220, y: 280 } },
  Kapoor: { color: "#55d9ff", anchor: { x: 360, y: -30 } },
  Other: { color: "#c2cad3", anchor: { x: 0, y: 0 } }
};

let nodes = [];
let edges = [];
let nodeMap = new Map();
let generationChildren = new Map();
let generationParents = new Map();
let familyLayout = new Map();

const camera = { x: 0, y: 0, zoom: 1 };
let hoveredNode = null;
let selectedNode = null;
let highlightNode = null;
let draggedNode = null;
let isPanning = false;
let lastMouse = { x: 0, y: 0 };
const dpr = window.devicePixelRatio || 1;

function resizeCanvas() {
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

inputData.value = FAMILY_DATA_TEMPLATE;

function setStatus(message, type = "info") {
  const colors = {
    info: "#d8d4d1",
    success: "#97f0a3",
    error: "#ff9f9f"
  };
  statusPanel.innerHTML = `<strong style="color:${colors[type]}">${type.toUpperCase()}</strong><br>${message}`;
}

function inferFamily(name, fallback = "Other") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return fallback;
  return parts[parts.length - 1];
}

function normalizeFamilyName(family, name) {
  const cleaned = String(family || "").trim();
  if (!cleaned || cleaned === ".") return "Other";
  return cleaned || inferFamily(name, "Other");
}

function normalizeRelationship(rel) {
  const r = String(rel || "").trim().toLowerCase();
  if (["wife", "husband", "married"].includes(r)) return "spouse";
  if (["father", "mother"].includes(r)) return "parent";
  if (["son", "daughter"].includes(r)) return "child";
  if (["brother", "sister"].includes(r)) return "sibling";
  return r;
}


function normalizeDatasetToRows(dataset) {
  const people = Array.isArray(dataset.people) ? dataset.people : [];
  const relations = Array.isArray(dataset.relations) ? dataset.relations : [];
  const peopleById = new Map(people.map(person => [person.id, person]));

  return relations.map((relation, index) => {
    if (!relation.source || !relation.target || !relation.kind) {
      throw new Error(`Relation ${index + 1} is missing source, target, or kind.`);
    }

    const source = peopleById.get(relation.source) || { id: relation.source, name: relation.source, family: 'Other' };
    const target = peopleById.get(relation.target) || { id: relation.target, name: relation.target, family: 'Other' };

    return {
      personAId: source.id,
      personAName: source.name,
      personAFamily: normalizeFamilyName(source.family, source.name),
      personBId: target.id,
      personBName: target.name,
      personBFamily: normalizeFamilyName(target.family, target.name),
      relationship: relation.kind
    };
  });
}

function buildGraphDataFromRows(rows, seededPeople = []) {
  const peopleMap = new Map();
  const rels = [];

  seededPeople.forEach(person => {
    ensurePerson(person.id, person.name, person.family, person.role);
  });

  function ensurePerson(id, name, family, role = "") {
    if (!id) throw new Error("Each row must include personAId and personBId.");
    if (!peopleMap.has(id)) {
      peopleMap.set(id, {
        id,
        name: name || id,
        family: normalizeFamilyName(family, name),
        role: role || "",
        explicitRole: role || "",
        branch: "direct",
        generation: null,
        gender: "U",
        vx: 0,
        vy: 0,
        x: 0,
        y: 0,
        fixed: false
      });
    }
  }

  rows.forEach((row, index) => {
    if (!row.personAId || !row.personBId || !row.relationship) {
      throw new Error(`Row ${index + 1} is missing personAId, personBId, or relationship.`);
    }

    ensurePerson(row.personAId, row.personAName, row.personAFamily);
    ensurePerson(row.personBId, row.personBName, row.personBFamily);

    const a = peopleMap.get(row.personAId);
    const b = peopleMap.get(row.personBId);

    a.name = row.personAName || a.name;
    b.name = row.personBName || b.name;
    a.family = normalizeFamilyName(row.personAFamily || a.family, a.name);
    b.family = normalizeFamilyName(row.personBFamily || b.family, b.name);

    const rel = normalizeRelationship(row.relationship);

    if (rel === "spouse") {
      rels.push({ source: row.personAId, target: row.personBId, kind: "marriage" });
    } else if (rel === "parent") {
      rels.push({ source: row.personAId, target: row.personBId, kind: "parent" });
    } else if (rel === "child") {
      rels.push({ source: row.personBId, target: row.personAId, kind: "parent" });
    } else if (rel === "sibling") {
      rels.push({ source: row.personAId, target: row.personBId, kind: "sibling" });
    } else {
      rels.push({ source: row.personAId, target: row.personBId, kind: "extended" });
    }
  });

  assignGenerations(peopleMap, rels);
  assignRolesAndBranches(peopleMap, rels);
  assignClusterLeads(peopleMap, rels);
  familyLayout = buildFamilyLayout(peopleMap);
  seedNodePositions(peopleMap);

  return { people: Array.from(peopleMap.values()), relations: rels };
}

function assignGenerations(peopleMap, rels) {
  const incoming = new Map();
  const outgoing = new Map();
  for (const id of peopleMap.keys()) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }

  rels.forEach(rel => {
    if (rel.kind === "parent") {
      outgoing.get(rel.source).push(rel.target);
      incoming.get(rel.target).push(rel.source);
    }
  });

  const queue = [];
  for (const [id] of peopleMap) {
    if ((incoming.get(id) || []).length === 0) {
      peopleMap.get(id).generation = 1;
      queue.push(id);
    }
  }

  while (queue.length) {
    const id = queue.shift();
    const person = peopleMap.get(id);
    for (const childId of outgoing.get(id) || []) {
      const child = peopleMap.get(childId);
      const nextGen = person.generation + 1;
      if (child.generation == null || nextGen > child.generation) {
        child.generation = nextGen;
        queue.push(childId);
      }
    }
  }

  rels.forEach(rel => {
    if (rel.kind === "marriage") {
      const a = peopleMap.get(rel.source);
      const b = peopleMap.get(rel.target);
      if (a.generation != null && b.generation == null) b.generation = a.generation;
      if (b.generation != null && a.generation == null) a.generation = b.generation;
      if (a.generation != null && b.generation != null) {
        const gen = Math.min(a.generation, b.generation);
        a.generation = gen;
        b.generation = gen;
      }
    }
  });

  for (const person of peopleMap.values()) {
    if (person.generation == null) person.generation = 1;
  }
}

function assignRolesAndBranches(peopleMap, rels) {
  const parentOutCount = new Map();
  const explicitCoreRoles = new Set(["patriarch", "matriarch", "family-head"]);

  for (const person of peopleMap.values()) {
    if (!person.role) person.role = "extended";
  }

  rels.forEach(rel => {
    if (rel.kind === "parent") {
      parentOutCount.set(rel.source, (parentOutCount.get(rel.source) || 0) + 1);
      const parent = peopleMap.get(rel.source);
      const child = peopleMap.get(rel.target);

      if (!explicitCoreRoles.has(parent.explicitRole)) {
        parent.role = "core";
      }

      if (!explicitCoreRoles.has(child.explicitRole)) {
        child.role = "core";
      }
    }
  });

  rels.forEach(rel => {
    if (rel.kind === "marriage") {
      const a = peopleMap.get(rel.source);
      const b = peopleMap.get(rel.target);
      if (a.family !== b.family) {
        if (a.role === "core") {
          b.branch = "inlaw";
          b.role = b.role === "extended" ? "spouse" : b.role;
          b.marriedInto = a.family;
        } else if (b.role === "core") {
          a.branch = "inlaw";
          a.role = a.role === "extended" ? "spouse" : a.role;
          a.marriedInto = b.family;
        } else {
          a.role = "spouse";
          b.role = "spouse";
        }
      }
    }

    if (rel.kind === "sibling") {
      const a = peopleMap.get(rel.source);
      const b = peopleMap.get(rel.target);
      if (a.role === "extended") a.role = "extended";
      if (b.role === "extended") b.role = "extended";
    }
  });

  for (const [id, count] of parentOutCount.entries()) {
    const person = peopleMap.get(id);
    if (!person.explicitRole && count >= 2) {
      person.role = person.generation === 1 ? "patriarch" : "family-head";
    }
  }
}

function assignClusterLeads(peopleMap, rels) {
  const familyAdjacency = new Map();

  for (const person of peopleMap.values()) {
    familyAdjacency.set(person.id, []);
  }

  rels.forEach(rel => {
    const source = peopleMap.get(rel.source);
    const target = peopleMap.get(rel.target);
    if (!source || !target || source.family !== target.family) return;

    familyAdjacency.get(source.id).push(target.id);
    familyAdjacency.get(target.id).push(source.id);
  });

  const families = new Map();
  for (const person of peopleMap.values()) {
    if (!families.has(person.family)) families.set(person.family, []);
    families.get(person.family).push(person);
  }

  for (const members of families.values()) {
    const anchors = members.filter(person => ["patriarch", "matriarch", "family-head"].includes(person.role));

    if (!anchors.length) {
      members.forEach(person => {
        person.clusterLeadId = members[0].id;
      });
      continue;
    }

    const queue = [];
    const visited = new Set();

    anchors.forEach(anchor => {
      anchor.clusterLeadId = anchor.id;
      queue.push(anchor.id);
      visited.add(anchor.id);
    });

    while (queue.length) {
      const currentId = queue.shift();
      const current = peopleMap.get(currentId);

      for (const nextId of familyAdjacency.get(currentId) || []) {
        if (visited.has(nextId)) continue;
        const next = peopleMap.get(nextId);
        next.clusterLeadId = current.clusterLeadId || current.id;
        visited.add(nextId);
        queue.push(nextId);
      }
    }

    const fallbackLeadId = anchors[0].id;
    members.forEach(person => {
      if (!person.clusterLeadId) person.clusterLeadId = fallbackLeadId;
    });
  }
}

function buildFamilyLayout(peopleMap) {
  const families = new Map();

  for (const person of peopleMap.values()) {
    if (!families.has(person.family)) {
      families.set(person.family, {
        family: person.family,
        members: [],
        anchorPeople: []
      });
    }

    const group = families.get(person.family);
    group.members.push(person);

    if (["patriarch", "matriarch", "family-head"].includes(person.role)) {
      group.anchorPeople.push(person);
    }
  }

  const familyList = [...families.values()].sort((a, b) => {
    if (a.family === "Other") return 1;
    if (b.family === "Other") return -1;
    return b.members.length - a.members.length;
  });
  const columns = Math.max(2, Math.ceil(Math.sqrt(familyList.length)));
  const baseSpacingX = 420;
  const baseSpacingY = 320;
  const outerRingRadius = 880;

  familyList.forEach((group, index) => {
    const style = FAMILY_STYLES[group.family] || FAMILY_STYLES.Other;
    const sizeBoost = Math.min(group.members.length * 10, 220);
    const anchorBiasX = style.anchor?.x ?? 0;
    const anchorBiasY = style.anchor?.y ?? 0;
    const isOuterFamily = group.family === "Other";

    if (isOuterFamily) {
      const angle = (Math.PI * 2 * index) / Math.max(1, familyList.length - 1);
      group.anchor = {
        x: Math.cos(angle) * outerRingRadius,
        y: Math.sin(angle) * outerRingRadius * 0.72
      };
    } else {
      const visibleIndex = familyList.filter(item => item.family !== "Other").indexOf(group);
      const row = Math.floor(visibleIndex / columns);
      const col = visibleIndex % columns;
      group.anchor = {
        x: (col - (columns - 1) / 2) * (baseSpacingX + sizeBoost) + anchorBiasX * 0.35,
        y: (row - (Math.ceil(familyList.length / columns) - 1) / 2) * (baseSpacingY + sizeBoost * 0.45) + anchorBiasY * 0.35
      };
    }

    const subAnchors = new Map();
    const anchorCount = Math.max(1, group.anchorPeople.length);
    const orbitRadius = anchorCount === 1 ? 0 : 70 + Math.min(group.members.length * 3, 90);

    (group.anchorPeople.length ? group.anchorPeople : [group.members[0]]).forEach((person, anchorIndex) => {
      const angle = anchorCount === 1 ? 0 : (Math.PI * 2 * anchorIndex) / anchorCount;
      subAnchors.set(person.id, {
        x: Math.cos(angle) * orbitRadius,
        y: Math.sin(angle) * orbitRadius * 0.7
      });
    });

    group.subAnchors = subAnchors;
  });

  enforceFamilyAnchorSpacing(familyList);

  return new Map(familyList.map(group => [group.family, group]));
}

function enforceFamilyAnchorSpacing(familyList) {
  for (let step = 0; step < 18; step++) {
    for (let i = 0; i < familyList.length; i++) {
      for (let j = i + 1; j < familyList.length; j++) {
        const a = familyList[i];
        const b = familyList[j];
        if (!a.anchor || !b.anchor) continue;

        const minGap = 320 + Math.sqrt(a.members.length * b.members.length) * 16;
        let dx = b.anchor.x - a.anchor.x;
        let dy = b.anchor.y - a.anchor.y;
        let distance = Math.sqrt(dx * dx + dy * dy) || 0.001;

        if (distance >= minGap) continue;

        const overlap = (minGap - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;

        a.anchor.x -= ux * overlap;
        a.anchor.y -= uy * overlap;
        b.anchor.x += ux * overlap;
        b.anchor.y += uy * overlap;
      }
    }
  }
}

function seedNodePositions(peopleMap) {
  const clusters = new Map();

  for (const person of peopleMap.values()) {
    const key = `${person.family}::${person.clusterLeadId || person.id}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(person);
  }

  for (const members of clusters.values()) {
    const lead = members.find(person => person.id === person.clusterLeadId) || members[0];
    const familyGroup = familyLayout.get(lead.family);
    const familyAnchor = familyGroup?.anchor || { x: 0, y: 0 };
    const subAnchor = familyGroup?.subAnchors?.get(lead.clusterLeadId) || { x: 0, y: 0 };
    const clusterCenterX = familyAnchor.x + subAnchor.x;
    const clusterCenterY = familyAnchor.y + subAnchor.y;

    lead.targetX = clusterCenterX;
    lead.targetY = clusterCenterY;
    lead.x = clusterCenterX + (Math.random() - 0.5) * 8;
    lead.y = clusterCenterY + (Math.random() - 0.5) * 8;
    lead.vx = 0;
    lead.vy = 0;

    const orbiters = members
      .filter(person => person.id !== lead.id)
      .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name));

    orbiters.forEach((person, index) => {
      const ringIndex = Math.floor(index / 10);
      const ringSize = Math.min(10, orbiters.length - ringIndex * 10);
      const slotIndex = index % 10;
      const angle = (Math.PI * 2 * slotIndex) / Math.max(1, ringSize);
      const radius =
        90 +
        ringIndex * 42 +
        Math.max(0, person.generation - lead.generation) * 34 +
        (person.branch === "inlaw" ? 28 : 0) +
        (person.family === "Other" ? 180 : 0);

      person.targetX = clusterCenterX + Math.cos(angle) * radius;
      person.targetY = clusterCenterY + Math.sin(angle) * radius * 0.82;
      person.x = person.targetX + (Math.random() - 0.5) * 18;
      person.y = person.targetY + (Math.random() - 0.5) * 18;
      person.vx = 0;
      person.vy = 0;
    });
  }

  for (const person of peopleMap.values()) {
    if (person.targetX == null) {
      person.targetX = person.x;
      person.targetY = person.y;
      person.vx = 0;
      person.vy = 0;
    }
  }
}

function refreshDerivedMaps() {
  generationChildren = new Map();
  generationParents = new Map();
  nodeMap = new Map(nodes.map(node => [node.id, node]));
  nodes.forEach(node => {
    generationChildren.set(node.id, []);
    generationParents.set(node.id, []);
  });
  edges.forEach(edge => {
    if (edge.kind === "parent") {
      generationChildren.get(edge.source)?.push(edge.target);
      generationParents.get(edge.target)?.push(edge.source);
    }
  });
}

function loadDataset(dataset) {
  const rows = normalizeDatasetToRows(dataset);
  const built = buildGraphDataFromRows(rows, dataset.people || []);
  const builtNodeMap = new Map(built.people.map(person => [person.id, person]));
  const childParents = new Map();

  built.relations.forEach(rel => {
    if (rel.kind !== "parent") return;
    if (!childParents.has(rel.target)) childParents.set(rel.target, []);
    childParents.get(rel.target).push(rel.source);
  });

  nodes = built.people;
  edges = built.relations.map(rel => {
    const source = builtNodeMap.get(rel.source);
    const target = builtNodeMap.get(rel.target);

    if (rel.kind === "marriage") {
      const crossFamilyMarriage = source && target && source.family !== target.family;
      return {
        ...rel,
        strength: crossFamilyMarriage ? 0.012 : 0.018,
        rest: crossFamilyMarriage ? 340 : 220
      };
    }

    if (rel.kind === "parent") {
      const child = target;
      const parent = source;
      const childFamily = child?.family || "Other";
      const parentFamily = parent?.family || "Other";
      const crossFamilyParent = childFamily !== parentFamily;
      const parentCount = (childParents.get(rel.target) || []).length;

      return {
        ...rel,
        strength: crossFamilyParent && parentCount > 1 ? 0.008 : crossFamilyParent ? 0.016 : 0.045,
        rest: crossFamilyParent ? 240 : 150
      };
    }

    return {
      ...rel,
      strength: rel.kind === "sibling" ? 0.025 : 0.018,
      rest: rel.kind === "sibling" ? 120 : 100
    };
  });
  refreshDerivedMaps();
  selectedNode = null;
  highlightNode = null;
  infoPanel.classList.add("hidden");
  fitView();
  const families = [...new Set(nodes.map(n => n.family))].join(", ");
  setStatus(`Loaded <strong>${nodes.length}</strong> people and <strong>${edges.length}</strong> relationships.<br>Families: ${families}`, "success");
}

function getNodeRadius(node) {
  if (node.role === "patriarch" || node.role === "matriarch") return 22;
  if (node.role === "family-head") return 18;
  if (node.role === "core") return 16;
  if (node.role === "spouse") return 15;
  return 8;
}

function getNodeColor(node) {
  return (FAMILY_STYLES[node.family] || FAMILY_STYLES.Other).color;
}

function getEdgeStyle(kind) {
  if (kind === "marriage") return { color: "#ffe44d", width: 3 };
  if (kind === "parent") return { color: "#64d8ff", width: 2.2 };
  if (kind === "sibling") return { color: "rgba(255,255,255,0.35)", width: 1.5 };
  return { color: "rgba(200,200,200,0.18)", width: 1 };
}

function worldToScreen(x, y) {
  return {
    x: (x + camera.x) * camera.zoom + window.innerWidth / 2,
    y: (y + camera.y) * camera.zoom + window.innerHeight / 2
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - window.innerWidth / 2) / camera.zoom - camera.x,
    y: (y - window.innerHeight / 2) / camera.zoom - camera.y
  };
}

function findNodeAt(x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const p = worldToScreen(node.x, node.y);
    const r = getNodeRadius(node) * camera.zoom;
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= r * r) return node;
  }
  return null;
}

function applyRepulsion() {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distSq = dx * dx + dy * dy + 0.01;
      let dist = Math.sqrt(distSq);
      let force = 900 / distSq;
      if (a.family !== b.family) force *= 1.7;
      if (a.role === "patriarch" || a.role === "matriarch" || b.role === "patriarch" || b.role === "matriarch") {
        force *= 1.25;
      }
      if (a.role === "extended" && b.role === "extended") force *= 0.22;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
      if (!b.fixed) { b.vx += fx; b.vy += fy; }
    }
  }
}

function applySprings() {
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const diff = dist - edge.rest;
    const force = diff * edge.strength;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!a.fixed) { a.vx += fx; a.vy += fy; }
    if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
  }
}

function applyFamilyClusterRepulsion() {
  const familyMembers = new Map();

  nodes.forEach(node => {
    if (!familyMembers.has(node.family)) familyMembers.set(node.family, []);
    familyMembers.get(node.family).push(node);
  });

  const families = [...familyMembers.entries()].map(([family, members]) => {
    const anchor = familyLayout.get(family)?.anchor || { x: 0, y: 0 };
    return { family, members, anchor };
  });

  for (let i = 0; i < families.length; i++) {
    for (let j = i + 1; j < families.length; j++) {
      const a = families[i];
      const b = families[j];
      let dx = b.anchor.x - a.anchor.x;
      let dy = b.anchor.y - a.anchor.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const minGap = 320 + Math.sqrt(a.members.length * b.members.length) * 14;

      if (distance >= minGap) continue;

      const push = (minGap - distance) * 0.0009;
      const ux = dx / distance;
      const uy = dy / distance;

      a.members.forEach(node => {
        if (!node.fixed) {
          node.vx -= ux * push;
          node.vy -= uy * push;
        }
      });

      b.members.forEach(node => {
        if (!node.fixed) {
          node.vx += ux * push;
          node.vy += uy * push;
        }
      });
    }
  }
}

function applyAnchors() {
  nodes.forEach(node => {
    const strength =
      node.role === "patriarch" || node.role === "matriarch" ? 0.0035 :
      node.role === "family-head" ? 0.0024 :
      node.role === "core" ? 0.0017 :
      node.role === "spouse" ? 0.0012 :
      0.00045;
    node.vx += ((node.targetX ?? node.x) - node.x) * strength;
    node.vy += ((node.targetY ?? node.y) - node.y) * strength;
  });
}

function integrate() {
  nodes.forEach(node => {
    if (node.fixed) return;
    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;
  });
}

function simulate() {
  applyRepulsion();
  applySprings();
  applyFamilyClusterRepulsion();
  applyAnchors();
  integrate();
}

function drawEdges() {
  edges.forEach(edge => {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) return;
    const pa = worldToScreen(a.x, a.y);
    const pb = worldToScreen(b.x, b.y);
    const style = getEdgeStyle(edge.kind);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.stroke();
  });
}

function drawNodes() {
  nodes.forEach(node => {
    const p = worldToScreen(node.x, node.y);
    const r = getNodeRadius(node);

    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(node);
    ctx.fill();

    if (node === hoveredNode || node === selectedNode || node === highlightNode) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (camera.zoom > 0.45 || node.role !== "extended") {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = node.role === "extended" ? "11px Arial" : "13px Arial";
      ctx.fillText(node.name, p.x, p.y + r + 16);
    }
  });
}

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawEdges();
  drawNodes();
}

function animate() {
  for (let i = 0; i < 2; i++) simulate();
  render();
  requestAnimationFrame(animate);
}

function getRelatives(nodeId, depth = 2) {
  const visited = new Set([nodeId]);
  const queue = [{ id: nodeId, level: 0 }];
  const relatives = [];

  while (queue.length) {
    const { id, level } = queue.shift();
    if (level >= depth) continue;

    edges.forEach(edge => {
      if (edge.source === id || edge.target === id) {
        const otherId = edge.source === id ? edge.target : edge.source;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          relatives.push({ id: otherId, via: edge.kind });
          queue.push({ id: otherId, level: level + 1 });
        }
      }
    });
  }

  return relatives;
}

function showInfo(node) {
  const parents = (generationParents.get(node.id) || []).map(id => nodeMap.get(id)?.name).filter(Boolean);
  const children = (generationChildren.get(node.id) || []).map(id => nodeMap.get(id)?.name).filter(Boolean);
  const spouses = edges
    .filter(edge => edge.kind === "marriage" && (edge.source === node.id || edge.target === node.id))
    .map(edge => nodeMap.get(edge.source === node.id ? edge.target : edge.source)?.name)
    .filter(Boolean);
  const related = getRelatives(node.id, 2).slice(0, 8).map(item => nodeMap.get(item.id)?.name).filter(Boolean);

  infoPanel.classList.remove("hidden");
  infoPanel.innerHTML = `
    <h3 style="margin-top:0">${node.name}</h3>
    <div><strong>ID:</strong> ${node.id}</div>
    <div><strong>Family:</strong> ${node.family}</div>
    <div><strong>Role:</strong> ${node.role}</div>
    <div><strong>Generation:</strong> ${node.generation}</div>
    <div><strong>Branch:</strong> ${node.branch || "direct"}</div>
    ${node.marriedInto ? `<div><strong>Married into:</strong> ${node.marriedInto}</div>` : ""}
    <hr>
    <div><strong>Parents:</strong> ${parents.length ? parents.join(", ") : "—"}</div>
    <div><strong>Spouse:</strong> ${spouses.length ? spouses.join(", ") : "—"}</div>
    <div><strong>Children:</strong> ${children.length ? children.join(", ") : "—"}</div>
    <div><strong>Nearby relatives:</strong> ${related.length ? related.join(", ") : "—"}</div>
  `;
}

function focusNode(node, zoom = 1.2) {
  const startX = camera.x;
  const startY = camera.y;
  const startZoom = camera.zoom;
  const targetX = -node.x;
  const targetY = -node.y;
  const duration = 450;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.x = startX + (targetX - startX) * ease;
    camera.y = startY + (targetY - startY) * ease;
    camera.zoom = startZoom + (zoom - startZoom) * ease;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function fitView() {
  if (!nodes.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  });
  const width = maxX - minX + 260;
  const height = maxY - minY + 220;
  camera.zoom = Math.max(0.2, Math.min(1.4, Math.min(window.innerWidth / width, window.innerHeight / height)));
  camera.x = -(minX + maxX) / 2;
  camera.y = -(minY + maxY) / 2;
}

function resetView() {
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  selectedNode = null;
  highlightNode = null;
  infoPanel.classList.add("hidden");
  setStatus("Camera reset. Sample or custom row-based data remains loaded.", "info");
}

function searchPerson() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return;
  const found = nodes.find(node => node.name.toLowerCase().includes(q) || node.id.toLowerCase().includes(q));
  if (!found) {
    setStatus(`No match found for <strong>${q}</strong>.`, "error");
    return;
  }
  selectedNode = found;
  highlightNode = found;
  showInfo(found);
  focusNode(found);
  setStatus(`Focused on <strong>${found.name}</strong>.`, "success");
}

function parseInputData() {
  try {
    const dataset = JSON.parse(inputData.value);
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
      throw new Error("Input must be an object with people and relations arrays.");
    }
    return dataset;
  } catch (error) {
    setStatus(`Invalid JSON: ${error.message}`, "error");
    throw error;
  }
}

loadBtn.addEventListener("click", () => {
  try {
    loadDataset(parseInputData());
  } catch (error) {
    console.error(error);
  }
});

sampleBtn.addEventListener("click", () => {
  inputData.value = FAMILY_DATA_TEMPLATE;
  loadDataset(FAMILY_DATA_SAMPLE);
});

searchBtn.addEventListener("click", searchPerson);
searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") searchPerson();
});
fitBtn.addEventListener("click", () => {
  fitView();
  setStatus("Graph fitted to viewport.", "info");
});
resetBtn.addEventListener("click", resetView);

canvas.addEventListener("mousedown", event => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  lastMouse = { x, y };
  const hit = findNodeAt(x, y);
  if (hit) {
    draggedNode = hit;
    selectedNode = hit;
    hit.fixed = true;
    showInfo(hit);
  } else {
    isPanning = true;
  }
  canvas.classList.add("dragging");
});

window.addEventListener("mousemove", event => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  hoveredNode = findNodeAt(x, y);
  if (draggedNode) {
    const world = screenToWorld(x, y);
    draggedNode.x = world.x;
    draggedNode.y = world.y;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
  } else if (isPanning) {
    const dx = x - lastMouse.x;
    const dy = y - lastMouse.y;
    camera.x += dx / camera.zoom;
    camera.y += dy / camera.zoom;
    lastMouse = { x, y };
  }
});

window.addEventListener("mouseup", () => {
  if (draggedNode) {
    draggedNode.fixed = false;
    draggedNode = null;
  }
  isPanning = false;
  canvas.classList.remove("dragging");
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const before = screenToWorld(mx, my);
  camera.zoom *= event.deltaY < 0 ? 1.12 : 0.9;
  camera.zoom = Math.max(0.2, Math.min(3.4, camera.zoom));
  const after = screenToWorld(mx, my);
  camera.x += after.x - before.x;
  camera.y += after.y - before.y;
}, { passive: false });

loadDataset(FAMILY_DATA_SAMPLE);
animate();
