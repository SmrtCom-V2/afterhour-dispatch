import { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const initialEmployeeForm = {
  name: '',
  email: '',
  phone: '',
  role: 'staff',
  is_active: true,
  can_be_oncall: true,
  notes: '',
};

// Icons
const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const UserPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ForwardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 17 20 12 15 7"/>
    <path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// Helper functions for week calculations
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (date) => {
  const start = getWeekStart(date);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
};

const formatDate = (date, language = 'en') => {
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  return new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const formatDateFull = (date, language = 'en') => {
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  return new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getMonthYear = (date, language = 'en') => {
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  return new Date(date).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
};

const isCurrentWeek = (startDate) => {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const start = getWeekStart(new Date(startDate));
  return start.getTime() === weekStart.getTime();
};

const isPastWeek = (startDate) => {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const start = getWeekStart(new Date(startDate));
  return start.getTime() < weekStart.getTime();
};

const generateWeeks = (startOffset = 0, numWeeks = 12, language = 'en') => {
  const weeks = [];
  const today = new Date();
  const baseWeekStart = getWeekStart(today);
  // Move base to startOffset weeks from current
  const offsetStart = new Date(baseWeekStart.getTime() + startOffset * 7 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < numWeeks; i++) {
    const start = new Date(offsetStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const end = getWeekEnd(start);
    weeks.push({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      startDate: start,
      endDate: end,
      label: `${formatDate(start, language)} - ${formatDate(end, language)}`,
      fullLabel: `${formatDateFull(start, language)} - ${formatDateFull(end, language)}`,
      isCurrent: isCurrentWeek(start),
      isPast: isPastWeek(start),
      weekNumber: Math.ceil((start - new Date(start.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000)),
    });
  }
  return weeks;
};

export function Employees() {
  const { t, language } = useLanguage();

  const ROLES = [
    { value: 'admin', label: t('admin') },
    { value: 'dispatcher', label: t('dispatcher') },
    { value: 'staff', label: t('staff') },
  ];

  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [currentOnCall, setCurrentOnCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rotation');
  const [search, setSearch] = useState('');

  // Rotation state - can scroll through months
  const [weekOffset, setWeekOffset] = useState(0); // 0 = starting from current week
  const [rotations, setRotations] = useState({});
  const weeks = useMemo(() => generateWeeks(weekOffset, 12, language), [weekOffset, language]);

  // Employee modal
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);

  // Rotation assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [usePhysicalPhone, setUsePhysicalPhone] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [empData, schedData, onCallData] = await Promise.all([
        api.getEmployees(),
        api.getOnCallSchedules(),
        api.getCurrentOnCall(),
      ]);
      setEmployees(empData || []);
      setSchedules(schedData || []);
      setCurrentOnCall(onCallData);
      buildRotationsFromSchedules(schedData || [], empData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildRotationsFromSchedules = (scheds, emps) => {
    // Build rotation assignments - in production this would come from a rotation_assignments table
    const rotationMap = {};

    // For demo, assign first few employees in rotation
    const onCallEmps = emps.filter(e => e.can_be_oncall && e.is_active);
    if (onCallEmps.length > 0) {
      const allWeeks = generateWeeks(-4, 20); // Get past and future weeks
      allWeeks.forEach((week, idx) => {
        if (onCallEmps.length > 0) {
          const emp = onCallEmps[idx % onCallEmps.length];
          rotationMap[week.start] = {
            employeeId: emp.id,
            employeeName: emp.name,
            employeePhone: emp.phone,
            usePhysicalPhone: false,
            notes: '',
          };
        }
      });
    }

    setRotations(rotationMap);
  };

  // Stats
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.is_active).length,
    onCallCapable: employees.filter(e => e.can_be_oncall && e.is_active).length,
  };

  const onCallEmployees = employees.filter(e => e.can_be_oncall && e.is_active);

  // Group weeks by month for display
  const weeksByMonth = useMemo(() => {
    const groups = {};
    weeks.forEach(week => {
      const monthKey = getMonthYear(week.startDate, language);
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(week);
    });
    return groups;
  }, [weeks, language]);

  // Navigation
  const goToPreviousMonth = () => setWeekOffset(prev => prev - 4);
  const goToNextMonth = () => setWeekOffset(prev => prev + 4);
  const goToToday = () => setWeekOffset(0);

  // Employee handlers
  const handleAddEmployee = () => {
    setEmployeeForm(initialEmployeeForm);
    setEditingEmployee(null);
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (emp) => {
    setEmployeeForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      role: emp.role || 'staff',
      is_active: emp.is_active !== false,
      can_be_oncall: emp.can_be_oncall !== false,
      notes: emp.notes || '',
    });
    setEditingEmployee(emp);
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.name || !employeeForm.phone) {
      alert('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, employeeForm);
      } else {
        await api.createEmployee(employeeForm);
      }
      setShowEmployeeModal(false);
      loadData();
    } catch (err) {
      alert('Failed to save employee: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (emp) => {
    if (!confirm(`Delete employee "${emp.name}"? This will also remove their on-call assignments.`)) return;
    try {
      await api.deleteEmployee(emp.id);
      loadData();
    } catch (err) {
      alert('Failed to delete employee: ' + err.message);
    }
  };

  // Rotation handlers
  const handleAssignWeek = (week) => {
    if (week.isPast) return; // Don't allow editing past weeks
    setSelectedWeek(week);
    const existing = rotations[week.start];
    setSelectedAssignee(existing?.employeeId || '');
    setUsePhysicalPhone(existing?.usePhysicalPhone || false);
    setAssignmentNotes(existing?.notes || '');
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async () => {
    setSaving(true);
    try {
      const newRotations = { ...rotations };

      if (!selectedAssignee) {
        // Clear assignment
        delete newRotations[selectedWeek.start];
      } else {
        const emp = employees.find(e => e.id === selectedAssignee);
        if (emp) {
          newRotations[selectedWeek.start] = {
            employeeId: emp.id,
            employeeName: emp.name,
            employeePhone: emp.phone,
            usePhysicalPhone,
            notes: assignmentNotes,
          };
        }
      }

      setRotations(newRotations);
      setShowAssignModal(false);

      // In production, save to API:
      // await api.saveRotationAssignment({ weekStart: selectedWeek.start, employeeId: selectedAssignee, usePhysicalPhone, notes: assignmentNotes });
    } catch (err) {
      alert('Failed to save assignment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header-modern">
        <div>
          <h1 className="page-title">{t('employeesAndOnCall')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {t('manageTeamAndRotations')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleAddEmployee}>
            <UserPlusIcon /> {t('addEmployee')}
          </button>
        </div>
      </div>

      {/* Current On-Call Banner */}
      {currentOnCall && (
        <div className="live-status-bar" style={{ marginBottom: 24 }}>
          <div className="live-status-time">
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{t('currentlyOnCall')}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{currentOnCall.employee_name}</div>
            <div style={{ fontSize: 15, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <PhoneIcon /> {currentOnCall.employee_phone}
            </div>
          </div>
          <div className="live-status-indicators">
            <div className="live-indicator active">
              <div className="live-indicator-value">
                <PhoneIcon />
              </div>
              <div className="live-indicator-label">{t('callsForwarded')}</div>
            </div>
            <div className="live-indicator">
              <div className="live-indicator-value">
                {currentOnCall.start_time?.slice(0, 5)} - {currentOnCall.end_time?.slice(0, 5)}
              </div>
              <div className="live-indicator-label">{t('shiftHours')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card-modern primary">
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern primary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
          <div className="stat-card-value-modern">{stats.total}</div>
          <div className="stat-card-label-modern">{t('totalEmployees')}</div>
        </div>
        <div className="stat-card-modern success">
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <div className="stat-card-value-modern">{stats.active}</div>
          <div className="stat-card-label-modern">{t('active')}</div>
        </div>
        <div className="stat-card-modern warning">
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern warning">
              <PhoneIcon />
            </div>
          </div>
          <div className="stat-card-value-modern">{stats.onCallCapable}</div>
          <div className="stat-card-label-modern">{t('onCallReady')}</div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern primary">
              <CalendarIcon />
            </div>
          </div>
          <div className="stat-card-value-modern">{Object.keys(rotations).length}</div>
          <div className="stat-card-label-modern">{t('weeksPlanned')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('rotation')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'rotation' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'rotation' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'var(--transition)',
          }}
        >
          <CalendarIcon /> {t('weeklyRotation')}
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'employees' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'employees' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'var(--transition)',
          }}
        >
          <UserPlusIcon /> {t('teamMembersTab')}
        </button>
      </div>

      {/* Rotation Tab */}
      {activeTab === 'rotation' && (
        <div>
          {/* Call Forwarding Status */}
          <div className="forwarding-status" style={{ marginBottom: 24 }}>
            <div className={`forwarding-icon ${currentOnCall ? 'active' : 'inactive'}`}>
              <ForwardIcon />
            </div>
            <div className="forwarding-info">
              <div className="forwarding-label">{t('callForwardingStatus')}</div>
              <div className="forwarding-value">
                {currentOnCall
                  ? `${t('forwardingTo')} ${currentOnCall.employee_name}`
                  : t('noActiveOnCall')
                }
              </div>
            </div>
            <button className="forwarding-toggle">
              {currentOnCall ? t('configure') : t('setUp')}
            </button>
          </div>

          {/* Calendar Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            padding: '12px 16px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={goToPreviousMonth}
            >
              <ChevronLeftIcon /> {t('previous')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>
                {Object.keys(weeksByMonth)[0]}
              </span>
              {weekOffset !== 0 && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={goToToday}
                >
                  {t('today')}
                </button>
              )}
            </div>

            <button
              className="btn btn-sm btn-ghost"
              onClick={goToNextMonth}
            >
              {t('next')} <ChevronRightIcon />
            </button>
          </div>

          {/* Rotation Timeline */}
          <div className="rotation-timeline">
            {weeks.map((week) => {
              const assignment = rotations[week.start];
              return (
                <div
                  key={week.start}
                  className={`rotation-week ${week.isCurrent ? 'current' : ''}`}
                  onClick={() => handleAssignWeek(week)}
                  style={{
                    cursor: week.isPast ? 'default' : 'pointer',
                    opacity: week.isPast ? 0.6 : 1,
                  }}
                >
                  <div className="rotation-week-dates">
                    <div className="rotation-week-label">
                      {week.isCurrent ? `● ${language === 'de' ? 'Diese Woche' : 'This Week'}` : week.isPast ? t('past') : `${t('week')} ${week.weekNumber}`}
                    </div>
                    <div className="rotation-week-range">{week.label}</div>
                  </div>

                  {assignment ? (
                    <div className="rotation-assignee">
                      <div className="rotation-assignee-avatar">
                        {getInitials(assignment.employeeName)}
                      </div>
                      <div className="rotation-assignee-info">
                        <div className="rotation-assignee-name">
                          {assignment.employeeName}
                          {assignment.usePhysicalPhone && (
                            <span style={{
                              marginLeft: 8,
                              padding: '2px 6px',
                              background: 'var(--color-warning-bg)',
                              color: 'var(--color-warning)',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                            }}>
                              {t('physicalPhone')}
                            </span>
                          )}
                        </div>
                        <div className="rotation-assignee-phone">
                          <PhoneIcon /> {assignment.employeePhone}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rotation-assignee" style={{ opacity: 0.5 }}>
                      <div className="rotation-assignee-avatar" style={{
                        background: 'var(--color-bg-hover)',
                        color: 'var(--color-text-muted)'
                      }}>
                        ?
                      </div>
                      <div className="rotation-assignee-info">
                        <div className="rotation-assignee-name" style={{ color: 'var(--color-text-muted)' }}>
                          {t('notAssigned')}
                        </div>
                        <div className="rotation-assignee-phone">
                          {week.isPast ? t('pastWeek') : t('clickToAssign')}
                        </div>
                      </div>
                    </div>
                  )}

                  {!week.isPast && (
                    <div className="rotation-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handleAssignWeek(week); }}
                      >
                        {assignment ? t('change') : t('assign')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {onCallEmployees.length === 0 && (
            <div className="rotation-empty" style={{ marginTop: 24 }}>
              <div className="rotation-empty-icon">
                <UserPlusIcon />
              </div>
              <div className="rotation-empty-title">{t('noOnCallEmployees')}</div>
              <div className="rotation-empty-desc">
                {t('addEmployeesOnCallDescription')}
              </div>
              <button className="btn btn-primary" onClick={handleAddEmployee}>
                <UserPlusIcon /> {t('addFirstEmployee')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <>
          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ position: 'relative', maxWidth: 400 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder={t('searchEmployees')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input-pro"
                style={{ paddingLeft: 44 }}
              />
            </div>
          </div>

          {/* Employees Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {employees
              .filter(emp =>
                emp.name.toLowerCase().includes(search.toLowerCase()) ||
                emp.email?.toLowerCase().includes(search.toLowerCase()) ||
                emp.phone?.includes(search)
              )
              .map(emp => {
                const isCurrentlyOnCall = currentOnCall?.fm_employee_id === emp.id;
                return (
                  <div
                    key={emp.id}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: isCurrentlyOnCall ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 20,
                      transition: 'var(--transition)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{
                        width: 52,
                        height: 52,
                        borderRadius: 'var(--radius-full)',
                        background: isCurrentlyOnCall ? 'var(--color-success)' : 'var(--color-primary-light)',
                        color: isCurrentlyOnCall ? 'white' : 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 18,
                        flexShrink: 0,
                      }}>
                        {getInitials(emp.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 16 }}>{emp.name}</span>
                          {isCurrentlyOnCall && (
                            <span className="badge badge-success" style={{ fontSize: 10 }}>{t('onCall')}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <PhoneIcon /> {emp.phone}
                          </div>
                          {emp.email && (
                            <div style={{ opacity: 0.8 }}>{emp.email}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className={`badge ${emp.role === 'admin' ? 'badge-primary' : emp.role === 'dispatcher' ? 'badge-warning' : 'badge-default'}`}>
                            {emp.role === 'admin' ? t('admin') : emp.role === 'dispatcher' ? t('dispatcher') : t('staff')}
                          </span>
                          <span className={`badge ${emp.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {emp.is_active ? t('active') : t('inactive')}
                          </span>
                          {emp.can_be_oncall && (
                            <span className="badge badge-info">{t('onCallReady')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleEditEmployee(emp)}
                          title="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleDeleteEmployee(emp)}
                          title="Delete"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {employees.length === 0 && (
            <div className="rotation-empty">
              <div className="rotation-empty-icon">
                <UserPlusIcon />
              </div>
              <div className="rotation-empty-title">{t('noEmployeesYet')}</div>
              <div className="rotation-empty-desc">
                {t('addTeamMembersDescription')}
              </div>
              <button className="btn btn-primary" onClick={handleAddEmployee}>
                <UserPlusIcon /> {t('addFirstEmployee')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Employee Modal - Professional Design */}
      {showEmployeeModal && (
        <div className="modal-overlay" onClick={() => setShowEmployeeModal(false)}>
          <div className="modal-pro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon primary">
                <UserPlusIcon />
              </div>
              <div className="modal-pro-title-group">
                <h3 className="modal-pro-title">
                  {editingEmployee ? t('editEmployee') : t('addNewEmployee')}
                </h3>
                <p className="modal-pro-subtitle">
                  {editingEmployee ? t('updateEmployeeInfo') : t('addTeamMemberToSystem')}
                </p>
              </div>
              <button className="modal-pro-close" onClick={() => setShowEmployeeModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-pro-body">
              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('basicInformation')}</div>

                <div className="form-field-pro">
                  <div className="form-label-pro">
                    <span className="form-label-pro-text">{t('fullName')}</span>
                    <span className="form-label-pro-hint">{t('required')}</span>
                  </div>
                  <input
                    type="text"
                    className="form-input-pro"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    placeholder={t('enterFullName')}
                  />
                </div>

                <div className="form-row-pro">
                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('phoneNumber')}</span>
                      <span className="form-label-pro-hint">{t('required')}</span>
                    </div>
                    <input
                      type="tel"
                      className="form-input-pro"
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                      placeholder="+49 xxx xxxxxxx"
                    />
                  </div>
                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('email')}</span>
                      <span className="form-label-pro-hint">{t('optional')}</span>
                    </div>
                    <input
                      type="email"
                      className="form-input-pro"
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="form-field-pro">
                  <div className="form-label-pro">
                    <span className="form-label-pro-text">{t('role')}</span>
                  </div>
                  <select
                    className="form-input-pro"
                    value={employeeForm.role}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('settingsSection')}</div>

                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={employeeForm.is_active}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, is_active: e.target.checked })}
                  />
                  <div className="toggle-switch-track">
                    <div className="toggle-switch-thumb" />
                  </div>
                  <div className="toggle-switch-label">
                    <div className="toggle-switch-title">{t('activeEmployee')}</div>
                    <div className="toggle-switch-desc">{t('canLoginAndAssigned')}</div>
                  </div>
                </label>

                <label className="toggle-switch" style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={employeeForm.can_be_oncall}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, can_be_oncall: e.target.checked })}
                  />
                  <div className="toggle-switch-track">
                    <div className="toggle-switch-thumb" />
                  </div>
                  <div className="toggle-switch-label">
                    <div className="toggle-switch-title">{t('availableForOnCall')}</div>
                    <div className="toggle-switch-desc">{t('canBeAssignedRotations')}</div>
                  </div>
                </label>
              </div>

              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('notes')}</div>
                <div className="form-field-pro">
                  <textarea
                    className="form-input-pro"
                    value={employeeForm.notes}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                    placeholder={t('internalNotesEmployee')}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 80 }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-pro-footer">
              {editingEmployee && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    handleDeleteEmployee(editingEmployee);
                    setShowEmployeeModal(false);
                  }}
                >
                  {t('delete')}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowEmployeeModal(false)}>
                {t('cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSaveEmployee} disabled={saving}>
                {saving ? t('saving') : editingEmployee ? t('saveChanges') : t('addEmployee')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal - Professional Design */}
      {showAssignModal && selectedWeek && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-pro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon success">
                <CalendarIcon />
              </div>
              <div className="modal-pro-title-group">
                <h3 className="modal-pro-title">{t('assignOnCallWeek')}</h3>
                <p className="modal-pro-subtitle">
                  {selectedWeek.fullLabel}
                  {selectedWeek.isCurrent && ` (${t('currentWeek')})`}
                </p>
              </div>
              <button className="modal-pro-close" onClick={() => setShowAssignModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-pro-body">
              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('selectEmployee')}</div>

                {onCallEmployees.length === 0 ? (
                  <div style={{
                    padding: 24,
                    textAlign: 'center',
                    background: 'var(--color-bg-hover)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                      {t('noEmployeesForOnCall')}
                    </p>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => { setShowAssignModal(false); handleAddEmployee(); }}
                    >
                      {t('addEmployee')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Option to clear assignment */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: selectedAssignee === '' ? 'var(--color-danger-bg)' : 'var(--color-bg-hover)',
                        border: selectedAssignee === '' ? '2px solid var(--color-danger)' : '2px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                    >
                      <input
                        type="radio"
                        name="assignee"
                        value=""
                        checked={selectedAssignee === ''}
                        onChange={() => setSelectedAssignee('')}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-bg-active)',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                      }}>
                        —
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>{t('noAssignment')}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                          {t('clearWeekOnCall')}
                        </div>
                      </div>
                    </label>

                    {onCallEmployees.map(emp => (
                      <label
                        key={emp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 16px',
                          background: selectedAssignee === emp.id ? 'var(--color-primary-light)' : 'var(--color-bg-hover)',
                          border: selectedAssignee === emp.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'var(--transition)',
                        }}
                      >
                        <input
                          type="radio"
                          name="assignee"
                          value={emp.id}
                          checked={selectedAssignee === emp.id}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                          style={{ display: 'none' }}
                        />
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-full)',
                          background: selectedAssignee === emp.id ? 'var(--color-primary)' : 'var(--color-bg-active)',
                          color: selectedAssignee === emp.id ? 'white' : 'var(--color-text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 14,
                        }}>
                          {getInitials(emp.name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{emp.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                            {emp.phone}
                          </div>
                        </div>
                        {selectedAssignee === emp.id && (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedAssignee && (
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('phoneHandling')}</div>

                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={usePhysicalPhone}
                      onChange={(e) => setUsePhysicalPhone(e.target.checked)}
                    />
                    <div className="toggle-switch-track">
                      <div className="toggle-switch-thumb" />
                    </div>
                    <div className="toggle-switch-label">
                      <div className="toggle-switch-title">{t('usePhysicalPhone')}</div>
                      <div className="toggle-switch-desc">{t('employeeCarriesPhone')}</div>
                    </div>
                  </label>

                  {!usePhysicalPhone && (
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      background: 'var(--color-info-bg)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      color: 'var(--color-text-secondary)',
                    }}>
                      {t('callForwardingInfo')}
                    </div>
                  )}
                </div>
              )}

              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('notesOptional')}</div>
                <div className="form-field-pro">
                  <textarea
                    className="form-input-pro"
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    placeholder={t('specialInstructionsWeek')}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>
              </div>

              {selectedWeek.isCurrent && selectedAssignee && (
                <div style={{
                  padding: 16,
                  background: 'var(--color-warning-bg)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-warning)', marginBottom: 4 }}>
                      {t('immediateEffect')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {t('changeWillTakeEffect')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-pro-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveAssignment}
                disabled={saving}
              >
                {saving ? t('saving') : t('saveAssignment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
