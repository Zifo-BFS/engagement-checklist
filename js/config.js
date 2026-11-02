/* =====================================================================
   ENGAGEMENT CHECKLIST \u2014 CONFIGURATION
   Edit this file after registering the app in Microsoft Entra ID.
   Nothing here is secret: a browser (SPA) app only needs the client ID.
   ===================================================================== */
window.APP_CONFIG = {
  appName: "Engagement Checklist",

  /* ---- Microsoft Entra ID (Azure AD) app registration ---------------
     Leave clientId as "YOUR-CLIENT-ID" to run in DEMO MODE
     (no sign-in, data kept in memory only, Microsoft actions simulated). */
  auth: {
    clientId: "YOUR-CLIENT-ID",
    tenantId: "YOUR-TENANT-ID",          // your company tenant (never "common")
    // Redirect URI must also be added in Entra > Authentication > SPA
    redirectUri: window.location.origin + window.location.pathname,
  },

  /* Delegated Microsoft Graph permissions (least privilege for the features) */
  scopes: [
    "User.Read",
    "Calendars.ReadWrite",   // kickoff meeting + milestone events
    "Tasks.ReadWrite",       // Microsoft To Do lists, tasks and reminders
    "Mail.ReadWrite",        // create email DRAFTS (you review and send)
    "Mail.Send",             // only used to send the digest to yourself
    "Files.ReadWrite.All",   // project folder, tracker workbook, slide copies
  ],

  /* ---- Team-only access ---------------------------------------------
     Primary control: in Entra > Enterprise applications > this app,
     set "Assignment required = Yes" and assign only your team's group.
     Optional second check inside the app (needs GroupMember.Read.All
     added to scopes above). Leave empty to skip. */
  allowedGroupIds: [],

  /* ---- Where data is stored -----------------------------------------
     "onedrive"  -> your own OneDrive (only you)
     "shared"    -> a SharePoint document library shared with your team
                    (set driveId; see README for how to find it)        */
  storage: {
    type: "onedrive",
    driveId: "",                          // required when type = "shared"
    rootFolder: "EngagementChecklist",    // folder created in that drive
  },

  /* ---- Your working time zone ---------------------------------------- */
  user: {
    timeZoneIana: "Asia/Kolkata",
    timeZoneWindows: "India Standard Time",
    reminderHour: 9,                      // To Do reminder time (local)
  },

  /* ---- Kickoff meeting rule -----------------------------------------
     "client-9am" : 9:00 AM in the client's billing-address time zone
     "ist-9am"    : 9:00 AM IST, with a check against client business hours
     Can also be switched per assignment in the app. */
  kickoff: {
    rule: "client-9am",
    hour: 9,
    durationMinutes: 60,
    teamsMeeting: true,                   // attach a Teams link to the event
  },

  /* ---- Tenant access request ---------------------------------------- */
  accessRequest: {
    to: "",                               // e.g. access-team@yourcompany.com
    cc: "",
  },

  /* ---- Slide templates per service package ---------------------------
     Paths are inside the same drive as storage above.
     Example: "BFS-1": "Templates/Slides/BFS-1 Deck.pptx"               */
  slideTemplates: {
    // "BFS-1": "Templates/Slides/BFS-1 Deck.pptx",
  },
};

