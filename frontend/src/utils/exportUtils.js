/**
 * Export Utilities
 * Export alerts and reports to CSV and PDF formats
 */

// CSV Export
export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

// Export alerts to CSV
export const exportAlertsToCSV = (alerts) => {
  const exportData = alerts.map(alert => ({
    'Alert ID': alert._id || alert.id,
    'Type': alert.alert_type,
    'Room': alert.room_id,
    'Patient': alert.patient_id || 'N/A',
    'Description': alert.description,
    'Status': alert.status,
    'Confidence': alert.confidence || 'N/A',
    'Timestamp': new Date(alert.timestamp).toLocaleString(),
    'Acknowledged': alert.acknowledged ? 'Yes' : 'No',
    'Acknowledged By': alert.acknowledged_by || 'N/A',
    'Acknowledged At': alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleString() : 'N/A'
  }));

  const filename = `alerts_${new Date().toISOString().split('T')[0]}.csv`;
  exportToCSV(exportData, filename);
};

// Export contacts to CSV
export const exportContactsToCSV = (contacts) => {
  const exportData = contacts.map(contact => ({
    'Name': contact.name,
    'Phone': contact.phone_number,
    'Email': contact.email || 'N/A',
    'Priority': contact.priority,
    'Active': contact.active ? 'Yes' : 'No',
    'Firebase Token': contact.firebase_token ? 'Yes' : 'No'
  }));

  const filename = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
  exportToCSV(exportData, filename);
};

// Helper function to download file
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generate PDF report (requires jsPDF library - install separately)
export const exportAlertsToPDF = async (alerts, options = {}) => {
  try {
    // Dynamic import to avoid loading jsPDF if not needed
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const {
      title = 'CarePulse Alert Report',
      subtitle = `Generated on ${new Date().toLocaleString()}`,
      includeCharts = false
    } = options;

    // Title
    doc.setFontSize(20);
    doc.text(title, 20, 20);
    
    // Subtitle
    doc.setFontSize(12);
    doc.text(subtitle, 20, 30);
    
    // Summary
    doc.setFontSize(14);
    doc.text('Summary', 20, 45);
    doc.setFontSize(10);
    doc.text(`Total Alerts: ${alerts.length}`, 20, 55);
    doc.text(`Active: ${alerts.filter(a => a.status === 'active').length}`, 20, 62);
    doc.text(`Acknowledged: ${alerts.filter(a => a.status === 'acknowledged').length}`, 20, 69);
    doc.text(`Resolved: ${alerts.filter(a => a.status === 'resolved').length}`, 20, 76);
    
    // Alert list
    let yPosition = 90;
    doc.setFontSize(14);
    doc.text('Alert Details', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(9);
    alerts.slice(0, 20).forEach((alert, index) => {  // Limit to first 20 alerts
      if (yPosition > 270) {  // Check if we need a new page
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(`${index + 1}. ${alert.alert_type.toUpperCase()} - ${alert.room_id}`, 20, yPosition);
      yPosition += 5;
      doc.text(`   ${alert.description}`, 20, yPosition);
      yPosition += 5;
      doc.text(`   Status: ${alert.status} | Time: ${new Date(alert.timestamp).toLocaleString()}`, 20, yPosition);
      yPosition += 8;
    });
    
    if (alerts.length > 20) {
      doc.text(`... and ${alerts.length - 20} more alerts`, 20, yPosition);
    }
    
    // Save PDF
    const filename = `alert_report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('PDF export requires jsPDF library. Install with: npm install jspdf');
  }
};

// Export system health report
export const exportSystemHealthReport = (healthData) => {
  const reportData = [{
    'Timestamp': new Date().toLocaleString(),
    'WebSocket': healthData.websocketConnected ? 'Connected' : 'Disconnected',
    'Active Streams': healthData.activeStreams || 0,
    'Total Alerts': healthData.totalAlerts || 0,
    'Active Alerts': healthData.activeAlerts || 0,
    'API Status': healthData.apiStatus || 'Unknown',
    'Database': healthData.databaseConnected ? 'Connected' : 'Disconnected'
  }];
  
  const filename = `system_health_${new Date().toISOString().split('T')[0]}.csv`;
  exportToCSV(reportData, filename);
};

// JSON export (for importing/backup)
export const exportToJSON = (data, filename = 'export.json') => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

export default {
  exportToCSV,
  exportAlertsToCSV,
  exportContactsToCSV,
  exportAlertsToPDF,
  exportSystemHealthReport,
  exportToJSON
};
