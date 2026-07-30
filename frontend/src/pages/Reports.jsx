import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

export function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await api.getReports();
      setReports(data.reports);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (id) => {
    const email = prompt(t('enterEmailToSend'));
    if (!email) return;

    try {
      await api.resendReport(id, email);
      alert(t('reportSentSuccessfully'));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewPdf = (id) => {
    window.open(api.getReportPdfUrl(id), '_blank');
  };

  const formatDate = (dateStr) => {
    const locale = language === 'de' ? 'de-DE' : 'en-US';
    return new Date(dateStr).toLocaleDateString(locale);
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('reportsTitle')}</h1>
      </div>

      <table>
        <thead>
          <tr>
            <th>{t('date')}</th>
            <th>{t('pmCompanyColumn')}</th>
            <th>{t('incidentsCount')}</th>
            <th>{t('sentTo')}</th>
            <th>{t('statusColumn')}</th>
            <th>{t('actionsColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>
                {t('noReportsYet')}
              </td>
            </tr>
          ) : (
            reports.map((report) => (
              <tr key={report.id}>
                <td>{formatDate(report.report_date)}</td>
                <td>{report.pm_company_name}</td>
                <td>{report.incidents_included?.length || 0}</td>
                <td>{report.sent_to || '-'}</td>
                <td>
                  {report.sent_at ? (
                    <div>
                      <span className="badge badge-success">{t('sent')}</span>
                      <div className="text-sm text-secondary" style={{ marginTop: 4 }}>
                        {new Date(report.sent_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="badge badge-pending">{t('pending')}</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-secondary btn-small" onClick={() => handleViewPdf(report.id)}>
                    {t('viewPdf')}
                  </button>
                  <button className="btn btn-secondary btn-small" style={{ marginLeft: 8 }} onClick={() => handleResend(report.id)}>
                    {t('resend')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
