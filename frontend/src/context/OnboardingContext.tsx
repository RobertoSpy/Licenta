import React, { createContext, useContext, useEffect, useState } from 'react';

interface OnboardingContextType {
  hasSeenIntro: (screenId: string) => boolean;
  markIntroSeen: (screenId: string) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_KEY = 'zidario_onboarding_state';

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seenScreens, setSeenScreens] = useState<Record<string, boolean>>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_KEY);
      if (stored) {
        setSeenScreens(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading onboarding state', e);
    }
  }, []);

  const hasSeenIntro = (screenId: string) => {
    return !!seenScreens[screenId];
  };

  const markIntroSeen = (screenId: string) => {
    setSeenScreens(prev => {
      if (prev[screenId]) return prev; // Already seen
      const newState = { ...prev, [screenId]: true };
      try {
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error('Error saving onboarding state', e);
      }
      return newState;
    });
  };

  const resetOnboarding = () => {
    setSeenScreens({});
    localStorage.removeItem(ONBOARDING_KEY);
  };

  return (
    <OnboardingContext.Provider value={{ hasSeenIntro, markIntroSeen, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
