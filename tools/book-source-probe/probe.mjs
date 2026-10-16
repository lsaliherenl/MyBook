// Compares free book metadata sources (Google Books, Open Library, Apple Books)
// for the same set of books: what metadata each returns and how large the covers are.
//
// Usage:  node tools/book-source-probe/probe.mjs
//         GOOGLE_BOOKS_API_KEY=... node tools/book-source-probe/probe.mjs
// Output: tools/book-source-probe/out/results.json, report.html, covers/*

import { mkdir, writeFile } from "node:fs/promises";
import https from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const COVERS = join(OUT, "covers");
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? "";

const CASES = [
  { id: "atomic-habits", lang: "en", isbn: "9780735211292", title: "Atomic Habits", author: "James Clear" },
  { id: "project-hail-mary", lang: "en", isbn: "9780593135204", title: "Project Hail Mary", author: "Andy Weir" },
  { id: "dune", lang: "en", isbn: "9780441172719", title: "Dune", author: "Frank Herbert" },
  { id: "sapiens", lang: "en", isbn: "9780062316097", title: "Sapiens", author: "Yuval Noah Harari" },
  { id: "midnight-library", lang: "en", isbn: "9780525559474", title: "The Midnight Library", author: "Matt Haig" },
  { id: "creative-act", lang: "en", isbn: "9780593652886", title: "The Creative Act", author: "Rick Rubin" },
  { id: "nineteen-eighty-four", lang: "en", isbn: "9780451524935", title: "1984", author: "George Orwell" },
  { id: "kurk-mantolu-madonna", lang: "tr", title: "Kürk Mantolu Madonna", author: "Sabahattin Ali" },
  { id: "tutunamayanlar", lang: "tr", title: "Tutunamayanlar", author: "Oğuz Atay" },
  { id: "saatleri-ayarlama", lang: "tr", title: "Saatleri Ayarlama Enstitüsü", author: "Ahmet Hamdi Tanpınar" },
  { id: "ince-memed", lang: "tr", title: "İnce Memed", author: "Yaşar Kemal" },
  { id: "masumiyet-muzesi", lang: "tr", title: "Masumiyet Müzesi", author: "Orhan Pamuk" },
  { id: "seker-portakali", lang: "tr", title: "Şeker Portakalı", author: "José Mauro de Vasconcelos" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// node:https instead of fetch: Open Library can take >10s to accept a connection,
// which is longer than fetch's fixed connect timeout.
function request(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "MyBook-probe/0.1 (student project)" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(request(new URL(res.headers.location, url).href, redirects - 1));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.setTimeout(45_000, () => req.destroy(new Error(`timeout ${url}`)));
    req.on("error", reject);
  });
}

// Google Books intermittently answers 503 for valid queries; retry with backoff.
async function getJson(url, attempts = 4) {
  for (let i = 1; ; i++) {
    const res = await request(url);
    if (res.status === 200) return JSON.parse(res.body.toString("utf8"));
    if (![429, 500, 502, 503].includes(res.status) || i >= attempts) {
      throw new Error(`HTTP ${res.status} after ${i} attempt(s) ${url.replace(/key=[^&]*/, "key=***")}`);
    }
    await sleep(1000 * 2 ** (i - 1));
  }
}

