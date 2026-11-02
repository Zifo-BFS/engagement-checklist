/* =====================================================================
   CHECKLIST + EMAIL TEMPLATES
   This is the file you edit to match your real process.

   Each checklist item:
     id          unique within the track
     title       what you will see
     anchor      date it is counted from:
                 "assignmentStart" | "projectStart" | "projectEnd" | "kickoff"
     offsetDays  calendar days after (+) or before (-) the anchor
     action      optional built-in button (see list below)
     gate        "accessGranted" = stays locked until tenant access is granted
     milestone   true = also added to your Outlook calendar

   Built-in actions:
     kickoffEmail, scheduleKickoff, accessRequest, markAccessGranted,
     copySlides, trackerWorkbook, pushToDo

   Items marked PLACEHOLDER are examples only. Replace them with your
   BFS 1\u20135 (5-week), BFS 6\u201310 (13-week) and BES activity lists.
   ===================================================================== */
(function () {
  const wk = (week, day = 0) => (week - 1) * 7 + day; // week 1 = project start

  const preKickoff = {
    name: "Pre-kickoff",
    items: [
      { id: "pk-review", title: "Review assignment, project and account in Salesforce", anchor: "assignmentStart", offsetDays: 0 },
      { id: "pk-tracker", title: "Create project tracker workbook", anchor: "assignmentStart", offsetDays: 0, action: "trackerWorkbook" },
      { id: "pk-mail", title: "Send pre-kickoff email to the client", anchor: "assignmentStart", offsetDays: 1, action: "kickoffEmail" },
      { id: "pk-meet", title: "Schedule kickoff meeting", anchor: "assignmentStart", offsetDays: 1, action: "scheduleKickoff", milestone: true },
      { id: "pk-todo", title: "Add checklist to Microsoft To Do", anchor: "assignmentStart", offsetDays: 1, action: "pushToDo" },
      { id: "pk-followup", title: "Follow up if no reply to pre-kickoff email", anchor: "assignmentStart", offsetDays: 3 },
    ],
  };

  const access = {
    name: "Tenant access",
    items: [
      { id: "ac-request", title: "Request access to client tenant", anchor: "assignmentStart", offsetDays: 1, action: "accessRequest" },
      { id: "ac-granted", title: "Confirm tenant access granted", anchor: "assignmentStart", offsetDays: 4, action: "markAccessGranted" },
    ],
  };

  const setup = {
    name: "After access",
    items: [
      { id: "st-tenant", title: "Set up tenant", anchor: "kickoff", offsetDays: -1, gate: "accessGranted" },
      { id: "st-slides", title: "Copy service-package slides to project folder", anchor: "kickoff", offsetDays: -2, action: "copySlides", gate: "accessGranted" },
      { id: "st-prep", title: "Prepare kickoff slides", anchor: "kickoff", offsetDays: -1, gate: "accessGranted" },
    ],
  };

  window.TRACKS = {
    "BFS-5W": {
      label: "BFS 1\u20135 \u00b7 5-week implementation",
      weeks: 5,
      phases: [
        preKickoff, access, setup,
        { name: "Implementation", items: [
          // PLACEHOLDER \u2014 replace with your 5-week activity list
          { id: "i1", title: "Week 1: Kickoff and discovery (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(1), milestone: true },
          { id: "i2", title: "Week 2: Configuration (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(2) },
          { id: "i3", title: "Week 3: Build and validation (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(3) },
          { id: "i4", title: "Week 4: UAT and training (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(4) },
          { id: "i5", title: "Week 5: Go-live and handover (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(5), milestone: true },
        ]},
        { name: "Close-out", items: [
          { id: "c1", title: "Close-out summary and hours reconciliation", anchor: "projectEnd", offsetDays: -2 },
          { id: "c2", title: "Remove tenant access / confirm offboarding", anchor: "projectEnd", offsetDays: 0, milestone: true },
        ]},
      ],
    },

    "BFS-13W": {
      label: "BFS 6\u201310 \u00b7 13-week implementation",
      weeks: 13,
      phases: [
        preKickoff, access, setup,
        { name: "Implementation", items: [
          // PLACEHOLDER \u2014 replace with your 13-week activity list
          { id: "i1", title: "Weeks 1\u20132: Kickoff and discovery (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(1), milestone: true },
          { id: "i2", title: "Weeks 3\u20135: Solution design (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(3) },
          { id: "i3", title: "Weeks 6\u20139: Build and configuration (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(6), milestone: true },
          { id: "i4", title: "Weeks 10\u201311: Testing and UAT (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(10) },
          { id: "i5", title: "Week 12: Training (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(12) },
          { id: "i6", title: "Week 13: Go-live and hypercare (PLACEHOLDER)", anchor: "projectStart", offsetDays: wk(13), milestone: true },
        ]},
        { name: "Close-out", items: [
          { id: "c1", title: "Close-out summary and hours reconciliation", anchor: "projectEnd", offsetDays: -2 },
          { id: "c2", title: "Remove tenant access / confirm offboarding", anchor: "projectEnd", offsetDays: 0, milestone: true },
        ]},
      ],
    },

    "BES": {
      label: "BES",
      weeks: null,
      phases: [
        preKickoff, access, setup,
        { name: "Delivery", items: [
          // PLACEHOLDER \u2014 replace with your BES activity list
          { id: "b1", title: "BES activity 1 (PLACEHOLDER)", anchor: "projectStart", offsetDays: 0, milestone: true },
          { id: "b2", title: "BES activity 2 (PLACEHOLDER)", anchor: "projectStart", offsetDays: 7 },
        ]},
        { name: "Close-out", items: [
          { id: "c1", title: "Close-out summary and hours reconciliation", anchor: "projectEnd", offsetDays: -2 },
        ]},
      ],
    },
  };

  /* Which track a service package uses */
  window.resolveTrack = function (pkgType, pkgLevel) {
    if (pkgType === "BES") return "BES";
    const n = Number(pkgLevel);
    return n >= 6 ? "BFS-13W" : "BFS-5W";
  };

  /* ---- Email templates (replace with your sample content) ----------
     Tokens in {{double braces}} are filled from the assignment.        */
  window.EMAIL_TEMPLATES = {
    kickoff: {
      subject: "{{clientName}} | {{servicePackage}} | Pre-kickoff",
      body:
`Hi {{accountOwner}} team,

I've been assigned as your consultant for {{servicePackage}}, running from {{projectStart}} to {{projectEnd}}.

I'd like to schedule our kickoff for {{kickoffClientTime}} ({{kickoffIstTime}}). Please let me know if that works, or suggest a better time.

Ahead of the kickoff, it would help to have:
- Key stakeholders and their roles
- Your goals for this engagement
- Any access or security steps we should plan for

Looking forward to working with you.

Regards,
{{myName}}`,
    },

    accessRequest: {
      subject: "Tenant access request | {{clientName}} | {{tenantName}}",
      body:
`Hi team,

Please grant access to the following tenant.

Validation status: {{validationStatus}}
Tenant name: {{tenantName}}
Access needed: {{accessNeeded}}
Assignment link: {{assignmentLink}}
Access required until (project end): {{projectEnd}}

Access screenshot attached.

Thanks,
{{myName}}`,
    },
  };
})();

