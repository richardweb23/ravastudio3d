import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const isHome = window.location.pathname.replace(/\/?$/, '/') === '/rivoxel-preview/';
const root = createRoot(document.getElementById('root')!);
if (isHome) {
  Promise.all([import('./RivoxelRavaApp.tsx'), import('./styles.css'), import('./rivoxel/rava-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
} else {
  Promise.all([import('./rivoxel/RivoxelPreview.tsx'), import('./rivoxel/preview.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
}