// --- image size sniffing (JPEG / PNG / GIF / WebP), no dependencies ---------
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { type: "gif", w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { type: "webp", w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { type: "webp", w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { type: "webp", w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpeg", w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function fetchCover(url, file) {
  try {
    const res = await request(url);
    if (res.status !== 200) return { url, error: `HTTP ${res.status}` };
    const buf = res.body;
    const size = imageSize(buf);
    if (!size) return { url, error: "not an image", bytes: buf.length };
    const path = `${file}.${size.type === "jpeg" ? "jpg" : size.type}`;
    await writeFile(join(COVERS, path), buf);
    return { url, w: size.w, h: size.h, bytes: buf.length, file: `covers/${path}` };
  } catch (e) {
    return { url, error: String(e.message ?? e) };
  }
}

const best = (covers) =>
  covers.filter((c) => c.w).sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;

// --- Google Books -------------------------------------------------------------
async function googleBooks(c) {
  const key = GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : "";
  const q = c.isbn ? `isbn:${c.isbn}` : `${c.title} ${c.author}`;
  const search = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5${key}`,
  );
  const item = search.items?.[0];
  if (!item) return { found: false };
  // The single-volume endpoint sometimes exposes larger imageLinks than search.
  const vol = await getJson(`https://www.googleapis.com/books/v1/volumes/${item.id}?${key.slice(1)}`);
  const v = vol.volumeInfo ?? item.volumeInfo;
  const isbn13 = v.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ?? null;

  const urls = new Map();
  for (const [size, url] of Object.entries(v.imageLinks ?? {})) urls.set(`gb-${size}`, url.replace("http://", "https://"));
  urls.set("gb-zoom0", `https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=0`);
  urls.set("gb-fife800", `https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=1&fife=w800`);

  const covers = [];
  for (const [name, url] of urls) covers.push({ variant: name, ...(await fetchCover(url, `${c.id}-${name}`)) });

  return {
    found: true,
    title: v.title,
    subtitle: v.subtitle ?? null,
    authors: v.authors ?? [],
    publisher: v.publisher ?? null,
    publishedDate: v.publishedDate ?? null,
    pages: v.pageCount ?? null,
    language: v.language ?? null,
    categories: v.categories ?? [],
    descriptionChars: (v.description ?? "").length,
    isbn13,
    covers,
    bestCover: best(covers),
  };
}

// --- Open Library ----------------------------------------------------------------
async function openLibrary(c) {
  const fields = "key,title,author_name,isbn,cover_i,first_publish_year,publisher,language,number_of_pages_median,subject";
  const q = c.isbn
    ? `isbn=${c.isbn}`
    : `title=${encodeURIComponent(c.title)}&author=${encodeURIComponent(c.author)}`;
  const s = await getJson(`https://openlibrary.org/search.json?${q}&fields=${fields}&limit=3`);
  const doc = s.docs?.[0];
  if (!doc) return { found: false };

  let description = "";
  try {
    const work = await getJson(`https://openlibrary.org${doc.key}.json`);
    description = typeof work.description === "string" ? work.description : work.description?.value ?? "";
  } catch {}

  const covers = [];
  if (doc.cover_i) {
    covers.push({ variant: "ol-id-L", ...(await fetchCover(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`, `${c.id}-ol-id-L`)) });
  }
  if (c.isbn) {
    covers.push({
      variant: "ol-isbn-L",
      ...(await fetchCover(`https://covers.openlibrary.org/b/isbn/${c.isbn}-L.jpg?default=false`, `${c.id}-ol-isbn-L`)),
    });
  }

  return {
    found: true,
    title: doc.title,
    authors: doc.author_name ?? [],
    publisher: doc.publisher?.slice(0, 3).join(" | ") ?? null,
    publishedDate: doc.first_publish_year ?? null,
    pages: doc.number_of_pages_median ?? null,
    language: doc.language?.join(",") ?? null,
    categories: doc.subject?.slice(0, 5) ?? [],
    descriptionChars: description.length,
    isbn13: doc.isbn?.find((x) => x.length === 13) ?? null,
    editionIsbnCount: doc.isbn?.length ?? 0,
    covers,
    bestCover: best(covers),
  };
}

// --- Apple Books (iTunes Search API) ---------------------------------------------
async function appleBooks(c) {
  const term = encodeURIComponent(`${c.title} ${c.author}`);
  let r = null;
  for (const country of c.lang === "tr" ? ["tr", "us"] : ["us"]) {
    const s = await getJson(`https://itunes.apple.com/search?term=${term}&media=ebook&limit=3&country=${country}`);
    r = s.results?.[0];
    if (r) { r.country = country; break; }
    await sleep(500);
  }
  if (!r) return { found: false };

  const base = r.artworkUrl100;
  const covers = [];
  for (const size of ["600x600bb", "1400x1400bb", "3000x3000bb"]) {
    const url = base.replace(/\/100x100bb\.(jpg|png)$/, `/${size}.jpg`);
    covers.push({ variant: `apple-${size}`, ...(await fetchCover(url, `${c.id}-apple-${size}`)) });
  }

  return {
    found: true,
    store: r.country,
    title: r.trackName,
    authors: [r.artistName],
    publisher: null,
    publishedDate: r.releaseDate?.slice(0, 10) ?? null,
    pages: null,
    language: null,
    categories: (r.genres ?? []).filter((g) => g !== "Books"),
    descriptionChars: (r.description ?? "").replace(/<[^>]+>/g, "").length,
    isbn13: null,
    covers,
    bestCover: best(covers),
  };
}

// ONLY=google,apple limits the run to some providers.
const ALL_PROVIDERS = { google: googleBooks, openlibrary: openLibrary, apple: appleBooks };
const ONLY = process.env.ONLY?.split(",");
const SUFFIX = ONLY ? `-${ONLY.join("-")}` : "";
const PROVIDERS = Object.fromEntries(Object.entries(ALL_PROVIDERS).filter(([k]) => !ONLY || ONLY.includes(k)));

async function main() {
  await mkdir(COVERS, { recursive: true });
  const results = [];
  for (const c of CASES) {
    const row = { case: c, providers: {} };
    for (const [name, fn] of Object.entries(PROVIDERS)) {
      const t0 = Date.now();
      try {
        row.providers[name] = await fn(c);
      } catch (e) {
        row.providers[name] = { found: false, error: String(e.message ?? e) };
      }
      row.providers[name].ms = Date.now() - t0;
      const p = row.providers[name];
      const bc = p.bestCover ? `${p.bestCover.w}x${p.bestCover.h}` : "-";
      console.log(`${c.id.padEnd(22)} ${name.padEnd(12)} ${p.found ? "found" : "MISS "} cover=${bc} ${p.error ?? ""}`);
      await sleep(400);
    }
    results.push(row);
  }
  await writeFile(join(OUT, `results${SUFFIX}.json`), JSON.stringify(results, null, 2));
  await writeFile(join(OUT, `report${SUFFIX}.html`), renderReport(results));
  console.log(`\nWrote ${join(OUT, `report${SUFFIX}.html`)}`);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function renderReport(results) {
  const cell = (p) => {
    if (!p) return `<td class="miss">skipped</td>`;
    if (!p.found) return `<td class="miss">miss${p.error ? `<br><small>${esc(p.error)}</small>` : ""}</td>`;
    const b = p.bestCover;
    return `<td>
      ${b ? `<img src="${esc(b.file)}" loading="lazy"><div class="dim">${b.w}×${b.h} · ${Math.round(b.bytes / 1024)} KB · ${esc(b.variant)}</div>` : `<div class="miss">no cover</div>`}
      <div><b>${esc(p.title)}</b></div>
      <div>${esc(p.authors?.join(", "))}</div>
      <div class="meta">${esc(p.publisher)} · ${esc(p.publishedDate)} · ${esc(p.pages ?? "?")} pp · lang ${esc(p.language ?? "?")}</div>
      <div class="meta">desc ${p.descriptionChars} chars · ISBN ${esc(p.isbn13 ?? "-")}</div>
      <div class="meta">${esc(p.categories?.join(", "))}</div>
    </td>`;
  };
  const rows = results
    .map((r) => `<tr><th>${esc(r.case.title)}<br><small>${esc(r.case.author)} · ${r.case.lang}</small></th>${["google", "openlibrary", "apple"].map((k) => cell(r.providers[k])).join("")}</tr>`)
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Book source probe</title>
<style>
  body{font:14px system-ui;margin:24px;background:#f6f1ea;color:#2a1a22}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #d8cfc3;padding:10px;vertical-align:top;text-align:left;width:25%}
  img{max-width:180px;max-height:270px;display:block;margin-bottom:6px;box-shadow:0 4px 12px #0003}
  .dim{font-weight:600;color:#4a2236}.meta{color:#6b5a62;font-size:12px}.miss{color:#a33}
</style>
<h1>Book source probe</h1>
<table><tr><th>Book</th><th>Google Books</th><th>Open Library</th><th>Apple Books</th></tr>${rows}</table>`;
}

main();
