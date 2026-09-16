// Prevent AUT-level uncaught exceptions (e.g. zone.js async errors) from
// failing tests.
Cypress.on( 'uncaught:exception', () => false );
