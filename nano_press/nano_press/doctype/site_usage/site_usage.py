# Copyright (c) 2026, Venkatesh M and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SiteUsage(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		backups: DF.Float
		database: DF.Float
		database_free: DF.Float
		private: DF.Float
		public: DF.Float
		site: DF.Link

	# end: auto-generated types

	pass
