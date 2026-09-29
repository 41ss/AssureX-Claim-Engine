# database/

| Command | What it does |
|---|---|
| `python database/init_db.py` | Creates every table in `assurex.db` (empty) |
| `python database/seed_db.py` | Deletes `assurex.db` and `uploads/`, then creates the demo accounts and one claim per SRS demo case through the real API |

Tables are defined in `src/core/models.py` (diagram: `documentation/diagrams/database_er.png`).
Logins created by the seed are listed in the main README.
