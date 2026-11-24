import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './common/TopBar.js';

export const Layout: React.FC = () => {
  const location = useLocation();
  const isDisplay = location.pathname === '/display';

  if (isDisplay) {
    return (
      <div className="min-h-screen bg-charcoal-dark text-silver-highlight overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-charcoal-dark text-silver-highlight">
      <TopBar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
