const ejs  = require('ejs');
const path = require('path');
const fs   = require('fs');

const BrandTheme  = require('../models/brand_theme');
const BankDetails = require('../models/bank_details');
const TaxSettings = require('../models/tax_settings');

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

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/invoice.ejs'),
    { invoice, items: invoice.items, brand, bank, tax_cfg, base_url: process.env.BASE_DIR || __dirname }
  );
  return generate_pdf_from_html(html_string);
};

// ── 2. Quotation PDF ──────────────────────────────────────────────────────────
exports.render_quotation_pdf = async (quotation) => {
  const brand   = await BrandTheme.findOne();
  const tax_cfg = await TaxSettings.findOne();

  if (!quotation.populated('items')) await quotation.populate('items');

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/quotation.ejs'),
    { quotation, items: quotation.items, brand, tax_cfg }
  );
  return generate_pdf_from_html(html_string);
};

// ── 3. Proposal PDF ───────────────────────────────────────────────────────────
exports.render_proposal_pdf = async (proposal) => {
  const brand = await BrandTheme.findOne();

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/proposal.ejs'),
    { proposal, brand }
  );
  return generate_pdf_from_html(html_string);
};

// ── 4. Portfolio PDF ──────────────────────────────────────────────────────────
exports.render_portfolio_pdf = async (portfolio) => {
  const brand = await BrandTheme.findOne();

  const html_string = await ejs.renderFile(
    path.join(__dirname, '../templates/pdf/portfolio.ejs'),
    { portfolio, brand }
  );
  return generate_pdf_from_html(html_string);
};