const fs = require("fs");
const path = require("path");

const root = __dirname;

// فایل‌هایی که نباید دست بخورند
const ignore = ["header.html", "footer.html", "404.html"];

function walk(dir) {
  let files = [];

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (file.endsWith(".html") && !ignore.includes(file)) {
      files.push(full);
    }
  }

  return files;
}

const pages = walk(root);

pages.forEach((file) => {
  let html = fs.readFileSync(file, "utf8");

  console.log("Processing:", path.basename(file));

  // حذف هدر
  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  // حذف فوتر
  html = html.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // حذف تکراری‌ها
  html = html.replace(/<div id="header"><\/div>/gi, "");

  html = html.replace(/<div id="footer"><\/div>/gi, "");

  // حذف scriptهای تکراری
  html = html.replace(/<script\s+src="js\/components\.js"><\/script>/gi, "");

  html = html.replace(/<script\s+src="js\/main\.js"><\/script>/gi, "");

  // حذف body/html اضافی
  html = html.replace(
    /<\/body>\s*<\/html>\s*<\/body>\s*<\/html>/gi,
    "</body>\n</html>",
  );

  // اضافه کردن هدر
  html = html.replace(
    /<body([^>]*)>/i,
    `<body$1>

<div id="header"></div>`,
  );

  // اضافه کردن فوتر
  html = html.replace(
    /<\/body>/i,
    `
<div id="footer"></div>

<script src="js/components.js"></script>
<script src="js/main.js"></script>

</body>`,
  );

  fs.writeFileSync(file, html, "utf8");
});

console.log("");
console.log("===================================");
console.log("✔ All pages updated successfully.");
console.log("===================================");
