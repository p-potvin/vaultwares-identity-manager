import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../theme/revisited.css';
import '../theme/global.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<React.StrictMode><App /></React.StrictMode>);
}
