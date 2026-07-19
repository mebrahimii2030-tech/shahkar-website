async function loadComponent(id, file) {
  const element = document.getElementById(id);

  if (!element) return;

  const response = await fetch(file);

  element.innerHTML = await response.text();

  if (id === "header") {
    initMenu();
  }
}

loadComponent("header", "components/header.html");
loadComponent("footer", "components/footer.html");
