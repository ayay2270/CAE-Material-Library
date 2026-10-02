import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../base.css';
import '../d/d.css';
import { ConceptD } from '../d/ConceptD';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptD />
  </StrictMode>,
);
