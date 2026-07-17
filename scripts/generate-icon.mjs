import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const output = resolve("build", "icon.png");
await mkdir(resolve("build"), { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          html, body { width: 512px; height: 512px; margin: 0; overflow: hidden; background: transparent; }
          svg { display: block; width: 512px; height: 512px; }
        </style>
      </head>
      <body>
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-label="Acta">
          <defs>
            <linearGradient id="acta" x1="80" y1="54" x2="432" y2="458" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#6f8fff"/>
              <stop offset="0.55" stop-color="#3f65df"/>
              <stop offset="1" stop-color="#294bb8"/>
            </linearGradient>
          </defs>
          <rect x="20" y="20" width="472" height="472" rx="108" fill="url(#acta)"/>
          <rect x="21" y="21" width="470" height="470" rx="107" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
          <path fill="#ffffff" fill-rule="evenodd" d="M256 78 434 430h-85l-38-82H201l-38 82H78L256 78Zm0 137-30 67h60l-30-67Z"/>
        </svg>
      </body>
    </html>
  `);
  await page.locator("svg").screenshot({ path: output, omitBackground: true });
} finally {
  await browser.close();
}
