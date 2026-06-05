/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Format data and trigger browser download of CSV string
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const content = [
    headers.join(','),
    ...rows.map(row => 
      row.map(val => {
        const clean = (val || '').replace(/"/g, '""');
        return idContainsSpecialChars(clean) ? `"${clean}"` : clean;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function idContainsSpecialChars(val: string): boolean {
  return val.includes(',') || val.includes('\n') || val.includes('"');
}

// Print formatted PDF/HTML reports
export function printFormattedReport(title: string, subtitle: string, headers: string[], rows: string[][], summaryStats?: Record<string, string | number>) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const statsHtml = summaryStats 
    ? `<div class="stats-grid">
         ${Object.entries(summaryStats).map(([key, val]) => `
           <div class="stat-card">
             <div class="stat-label">${key}</div>
             <div class="stat-value">${val}</div>
           </div>
         `).join('')}
       </div>`
    : '';

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            padding: 40px;
            background: #ffffff;
          }
          .header {
            margin-bottom: 30px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
          }
          h1 {
            margin: 0 0 5px 0;
            font-size: 24px;
            color: #0f172a;
          }
          p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
          }
          .stat-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 8px;
          }
          .stat-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #f1f5f9;
            text-align: left;
            padding: 12px;
            font-size: 12px;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
          }
          td {
            padding: 12px;
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>${subtitle} &bull; Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        ${statsHtml}

        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell || '-'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Smart Attendance Hub &copy; ${new Date().getFullYear()} &bull; Professional Educational Tracking Systems
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
