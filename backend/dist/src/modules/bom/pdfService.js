"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const prisma_1 = require("../../lib/prisma");
exports.pdfService = {
    generateBOMPdf: (projectId) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        // 1. Colectăm datele proiectului și ale BOM-ului
        const project = yield prisma_1.prisma.project.findUnique({
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
        const groupedItems = {};
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
          <p>Generat de Zidario AI pentru ${((_a = project.user) === null || _a === void 0 ? void 0 : _a.name) || ((_b = project.user) === null || _b === void 0 ? void 0 : _b.email) || 'Client'}</p>
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
                items.map(item => {
                    var _a, _b;
                    return '<tr>' +
                        '<td>' + (((_a = item.material) === null || _a === void 0 ? void 0 : _a.name) || 'Material Necunoscut') + '</td>' +
                        '<td>' + item.quantity.toFixed(2) + ' ' + (((_b = item.material) === null || _b === void 0 ? void 0 : _b.unit) || '') + '</td>' +
                        '<td>' + item.unitPrice.toFixed(2) + ' RON</td>' +
                        '<td>' + item.totalPrice.toFixed(2) + ' RON</td>' +
                        '</tr>';
                }).join('') +
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
        const browser = yield puppeteer_1.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = yield browser.newPage();
        yield page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfBuffer = yield page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        yield browser.close();
        // Puppeteer returnează un Uint8Array în versiunile noi, deci îl mapăm într-un Buffer clasic.
        return Buffer.from(pdfBuffer);
    })
};
