/* =====================================================================
   ENGAGEMENT CHECKLIST \u2014 UI
   ===================================================================== */
(function () {
  const C = window.APP_CONFIG, MS = window.MS, S = window.Store, D = S.D, TZ = window.TZ;
  const $ = s => document.querySelector(s);
  const h = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  let cache = [];

  /* ---------------- feedback ---------------- */
  function toast(msg, kind = "ok") {
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`; el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), kind === "err" ? 8000 : 4000);
  }
  window.addEventListener("demo-action", e => toast(`Demo: ${e.detail}`, "demo"));

  async function busy(btn, fn) {
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Working\u2026"; }
    try { return await fn(); }
    catch (e) { console.error(e); toast(e.message || String(e), "err"); }
    finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    document.title = C.appName;
    try { await MS.init(); }
    catch (e) { app.innerHTML = errorPanel("Sign-in could not start", e.message); return; }

    renderHeader();
    if (!MS.account) { app.innerHTML = signInPanel(); return; }

    const access = await MS.checkTeamAccess();
    if (!access.ok) {
      app.innerHTML = errorPanel("This app is limited to your team",
        access.error || "Your account is not in the team group for this app. Ask the app owner to add you.");
      return;
    }
    if (MS.DEMO) S.seedDemo();
    await refresh();
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    route();
  }

  async function refresh() {
    cache = await S.list();
    cache.sort((a, b) => (a.project.start || "").localeCompare(b.project.start || ""));
  }

  function renderHeader() {
    $("#header").innerHTML = `
      <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span>${h(C.appName)}</a>
      <nav class="topnav">
        ${MS.account ? `<a href="#/">Projects</a><a href="#/new" class="btn btn-primary btn-sm">New assignment</a>` : ""}
      </nav>
      <div class="who">
        ${MS.account ? `<span title="${h(MS.account.username)}">${h(MS.account.name || MS.account.username)}</span>
          ${MS.DEMO ? "" : `<button class="btn btn-ghost btn-sm" data-act="signout">Sign out</button>`}` : ""}
      </div>`;
    $("#demo-banner").hidden = !MS.DEMO;
  }

  function signInPanel() {
    return `<section class="center-panel">
      <h1>Sign in with your work account</h1>
      <p>Use your company Microsoft account. Only members of your team can open this app.</p>
      <button class="btn btn-primary" data-act="signin">Sign in with Microsoft</button>
    </section>`;
  }
  function errorPanel(title, msg) {
    return `<section class="center-panel"><h1>${h(title)}</h1><p>${h(msg)}</p></section>`;
  }

  /* ---------------- routing ---------------- */
  function route() {
    const [, view, id] = location.hash.split("/");
    if (view === "new") return renderForm();
    if (view === "edit") return renderForm(cache.find(a => a.id === id));
    if (view === "a") {
      const a = cache.find(x => x.id === id);
      return a ? renderDetail(a) : (app.innerHTML = errorPanel("Assignment not found", "It may have been deleted. Go back to Projects."));
    }
    renderDashboard();
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */
  function renderDashboard() {
    const today = D.today();
    const due = cache.flatMap(a => S.flatItems(a)
      .filter(i => ["overdue", "today", "soon"].includes(i.status))
      .map(i => ({ ...i, a })))
      .sort((x, y) => x.due.localeCompare(y.due));

    app.innerHTML = `
      <section class="dash-head">
        <div>
          <h1>Projects</h1>
          <p class="muted">${cache.length ? `${cache.length} assignment${cache.length > 1 ? "s" : ""} \u00b7 today is ${D.nice(today)}` : "No assignments yet"}</p>
        </div>
        <div class="dash-actions">
          ${cache.length ? `<button class="btn" data-act="digest">Email me a digest</button>` : ""}
          <a class="btn btn-primary" href="#/new">New assignment</a>
        </div>
      </section>

      ${cache.length ? `
      <section class="panel attention">
        <h2>Needs attention</h2>
        ${due.length ? `<ul class="due-list">${due.slice(0, 12).map(i => `
          <li class="due-row s-${i.status}">
            <span class="pill pill-${i.status}">${statusLabel(i.status)}</span>
            <a href="#/a/${i.a.id}">${h(i.title)}</a>
            <span class="muted">${h(i.a.account.name)}</span>
            <span class="due-date">${D.short(i.due)}</span>
          </li>`).join("")}</ul>`
        : `<p class="muted">Nothing due in the next three days.</p>`}
      </section>

      <section class="project-list">
        ${cache.map(projectRow).join("")}
      </section>`
      : `<section class="empty">
          <h2>Add your first assignment</h2>
          <p>Copy the details from the Salesforce assignment, project and account. The checklist, dates and reminders are built from the service package.</p>
          <a class="btn btn-primary" href="#/new">New assignment</a>
        </section>`}`;
  }

  function projectRow(a) {
    const p = S.progress(a);
    const next = S.flatItems(a).filter(i => !i.done && !i.locked).sort((x, y) => x.due.localeCompare(y.due))[0];
    return `<a class="project-row" href="#/a/${a.id}">
      ${logo(a, "logo-sm")}
      <div class="pr-main">
        <strong>${h(a.account.name)}</strong>
        <span class="muted">${h(S.packageLabel(a))} \u00b7 ${h(window.TRACKS[a.track]?.label || a.track)}</span>
      </div>
      <div class="pr-dates"><span>${D.short(a.project.start)} \u2013 ${D.short(a.project.end)}</span></div>
      <div class="pr-next">${next ? `<span class="pill pill-${next.status}">${statusLabel(next.status)}</span> ${h(next.title)}` : `<span class="muted">All done</span>`}</div>
      <div class="pr-progress" title="${p.done} of ${p.total} done"><div class="bar"><i style="width:${p.pct}%"></i></div><span>${p.pct}%</span></div>
    </a>`;
  }

  function logo(a, cls) {
    const initials = (a.account.name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    return a.account.logo
      ? `<img class="${cls}" src="${h(a.account.logo)}" alt="${h(a.account.name)} logo" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} logo-fallback',textContent:'${h(initials)}'}))">`
      : `<span class="${cls} logo-fallback" aria-hidden="true">${h(initials)}</span>`;
  }

  function statusLabel(s) {
    return { overdue: "Overdue", today: "Today", soon: "Soon", later: "Upcoming", done: "Done", locked: "Waiting on access" }[s] || s;
  }

  /* =========================================================
     FORM
     ========================================================= */
  function renderForm(a) {
    const isEdit = !!a;
    a = a || {
      assignment: { pkgType: "BFS", pkgLevel: "1" }, project: {}, account: {},
      kickoff: { rule: C.kickoff.rule }, access: { validationStatus: "NonValidated" },
    };
    const v = (o, k) => h(o?.[k] ?? "");
    const zones = TZ.allZones();

    app.innerHTML = `
      <form id="aform" class="form" novalidate>
        <header class="form-head">
          <h1>${isEdit ? "Edit assignment" : "New assignment"}</h1>
          <p class="muted">Copy these from the Salesforce assignment, project and account records.</p>
        </header>

        <fieldset>
          <legend>Assignment</legend>
          <div class="grid g2">
            ${field("Start date", `<input type="date" name="assignment.start" required value="${v(a.assignment, "start")}">`)}
            ${field("End date", `<input type="date" name="assignment.end" required value="${v(a.assignment, "end")}">`)}
            ${field("Assignment type", `<input name="assignment.type" placeholder="e.g. Implementation" value="${v(a.assignment, "type")}">`)}
            ${field("Service package", `<div class="inline">
                <select name="assignment.pkgType">${["BFS", "BES"].map(t => `<option ${a.assignment.pkgType === t ? "selected" : ""}>${t}</option>`).join("")}</select>
                <select name="assignment.pkgLevel">${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<option ${String(a.assignment.pkgLevel) === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select>
              </div><small id="track-hint" class="hint"></small>`)}
            ${field("Planned hours (total)", `<input type="number" min="0" step="0.5" name="assignment.plannedTotal" value="${v(a.assignment, "plannedTotal")}">`)}
            ${field("Planned hours per week (TMI)", `<input type="number" min="0" step="0.5" name="assignment.plannedWeekly" value="${v(a.assignment, "plannedWeekly")}"><small id="hours-hint" class="hint"></small>`)}
          </div>
          ${field("Assignment link", `<input type="url" name="assignment.link" placeholder="https://\u2026" value="${v(a.assignment, "link")}">`)}
        </fieldset>

        <fieldset>
          <legend>Project</legend>
          ${field("Project name", `<input name="project.name" value="${v(a.project, "name")}">`)}
          <div class="grid g2">
            ${field("Start date", `<input type="date" name="project.start" required value="${v(a.project, "start")}">`)}
            ${field("End date", `<input type="date" name="project.end" required value="${v(a.project, "end")}">`)}
          </div>
          ${field("Project link", `<input type="url" name="project.link" placeholder="https://\u2026" value="${v(a.project, "link")}">`)}
        </fieldset>

        <fieldset>
          <legend>Account</legend>
          <div class="grid g2">
            ${field("Account name", `<input name="account.name" required value="${v(a.account, "name")}">`)}
            ${field("Account owner", `<input name="account.owner" value="${v(a.account, "owner")}">`)}
            ${field("Account link", `<input type="url" name="account.link" placeholder="https://\u2026" value="${v(a.account, "link")}">`)}
            ${field("Client website", `<input type="url" name="account.website" placeholder="https://\u2026" value="${v(a.account, "website")}">`)}
            ${field("LinkedIn page", `<input type="url" name="account.linkedin" placeholder="https://www.linkedin.com/company/\u2026" value="${v(a.account, "linkedin")}">`)}
            ${field("Client contact email(s)", `<input name="account.contacts" placeholder="name@client.com; other@client.com" value="${v(a.account, "contacts")}">`)}
          </div>
          ${field("Logo", `<div class="inline">
              <input type="url" name="account.logo" placeholder="Image URL, or upload a file" value="${a.account.logo?.startsWith("data:") ? "" : v(a.account, "logo")}">
              <label class="btn btn-sm file-btn">Upload<input type="file" accept="image/*" id="logo-file" hidden></label>
            </div><input type="hidden" name="account.logoData" value="${a.account.logo?.startsWith("data:") ? h(a.account.logo) : ""}">
            <small class="hint">Uploads up to 250 KB are stored with the assignment.</small>`)}
          <div class="grid g3">
            ${field("Billing country", `<input name="account.country" list="countries" required value="${v(a.account, "country")}">
              <datalist id="countries">${TZ.COUNTRIES.map(c => `<option value="${h(c)}">`).join("")}</datalist>`)}
            ${field("Billing state / province", `<input name="account.state" placeholder="e.g. CA, Ontario, NSW" value="${v(a.account, "state")}">`)}
            ${field("Client time zone", `<select name="account.timeZone"><option value="">Pick a zone</option>${zones.map(z => `<option ${a.account.timeZone === z ? "selected" : ""}>${h(z)}</option>`).join("")}</select>
              <small id="tz-hint" class="hint"></small>`)}
          </div>
        </fieldset>

        <div class="form-foot">
          <a class="btn btn-ghost" href="${isEdit ? `#/a/${a.id}` : "#/"}">Cancel</a>
          ${isEdit ? `<button type="button" class="btn btn-danger" data-act="delete" data-id="${a.id}">Delete</button>` : ""}
          <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Create checklist"}</button>
        </div>
      </form>`;

    const f = $("#aform");
    const val = n => f.elements[n]?.value;
    let tzTouched = isEdit && !!a.account.timeZone;

    function updateHints() {
      const track = window.resolveTrack(val("assignment.pkgType"), val("assignment.pkgLevel"));
      $("#track-hint").textContent = `Checklist: ${window.TRACKS[track].label}`;
      const tot = +val("assignment.plannedTotal"), wk = +val("assignment.plannedWeekly");
      const s = val("assignment.start"), e = val("assignment.end");
      if (tot && wk && s && e) {
        const weeks = Math.max(1, Math.ceil((D.diff(s, e) + 1) / 7));
        const cap = weeks * wk;
        $("#hours-hint").textContent = `${weeks} weeks \u00d7 ${wk} h = ${cap} h ${cap < tot ? `(${tot - cap} h short of total)` : ""}`;
      } else $("#hours-hint").textContent = "";
      const r = TZ.lookupTimeZone(val("account.country"), val("account.state"));
      if (!tzTouched && r.tz) f.elements["account.timeZone"].value = r.tz;
      const z = f.elements["account.timeZone"].value;
      $("#tz-hint").textContent = z ? `${r.note}${r.confident || tzTouched ? "" : " \u2014 check this"} \u00b7 now ${TZ.formatInZone(new Date(), z, false)}` : r.note;
      $("#tz-hint").classList.toggle("warn", !r.confident && !tzTouched);
    }
    f.addEventListener("input", e => {
      if (e.target.name === "account.timeZone") tzTouched = true;
      if (["account.country", "account.state"].includes(e.target.name)) tzTouched = false;
      updateHints();
    });
    f.addEventListener("change", updateHints);
    updateHints();

    $("#logo-file").addEventListener("change", e => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 250 * 1024) return toast("Logo is larger than 250 KB. Use a smaller image or a URL.", "err");
      const r = new FileReader();
      r.onload = () => { f.elements["account.logoData"].value = r.result; f.elements["account.logo"].value = ""; toast("Logo added"); };
      r.readAsDataURL(file);
    });

    f.addEventListener("submit", async e => {
      e.preventDefault();
      const missing = [...f.querySelectorAll("[required]")].filter(i => !i.value);
      f.querySelectorAll(".invalid").forEach(i => i.classList.remove("invalid"));
      if (missing.length) { missing.forEach(i => i.classList.add("invalid")); missing[0].focus(); return toast("Fill in the highlighted fields.", "err"); }
      if (val("project.end") < val("project.start")) return toast("Project end date is before the start date.", "err");

      const data = structuredClone(a);
      [...f.elements].forEach(el => {
        if (!el.name || !el.name.includes(".")) return;
        const [grp, key] = el.name.split(".");
        data[grp] = data[grp] || {}; data[grp][key] = el.value.trim();
      });
      data.account.logo = data.account.logoData || data.account.logo; delete data.account.logoData;
      const newTrack = window.resolveTrack(data.assignment.pkgType, data.assignment.pkgLevel);
      if (isEdit && data.track !== newTrack) toast("Service package changed, so the checklist was rebuilt. Items completed in both checklists stay completed.");
      data.track = newTrack;
      if (!isEdit) {
        Object.assign(data, { id: S.newId(), createdAt: new Date().toISOString(), createdBy: MS.account.username,
          items: {}, links: {}, todo: {} });
        data.kickoff.date = D.nextWorkday(data.project.start);
      }
      await busy(f.querySelector("[type=submit]"), async () => {
        await S.save(data); await refresh();
        toast(isEdit ? "Changes saved" : "Checklist created");
        location.hash = `#/a/${data.id}`;
      });
    });
  }

  function field(label, control) {
    return `<label class="field"><span>${label}</span>${control}</label>`;
  }

  /* =========================================================
     DETAIL
     ========================================================= */
  function renderDetail(a) {
    const phases = S.checklist(a);
    const p = S.progress(a);
    const tz = a.account.timeZone;
    app.innerHTML = `
      <section class="detail-head">
        ${logo(a, "logo-lg")}
        <div class="dh-main">
          <h1>${h(a.account.name)}</h1>
          <p class="muted">${h(a.project.name || "")}${a.project.name ? " \u00b7 " : ""}${h(S.packageLabel(a))} \u00b7 ${h(window.TRACKS[a.track].label)}</p>
          <div class="chips">
            ${chip("Assignment", a.assignment.link)}${chip("Project", a.project.link)}${chip("Account", a.account.link)}
            ${chip("Website", a.account.website)}${chip("LinkedIn", a.account.linkedin)}
            ${chip("Project folder", a.links?.projectFolder)}${chip("Tracker workbook", a.links?.tracker)}${chip("Slides (Google Drive)", a.links?.googleSlides)}
          </div>
        </div>
        <div class="dh-side">
          <div class="big-progress"><strong>${p.pct}%</strong><span>${p.done} of ${p.total} done</span></div>
          <a class="btn btn-sm" href="#/edit/${a.id}">Edit details</a>
        </div>
      </section>

      ${timeline(a, phases)}

      <div class="detail-grid">
        <section class="checklist">
          ${phases.map(ph => `
            <div class="phase">
              <h2>${h(ph.name)} <span class="muted">${ph.items.filter(i => i.done).length}/${ph.items.length}</span></h2>
              <ul>${ph.items.map(i => itemRow(a, i)).join("")}</ul>
            </div>`).join("")}
        </section>

        <aside class="side">
          <section class="panel" id="p-account">
            <h2>Account</h2>
            <dl class="kv">
              <dt>Owner</dt><dd>${h(a.account.owner || "\u2014")}</dd>
              <dt>Billing</dt><dd>${h([a.account.state, a.account.country].filter(Boolean).join(", ") || "\u2014")}</dd>
              <dt>Time zone</dt><dd>${tz ? `${h(tz)}<br><span class="muted">now ${TZ.formatInZone(new Date(), tz, false)}</span>` : `<span class="warn">Not set \u2014 edit details</span>`}</dd>
              <dt>Assignment</dt><dd>${D.short(a.assignment.start)} \u2013 ${D.short(a.assignment.end)}</dd>
              <dt>Hours</dt><dd>${h(a.assignment.plannedTotal || "\u2014")} total \u00b7 ${h(a.assignment.plannedWeekly || "\u2014")} / week</dd>
              <dt>Type</dt><dd>${h(a.assignment.type || "\u2014")}</dd>
            </dl>
          </section>

          ${kickoffPanel(a)}
          ${accessPanel(a)}

          <section class="panel" id="p-sync">
            <h2>Microsoft 365</h2>
            <p class="muted small">Tasks go to Microsoft To Do with a ${C.user.reminderHour}:00 reminder on the due date. Milestones go to Outlook as all-day events.</p>
            <div class="stack">
              <button class="btn" data-act="pushToDo">${a.todo?.listId ? "Add new tasks to To Do" : "Add checklist to To Do"}</button>
              ${a.todo?.listId ? `<button class="btn" data-act="syncToDo">Get completed tasks from To Do</button>` : ""}
              <button class="btn" data-act="milestones">${a.milestonesAdded ? "Milestones in calendar \u2713 (add again)" : "Add milestones to calendar"}</button>
              <button class="btn" data-act="trackerWorkbook">${a.links?.tracker ? "Rebuild tracker workbook" : "Create tracker workbook"}</button>
              <button class="btn" data-act="copySlides">Copy package slides to project folder</button>
            </div>
            <label class="field small-field"><span>Google Drive slides folder link</span>
              <input type="url" id="gslides" placeholder="https://drive.google.com/\u2026" value="${h(a.links?.googleSlides || "")}"></label>
          </section>
        </aside>
      </div>`;
    app.dataset.id = a.id;
  }

  function chip(label, url) {
    return url ? `<a class="chip" href="${h(url)}" target="_blank" rel="noopener">${h(label)}</a>` : "";
  }

  function itemRow(a, i) {
    const actionBtn = i.action && !i.done && !i.locked ? actionButton(i.action) : "";
    return `<li class="item s-${i.status}">
      <label class="check">
        <input type="checkbox" data-item="${i.id}" ${i.done ? "checked" : ""} ${i.locked ? "disabled" : ""}>
        <span class="item-title">${h(i.title)}</span>
      </label>
      <span class="item-meta">
        ${i.milestone ? `<span class="ms" title="Milestone">\u25c6</span>` : ""}
        ${i.todoTaskId ? `<span class="todo-tag" title="In Microsoft To Do">To Do</span>` : ""}
        <span class="pill pill-${i.status}">${i.done ? `Done` : statusLabel(i.status)}</span>
        <span class="due">${D.short(i.due)}</span>
      </span>
      ${actionBtn ? `<span class="item-action">${actionBtn}</span>` : ""}
    </li>`;
  }

  function actionButton(act) {
    const labels = {
      kickoffEmail: "Create email draft", scheduleKickoff: "Plan meeting", accessRequest: "Request access",
      markAccessGranted: "Mark granted", copySlides: "Copy slides", trackerWorkbook: "Create workbook", pushToDo: "Add to To Do",
    };
    return `<button class="btn btn-sm btn-quiet" data-act="${act}">${labels[act] || act}</button>`;
  }

  /* ---------------- timeline ---------------- */
  function timeline(a, phases) {
    const start = a.assignment.start < a.project.start ? a.assignment.start : a.project.start;
    const end = a.project.end > a.assignment.end ? a.project.end : a.assignment.end;
    const span = Math.max(1, D.diff(start, end));
    const pos = d => Math.min(100, Math.max(0, D.diff(start, d) / span * 100));
    const today = D.today();
    const weeks = [];
    for (let d = a.project.start, n = 1; d <= a.project.end; d = D.add(d, 7), n++) weeks.push({ d, n });
    const ms = phases.flatMap(p => p.items).filter(i => i.milestone);
    const ko = S.kickoffDate(a);

    return `<section class="timeline" aria-label="Project timeline">
      <div class="tl-track">
        <div class="tl-pre" style="left:0;width:${pos(a.project.start)}%"><span>Pre-kickoff</span></div>
        ${weeks.map((w, idx) => {
          const next = weeks[idx + 1] ? weeks[idx + 1].d : a.project.end;
          return `<div class="tl-week ${today >= w.d && today < next ? "current" : ""}" style="left:${pos(w.d)}%;width:${pos(next) - pos(w.d)}%"><span>W${w.n}</span></div>`;
        }).join("")}
        ${ms.map(i => `<span class="tl-ms ${i.done ? "done" : ""}" style="left:${pos(i.due)}%" title="${h(i.title)} \u00b7 ${D.short(i.due)}"></span>`).join("")}
        <span class="tl-kickoff" style="left:${pos(ko)}%" title="Kickoff ${D.short(ko)}"></span>
        ${today >= start && today <= end ? `<span class="tl-today" style="left:${pos(today)}%"><b>Today</b></span>` : ""}
      </div>
      <div class="tl-scale"><span>${D.short(start)}</span><span>Kickoff ${D.short(ko)}</span><span>${D.short(end)}</span></div>
    </section>`;
  }

  /* ---------------- kickoff ---------------- */
  function kickoffTimes(a, rule, date) {
    const ctz = a.account.timeZone || C.user.timeZoneIana;
    const hour = C.kickoff.hour;
    const start = rule === "ist-9am" ? TZ.zonedToUtc(date, hour, 0, C.user.timeZoneIana) : TZ.zonedToUtc(date, hour, 0, ctz);
    const end = new Date(start.getTime() + C.kickoff.durationMinutes * 60000);
    const clientHour = TZ.hourInZone(start, ctz), myHour = TZ.hourInZone(start, C.user.timeZoneIana);
    let warn = "";
    if (clientHour < 8 || clientHour >= 18) warn = "This is outside the client's business hours (8:00\u201318:00).";
    else if (myHour < 7 || myHour >= 21) warn = "This is outside your usual hours in IST. Consider the 9:00 IST rule or another date.";
    return { start, end, client: TZ.formatInZone(start, ctz), mine: TZ.formatInZone(start, C.user.timeZoneIana), warn };
  }

  function kickoffPanel(a) {
    const k = a.kickoff || {};
    const rule = k.rule || C.kickoff.rule;
    const date = k.date || D.nextWorkday(a.project.start);
    const t = kickoffTimes(a, rule, date);
    return `<section class="panel" id="p-kickoff">
      <h2>Kickoff meeting</h2>
      ${k.eventId ? `<p class="ok-note">In your calendar: ${h(TZ.formatInZone(new Date(k.startUtc), C.user.timeZoneIana))}${k.eventLink && k.eventLink !== "#" ? ` \u00b7 <a href="${h(k.eventLink)}" target="_blank" rel="noopener">Open</a>` : ""}</p>` : ""}
      <div class="grid g2">
        <label class="field"><span>Date</span><input type="date" id="ko-date" value="${h(date)}"></label>
        <label class="field"><span>Time rule</span>
          <select id="ko-rule">
            <option value="client-9am" ${rule === "client-9am" ? "selected" : ""}>9:00 client time</option>
            <option value="ist-9am" ${rule === "ist-9am" ? "selected" : ""}>9:00 IST</option>
          </select></label>
      </div>
      <dl class="kv times">
        <dt>Client</dt><dd>${h(t.client)}</dd>
        <dt>You</dt><dd>${h(t.mine)}</dd>
      </dl>
      ${t.warn ? `<p class="warn small">${h(t.warn)}</p>` : ""}
      <label class="field"><span>Invite (optional)</span><input id="ko-attendees" placeholder="name@client.com; \u2026" value="${h(k.attendees ?? a.account.contacts ?? "")}"></label>
      <label class="check small"><input type="checkbox" id="ko-send"> Send invites now (otherwise the event is created only in your calendar)</label>
      <div class="stack">
        <button class="btn btn-primary" data-act="bookKickoff">${k.eventId ? "Add another kickoff event" : "Add kickoff to my calendar"}</button>
        <button class="btn" data-act="kickoffEmail">Create pre-kickoff email draft</button>
      </div>
    </section>`;
  }

  /* ---------------- tenant access ---------------- */
  function accessPanel(a) {
    const x = a.access || {};
    return `<section class="panel ${x.granted ? "panel-done" : ""}" id="p-access">
      <h2>Tenant access ${x.granted ? `<span class="pill pill-done">Granted</span>` : x.requestedAt ? `<span class="pill pill-soon">Requested</span>` : ""}</h2>
      <div class="grid g2">
        <label class="field"><span>Validation status</span>
          <select id="ac-valid">${["NonValidated", "Validated"].map(o => `<option ${x.validationStatus === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
        <label class="field"><span>Tenant name</span><input id="ac-tenant" value="${h(x.tenantName || "")}"></label>
      </div>
      <label class="field"><span>Access needed</span><input id="ac-needed" placeholder="e.g. Admin, read-only" value="${h(x.needed || "")}"></label>
      <label class="field"><span>Access screenshot</span><input type="file" id="ac-shot" accept="image/*"></label>
      <p class="muted small">Assignment link and project end date (${D.nice(a.project.end)}) are added automatically.</p>
      <div class="stack">
        <button class="btn btn-primary" data-act="accessRequest">Create access request draft</button>
        ${x.granted ? "" : `<button class="btn" data-act="markAccessGranted">Mark access granted</button>`}
      </div>
    </section>`;
  }

  /* =========================================================
     ACTIONS
     ========================================================= */
  const current = () => cache.find(x => x.id === app.dataset.id);
  async function persist(a, msg) { await S.save(a); await refresh(); if (msg) toast(msg); route(); }
  function markDone(a, id) { a.items[id] = { ...(a.items[id] || {}), done: true, doneAt: new Date().toISOString() }; }

  const actions = {
    signin: () => MS.signIn(),
    signout: () => MS.signOut(),

    async delete(btn) {
      const a = cache.find(x => x.id === btn.dataset.id);
      if (!confirm(`Delete ${a.account.name}? Items already in To Do and Outlook stay there.`)) return;
      await S.remove(a.id); await refresh(); toast("Assignment deleted"); location.hash = "#/";
    },

    async kickoffEmail() {
      const a = current(); const tpl = window.EMAIL_TEMPLATES.kickoff;
      const k = a.kickoff || {}; const t = kickoffTimes(a, k.rule || C.kickoff.rule, k.date || a.project.start);
      const extra = { kickoffClientTime: t.client, kickoffIstTime: t.mine };
      const link = await MS.createDraft({ subject: S.fill(tpl.subject, a, extra), body: S.fill(tpl.body, a, extra), to: a.account.contacts });
      markDone(a, "pk-mail");
      await persist(a, "Draft saved in Outlook. Review it and send.");
      if (link && link !== "#") window.open(link, "_blank", "noopener");
    },

    scheduleKickoff() { $("#p-kickoff").scrollIntoView({ behavior: "smooth", block: "center" }); $("#ko-date").focus(); },

    async bookKickoff() {
      const a = current();
      const date = $("#ko-date").value, rule = $("#ko-rule").value;
      const attendees = $("#ko-attendees").value.trim(), send = $("#ko-send").checked;
      if (send && !attendees) return toast("Add at least one invitee, or untick \u2018Send invites now\u2019.", "err");
      const t = kickoffTimes(a, rule, date);
      const ev = await MS.createEvent({
        subject: `Kickoff | ${a.account.name} | ${S.packageLabel(a)}`,
        startUtc: t.start, endUtc: t.end, online: C.kickoff.teamsMeeting,
        attendees: send ? attendees : null,
        body: `Client time: ${t.client}\nAssignment: ${a.assignment.link || ""}\nProject: ${a.project.link || ""}\nAccount: ${a.account.link || ""}`,
      });
      a.kickoff = { ...a.kickoff, rule, date, attendees, startUtc: t.start.toISOString(), eventId: ev.id, eventLink: ev.webLink };
      markDone(a, "pk-meet");
      await persist(a, send ? "Kickoff added and invites sent" : "Kickoff added to your calendar");
    },

    async accessRequest() {
      const a = current();
      a.access = { ...a.access, validationStatus: $("#ac-valid").value, tenantName: $("#ac-tenant").value.trim(), needed: $("#ac-needed").value.trim() };
      if (!a.access.tenantName) return toast("Enter the tenant name first.", "err");
      const file = $("#ac-shot").files[0];
      const attachments = [];
      if (file) {
        if (file.size > 3 * 1024 * 1024) return toast("Screenshot is over 3 MB. Use a smaller image.", "err");
        const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(file); });
        attachments.push({ name: file.name, type: file.type, base64: b64 });
      }
      const tpl = window.EMAIL_TEMPLATES.accessRequest;
      const link = await MS.createDraft({ subject: S.fill(tpl.subject, a), body: S.fill(tpl.body, a),
        to: C.accessRequest.to, cc: C.accessRequest.cc, attachments });
      a.access.requestedAt = new Date().toISOString();
      markDone(a, "ac-request");
      await persist(a, file ? "Access request draft saved with screenshot" : "Access request draft saved. Attach the screenshot before sending.");
      if (link && link !== "#") window.open(link, "_blank", "noopener");
    },

    async markAccessGranted() {
      const a = current();
      a.access = { ...a.access, granted: true, grantedAt: new Date().toISOString() };
      markDone(a, "ac-granted");
      await persist(a, "Access granted. Setup tasks are unlocked.");
    },

    async copySlides() {
      const a = current(); const key = S.packageKey(a);
      const src = C.slideTemplates[key];
      if (!src) return toast(`No slide template set for ${key}. Add it under slideTemplates in config.js, or paste the Google Drive link below.`, "err");
      const folder = projectFolder(a);
      const name = `${a.account.name} - ${src.split("/").pop()}`;
      const url = await MS.copyFromPath(src, folder, name);
      a.links = { ...a.links, projectFolder: url !== "#" ? url : a.links?.projectFolder };
      markDone(a, "st-slides");
      await persist(a, "Slides copied to the project folder");
    },

    async trackerWorkbook() {
      const a = current();
      const wb = buildWorkbook(a);
      const fname = `${safe(a.account.name)} - ${S.packageLabel(a)} - Tracker.xlsx`;
      const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      if (MS.DEMO) {
        XLSX.writeFile(wb, fname); toast("Demo: workbook downloaded instead of uploaded", "demo");
      } else {
        const r = await MS.putFile(`${projectFolder(a)}/${fname}`, new Blob([bytes]),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        a.links = { ...a.links, tracker: r.webUrl };
      }
      markDone(a, "pk-tracker");
      await persist(a, "Tracker workbook saved");
    },

    async pushToDo(btn) {
      const a = current();
      a.todo = a.todo || {};
      if (!a.todo.listId) a.todo.listId = await MS.createTodoList(`${a.account.name} \u00b7 ${S.packageLabel(a)}`);
      const pending = S.flatItems(a).filter(i => !i.done && !i.todoTaskId);
      let n = 0;
      for (const i of pending) {
        if (btn) btn.textContent = `Adding ${++n} of ${pending.length}\u2026`;
        const id = await MS.createTodoTask(a.todo.listId, {
          title: `${i.title} \u2014 ${a.account.name}`, due: i.due,
          note: `${i.phase}${i.locked ? " (after tenant access)" : ""}\nAssignment: ${a.assignment.link || ""}\nProject: ${a.project.link || ""}`,
        });
        a.items[i.id] = { ...(a.items[i.id] || {}), todoTaskId: id };
      }
      markDone(a, "pk-todo");
      await persist(a, pending.length ? `${pending.length} tasks added to To Do with reminders` : "To Do is already up to date");
    },

    async syncToDo() {
      const a = current();
      const tasks = await MS.getTodoTasks(a.todo.listId);
      const byId = new Map(tasks.map(t => [t.id, t]));
      let changed = 0;
      Object.entries(a.items).forEach(([id, st]) => {
        const t = st.todoTaskId && byId.get(st.todoTaskId);
        if (t && (t.status === "completed") !== !!st.done) {
          a.items[id] = { ...st, done: t.status === "completed", doneAt: t.status === "completed" ? new Date().toISOString() : null };
          changed++;
        }
      });
      await persist(a, changed ? `${changed} item${changed > 1 ? "s" : ""} updated from To Do` : "Already in sync with To Do");
    },

    async milestones() {
      const a = current();
      const ms = S.flatItems(a).filter(i => i.milestone && !i.done && i.id !== "pk-meet");
      for (const i of ms) {
        await MS.createEvent({ subject: `\u25c6 ${a.account.name}: ${i.title}`, allDayDate: i.due,
          body: `${i.phase}\nProject: ${a.project.link || ""}` });
      }
      a.milestonesAdded = true;
      await persist(a, `${ms.length} milestones added to your calendar`);
    },

    async digest() {
      const rows = cache.flatMap(a => S.flatItems(a).filter(i => ["overdue", "today", "soon"].includes(i.status)).map(i => ({ ...i, a })))
        .sort((x, y) => x.due.localeCompare(y.due));
      if (!rows.length) return toast("Nothing due in the next three days, so no digest was sent.");
      const url = location.origin + location.pathname;
      const html = `<p>Checklist items due soon (${D.nice(D.today())}):</p><table cellpadding="6" style="border-collapse:collapse">
        ${rows.map(r => `<tr><td><b>${statusLabel(r.status)}</b></td><td>${D.short(r.due)}</td><td>${h(r.a.account.name)}</td><td>${h(r.title)}</td></tr>`).join("")}
        </table><p><a href="${url}">Open ${h(C.appName)}</a></p>`;
      await MS.sendToSelf(`${C.appName}: ${rows.length} item${rows.length > 1 ? "s" : ""} due`, html);
      toast("Digest sent to your inbox");
    },
  };

  function projectFolder(a) { return `Projects/${safe(a.account.name)} - ${S.packageLabel(a)}`; }
  function safe(s) { return String(s || "").replace(/[\\/:*?"<>|#%]/g, "-").trim(); }

  function buildWorkbook(a) {
    const wb = XLSX.utils.book_new();
    const overview = [
      ["Field", "Value"],
      ["Account", a.account.name], ["Account owner", a.account.owner], ["Website", a.account.website],
      ["LinkedIn", a.account.linkedin], ["Billing", [a.account.state, a.account.country].filter(Boolean).join(", ")],
      ["Client time zone", a.account.timeZone], ["Account link", a.account.link],
      ["Project", a.project.name], ["Project start", a.project.start], ["Project end", a.project.end], ["Project link", a.project.link],
      ["Assignment start", a.assignment.start], ["Assignment end", a.assignment.end], ["Assignment type", a.assignment.type],
      ["Service package", S.packageLabel(a)], ["Checklist", window.TRACKS[a.track].label],
      ["Planned hours (total)", Number(a.assignment.plannedTotal) || ""], ["Planned hours / week", Number(a.assignment.plannedWeekly) || ""],
      ["Assignment link", a.assignment.link], ["Tenant", a.access?.tenantName], ["Tenant access granted", a.access?.granted ? "Yes" : "No"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(overview); ws1["!cols"] = [{ wch: 24 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Overview");

    const rows = [["Phase", "Activity", "Due", "Status", "Milestone", "Completed on", "Notes"]];
    S.flatItems(a).forEach(i => rows.push([i.phase, i.title, i.due, i.done ? "Done" : statusLabel(i.status), i.milestone ? "Yes" : "", i.doneAt ? i.doneAt.slice(0, 10) : "", ""]));
    const ws2 = XLSX.utils.aoa_to_sheet(rows); ws2["!cols"] = [{ wch: 16 }, { wch: 55 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Checklist");

    const weekly = [["Week", "Week starting", "Planned hours", "Actual hours", "Notes"]];
    for (let d = a.project.start, n = 1; d <= a.project.end; d = D.add(d, 7), n++) weekly.push([n, d, Number(a.assignment.plannedWeekly) || "", "", ""]);
    const ws3 = XLSX.utils.aoa_to_sheet(weekly); ws3["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Weekly hours");
    return wb;
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const fn = actions[btn.dataset.act];
    if (!fn) return;
    e.preventDefault();
    busy(btn, () => fn(btn));
  });

  document.addEventListener("change", async e => {
    const cb = e.target.closest("input[data-item]");
    if (cb) {
      const a = current(); const id = cb.dataset.item; const st = a.items[id] || {};
      a.items[id] = { ...st, done: cb.checked, doneAt: cb.checked ? new Date().toISOString() : null };
      try {
        if (st.todoTaskId && a.todo?.listId) await MS.setTodoStatus(a.todo.listId, st.todoTaskId, cb.checked);
        await persist(a);
      } catch (err) { toast(err.message, "err"); }
      return;
    }
    if (e.target.id === "ko-date" || e.target.id === "ko-rule") {
      const a = current();
      a.kickoff = { ...a.kickoff, date: $("#ko-date").value, rule: $("#ko-rule").value, attendees: $("#ko-attendees").value };
      await persist(a);
      $("#p-kickoff")?.scrollIntoView({ block: "center" });
    }
    if (e.target.id === "gslides") {
      const a = current(); a.links = { ...a.links, googleSlides: e.target.value.trim() };
      await persist(a, "Google Drive link saved");
    }
  });

  boot();
})();

