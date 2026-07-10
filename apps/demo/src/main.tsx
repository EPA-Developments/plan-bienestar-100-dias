import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { indexSearchParameterBundle, indexStructureDefinitionBundle } from '@medplum/core';
// El paquete @medplum/definitions lee via fs (solo Node); en el navegador
// importamos los JSON directamente (alias en vite.config.ts) y Vite los embebe.
import profilesTypes from 'fhir-definitions/profiles-types.json';
import profilesResources from 'fhir-definitions/profiles-resources.json';
import searchParameters from 'fhir-definitions/search-parameters.json';
import searchParametersMedplum from 'fhir-definitions/search-parameters-medplum.json';
import type { Bundle, SearchParameter } from '@medplum/fhirtypes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// El MockClient matchea busquedas contra las definiciones FHIR globales.
indexStructureDefinitionBundle(profilesTypes as Bundle);
indexStructureDefinitionBundle(profilesResources as Bundle);
indexSearchParameterBundle(searchParameters as Bundle<SearchParameter>);
indexSearchParameterBundle(searchParametersMedplum as Bundle<SearchParameter>);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
