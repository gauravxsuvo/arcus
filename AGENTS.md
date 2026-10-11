# ARCUS data requirements

- Product interfaces must use real database-backed user and activity data. Do not introduce mock athletes, mock workouts, fabricated statistics, or placeholder community posts in pull requests.
- Static navigation, domain catalogs, pricing configuration and isolated test fixtures are not user activity data. Keep test fixtures out of shipped product UI.
- Never send account emails, password hashes, billing identifiers or raw account/workout payloads in social DTOs. Explicitly select public identity fields.
- Authenticate mutations on the server, validate untrusted input, enforce ownership in database writes, and preserve visible loading/error feedback during navigation.
