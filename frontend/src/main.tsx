import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OnboardingProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </OnboardingProvider>
    </AuthProvider>
  </StrictMode>,
)
