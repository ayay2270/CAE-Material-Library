import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../base.css';
import '../a/a.css';
import { ConceptA } from '../a/ConceptA';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptA />
  </StrictMode>,
);
