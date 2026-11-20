/* Theme before the first paint: the saved pick (light, dark) or the device's scheme, as the Separation Table does.
   app.js runs the switch. A plain script (not a module), so it runs before the page draws. */
(function () {
  var t = "device"; try { t = JSON.parse(localStorage.getItem("dtgtable.theme")) || "device"; } catch { t = "device"; }
  if (t !== "light" && t !== "dark") t = "device";
  var d = document.documentElement; d.dataset.theme = t;
  d.dataset.scheme = t === "device" ? (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
})();
