/* =====================================================================
   DATA STORE + CHECKLIST LOGIC
   Each assignment is one JSON file in <rootFolder>/data/ in OneDrive or
   the team SharePoint library. In demo mode, data lives in memory only.
   ===================================================================== */
(function () {
  const C = window.APP_CONFIG;

  /* ---------------- dates ---------------- */
  const D = {
    today() {
      return new Intl.DateTimeFormat("en-CA", { timeZone: C.user.timeZoneIana }).format(new Date());
    },
    add(dateStr, days) {
      const d = new Date(dateStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    },
    diff(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000); },
    nice(dateStr) {
      if (!dateStr) return "\u2014";
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(dateStr + "T00:00:00Z"));
    },
    short(dateStr) {
      if (!dateStr) return "\u2014";
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
        .format(new Date(dateStr + "T00:00:00Z"));
    },
    weekday(dateStr) { return new Date(dateStr + "T00:00:00Z").getUTCDay(); },
    nextWorkday(dateStr) {
      let d = dateStr; while ([0, 6].includes(D.weekday(d))) d = D.add(d, 1); return d;
    },
  };

  /* ---------------- checklist ---------------- */
  function kickoffDate(a) {
    return a.kickoff?.date || a.project.start || a.assignment.start;
  }

  function anchorDate(a, anchor) {
    switch (anchor) {
      case "assignmentStart": return a.assignment.start;
      case "projectStart": return a.project.start || a.assignment.start;
      case "projectEnd": return a.project.end || a.assignment.end;
      case "kickoff": return kickoffDate(a);
      default: return a.assignment.start;
    }
  }

  function status(item, today) {
    if (item.done) return "done";
    if (item.locked) return "locked";
    const d = D.diff(today, item.due);
    if (d < 0) return "overdue";
    if (d === 0) return "today";
    if (d <= 3) return "soon";
    return "later";
  }

  /** Returns phases with items resolved to due dates and status */
  function checklist(a) {
    const track = window.TRACKS[a.track];
    const today = D.today();
    if (!track) return [];
    return track.phases.map(ph => ({
      name: ph.name,
      items: ph.items.map(t => {
        const st = a.items[t.id] || {};
        const base = anchorDate(a, t.anchor);
        const due = base ? D.nextWorkday(D.add(base, t.offsetDays)) : "";
        const locked = t.gate === "accessGranted" && !a.access?.granted;
        const item = { ...t, due, done: !!st.done, doneAt: st.doneAt, todoTaskId: st.todoTaskId, locked };
        item.status = status(item, today);
        return item;
      }),
    }));
  }

  function flatItems(a) { return checklist(a).flatMap(p => p.items.map(i => ({ ...i, phase: p.name }))); }

  function progress(a) {
    const all = flatItems(a);
    const done = all.filter(i => i.done).length;
    return { done, total: all.length, pct: all.length ? Math.round(done / all.length * 100) : 0 };
  }

  function packageLabel(a) {
    return a.assignment.pkgType === "BES" ? `BES ${a.assignment.pkgLevel || ""}`.trim()
      : `BFS ${a.assignment.pkgLevel}`;
  }
  function packageKey(a) {
    return a.assignment.pkgType === "BES" ? `BES-${a.assignment.pkgLevel || ""}`.replace(/-$/, "") : `BFS-${a.assignment.pkgLevel}`;
  }

  function fill(tpl, a, extra = {}) {
    const tokens = {
      clientName: a.account.name, accountOwner: a.account.owner,
      servicePackage: packageLabel(a), projectName: a.project.name,
      projectStart: D.nice(a.project.start), projectEnd: D.nice(a.project.end),
      assignmentEnd: D.nice(a.assignment.end), projectLink: a.project.link,
      assignmentLink: a.assignment.link, accountLink: a.account.link,
      tenantName: a.access?.tenantName, accessNeeded: a.access?.needed,
      validationStatus: a.access?.validationStatus,
      myName: window.MS.account?.name || "",
      ...extra,
    };
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? `[${k}]`);
  }

  /* ---------------- persistence ---------------- */
  const mem = new Map();

  async function list() {
    if (window.MS.DEMO) return [...mem.values()];
    const files = (await window.MS.listFolder("data")).filter(f => f.name.endsWith(".json"));
    const all = await Promise.all(files.map(f => window.MS.getFileJson(`data/${f.name}`).catch(() => null)));
    return all.filter(Boolean);
  }

  async function save(a) {
    a.updatedAt = new Date().toISOString();
    if (window.MS.DEMO) { mem.set(a.id, structuredClone(a)); return a; }
    await window.MS.putFile(`data/${a.id}.json`, new Blob([JSON.stringify(a, null, 2)]), "application/json");
    return a;
  }

  async function remove(id) {
    if (window.MS.DEMO) { mem.delete(id); return; }
    await window.MS.deleteFile(`data/${id}.json`);
  }

  function newId() {
    return "A" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function seedDemo() {
    const t = D.today();
    const a = {
      id: newId(), createdAt: new Date().toISOString(), createdBy: "demo.user@yourcompany.com",
      assignment: { start: D.add(t, -3), end: D.add(t, 40), type: "Implementation", pkgType: "BFS",
        pkgLevel: "3", plannedTotal: 60, plannedWeekly: 12, link: "https://example.my.salesforce.com/assignment" },
      project: { name: "Northwind Labs onboarding", start: D.add(t, 4), end: D.add(t, 38),
        link: "https://example.my.salesforce.com/project" },
      account: { name: "Northwind Labs", website: "https://example.com", linkedin: "https://www.linkedin.com/company/example",
        logo: "", country: "United States", state: "CA", timeZone: "America/Los_Angeles",
        owner: "Priya Raman", link: "https://example.my.salesforce.com/account", contacts: "" },
      track: "BFS-5W",
      kickoff: { rule: C.kickoff.rule, date: D.nextWorkday(D.add(t, 4)) },
      access: { validationStatus: "NonValidated", tenantName: "northwind-prod", needed: "Admin", granted: false },
      links: {}, todo: {},
      items: { "pk-review": { done: true, doneAt: new Date().toISOString() } },
    };
    mem.set(a.id, a);
  }

  window.Store = { D, checklist, flatItems, progress, packageLabel, packageKey, fill, kickoffDate,
    list, save, remove, newId, seedDemo };
})();

