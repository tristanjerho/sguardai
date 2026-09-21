import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { PwaInstallPrompt } from '../components/common/PwaInstallPrompt';

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
        <PwaInstallPrompt />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;
