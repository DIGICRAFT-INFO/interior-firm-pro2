const ejs  = require('ejs');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const https = require('https');

const BrandTheme  = require('../models/brand_theme');
const BankDetails = require('../models/bank_details');
const TaxSettings = require('../models/tax_settings');

/**
 * get_logo_base64(brand)
 * Converts the brand logo to a base64 data-URI so Puppeteer can embed it
 * inline — no external network request needed at PDF render time.
 *
 * Priority:
 *   1. brand.logo is a local file path  → read from disk
 *   2. brand.logo is an http/https URL  → download and encode
 *   3. Default fallback: uploads/logo2.png (if exists)
 *   4. Return null (no logo shown, firm name text is used instead)
 */
const get_logo_base64 = async (brand) => {
  const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
  const DEFAULT_LOGO = path.join(UPLOADS_DIR, 'logo2.png');

  const encode_file = (file_path) => {
    const buf  = fs.readFileSync(file_path);
    const ext  = path.extname(file_path).toLowerCase().replace('.', '');
    const mime = ext === 'svg' ? 'image/svg+xml'
               : ext === 'png' ? 'image/png'
               : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
               : ext === 'webp' ? 'image/webp'
               : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  // ── 1. brand.logo set hai ────────────────────────────────────────────────
  if (brand && brand.logo && brand.logo.trim()) {
    const logo = brand.logo.trim();

    // Local file path
    const is_absolute = path.isAbsolute(logo);
    const local_path  = is_absolute
      ? logo
      : path.join(__dirname, '..', logo.replace(/^\//, ''));

    if (fs.existsSync(local_path)) {
      try { return encode_file(local_path); } catch (_) {}
    }

    // Remote URL
    if (logo.startsWith('http://') || logo.startsWith('https://')) {
      try {
        const buf = await new Promise((resolve, reject) => {
          const client = logo.startsWith('https://') ? https : http;
          client.get(logo, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch (_) {}
    }
  }

  // ── 2. Default fallback logo ─────────────────────────────────────────────
  if (fs.existsSync(DEFAULT_LOGO)) {
    try { return encode_file(DEFAULT_LOGO); } catch (_) {}
  }

  return null;
};

/**
 * get_browser()
 * Strategy (in order):
 *   1. @sparticuz/chromium  — works on Render, Lambda, Railway, Fly.io (no system Chrome needed)
 *   2. puppeteer bundled Chrome — works on local dev after `npx puppeteer browsers install chrome`
 */
const get_browser = async () => {
  const puppeteerCore = require('puppeteer-core');

  // ── Strategy 1: @sparticuz/chromium (cloud / Render) ──────────────────────
  try {
    const chromium = require('@sparticuz/chromium');
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode  = false;

    const executablePath = await chromium.executablePath();

    return puppeteerCore.launch({
      executablePath,
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
      ],
      defaultViewport: chromium.defaultViewport,
    });
  } catch (_) {
    // @sparticuz/chromium not available or failed — fall through to local
  }

  // ── Strategy 2: local puppeteer bundled Chrome (dev machine) ──────────────
  try {
    const puppeteerFull = require('puppeteer');
    const executablePath = puppeteerFull.executablePath();

    if (fs.existsSync(executablePath)) {
      return puppeteerCore.launch({
        executablePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
  } catch (_) {}

  // ── Strategy 3: system Chrome paths ───────────────────────────────────────
  const systemPaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  for (const p of systemPaths) {
    if (fs.existsSync(p)) {
      return puppeteerCore.launch({
        executablePath: p,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
      });
    }
  }

  throw new Error(
    'No Chrome/Chromium found.\n' +
    '  Local: run "npx puppeteer browsers install chrome"\n' +
    '  Render: ensure @sparticuz/chromium is installed (npm install @sparticuz/chromium)'
  );
};

// ── Core PDF generator ────────────────────────────────────────────────────────
const generate_pdf_from_html = async (html_string) => {
  const browser = await get_browser();
  try {
    const page = await browser.newPage();
    await page.setContent(html_string, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf_buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    return pdf_buffer;
  } finally {
    await browser.close();
  }
};

// ── 1. Invoice PDF ────────────────────────────────────────────────────────────
exports.render_invoice_pdf = async (invoice) => {
  const brand   = await BrandTheme.findOne();
  const bank    = await BankDetails.findOne();
  const tax_cfg = await TaxSettings.findOne();

  if (!invoice.populated('items')) await invoice.populate('items');

  const logo_base64 = await get_logo_base64(brand);

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/invoice.ejs'),
    { invoice, items: invoice.items, brand, bank, tax_cfg, logo_base64, base_url: process.env.BASE_DIR || __dirname }
  );
  return generate_pdf_from_html(html_string);
};

// ── 2. Quotation PDF ──────────────────────────────────────────────────────────
exports.render_quotation_pdf = async (quotation) => {
  const brand   = await BrandTheme.findOne();
  const tax_cfg = await TaxSettings.findOne();

  if (!quotation.populated('items')) await quotation.populate('items');

  const logo_base64 = await get_logo_base64(brand);

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/quotation.ejs'),
    { quotation, items: quotation.items, brand, tax_cfg, logo_base64 }
  );
  return generate_pdf_from_html(html_string);
};

// ── 3. Proposal PDF ───────────────────────────────────────────────────────────
exports.render_proposal_pdf = async (proposal) => {
  const brand = await BrandTheme.findOne();

  const logo_base64 = await get_logo_base64(brand);

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/proposal.ejs'),
    { proposal, brand, logo_base64 }
  );
  return generate_pdf_from_html(html_string);
};

// ── 4. Portfolio PDF ──────────────────────────────────────────────────────────
exports.render_portfolio_pdf = async (portfolio) => {
  const brand = await BrandTheme.findOne();

  const logo_base64 = await get_logo_base64(brand);

  // Convert each portfolio image to base64 so Puppeteer can render it inline
  const BACKEND_ROOT = path.join(__dirname, '..');
  if (portfolio.images && portfolio.images.length > 0) {
    portfolio = portfolio.toObject ? portfolio.toObject() : { ...portfolio };
    portfolio.images = portfolio.images.map((img) => {
      const rel = (img.file_url || '').replace(/^\//, '');
      const full = path.join(BACKEND_ROOT, rel);
      if (fs.existsSync(full)) {
        try {
          const buf = fs.readFileSync(full);
          const ext = path.extname(full).toLowerCase().replace('.', '');
          const mime = ext === 'png' ? 'image/png'
                     : ext === 'webp' ? 'image/webp'
                     : ext === 'avif' ? 'image/avif'
                     : 'image/jpeg';
          return { ...img, file_url: `data:${mime};base64,${buf.toString('base64')}` };
        } catch (_) { return img; }
      }
      return img;
    });
  }

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/portfolio.ejs'),
    { portfolio, brand, logo_base64 }
  );
  return generate_pdf_from_html(html_string);
};