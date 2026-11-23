import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RivoxelPreview from './rivoxel/RivoxelPreview.tsx';
import './rivoxel/preview.css';

createRoot(document.getElementById('root')!).render(<StrictMode><RivoxelPreview /></StrictMode>);
