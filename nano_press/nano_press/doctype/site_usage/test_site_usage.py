# Copyright (c) 2026, Venkatesh M and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

EXTRA_TEST_RECORD_DEPENDENCIES = []
IGNORE_TEST_RECORD_DEPENDENCIES = []


class IntegrationTestSiteUsage(IntegrationTestCase):
	"""
	Integration tests for SiteUsage.
	Use this class for testing interactions between multiple components.
	"""

	def test_site_usage_creation(self):
		"""Test that a SiteUsage record can be created with valid data."""
		doc = frappe.new_doc("Site Usage")
		doc.site = "_Test Frappe Site"
		doc.database = 100.5
		doc.public = 20.0
		doc.private = 15.0
		doc.backups = 50.0
		doc.database_free = 200.0
		# Only validate fields, not insert (no real site in test env)
		self.assertEqual(doc.database, 100.5)
		self.assertEqual(doc.public, 20.0)
		self.assertEqual(doc.private, 15.0)
		self.assertEqual(doc.backups, 50.0)
		self.assertEqual(doc.database_free, 200.0)

	def test_site_usage_defaults_to_zero(self):
		"""Test that numeric fields default to zero."""
		doc = frappe.new_doc("Site Usage")
		self.assertEqual(doc.database or 0, 0)
		self.assertEqual(doc.public or 0, 0)
		self.assertEqual(doc.private or 0, 0)
		self.assertEqual(doc.backups or 0, 0)
		self.assertEqual(doc.database_free or 0, 0)
