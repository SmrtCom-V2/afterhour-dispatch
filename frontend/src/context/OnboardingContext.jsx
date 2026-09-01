/**
 * Onboarding Context
 * Manages onboarding state, guided tour, and checklist progress
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import api from '../utils/api';

const OnboardingContext = createContext(null);

// Onboarding steps/checklist items — titleKey/descriptionKey are translation keys,
// resolved via t() where the steps are consumed (title/description kept as English
// fallback for any code path that reads them before translation).
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    titleKey: 'onboardingWelcomeTitle',
    descriptionKey: 'onboardingWelcomeDesc',
    completed: false,
    auto: true, // Auto-completes when seen
  },
  {
    id: 'add_pm_company',
    titleKey: 'onboardingAddPmTitle',
    descriptionKey: 'onboardingAddPmDesc',
    completed: false,
    route: '/pm-companies',
  },
  {
    id: 'setup_emergency_line',
    titleKey: 'onboardingEmergencyLineTitle',
    descriptionKey: 'onboardingEmergencyLineDesc',
    completed: false,
    route: '/settings/telephony',
    blocking: true, // without this the product does not work — dashboard shows a banner until done
  },
  {
    id: 'add_service_provider',
    titleKey: 'onboardingAddSpTitle',
    descriptionKey: 'onboardingAddSpDesc',
    completed: false,
    route: '/service-providers',
  },
  {
    id: 'add_employee',
    titleKey: 'onboardingAddEmployeeTitle',
    descriptionKey: 'onboardingAddEmployeeDesc',
    completed: false,
    route: '/employees',
  },
  {
    id: 'setup_schedule',
    titleKey: 'onboardingScheduleTitle',
    descriptionKey: 'onboardingScheduleDesc',
    completed: false,
    route: '/schedules',
  },
];

// Tour steps with element targeting
const TOUR_STEPS = [
  {
    id: 'sidebar',
    target: '.sidebar',
    titleKey: 'tourSidebarTitle',
    contentKey: 'tourSidebarContent',
    placement: 'right',
  },
  {
    id: 'pm_companies',
    target: '[href="/pm-companies"]',
    titleKey: 'tourPmCompaniesTitle',
    contentKey: 'tourPmCompaniesContent',
    placement: 'right',
    highlight: true,
  },
  {
    id: 'service_providers',
    target: '[href="/service-providers"]',
    titleKey: 'tourServiceProvidersTitle',
    contentKey: 'tourServiceProvidersContent',
    placement: 'right',
  },
  {
    id: 'employees',
    target: '[href="/employees"]',
    titleKey: 'tourEmployeesTitle',
    contentKey: 'tourEmployeesContent',
    placement: 'right',
  },
  {
    id: 'schedules',
    target: '[href="/schedules"]',
    titleKey: 'tourSchedulesTitle',
    contentKey: 'tourSchedulesContent',
    placement: 'right',
  },
  {
    id: 'incidents',
    target: '[href="/incidents"]',
    titleKey: 'tourIncidentsTitle',
    contentKey: 'tourIncidentsContent',
    placement: 'right',
  },
];

export function OnboardingProvider({ children }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [steps, setSteps] = useState(ONBOARDING_STEPS);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Translate step titles/descriptions for the current language, every render
  const translatedSteps = steps.map(s => ({
    ...s,
    title: t(s.titleKey) || s.titleKey,
    description: t(s.descriptionKey) || s.descriptionKey,
  }));

  // Load onboarding state from localStorage and check actual progress
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadOnboardingState = async () => {
      try {
        // Check localStorage for dismissed state
        const storageKey = `onboarding_${user.id}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          const parsed = JSON.parse(stored);
          setDismissed(parsed.dismissed || false);

          // If not dismissed, check if this is first login (show welcome)
          if (!parsed.welcomed) {
            setShowWelcome(true);
          }
        } else {
          // First time - show welcome
          setShowWelcome(true);
        }

        // Check actual progress from API
        await checkProgress();
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOnboardingState();
  }, [user]);

  // Check actual progress by querying data
  const checkProgress = useCallback(async () => {
    if (!user) return;

    try {
      const updatedSteps = [...ONBOARDING_STEPS];

      // Check PM Companies
      try {
        const pmRes = await api.getPmCompanies();
        if (pmRes.pmCompanies && pmRes.pmCompanies.length > 0) {
          const step = updatedSteps.find(s => s.id === 'add_pm_company');
          if (step) step.completed = true;
        }
      } catch (e) { /* ignore */ }

      // Check emergency line — complete when at least one PM company has an
      // active service_phone. Also drives the blocking dashboard banner.
      try {
        const tel = await api.getTelephonyStatus();
        const anyActive = (tel.pmCompanies || []).some(p => p.service_phone_status === 'active');
        const step = updatedSteps.find(s => s.id === 'setup_emergency_line');
        if (step) step.completed = anyActive;
      } catch (e) { /* ignore */ }

      // Check Service Providers
      try {
        const spRes = await api.getServiceProviders();
        if (spRes.serviceProviders && spRes.serviceProviders.length > 0) {
          const step = updatedSteps.find(s => s.id === 'add_service_provider');
          if (step) step.completed = true;
        }
      } catch (e) { /* ignore */ }

      // Check Employees
      try {
        const empRes = await api.getEmployees();
        if (empRes.employees && empRes.employees.length > 0) {
          const step = updatedSteps.find(s => s.id === 'add_employee');
          if (step) step.completed = true;
        }
      } catch (e) { /* ignore */ }

      // Check Schedules
      try {
        const schedRes = await api.getSchedules();
        if (schedRes.schedules && schedRes.schedules.length > 0) {
          const step = updatedSteps.find(s => s.id === 'setup_schedule');
          if (step) step.completed = true;
        }
      } catch (e) { /* ignore */ }

      // Welcome is auto-completed
      updatedSteps.find(s => s.id === 'welcome').completed = true;

      setSteps(updatedSteps);
    } catch (error) {
      console.error('Failed to check progress:', error);
    }
  }, [user]);

  // Save state to localStorage
  const saveState = useCallback((updates) => {
    if (!user) return;

    const storageKey = `onboarding_${user.id}`;
    const current = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const updated = { ...current, ...updates };
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }, [user]);

  // Complete welcome and optionally start tour
  const completeWelcome = useCallback((startTour = false) => {
    setShowWelcome(false);
    saveState({ welcomed: true });

    if (startTour) {
      setShowTour(true);
      setTourStep(0);
    }
  }, [saveState]);

  // Tour navigation
  const nextTourStep = useCallback(() => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(prev => prev + 1);
    } else {
      setShowTour(false);
      saveState({ tourCompleted: true });
    }
  }, [tourStep, saveState]);

  const prevTourStep = useCallback(() => {
    if (tourStep > 0) {
      setTourStep(prev => prev - 1);
    }
  }, [tourStep]);

  const skipTour = useCallback(() => {
    setShowTour(false);
    saveState({ tourSkipped: true });
  }, [saveState]);

  // Dismiss checklist
  const dismissChecklist = useCallback(() => {
    setDismissed(true);
    saveState({ dismissed: true });
  }, [saveState]);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(`onboarding_${user.id}`);
    setDismissed(false);
    setShowWelcome(true);
    setSteps(ONBOARDING_STEPS);
  }, [user]);

  // Calculate progress
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  // A blocking step that isn't done yet — the dashboard shows a persistent
  // red banner for this (the emergency line: without it, tenants literally
  // cannot reach After Hour). Not gated by `dismissed` — you can hide the
  // checklist but not this.
  const blockingStep = steps.find(s => s.blocking && !s.completed) || null;

  const translatedTourSteps = TOUR_STEPS.map(s => ({
    ...s,
    title: t(s.titleKey) || s.titleKey,
    content: t(s.contentKey) || s.contentKey,
  }));

  const value = {
    // State
    showWelcome,
    showTour,
    tourStep,
    steps: translatedSteps,
    loading,
    dismissed,
    progress,
    isComplete,
    completedCount,
    totalCount,
    blockingStep,
    currentTourStep: translatedTourSteps[tourStep],
    tourSteps: translatedTourSteps,

    // Actions
    completeWelcome,
    nextTourStep,
    prevTourStep,
    skipTour,
    dismissChecklist,
    checkProgress,
    resetOnboarding,
    setShowTour,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

export default OnboardingContext;
