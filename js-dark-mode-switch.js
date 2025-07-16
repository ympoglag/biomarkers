function SetupDarkModeSwitch() {
  // Restore dark mode if saved
  if (localStorage.getItem("bmt_dark") === "1") {
    document.body.classList.add("dark");
    document.querySelector(".topbar").classList.add("dark");
  }
  // Toggle button
  document.getElementById("darkToggle").onclick = function () {
    document.body.classList.toggle("dark");
    document.querySelector(".topbar").classList.toggle("dark");
    if (document.body.classList.contains("dark")) {
      localStorage.setItem("bmt_dark", "1");
    } else {
      localStorage.removeItem("bmt_dark");
    }
  };
}
