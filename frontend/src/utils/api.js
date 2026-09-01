/**
 * API Client
 * Handles all API calls to the backend
 */

import { API_URL } from './apiConfig';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // A 401 on an *authenticated* request means the session died — bounce to
      // login. A 401 from the login/credential endpoints themselves just means
      // "wrong password": redirecting there hard-reloads the page and destroys
      // the React error state before it can render, so the user sees a silently
      // cleared form and no message at all. Let those throw normally instead.
      if (response.status === 401 && !options.skipAuthRedirect) {
        this.setToken(null);
        window.location.href = '/login';
      }
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRedirect: true,
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    this.setToken(null);
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Buildings
  async getBuildings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/buildings${query ? `?${query}` : ''}`);
  }

  async getBuilding(id) {
    return this.request(`/buildings/${id}`);
  }

  async createBuilding(data) {
    return this.request('/buildings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBuilding(id, data) {
    return this.request(`/buildings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBuilding(id) {
    return this.request(`/buildings/${id}`, {
      method: 'DELETE',
    });
  }

  async assignSpToBuilding(buildingId, serviceProviderId, priority) {
    return this.request(`/buildings/${buildingId}/service-providers`, {
      method: 'POST',
      body: JSON.stringify({ serviceProviderId, priority }),
    });
  }

  async removeSpFromBuilding(buildingId, spId) {
    return this.request(`/buildings/${buildingId}/service-providers/${spId}`, {
      method: 'DELETE',
    });
  }

  // Tenants
  async getTenants(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tenants${query ? `?${query}` : ''}`);
  }

  async getTenant(id) {
    return this.request(`/tenants/${id}`);
  }

  async createTenant(data) {
    return this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(id, data) {
    return this.request(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTenant(id) {
    return this.request(`/tenants/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkImportTenants(buildingId, tenants) {
    return this.request('/tenants/bulk', {
      method: 'POST',
      body: JSON.stringify({ buildingId, tenants }),
    });
  }

  async bulkImportBuildings(pmCompanyId, buildings) {
    return this.request('/buildings/bulk', {
      method: 'POST',
      body: JSON.stringify({ pmCompanyId, buildings }),
    });
  }

  // Service Providers
  async getServiceProviders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/service-providers${query ? `?${query}` : ''}`);
  }

  async getServiceProvider(id) {
    return this.request(`/service-providers/${id}`);
  }

  async createServiceProvider(data) {
    return this.request('/service-providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceProvider(id, data) {
    return this.request(`/service-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceProvider(id) {
    return this.request(`/service-providers/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleSpStatus(id) {
    return this.request(`/service-providers/${id}/toggle-status`, {
      method: 'PUT',
    });
  }

  // PM Companies
  async getPmCompanies() {
    return this.request('/pm-companies');
  }

  async getPmCompany(id) {
    return this.request(`/pm-companies/${id}`);
  }

  async createPmCompany(data) {
    return this.request('/pm-companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePmCompany(id, data) {
    return this.request(`/pm-companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePmCompany(id) {
    return this.request(`/pm-companies/${id}`, {
      method: 'DELETE',
    });
  }

  // Incidents
  async getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/incidents${query ? `?${query}` : ''}`);
  }

  async getIncident(id) {
    return this.request(`/incidents/${id}`);
  }

  async getIncidentStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/incidents/stats${query ? `?${query}` : ''}`);
  }

  async closeIncident(id, reason) {
    return this.request(`/incidents/${id}/close`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async translateIncidentSummary(id, targetLanguage) {
    return this.request(`/incidents/${id}/translate`, {
      method: 'POST',
      body: JSON.stringify({ targetLanguage }),
    });
  }

  // Reports
  async getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports${query ? `?${query}` : ''}`);
  }

  async getReport(id) {
    return this.request(`/reports/${id}`);
  }

  async resendReport(id, email) {
    return this.request(`/reports/${id}/resend`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  getReportPdfUrl(id) {
    return `${API_URL}/reports/${id}/pdf?token=${this.token}`;
  }

  // Employees
  async getEmployees() {
    return this.request('/employees');
  }

  async getEmployee(id) {
    return this.request(`/employees/${id}`);
  }

  async createEmployee(data) {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id, data) {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployee(id) {
    return this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // On-Call Schedules
  async getOnCallSchedules() {
    return this.request('/oncall');
  }

  async getCurrentOnCall() {
    return this.request('/oncall/current');
  }

  async getEmployeeSchedules(employeeId) {
    return this.request(`/oncall/employee/${employeeId}`);
  }

  async createOnCallSchedule(data) {
    return this.request('/oncall', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOnCallSchedule(id, data) {
    return this.request(`/oncall/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOnCallSchedule(id) {
    return this.request(`/oncall/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkUpdateSchedules(employeeId, schedules) {
    return this.request('/oncall/bulk', {
      method: 'POST',
      body: JSON.stringify({ fm_employee_id: employeeId, schedules }),
    });
  }

  async getWeekAssignments(from, to) {
    return this.request(`/oncall/week-assignments?from=${from}&to=${to}`);
  }

  async saveWeekAssignment(data) {
    return this.request('/oncall/week-assignment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Settings
  async getCompanySettings() {
    return this.request('/settings/company');
  }

  async updateCompanySettings(data) {
    return this.request('/settings/company', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getProfile() {
    return this.request('/settings/profile');
  }

  async updateProfile(data) {
    return this.request('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/settings/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getUsers() {
    return this.request('/settings/users');
  }

  async createUser(data) {
    return this.request('/settings/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/settings/users/${id}`, {
      method: 'DELETE',
    });
  }

  async updateUser(id, data) {
    return this.request(`/settings/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Billing
  async getBillingStatus() {
    return this.request('/billing/status');
  }

  async getBillingPlans(language = 'de') {
    // Pass language parameter for localized content
    return this.request(`/billing/plans?lang=${language}&_=${Date.now()}`);
  }

  async createCheckoutSession(priceId, opts = {}) {
    return this.request('/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId, ...opts }),
    });
  }

  // Telephony / after-hours number provisioning
  async getTelephonyStatus() {
    return this.request('/telephony/status');
  }

  async getAvailableNumbers({ type = 'local', areaCode = '30' } = {}) {
    const qs = new URLSearchParams({ type, ...(areaCode ? { areaCode } : {}) });
    return this.request(`/telephony/available?${qs}`);
  }

  async provisionNumber(pmCompanyId, opts = {}) {
    return this.request('/telephony/provision', {
      method: 'POST',
      body: JSON.stringify({ pmCompanyId, ...opts }),
    });
  }

  async setupByoForward(pmCompanyId, publishedNumber) {
    return this.request('/telephony/byo-forward', {
      method: 'POST',
      body: JSON.stringify({ pmCompanyId, publishedNumber }),
    });
  }

  async startTelephonyVerification(pmCompanyId) {
    return this.request('/telephony/verify-test-call', {
      method: 'POST',
      body: JSON.stringify({ pmCompanyId }),
    });
  }

  async confirmTelephonyHeard(verificationId) {
    return this.request(`/telephony/verify-test-call/${verificationId}/confirm-heard`, {
      method: 'POST',
    });
  }

  async releaseTelephonyNumber(pmCompanyId) {
    return this.request('/telephony/release', {
      method: 'POST',
      body: JSON.stringify({ pmCompanyId, confirm: true }),
    });
  }

  async getCarrierForwarding(lang = 'de') {
    return this.request(`/telephony/carriers?lang=${lang}`);
  }

  async createBillingPortal() {
    return this.request('/billing/create-portal', {
      method: 'POST',
    });
  }

  // Email Verification
  async sendVerificationEmail() {
    return this.request('/email-verification/send', {
      method: 'POST',
    });
  }

  async getVerificationStatus() {
    return this.request('/email-verification/status');
  }

  // GDPR / Privacy
  async getGdprRequests() {
    return this.request('/gdpr/my-requests');
  }

  async requestDataExport() {
    return this.request('/gdpr/request-export', {
      method: 'POST',
    });
  }

  async requestAccountDeletion(reason) {
    return this.request('/gdpr/request-deletion', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async cancelDeletionRequest(id) {
    return this.request(`/gdpr/cancel-deletion/${id}`, {
      method: 'POST',
    });
  }

  async updateConsent(consentType, consented) {
    return this.request('/gdpr/consent', {
      method: 'POST',
      body: JSON.stringify({ consent_type: consentType, consented }),
    });
  }

  async getMyData() {
    return this.request('/gdpr/my-data');
  }

  async getConsentStatus() {
    return this.request('/gdpr/consent-status');
  }

  // Entitlements
  async getEntitlements() {
    return this.request('/me/entitlements');
  }

  async getSettingsBilling() {
    return this.request('/settings/billing');
  }

  async getEntitlementPackages() {
    return this.request('/entitlements/packages');
  }

  async getEntitlementFeatures() {
    return this.request('/entitlements/features');
  }

  async requestAddon(featureId) {
    return this.request('/entitlements/request-addon', {
      method: 'POST',
      body: JSON.stringify({ feature_id: featureId }),
    });
  }
}

export const api = new ApiClient();
export default api;
