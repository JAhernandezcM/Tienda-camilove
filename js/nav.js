// Menú móvil compartido
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("mobile-menu-btn");
  var panel = document.getElementById("mobile-menu-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", function () {
    panel.classList.toggle("hidden");
  });
});
