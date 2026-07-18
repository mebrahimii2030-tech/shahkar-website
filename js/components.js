async function loadComponent(id, file) {
  const element = document.getElementById(id);

  if (!element) return;

  try {
    const response = await fetch(file);

    if (!response.ok) return;

    element.innerHTML = await response.text();

    if (id === "header") {
      const script = document.createElement("script");
      script.src = "js/menu.js";
      document.body.appendChild(script);
    }
  } catch (err) {
    console.error(err);
  }
}

loadComponent("header", "components/header.html");
loadComponent("footer", "components/footer.html");
