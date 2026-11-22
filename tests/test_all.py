"""
Unified Test Runner for SAANS Engine and API Test Suites.
"""

import os
import sys

# Ensure tests run deterministically offline without waiting for network timeouts
os.environ.setdefault("SAANS_OFFLINE", "1")

import unittest


def run_all_tests():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    tests_dir = os.path.abspath(os.path.dirname(__file__))
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Discover engine tests
    suite_engine = loader.discover(
        start_dir=os.path.join(tests_dir, "engine"),
        pattern="test_*.py",
        top_level_dir=root_dir,
    )
    # Discover api tests
    suite_api = loader.discover(
        start_dir=os.path.join(tests_dir, "api"),
        pattern="test_*.py",
        top_level_dir=root_dir,
    )
    # Discover evaluation harness tests
    suite_eval = loader.discover(
        start_dir=os.path.join(tests_dir, "eval"),
        pattern="test_*.py",
        top_level_dir=root_dir,
    )

    suite.addTests(suite_engine)
    suite.addTests(suite_api)
    suite.addTests(suite_eval)

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    run_all_tests()
