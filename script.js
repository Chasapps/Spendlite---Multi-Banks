// ================== WESTPAC PDF IMPORT ==================

// Extract all visible text from a PDF
async function readPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

// Parse Westpac Mastercard statement text into SpendLite txns
function parseWestpacPdfText(text) {
  const lines = text
    .split(/\n+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const txns = [];

  const rowRe = /^(
    \d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}   # date
  )\s+(.+?)\s+                         # description
  ([-+]?\$?\d+[.,]\d{2})$             # amount
  /x;

  for (const line of lines) {
    const m = line.match(/^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(.+?)\s+([-+]?\$?\d+[.,]\d{2})$/);
    if (!m) continue;

    const date = m[1];
    const description = m[2];
    let amount = parseAmount(m[3]);

    // Deposits (no minus sign) should be negative spend
    if (!m[3].includes('-')) {
      amount = -Math.abs(amount);
    }

    txns.push({ date, amount, description });
  }

  return txns;
}

function loadPdfTxns(txns) {
  CURRENT_TXNS = txns;
  saveTxnsToLocalStorage();
  rebuildMonthDropdown();
  applyRulesAndRender();
}

// Wire PDF input
document.getElementById('pdfFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await readPdfText(file);
    const txns = parseWestpacPdfText(text);

    if (!txns.length) {
      alert('No transactions detected. This importer expects a Westpac card statement.');
      return;
    }

    loadPdfTxns(txns);
  } catch (err) {
    console.error(err);
    alert('Failed to read PDF');
  }
});
