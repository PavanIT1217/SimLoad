import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './features/offline/registerServiceWorker';
import { bootstrapDesign } from './features/persistence/bootstrap';
import { useUiStore } from './state/uiStore';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/space-grotesk';
import './styles/theme.css';
import './ui/ui.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

if (import.meta.env.PROD) registerServiceWorker();

// Resolve the starting design (share link, autosave or a scenario) before the first render.
void bootstrapDesign()
  .then((startup) => useUiStore.getState().setStartup(startup))
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
