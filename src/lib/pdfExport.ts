// Simple PDF generation using HTML to PDF conversion via print
// This approach works without external dependencies

export interface PDFSection {
  title: string;
  content: string | string[];
}

export interface PDFDocument {
  title: string;
  subtitle?: string;
  date: string;
  sections: PDFSection[];
  footer?: string;
}

export function generatePDFHTML(doc: PDFDocument): string {
  const sectionsHTML = doc.sections.map(section => {
    const contentHTML = Array.isArray(section.content)
      ? section.content.map(item => `<li>${item}</li>`).join('')
      : `<p>${section.content}</p>`;
    
    return `
      <div class="section">
        <h2>${section.title}</h2>
        ${Array.isArray(section.content) ? `<ul>${contentHTML}</ul>` : contentHTML}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>${doc.title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 2px solid #6366f1;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 28px;
          color: #6366f1;
          margin-bottom: 8px;
        }
        .header .subtitle {
          color: #666;
          font-size: 14px;
        }
        .header .date {
          color: #999;
          font-size: 12px;
          margin-top: 4px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          font-size: 18px;
          color: #333;
          border-bottom: 1px solid #e5e5e5;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .section p {
          color: #555;
          margin-bottom: 8px;
        }
        .section ul {
          list-style: none;
          padding-left: 0;
        }
        .section li {
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
          color: #555;
        }
        .section li:last-child {
          border-bottom: none;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          color: #999;
          font-size: 11px;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .stat-box {
          background: #f8f8f8;
          padding: 16px;
          border-radius: 8px;
        }
        .stat-box .value {
          font-size: 24px;
          font-weight: bold;
          color: #6366f1;
        }
        .stat-box .label {
          font-size: 12px;
          color: #666;
        }
        .warning {
          background: #fef3cd;
          border-left: 4px solid #ffc107;
          padding: 12px 16px;
          margin: 12px 0;
          border-radius: 4px;
        }
        .success {
          background: #d4edda;
          border-left: 4px solid #28a745;
          padding: 12px 16px;
          margin: 12px 0;
          border-radius: 4px;
        }
        @media print {
          body {
            padding: 20px;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${doc.title}</h1>
        ${doc.subtitle ? `<p class="subtitle">${doc.subtitle}</p>` : ''}
        <p class="date">Erstellt am: ${doc.date}</p>
      </div>
      
      ${sectionsHTML}
      
      ${doc.footer ? `<div class="footer">${doc.footer}</div>` : ''}
    </body>
    </html>
  `;
}

export function downloadPDF(doc: PDFDocument, filename: string): void {
  const html = generatePDFHTML(doc);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.pdf', '.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export function generatePrivacyReportPDF(
  stats: {
    totalLogins: number;
    failedAttempts: number;
    uniqueLocations: number;
    uniqueDevices: number;
    suspiciousEvents: number;
  },
  securityScore: number,
  recentEvents: { type: string; date: string; location?: string }[]
): PDFDocument {
  const scoreStatus = securityScore >= 80 ? 'Gut geschützt' : 
                      securityScore >= 50 ? 'Überprüfung empfohlen' : 'Achtung erforderlich';
  
  return {
    title: 'Datenschutz-Bericht',
    subtitle: 'PhantomLock Vault - Sicherheitsübersicht',
    date: new Date().toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    sections: [
      {
        title: 'Sicherheitsbewertung',
        content: `Score: ${securityScore}/100 — ${scoreStatus}`
      },
      {
        title: 'Statistiken',
        content: [
          `Erfolgreiche Anmeldungen: ${stats.totalLogins}`,
          `Fehlgeschlagene Versuche: ${stats.failedAttempts}`,
          `Einzigartige Standorte: ${stats.uniqueLocations}`,
          `Verwendete Geräte: ${stats.uniqueDevices}`,
          `Verdächtige Ereignisse: ${stats.suspiciousEvents}`
        ]
      },
      {
        title: 'Letzte Aktivitäten',
        content: recentEvents.length > 0 
          ? recentEvents.slice(0, 10).map(e => 
              `${e.date} — ${e.type}${e.location ? ` (${e.location})` : ''}`
            )
          : ['Keine Aktivitäten im gewählten Zeitraum']
      },
      {
        title: 'Empfehlungen',
        content: [
          'PIN regelmäßig ändern',
          'Biometrische Authentifizierung aktivieren',
          'Unbekannte Sessions beenden',
          'Recovery-Key sicher aufbewahren'
        ]
      }
    ],
    footer: 'Dieser Bericht wurde automatisch von PhantomLock generiert. Vertraulich behandeln.'
  };
}
