import React, { useState, useEffect } from 'react';
import AuditLogsTable from '../components/AuditLogsTable.jsx';
import apiClient from '../api/client.js';

export function AuditLogs() {
  const [logsList, setLogsList] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterActionType, setFilterActionType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        action_type: filterActionType,
        startDate: filterStartDate,
        endDate: filterEndDate
      }).toString();
      const res = await apiClient.get(`/api/admin/audit-logs?${queryParams}`);
      setLogsList(res.data || []);
    } catch (err) {
      alert(err.message || 'فشلت عملية تحميل سجل العمليات.');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <AuditLogsTable
      logsList={logsList}
      logsLoading={logsLoading}
      loadAuditLogs={loadAuditLogs}
      filterActionType={filterActionType}
      setFilterActionType={setFilterActionType}
      filterStartDate={filterStartDate}
      setFilterStartDate={setFilterStartDate}
      filterEndDate={filterEndDate}
      setFilterEndDate={setFilterEndDate}
    />
  );
}

export default AuditLogs;
