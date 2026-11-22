.PHONY: all check test test-engine test-api lint format build-web run-api run-web clean

PYTHON ?= python

all: check

check: lint test

test:
	$(PYTHON) tests/test_all.py

test-engine:
	$(PYTHON) -m unittest discover -s tests/engine -p "test_*.py"

test-api:
	$(PYTHON) -m unittest discover -s tests/api -p "test_*.py"

test-eval:
	$(PYTHON) -m unittest discover -s tests/eval -p "test_*.py"

lint:
	$(PYTHON) -m ruff check apps/api tests

format:
	$(PYTHON) -m ruff format apps/api tests

build-web:
	cd apps/web && npm run build

run-api:
	$(PYTHON) -m uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port 8000 --reload

run-web:
	cd apps/web && npm run dev

export-openapi:
	$(PYTHON) scripts/export_openapi.py

clean:
	rm -rf apps/api/data/*.sqlite3*
	rm -rf apps/web/.next
	rm -rf .pytest_cache .ruff_cache .coverage
	rm -rf apps/web/test-results apps/web/playwright-report
