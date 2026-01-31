/**
 * Onboarding Context
 * Manages onboarding state, guided tour, and checklist progress
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const OnboardingContext = createContext(null);

// Onboarding steps/checklist items
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to After Hour Dispatch',
    description: 'Let\'s get you set up',
    completed: false,
    auto: true, // Auto-completes when seen
  },
  {
    id: 'add_pm_company',
    title: 'Add Your First Client',
    description: 'Add a Property Management company you serve',
    completed: false,
    route: '/pm-companies',
    action: 'Click "Add PM Company" to add your first client',
  },
  {
    id: 'add_service_provider',
    title: 'Add Service Providers',
    description: 'Add contractors (plumbers, electricians, etc.)',
    completed: false,
    route: '/service-providers',
    action: 'Click "Add Provider" to add your first service provider',
  },
  {
    id: 'add_employee',
    title: 'Add Team Members',
    description: 'Add employees who can be on-call',
    completed: false,
    route: '/employees',
    action: 'Click "Add Employee" to add your first team member',
  },
  {
    id: 'setup_schedule',
    title: 'Set Up On-Call Schedule',
    description: 'Configure who handles after-hours calls',
    completed: false,
    route: '/schedules',
    action: 'Create your first on-call schedule',
  },
];

// Tour steps with element targeting
const TOUR_STEPS = [
  {
    id: 'sidebar',
    target: '.sidebar',
    title: 'Navigation',
    content: 'Use the sidebar to navigate between sections. Dashboard shows your overview, and you can manage PM Companies, Service Providers, and more.',
    placement: 'right',
  },
  {
    id: 'pm_companies',
    target: '[href="/pm-companies"]',
    title: 'PM Companies',
    content: 'Start here! Add the Property Management companies you provide after-hours service for.',
    placement: 'right',
    highlight: true,
  },
  {
    id: 'service_providers',
    target: '[href="/service-providers"]',
    title: 'Service Providers',
    content: 'Add your contractors - plumbers, electricians, locksmiths - who handle emergency calls.',
    placement: 'right',
  },
  {
    id: 'employees',
    target: '[href="/employees"]',
    title: 'Your Team',
    content: 'Add your team members who can be assigned to on-call shifts.',
    placement: 'right',
  },
  {
    id: 'schedules',
    target: '[href="/schedules"]',
    title: 'On-Call Schedules',
    content: 'Set up who handles calls during after-hours. You can create recurring schedules or one-time assignments.',
    placement: 'right',
  },
  {
    id: 'incidents',
    target: '[href="/incidents"]',
    title: 'Incidents',
    content: 'All incoming calls and emergencies appear here. You\'ll see real-time updates as calls come in.',
    placement: 'right',
  },
];

export function OnboardingProvider({ children }) {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [steps, setSteps] = useState(ONBOARDING_STEPS);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

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

  const value = {
    // State
    showWelcome,
    showTour,
    tourStep,
    steps,
    loading,
    dismissed,
    progress,
    isComplete,
    completedCount,
    totalCount,
    currentTourStep: TOUR_STEPS[tourStep],
    tourSteps: TOUR_STEPS,

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
