import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Terminal from './Terminal';
import './terminal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Terminal />
  </StrictMode>,
);
