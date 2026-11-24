import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { rivoxelUrls } from './lib/rivoxel-urls.js';
import './theme-tokens.css';

document.documentElement.dataset.theme = 'rivoxel';
const urls = rivoxelUrls(window.location.hostname);
const path = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
const isHome = path === urls.home;
const root = createRoot(document.getElementById('root')!);
if (isHome) {
  Promise.all([import('./RivoxelRavaApp.tsx'), import('./styles.css'), import('./rivoxel/rava-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
} else if (path === urls.catalog) {
  Promise.all([import('./RivoxelCatalogPage.tsx'), import('./catalogo.css'), import('./rivoxel/catalog-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
} else {
  document.body.classList.add('rava-links-body');
  Promise.all([import('./RivoxelLinksPage.tsx'), import('./links.css'), import('./rivoxel/links-theme.css')])
    .then(([app]) => root.render(<StrictMode><app.default /></StrictMode>));
}
