# Vendor control plane

This Compose project runs the product-operations dashboard in its own database and containers.
It deliberately shares no user, patient, appointment, billing, or clinical data with a customer
installation.

The web image is the same audited application release used by Dental ERP, but
`PLATFORM_CONTROL_PLANE_MODE=true` exposes only login, owner operations, health checks, and the
authenticated worker API. All clinic routes and APIs return 404.

Deploy it from a private directory containing a mode-0600 `.env` file. Connect Caddy to
`product-control-web:3000`. Never attach a customer database to this project.
