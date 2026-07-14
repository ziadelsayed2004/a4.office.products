// Compatibility component for the legacy route. The router should redirect
// /return-authorizations to /returns; re-exporting keeps lazy imports safe.
import '../styles/ReturnAuthorizations.css';

export { default } from './Returns.jsx';
