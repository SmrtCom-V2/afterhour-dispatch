import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const PmContext = createContext(null);

export function PmProvider({ children }) {
  const { user } = useAuth();
  const [pmCompanies, setPmCompanies] = useState([]);
  const [selectedPmId, setSelectedPmId] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Only load PM companies when user is authenticated and we haven't loaded yet
    if (user && !loadedRef.current) {
      loadedRef.current = true;
      setLoading(true);
      loadPmCompanies();
    }
    // Reset when user logs out
    if (!user) {
      loadedRef.current = false;
      setPmCompanies([]);
      setSelectedPmId(null);
      setLoading(false);
    }
  }, [user]);

  const loadPmCompanies = async () => {
    try {
      const data = await api.getPmCompanies();
      setPmCompanies(data.pmCompanies || []);
    } catch (err) {
      console.error('Failed to load PM companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectPm = useCallback((pmId) => {
    setSelectedPmId(pmId);
  }, []);

  const clearPm = useCallback(() => {
    setSelectedPmId(null);
  }, []);

  // Compute selectedPm from pmCompanies and selectedPmId
  const selectedPm = useMemo(() => {
    if (selectedPmId && pmCompanies.length > 0) {
      return pmCompanies.find(p => p.id === selectedPmId) || null;
    }
    return null;
  }, [selectedPmId, pmCompanies]);

  // Is user in PM-scoped context?
  const isPmContext = !!selectedPmId;

  const value = useMemo(() => ({
    pmCompanies,
    selectedPmId,
    selectedPm,
    selectPm,
    clearPm,
    isPmContext,
    loading,
    refreshPmCompanies: loadPmCompanies,
  }), [pmCompanies, selectedPmId, selectedPm, selectPm, clearPm, isPmContext, loading]);

  return (
    <PmContext.Provider value={value}>
      {children}
    </PmContext.Provider>
  );
}

export function usePm() {
  const context = useContext(PmContext);
  if (!context) {
    throw new Error('usePm must be used within PmProvider');
  }
  return context;
}
