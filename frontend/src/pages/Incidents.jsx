import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

export function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [pmCompanies, setPmCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPm, setSelectedPm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [missingReportOnly, setMissingReportOnly] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();

  useEffect(() => {
    // Check for pmCompanyId/status/isEmergency/dateFrom/missingReport in URL
    // params — lets the dashboard's stat tiles link straight into a
    // pre-filtered list instead of dumping the user on the unfiltered
    // "all incidents" view.
    const pmIdParam = searchParams.get('pmCompanyId');
    if (pmIdParam) {
      setSelectedPm(pmIdParam);
    }
    const statusParam = searchParams.get('status');
    if (statusParam === 'open') {
      setFilter('open');
    }
    if (searchParams.get('isEmergency') === 'true') {
      setFilter('emergency');
    }
    const dateFromParam = searchParams.get('dateFrom');
    if (dateFromParam) {
      setDateFrom(dateFromParam);
    }
    if (searchParams.get('missingReport') === 'true') {
      setMissingReportOnly(true);
    }
    loadPmCompanies();
  }, [searchParams]);

  useEffect(() => {
    loadIncidents();
  }, [filter, selectedPm, dateFrom, missingReportOnly]);

  const loadPmCompanies = async () => {
    try {
      const data = await api.getPmCompanies();
      setPmCompanies(data.pmCompanies);
    } catch (err) {
      console.error('Failed to load PM companies:', err);
    }
  };

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'open') params.status = 'open';
      if (filter === 'emergency') params.isEmergency = 'true';
      if (selectedPm) params.pmCompanyId = selectedPm;
      if (dateFrom) params.dateFrom = dateFrom;
      if (missingReportOnly) params.missingReport = 'true';

      const data = await api.getIncidents(params);
      setIncidents(data.incidents);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = language === 'de' ? 'de-DE' : 'en-US';
    return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get current responsibility state
  const getResponsibility = (incident) => {
    if (['closed', 'sp_completed'].includes(incident.status)) {
      return { label: t('resolved'), class: 'resolved' };
    }
    if (incident.missing_report > 0) {
      return { label: t('reportOverdue'), class: 'alert' };
    }
    if (incident.status === 'sp_accepted') {
      return { label: t('spWorking'), class: 'pending' };
    }
    if (incident.status === 'sp_dispatched') {
      return { label: t('awaitingSp'), class: 'pending' };
    }
    if (incident.status === 'escalated_fm') {
      return { label: t('fmEscalated'), class: 'alert' };
    }
    return { label: t('open'), class: 'open' };
  };

  const selectedPmName = selectedPm ? pmCompanies.find(p => p.id === selectedPm)?.name : null;

  return (
    <div>
      {/* Context Header */}
      <div style={{
        background: selectedPm ? '#1A1A1A' : '#F5F5F5',
        color: selectedPm ? '#FFF' : '#000',
        padding: '12px 20px',
        marginBottom: 24,
        borderLeft: selectedPm ? 'none' : '4px solid #1A1A1A',
      }}>
        <div style={{ fontSize: 11, color: selectedPm ? '#999' : '#666', marginBottom: 2 }}>
          {selectedPm ? t('pmScopedView') : t('fmGlobalView')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          {selectedPm ? `${t('incidentsFor')} ${selectedPmName}` : t('allIncidentsAcrossPM')}
        </div>
      </div>

      <div className="actions-row" style={{ gap: 16 }}>
        <select
          className="form-select"
          style={{ width: 180 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">{t('allIncidents')}</option>
          <option value="open">{t('openOnly')}</option>
          <option value="emergency">{t('emergenciesOnly')}</option>
        </select>
        <select
          className="form-select"
          style={{ width: 220 }}
          value={selectedPm}
          onChange={(e) => setSelectedPm(e.target.value)}
        >
          <option value="">{t('allPmCompanies')}</option>
          {pmCompanies.map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.name}</option>
          ))}
        </select>
        {selectedPm && (
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setSelectedPm('')}
          >
            {t('clearPmFilter')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 130 }}>{t('dateTime')}</th>
              {!selectedPm && <th>{t('pmCompanyColumn')}</th>}
              <th>{t('building')}</th>
              <th>{t('issue')}</th>
              <th style={{ width: 90 }}>{t('severity')}</th>
              <th style={{ width: 80 }}>{t('aiConf')}</th>
              <th style={{ width: 130 }}>{t('responsibility')}</th>
              <th>{t('assignedSp')}</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={selectedPm ? 7 : 8} style={{ textAlign: 'center', color: '#666', padding: 40 }}>
                  {t('noIncidentsFound')}
                </td>
              </tr>
            ) : (
              incidents.map((incident) => {
                const resp = getResponsibility(incident);
                return (
                  <tr
                    key={incident.id}
                    className={`clickable ${incident.is_emergency ? 'emergency' : ''}`}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatDate(incident.created_at)}</td>
                    {!selectedPm && <td>{incident.pm_company_name || '-'}</td>}
                    <td>{incident.building_name || 'Unknown'}</td>
                    <td>{incident.issue_category?.replace(/_/g, ' ') || 'Unknown'}</td>
                    <td>
                      {incident.is_emergency ? (
                        <span style={{ color: '#C00000', fontWeight: 500 }}>{t('emergency')}</span>
                      ) : (
                        <span style={{ color: '#666' }}>{t('normal')}</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        color: incident.ai_confidence >= 80 ? '#00A000' : '#C00000',
                        fontWeight: incident.ai_confidence < 80 ? 500 : 400
                      }}>
                        {incident.ai_confidence || 0}%
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: resp.class === 'alert' ? 600 : 400,
                        color: resp.class === 'alert' ? '#C00000' :
                               resp.class === 'resolved' ? '#00A000' :
                               resp.class === 'pending' ? '#CC8800' : '#000'
                      }}>
                        {resp.label}
                      </span>
                    </td>
                    <td>{incident.sp_company_name || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
