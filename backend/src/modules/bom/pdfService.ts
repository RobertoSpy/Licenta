import puppeteer from 'puppeteer';
import { prisma } from '../../lib/prisma';

export const pdfService = {
  generateBOMPdf: async (projectId: number): Promise<Buffer> => {
    // 1. Colectăm datele proiectului și ale BOM-ului
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: true,
        bomItems: {
          include: {
            material: true
          }
        }
      }
    });

    if (!project) {
      throw new Error('Proiectul nu a fost găsit.');
    }

    // 2. Grupăm materialele pe faze
    const groupedItems: Record<string, any[]> = {};
    let grandTotal = 0;

    project.bomItems.forEach(item => {
      if (!groupedItems[item.phase]) {
        groupedItems[item.phase] = [];
      }
      groupedItems[item.phase].push(item);
      grandTotal += item.totalPrice;
    });

    // 3. Generăm HTML-ul pentru PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="UTF-8">
        <title>Deviz Detaliat - Zidario</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            background: #ffffff;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #ea580c;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #0f172a;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #64748b;
            margin: 5px 0 0 0;
            font-size: 14px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 40px;
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .info-item {
            font-size: 14px;
          }
          .info-item strong {
            color: #334155;
          }
          h2 {
            color: #ea580c;
            font-size: 20px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
            margin-top: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
          }
          th, td {
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
          }
          .total-row {
            font-weight: bold;
            background-color: #fff7ed;
            color: #c2410c;
          }
          .grand-total {
            text-align: right;
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ea580c;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Deviz Estimat Materiale</h1>
          <p>Generat de Zidario AI pentru ${project.user?.name || project.user?.email || 'Client'}</p>
        </div>

        <div class="info-grid">
          <div class="info-item"><strong>Locație:</strong> ${project.locality || '-'}, Jud. ${project.county || '-'}</div>
          <div class="info-item"><strong>Zonă seismică:</strong> ${project.seismicZone || '-'}</div>
          <div class="info-item"><strong>Tip sol:</strong> ${project.soilType || '-'}</div>
          <div class="info-item"><strong>Suprafață calculată:</strong> ${project.totalFloorAreaSqm ? project.totalFloorAreaSqm.toFixed(2) + ' mp' : '-'}</div>
        </div>

        ${Object.keys(groupedItems).map(phase => {
          const items = groupedItems[phase];
          const phaseTotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
          
          return '<h2>' + phase + '</h2>' +
            '<table>' +
              '<thead>' +
                '<tr>' +
                  '<th width="40%">Material</th>' +
                  '<th width="15%">Cantitate</th>' +
                  '<th width="20%">Preț Unitar</th>' +
                  '<th width="25%">Total</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                items.map(item => 
                  '<tr>' +
                    '<td>' + (item.material?.name || 'Material Necunoscut') + '</td>' +
                    '<td>' + item.quantity.toFixed(2) + ' ' + (item.material?.unit || '') + '</td>' +
                    '<td>' + item.unitPrice.toFixed(2) + ' RON</td>' +
                    '<td>' + item.totalPrice.toFixed(2) + ' RON</td>' +
                  '</tr>'
                ).join('') +
                '<tr class="total-row">' +
                  '<td colspan="3" style="text-align: right">Total Etapă:</td>' +
                  '<td>' + phaseTotal.toFixed(2) + ' RON</td>' +
                '</tr>' +
              '</tbody>' +
            '</table>';
        }).join('')}

        <div class="grand-total">
          TOTAL ESTIMAT: ${grandTotal.toFixed(2)} RON
        </div>

        <div class="footer">
          Document generat automat pe platforma Zidario. Prețurile sunt estimative și pot varia. 
          Acest document este orientativ și nu înlocuiește un deviz ofertă ferm.
        </div>
      </body>
      </html>
    `;

    // 4. Lansăm Puppeteer pentru a printa PDF-ul
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Puppeteer returnează un Uint8Array în versiunile noi, deci îl mapăm într-un Buffer clasic.
    return Buffer.from(pdfBuffer);
  }
};
