const SA_API_URL = import.meta.env.VITE_SA_API_URL || 'http://localhost:3001/sa';

class SaApiClient {
  constructor() {
    this.token = localStorage.getItem('sa_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('sa_token', token);
    } else {
      localStorage.removeItem('sa_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${SA_API_URL}${endpoint}`;
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    this.setToken(null);
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getDashboard() {
    return this.request('/dashboard');
  }

  async getCompanies(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/companies${query ? `?${query}` : ''}`);
  }

  async getCompany(companyId) {
    return this.request(`/companies/${companyId}`);
  }

  async getCompanyUsers(companyId) {
    return this.request(`/companies/${companyId}/users`);
  }

  async getCompanyUsage(companyId, range = '30d') {
    return this.request(`/companies/${companyId}/usage?range=${range}`);
  }

  async getCompanyNotes(companyId) {
    return this.request(`/companies/${companyId}/notes`);
  }

  async addCompanyNote(companyId, payload) {
    return this.request(`/companies/${companyId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async extendTrial(companyId, payload) {
    return this.request(`/companies/${companyId}/actions/extend-trial`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async changePlan(companyId, payload) {
    return this.request(`/companies/${companyId}/actions/change-plan`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async suspendCompany(companyId, payload) {
    return this.request(`/companies/${companyId}/actions/suspend`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async reactivateCompany(companyId, payload) {
    return this.request(`/companies/${companyId}/actions/reactivate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/audit-logs${query ? `?${query}` : ''}`);
  }

  async getTrials(filter = null) {
    const query = filter ? `?filter=${filter}` : '';
    return this.request(`/trials${query}`);
  }

  async extendTrialDays(companyId, days, reason) {
    return this.request(`/trials/${companyId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days, reason }),
    });
  }

  async bulkExtendTrials(companyIds, days, reason) {
    return this.request('/trials/bulk-extend', {
      method: 'POST',
      body: JSON.stringify({ company_ids: companyIds, days, reason }),
    });
  }

  async getBillingFailures() {
    return this.request('/billing/failures');
  }

  async getBillingOverview() {
    return this.request('/billing/overview');
  }

  async getBillingSubscriptions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/billing/subscriptions${query ? `?${query}` : ''}`);
  }

  async getCompanyInvoices(companyId) {
    return this.request(`/billing/company/${companyId}/invoices`);
  }

  async getBillingRevenue(period = '12m') {
    return this.request(`/billing/revenue?period=${period}`);
  }

  async getUsage() {
    return this.request('/usage');
  }

  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users${query ? `?${query}` : ''}`);
  }

  async getSupportNotes(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/support${query ? `?${query}` : ''}`);
  }

  async getSystemHealth() {
    return this.request('/system-health');
  }

  async startImpersonation(companyId, adminId) {
    return this.request(`/companies/${companyId}/actions/impersonate`, {
      method: 'POST',
      body: JSON.stringify({ admin_id: adminId }),
    });
  }

  async stopImpersonation(companyId, adminId) {
    return this.request(`/companies/${companyId}/actions/stop-impersonation`, {
      method: 'POST',
      body: JSON.stringify({ admin_id: adminId }),
    });
  }

  async getSettings() {
    return this.request('/settings');
  }

  async createPlan(payload) {
    return this.request('/settings/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePlan(id, payload) {
    return this.request(`/settings/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getAllowlist() {
    return this.request('/settings/allowlist');
  }

  async addAllowlistEntry(email) {
    return this.request('/settings/allowlist', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async deleteAllowlistEntry(id) {
    return this.request(`/settings/allowlist/${id}`, {
      method: 'DELETE',
    });
  }

  async disableUser(id) {
    return this.request(`/users/${id}/disable`, {
      method: 'POST',
    });
  }

  // Feature Flags
  async getFeatureFlags() {
    return this.request('/feature-flags');
  }

  async updateFeatureFlag(key, enabled) {
    return this.request(`/feature-flags/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async getFeatureFlagCompanies(key) {
    return this.request(`/feature-flags/${key}/companies`);
  }

  async setCompanyFeatureFlag(key, companyId, enabled) {
    return this.request(`/feature-flags/${key}/company/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async removeCompanyFeatureFlag(key, companyId) {
    return this.request(`/feature-flags/${key}/company/${companyId}`, {
      method: 'DELETE',
    });
  }

  async getCompanyFeatureFlags(companyId) {
    return this.request(`/feature-flags/company/${companyId}`);
  }

  async bulkUpdateFeatureFlags(updates) {
    return this.request('/feature-flags/bulk', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  // GDPR Tools
  async getGdprStats() {
    return this.request('/gdpr/stats');
  }

  async getGdprExportRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/gdpr/export-requests${query ? `?${query}` : ''}`);
  }

  async getGdprDeletionRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/gdpr/deletion-requests${query ? `?${query}` : ''}`);
  }

  async processExportRequest(id) {
    return this.request(`/gdpr/export-requests/${id}/process`, {
      method: 'POST',
    });
  }

  async processDeletionRequest(id, confirm) {
    return this.request(`/gdpr/deletion-requests/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    });
  }

  async rejectDeletionRequest(id, reason) {
    return this.request(`/gdpr/deletion-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getUserGdprData(userId) {
    return this.request(`/gdpr/user/${userId}/data`);
  }

  async getCompanyGdprData(companyId) {
    return this.request(`/gdpr/company/${companyId}/data`);
  }

  async anonymizeUser(userId, confirm, reason) {
    return this.request(`/gdpr/user/${userId}/anonymize`, {
      method: 'POST',
      body: JSON.stringify({ confirm, reason }),
    });
  }

  async getDataRetentionSettings() {
    return this.request('/gdpr/data-retention');
  }

  async updateDataRetention(dataType, settings) {
    return this.request(`/gdpr/data-retention/${dataType}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async runCleanup(dataType, dryRun = true) {
    return this.request('/gdpr/run-cleanup', {
      method: 'POST',
      body: JSON.stringify({ data_type: dataType, dry_run: dryRun }),
    });
  }

  // Entitlements
  async getEntitlementPackages() {
    return this.request('/entitlements/packages');
  }

  async getEntitlementFeatures() {
    return this.request('/entitlements/features');
  }

  async getEntitlementStats() {
    return this.request('/entitlements/stats');
  }

  async getCompanyBillingEntitlements(companyId) {
    return this.request(`/entitlements/companies/${companyId}/billing-entitlements`);
  }

  async changeCompanyPackage(companyId, packageId) {
    return this.request(`/entitlements/companies/${companyId}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ package_id: packageId }),
    });
  }

  async toggleCompanyAddon(companyId, featureId, enable, source = 'manual_override') {
    return this.request(`/entitlements/companies/${companyId}/addons`, {
      method: 'POST',
      body: JSON.stringify({ feature_id: featureId, enable, source }),
    });
  }

  async bulkToggleCompanyAddons(companyId, featureIds, enable, source = 'manual_override') {
    return this.request(`/entitlements/companies/${companyId}/addons/bulk`, {
      method: 'POST',
      body: JSON.stringify({ feature_ids: featureIds, enable, source }),
    });
  }

  async getCompanyEntitlementAudit(companyId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/entitlements/companies/${companyId}/entitlement-audit${query ? `?${query}` : ''}`);
  }
}

export const saApi = new SaApiClient();
export default saApi;
