import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../base.css';
import '../e/e.css';
import { ConceptE } from '../e/ConceptE';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptE />
  </StrictMode>,
);
