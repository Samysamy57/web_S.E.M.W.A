const btnGenerateReport = document.getElementById('btn-generate-report');
btnGenerateReport.addEventListener('click', () => {
  const content = document.getElementById('report-content');
  const opt = {
    margin: [10,10,10,10],
    filename: 'Report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'A4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(content).save();
  }
)