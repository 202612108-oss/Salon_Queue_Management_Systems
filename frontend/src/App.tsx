import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/index.js';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/Home/HomePage.js';
import { JoinPage } from './pages/Join/JoinPage.js';
import { StatusPage } from './pages/Status/StatusPage.js';
import { ReceptionPage } from './pages/Reception/ReceptionPage.js';
import { BarberPage } from './pages/Barber/BarberPage.js';
import { DisplayPage } from './pages/Display/DisplayPage.js';
import { AdminPage } from './pages/Admin/AdminPage.js';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/status/:id" element={<StatusPage />} />
            <Route path="/reception" element={<ReceptionPage />} />
            <Route path="/barber/:name" element={<BarberPage />} />
            <Route path="/display" element={<DisplayPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
};

export default App;
