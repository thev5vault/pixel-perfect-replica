# Vehicle lookup

`dvlaApi.ts` is the TypeScript equivalent of the requested `dvlaApi.js`, matching
the rest of this application. Its TanStack server function validates registration
input and loads the server-only adapters. No keys or tokens enter the client bundle.

Without credentials, only **AB14 CDE** and **BUL 200** return labelled demo data.
Other plates fail explicitly. Provider errors never fall back to sample data.
Vehicle lists and per-vehicle MOT histories persist in this browser's local storage.
Lookup is not proof of vehicle ownership and does not create a V5C unlock reference.

## Live credentials

Set these through Replit Secrets; do not prefix them with `VITE_`:

- `DVLA_VES_API_KEY`: DVLA Vehicle Enquiry Service key.
- `MOT_HISTORY_API_KEY`: DVSA MOT History API key.
- `MOT_HISTORY_CLIENT_ID`: issued OAuth client ID.
- `MOT_HISTORY_CLIENT_SECRET`: issued OAuth client secret.
- `MOT_HISTORY_TOKEN_URL`: full issued Microsoft OAuth token URL.
- `MOT_HISTORY_SCOPE`: optional; defaults to `https://tapi.dvsa.gov.uk/.default`.

VES and MOT can be configured independently. All four required MOT credentials
must be present together. VES does not supply a model or MOT expiry; omitted data
stays unavailable rather than being invented. OAuth tokens are cached server-side.
Requests time out after 15 seconds; errors show in the lookup modal.

Official documentation:

- https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html
- https://documentation.history.mot.api.gov.uk/mot-history-api/authentication
- https://documentation.history.mot.api.gov.uk/mot-history-api/api-specification

Live responses have not been exercised without credentials. Before exposing live
lookups publicly, add server-enforced account authorization and rate limits; the
imported application's local V5C preview gate is not server authentication.
