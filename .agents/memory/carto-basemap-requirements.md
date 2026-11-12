---
name: CARTO basemap requirements
description: Current raster tile authentication requirements and misleading successful responses
---

CARTO raster basemaps require a usable key, including the legacy light_all endpoint.

**Why:** CARTO removed keyless raster maps on September 25, 2026. Assuming the old public endpoint still worked caused incorrect advice. Unauthenticated tile requests can return HTTP 200 PNGs containing only an API-key-required notice.

**How to apply:** Check current documentation at https://docs.carto.com/faqs/carto-basemaps and inspect at least one returned tile visually; status and content type alone do not prove map success. Keep the saved server credential out of browser bundles and logs.
