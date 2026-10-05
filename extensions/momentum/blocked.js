document.querySelector("#blocked-back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});

document.querySelector("#blocked-unblock").addEventListener("click", async () => {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rules.map((rule) => rule.id) });
  document.querySelector(".blocked-note").textContent = "Sites unblocked. Go back and reload the page.";
});