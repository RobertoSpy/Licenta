import { useEffect } from 'react';

import { SCREEN_TUTORIALS } from '../data/tutorialContent';

interface UseScreenTutorOptions {
  screenId: string;
  addSystemMessage: (message: string, requiresAnswer?: boolean) => void;
}

export function useScreenTutor({ screenId, addSystemMessage }: UseScreenTutorOptions) {


  useEffect(() => {
    // Prevent strict mode double execution via simple timeout
    const timer = setTimeout(() => {
      if (SCREEN_TUTORIALS[screenId]) {
        addSystemMessage(SCREEN_TUTORIALS[screenId].introMessage, true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [screenId, addSystemMessage]);

}
