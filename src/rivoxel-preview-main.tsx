import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const isHome = window.location.pathname.replace(/\/?$/, '/') === '/rivoxel-preview/';
const root = createRoot(document.getElementById('root')!);
if (isHome) {
  Promise.all([import('./RivoxelRavaApp.tsx'), import('./styles.css'), import('./rivoxel/rava-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
} else if (window.location.pathname.startsWith('/rivoxel-preview/catalogo')) {
  Promise.all([import('./RivoxelCatalogPage.tsx'), import('./catalogo.css'), import('./rivoxel/catalog-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
} else {
  document.body.classList.add('rava-links-body');
  Promise.all([import('./RivoxelLinksPage.tsx'), import('./links.css'), import('./rivoxel/links-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
}
