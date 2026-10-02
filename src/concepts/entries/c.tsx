import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../base.css';
import '../c/c.css';
import { ConceptC } from '../c/ConceptC';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptC />
  </StrictMode>,
);
