import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../base.css';
import '../b/b.css';
import { ConceptB } from '../b/ConceptB';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptB />
  </StrictMode>,
);
