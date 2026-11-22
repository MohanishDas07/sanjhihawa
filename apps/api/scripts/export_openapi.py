"""
Exports FastAPI OpenAPI schema to JSON for frontend TypeScript contract synchronization.
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import app

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../web/src/types"))
os.makedirs(output_dir, exist_ok=True)
schema_path = os.path.join(output_dir, "openapi.json")

schema = app.openapi()
with open(schema_path, "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2)

print(f"Exported OpenAPI schema ({len(schema.get('paths', {}))} paths) to {schema_path}")
