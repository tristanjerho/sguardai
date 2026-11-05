import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { PwaInstallPrompt } from '../components/common/PwaInstallPrompt';
import { SmileGuardAssistant } from '../components/chat/SmileGuardAssistant';

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
        <PwaInstallPrompt />
        <SmileGuardAssistant />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;
