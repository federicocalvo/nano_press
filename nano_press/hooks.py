app_name = "nano_press"
app_title = "Nano Press"
app_publisher = "Venkatesh M"
app_description = "A lightweight, modular, and extensible version of Frappe Press — built for small-scale publishing, blogging, or CMS-like use cases with minimal dependencies and faster performance."
app_email = "venkateshvenki404224@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "nano_press",
		"logo": "/assets/nano_press/images/icon.png",
		"title": "Nano Press",
		"route": "app/nano-press",
		"has_permission": "nano_press.has_app_permission",
	}
]


doc_events = {"User": {"after_insert": "nano_press.add_user_role"}}

fixtures = [
	{"dt": "Role", "filters": {"name": ("in", ("Nano Press User",))}},
	{
		"dt": "Custom DocPerm",
		"filters": {"parent": ("in", ("Frappe Site", "Server", "Apps", "Custom Image", "Ansible Log"))},
	},
]

scheduler_events = {
	"cron": {
		"*/5 * * * *": [
			"nano_press.utils.ansible_runner.ping_server",
			"nano_press.nano_press.doctype.server.server_metrics.update_all_server_metrics",
		],
	}
}

ignore_links_on_delete = ["Ansible Log"]

default_log_clearing_doctypes = {
	"Ansible Log": 30
}
