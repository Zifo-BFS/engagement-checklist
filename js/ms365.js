/* =====================================================================
   MICROSOFT 365 LAYER \u2014 sign-in (MSAL) + Microsoft Graph calls.
   In demo mode every call is simulated and logged; nothing leaves the browser.
   ===================================================================== */
(function () {
  const C = window.APP_CONFIG;
  const DEMO = !C.auth.clientId || C.auth.clientId === "YOUR-CLIENT-ID";
  const GRAPH = "https://graph.microsoft.com/v1.0";
  let msalApp = null, account = null;

  /* ---------------- auth ---------------- */
  async function init() {
    if (DEMO) {
      account = { name: "Demo User", username: "demo.user@yourcompany.com" };
      return account;
    }
    msalApp = new msal.PublicClientApplication({
      auth: {
        clientId: C.auth.clientId,
        authority: `https://login.microsoftonline.com/${C.auth.tenantId}`,
        redirectUri: C.auth.redirectUri,
      },
      cache: { cacheLocation: "sessionStorage" }, // cleared when the tab closes
    });
    await msalApp.initialize();
    const res = await msalApp.handleRedirectPromise();
    if (res && res.account) account = res.account;
    else account = msalApp.getAllAccounts()[0] || null;
    if (account) msalApp.setActiveAccount(account);
    return account;
  }

  function signIn() { return msalApp.loginRedirect({ scopes: C.scopes }); }
  function signOut() { return msalApp.logoutRedirect({ account }); }

  async function token() {
    try {
      const r = await msalApp.acquireTokenSilent({ scopes: C.scopes, account });
      return r.accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) {
        await msalApp.acquireTokenRedirect({ scopes: C.scopes, account });
      }
      throw e;
    }
  }

  async function graph(method, path, body, opts = {}) {
    const headers = { Authorization: `Bearer ${await token()}` };
    let payload = body;
    if (body && !(body instanceof ArrayBuffer) && !(body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    } else if (body) {
      headers["Content-Type"] = opts.contentType || "application/octet-stream";
    }
    const res = await fetch(path.startsWith("http") ? path : GRAPH + path, { method, headers, body: payload });
    if (res.status === 204 || res.status === 202) return null;
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg = j.error?.message || msg; } catch {}
      const err = new Error(`Microsoft Graph: ${msg}`); err.status = res.status; throw err;
    }
    if (opts.raw) return res;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("json") ? res.json() : res.text();
  }

  /* ---------------- access check ---------------- */
  async function checkTeamAccess() {
    if (DEMO || !C.allowedGroupIds.length) return { ok: true };
    try {
      const r = await graph("POST", "/me/checkMemberGroups", { groupIds: C.allowedGroupIds });
      return { ok: (r.value || []).length > 0 };
    } catch (e) {
      return { ok: false, error: "The team membership check could not run. Ask your admin to grant GroupMember.Read.All, or clear allowedGroupIds in config.js." };
    }
  }

  /* ---------------- storage (OneDrive / SharePoint) ---------------- */
  function driveBase() {
    return C.storage.type === "shared" ? `/drives/${C.storage.driveId}` : "/me/drive";
  }
  const enc = p => p.split("/").map(encodeURIComponent).join("/");
  const rootPath = sub => enc(`${C.storage.rootFolder}/${sub}`);

  async function putFile(subPath, data, contentType) {
    return graph("PUT", `${driveBase()}/root:/${rootPath(subPath)}:/content`, data, { contentType });
  }
  async function getFileJson(subPath) {
    const r = await graph("GET", `${driveBase()}/root:/${rootPath(subPath)}:/content`, null, { raw: true });
    return r.json();
  }
  async function listFolder(subPath) {
    try {
      const r = await graph("GET", `${driveBase()}/root:/${rootPath(subPath)}:/children?$top=999&$select=name,id,webUrl`);
      return r.value || [];
    } catch (e) { if (e.status === 404) return []; throw e; }
  }
  async function deleteFile(subPath) {
    return graph("DELETE", `${driveBase()}/root:/${rootPath(subPath)}`);
  }
  async function getItem(subPath) {
    return graph("GET", `${driveBase()}/root:/${rootPath(subPath)}`);
  }
  async function ensureFolder(subPath) {
    // upload a tiny marker to force folder creation, then return the folder
    await putFile(`${subPath}/.keep`, new Blob(["keep"]), "text/plain");
    return getItem(subPath);
  }
  async function copyFromPath(sourcePath, destFolderSub, newName) {
    const folder = await ensureFolder(destFolderSub);
    const driveId = folder.parentReference.driveId;
    await graph("POST", `${driveBase()}/root:/${enc(sourcePath)}:/copy`, {
      parentReference: { driveId, id: folder.id }, name: newName,
    });
    return folder.webUrl;
  }

  /* ---------------- mail ---------------- */
  const recips = s => (s || "").split(/[;,]/).map(x => x.trim()).filter(Boolean)
    .map(address => ({ emailAddress: { address } }));

  async function createDraft({ subject, body, to, cc, attachments = [] }) {
    const msg = await graph("POST", "/me/messages", {
      subject, body: { contentType: "Text", content: body },
      toRecipients: recips(to), ccRecipients: recips(cc),
      attachments: attachments.map(a => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name, contentType: a.type, contentBytes: a.base64,
      })),
    });
    return msg.webLink;
  }
  async function sendToSelf(subject, html) {
    return graph("POST", "/me/sendMail", {
      message: { subject, body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: account.username } }] },
      saveToSentItems: false,
    });
  }

  /* ---------------- calendar ---------------- */
  async function createEvent({ subject, startUtc, endUtc, body, attendees, online, allDayDate }) {
    const ev = { subject, body: { contentType: "Text", content: body || "" }, isReminderOn: true };
    if (allDayDate) {
      const next = new Date(allDayDate + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      Object.assign(ev, {
        isAllDay: true, showAs: "free", reminderMinutesBeforeStart: 15 * 60,
        start: { dateTime: allDayDate + "T00:00:00", timeZone: C.user.timeZoneWindows },
        end: { dateTime: next.toISOString().slice(0, 10) + "T00:00:00", timeZone: C.user.timeZoneWindows },
      });
    } else {
      Object.assign(ev, {
        reminderMinutesBeforeStart: 30,
        start: { dateTime: startUtc.toISOString().slice(0, 19), timeZone: "UTC" },
        end: { dateTime: endUtc.toISOString().slice(0, 19), timeZone: "UTC" },
      });
      if (attendees) ev.attendees = recips(attendees).map(r => ({ ...r, type: "required" }));
      if (online) Object.assign(ev, { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" });
    }
    const r = await graph("POST", "/me/events", ev);
    return { id: r.id, webLink: r.webLink };
  }

  /* ---------------- To Do ---------------- */
  async function createTodoList(name) {
    const r = await graph("POST", "/me/todo/lists", { displayName: name });
    return r.id;
  }
  async function createTodoTask(listId, { title, due, note }) {
    const hh = String(C.user.reminderHour).padStart(2, "0");
    const r = await graph("POST", `/me/todo/lists/${listId}/tasks`, {
      title, body: { content: note || "", contentType: "text" },
      dueDateTime: { dateTime: `${due}T00:00:00`, timeZone: C.user.timeZoneWindows },
      isReminderOn: true,
      reminderDateTime: { dateTime: `${due}T${hh}:00:00`, timeZone: C.user.timeZoneWindows },
    });
    return r.id;
  }
  async function setTodoStatus(listId, taskId, done) {
    return graph("PATCH", `/me/todo/lists/${listId}/tasks/${taskId}`, { status: done ? "completed" : "notStarted" });
  }
  async function getTodoTasks(listId) {
    const out = []; let url = `/me/todo/lists/${listId}/tasks?$top=100`;
    while (url) { const r = await graph("GET", url); out.push(...(r.value || [])); url = r["@odata.nextLink"] || null; }
    return out;
  }

  /* ---------------- demo-mode stand-ins ---------------- */
  const demoLog = [];
  const sim = (label, ret) => async (...args) => {
    demoLog.push({ at: new Date(), label, detail: args[0] });
    window.dispatchEvent(new CustomEvent("demo-action", { detail: label }));
    return typeof ret === "function" ? ret(...args) : ret;
  };
  let n = 0;

  const real = { putFile, getFileJson, listFolder, deleteFile, ensureFolder, copyFromPath,
    createDraft, sendToSelf, createEvent, createTodoList, createTodoTask, setTodoStatus, getTodoTasks };
  const demo = {
    putFile: null, getFileJson: null, listFolder: null, deleteFile: null, // demo store handles data
    ensureFolder: sim("Created project folder", { webUrl: "#" }),
    copyFromPath: sim("Copied slide template to project folder", "#"),
    createDraft: sim("Created Outlook draft", "#"),
    sendToSelf: sim("Sent digest email to you", null),
    createEvent: sim("Created Outlook calendar event", () => ({ id: "demo-ev-" + (++n), webLink: "#" })),
    createTodoList: sim("Created Microsoft To Do list", () => "demo-list-" + (++n)),
    createTodoTask: sim("Created To Do task with reminder", () => "demo-task-" + (++n)),
    setTodoStatus: sim("Updated To Do task status", null),
    getTodoTasks: sim("Read To Do tasks", []),
  };

  window.MS = Object.assign({
    DEMO, init, signIn, signOut, checkTeamAccess, demoLog,
    get account() { return account; },
  }, DEMO ? demo : real);
})();

