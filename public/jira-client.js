(function () {
  function normalizeAtlassianDomain(input) {
    var trimmed = String(input || "").trim();
    if (!trimmed) return "";
    var host = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host.indexOf(".") === -1) {
      host = host + ".atlassian.net";
    }
    return host.toLowerCase();
  }

  function normalizeProjectId(input) {
    return String(input || "").trim().replace(/\D/g, "");
  }

  function buildSummary(payload) {
    var summary = "[Sync Scope] " + payload.severity + " · " + payload.category + ": " + payload.message;
    return summary.length > 240 ? summary.slice(0, 237) + "..." : summary;
  }

  function buildDescription(payload) {
    var lines = [
      "h2. Sync Scope comparison issue",
      "",
      "*Severity:* " + payload.severity,
      "*Category:* " + payload.category,
      "*Message:* " + payload.message
    ];

    if (payload.pageName) lines.push("*Page:* " + payload.pageName);
    if (payload.prodUrl) lines.push("*Live URL:* " + payload.prodUrl);
    if (payload.devUrl) lines.push("*Migration URL:* " + payload.devUrl);
    if (payload.url) lines.push("*Related URL:* " + payload.url);
    if (payload.prodValue) lines.push("*Live value:* " + payload.prodValue);
    if (payload.devValue) lines.push("*Migration value:* " + payload.devValue);
    if (payload.reportUrl) lines.push("*Report:* " + payload.reportUrl);
    lines.push("", "_Created from Sync Scope report_");
    return lines.join("\n");
  }

  function buildCreateIssueUrl(settings, payload) {
    var host = normalizeAtlassianDomain(settings.jiraAtlassianDomain || settings.atlassianDomain);
    if (!host) {
      throw new Error("Configure your Jira domain in Settings.");
    }

    var params = new URLSearchParams({
      summary: buildSummary(payload),
      description: buildDescription(payload)
    });

    var projectId = normalizeProjectId(settings.jiraProjectId || settings.projectId);
    if (projectId) {
      params.set("pid", projectId);
    }

    return "https://" + host + "/secure/CreateIssueDetails!init.jspa?" + params.toString();
  }

  var settingsCache = null;
  var settingsPromise = null;

  function loadSettings() {
    if (settingsCache) return Promise.resolve(settingsCache);
    if (settingsPromise) return settingsPromise;

    settingsPromise = fetch("/api/settings")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load Jira settings");
        return response.json();
      })
      .then(function (data) {
        settingsCache = data;
        return data;
      })
      .finally(function () {
        settingsPromise = null;
      });

    return settingsPromise;
  }

  function parseIssuePayload(button) {
    var raw = button.getAttribute("data-issue");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var button = target.closest(".jira-create-btn");
    if (!button) return;

    event.preventDefault();
    var payload = parseIssuePayload(button);
    if (!payload) return;

    if (!payload.reportUrl) {
      payload.reportUrl = window.location.href;
    }

    button.disabled = true;
    loadSettings()
      .then(function (settings) {
        var url = buildCreateIssueUrl(settings, payload);
        window.open(url, "_blank", "noopener,noreferrer");
      })
      .catch(function (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
