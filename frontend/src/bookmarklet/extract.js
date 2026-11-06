(function (doc, loc) {
  // Lê os dados do produto na página aberta do Mercado Livre. Roda no navegador de quem clica no botão.
  // Fontes, da mais para a menos confiável: JSON-LD (schema.org/Product), meta tags e o HTML da página.
  // Este arquivo é embutido no favorito (bookmarklet): sem imports, sem dependências.
  function text(el) {
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function meta(selector) {
    var el = doc.querySelector(selector);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }
  // "177.22" (JSON-LD/meta) e "1.234,56" (texto da página) → centavos.
  function toCents(value) {
    var n;
    if (typeof value === "number") {
      n = value;
    } else {
      var s = String(value == null ? "" : value).replace(/[^\d.,]/g, "");
      if (!s) return 0;
      n = s.indexOf(",") >= 0 ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s);
    }
    return isFinite(n) && n > 0 && n < 1000000 ? Math.round(n * 100) : 0;
  }

  function findProductLd() {
    var found = [];
    function walk(x) {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) {
        x.forEach(walk);
        return;
      }
      if (x["@graph"]) walk(x["@graph"]);
      var types = [].concat(x["@type"] || []);
      if (types.indexOf("Product") >= 0) found.push(x);
    }
    var nodes = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        walk(JSON.parse(nodes[i].textContent));
      } catch (e) {
        // JSON-LD inválido: ignora este bloco
      }
    }
    return found[0] || null;
  }

  var ld = findProductLd() || {};

  var name = String(ld.name || "").trim() || text(doc.querySelector("h1.ui-pdp-title")) || text(doc.querySelector("h1"));
  if (!name) {
    name = meta('meta[property="og:title"]').replace(/\s*[|\-–]\s*(Mercado Livre|MercadoLivre).*$/i, "");
  }

  // Preço: JSON-LD → meta itemprop → bloco de preço atual (não o riscado) → meta de produto.
  var price = 0;
  var offers = [].concat(ld.offers || []);
  for (var o = 0; o < offers.length && !price; o++) {
    var offer = offers[o] || {};
    price = toCents(offer.price != null ? offer.price : offer.lowPrice);
    if (!price && offer.offers) price = toCents([].concat(offer.offers)[0] && [].concat(offer.offers)[0].price);
  }
  if (!price) price = toCents(meta('meta[itemprop="price"]'));
  if (!price) {
    var fraction = doc.querySelector(
      ".ui-pdp-price__second-line .andes-money-amount__fraction, .ui-pdp-price .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction",
    );
    var cents = doc.querySelector(
      ".ui-pdp-price__second-line .andes-money-amount__cents, .ui-pdp-price .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents",
    );
    if (fraction) price = toCents(text(fraction).replace(/\./g, "") + "," + (text(cents) || "00"));
  }
  if (!price) price = toCents(meta('meta[property="product:price:amount"]'));

  // Foto: JSON-LD → og:image → galeria.
  var image = [].concat(ld.image || [])[0];
  if (image && typeof image === "object") image = image.url || image.contentUrl;
  if (!image) image = meta('meta[property="og:image"]');
  if (!image) {
    var img = doc.querySelector(".ui-pdp-gallery__figure img, img.ui-pdp-image");
    if (img) image = img.getAttribute("data-zoom") || img.getAttribute("src");
  }
  image = image ? String(image).replace(/^http:/, "https:") : "";

  // Especificações: linhas "Característica | Valor" da tabela da página (ou marca/cor do JSON-LD).
  var wanted = [
    [/^marca$/i, "Marca"],
    [/^modelo$/i, "Modelo"],
    [/^(cor|cor principal)$/i, "Cor"],
    [/^tamanho$/i, "Tamanho"],
    [/^capacidade/i, "Capacidade"],
    [/^voltagem$/i, "Voltagem"],
    [/^material/i, "Material"],
    [/^pot[eê]ncia/i, "Potência"],
  ];
  var specs = {};
  var rows = doc.querySelectorAll("tr");
  for (var r = 0; r < rows.length; r++) {
    var th = rows[r].querySelector("th");
    var td = rows[r].querySelector("td");
    if (!th || !td) continue;
    var key = text(th);
    var value = text(td);
    for (var w = 0; w < wanted.length; w++) {
      if (value && wanted[w][0].test(key) && !specs[wanted[w][1]]) specs[wanted[w][1]] = value;
    }
  }
  var brand = ld.brand && (ld.brand.name || ld.brand);
  if (!specs["Marca"] && typeof brand === "string") specs["Marca"] = brand;
  if (!specs["Cor"] && typeof ld.color === "string") specs["Cor"] = ld.color;
  var spec = Object.keys(specs)
    .map(function (k) {
      return k + ": " + specs[k] + ".";
    })
    .join(" ");

  // Endereço limpo: sem rastreamento, mantendo o que identifica o anúncio.
  var u = new URL(loc.href);
  var keep = [];
  ["pdp_filters", "wid"].forEach(function (k) {
    var v = u.searchParams.get(k);
    if (v) keep.push(k + "=" + encodeURIComponent(v));
  });
  var url = u.origin + u.pathname + (keep.length ? "?" + keep.join("&") : "");

  return { name: name.slice(0, 200), spec: spec.slice(0, 1000), priceCents: price, imageUrl: image, url: url };
})
