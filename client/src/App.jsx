import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import CardWizard from './pages/CardWizard.jsx';
import Recipient from './pages/Recipient.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/new" element={<CardWizard />} />
        <Route path="/dashboard/edit/:cardId" element={<CardWizard />} />
        <Route path="/c/:cardId" element={<Recipient />} />
        {/* Catch-all → dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
