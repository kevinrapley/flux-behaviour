// Auto-install entry point for the GA-style snippet documented in
// docs/instrumentation/tag-integration.md. The endpoint comes from the
// script tag's data-flux-endpoint attribute.
import { installFluxBrowserTag } from './flux-browser.mjs';

installFluxBrowserTag(window);
