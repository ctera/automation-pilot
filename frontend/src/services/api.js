import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const refreshInfra = () => api.post('/infrastructure/refresh');
export const getInfraStatus = () => api.get('/infrastructure/status');
export const getIntents = () => api.get('/intents');
export const cancelIntent = (id) => api.post(`/intents/${id}/cancel`);
export const stopIntent = (id, deleteVms = false) =>
  api.post(`/intents/${id}/stop`, { delete_vms: deleteVms });
export const reprioritizeIntent = (id, priority) =>
  api.post(`/intents/${id}/reprioritize`, { priority });
export const getDecisions = (params) => api.get('/decisions', { params });
export const getSettings = () => api.get('/settings');
export const updateSetting = (key, value) =>
  api.put(`/settings/${key}`, { value });
export const getJobs = () => api.get('/jobs');
export const getJenkinsJobStatuses = () => api.get('/jenkins/job-statuses');

export const getPortalTriggers = () => api.get('/portal-triggers');
export const enableTriggerJob = (jobName) => api.post(`/portal-triggers/${jobName}/enable`);
export const disableTriggerJob = (jobName) => api.post(`/portal-triggers/${jobName}/disable`);
export const updateTriggerSchedule = (jobName, spec) =>
  api.put(`/portal-triggers/${jobName}/schedule`, { spec });

export const getInfraHistory = (hours = 24) =>
  api.get('/infrastructure/history', { params: { hours } });
export const getInfraTrends = (hours = 72) =>
  api.get('/infrastructure/trends', { params: { hours } });

export default api;
