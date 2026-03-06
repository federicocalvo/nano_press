# Copyright (c) 2025, Venkatesh M and contributors
# For license information, please see license.txt

import json
import subprocess
from typing import Any

import frappe


def _run_server_metric_command(server_ip: str, ssh_user: str, ssh_port: int | None = None) -> dict[str, Any]:
	port = ssh_port or 22
	command = [
		"ssh",
		"-o",
		"BatchMode=yes",
		"-o",
		"ConnectTimeout=10",
		"-p",
		str(port),
		f"{ssh_user}@{server_ip}",
		(
			"python3 - <<'PY'\n"
			"import json, os\n"
			"\n"
			"def read_first_line(path):\n"
			"    with open(path) as f:\n"
			"        return f.readline().strip()\n"
			"\n"
			"load_avg = read_first_line('/proc/loadavg').split()[:3]\n"
			"\n"
			"meminfo = {}\n"
			"with open('/proc/meminfo') as f:\n"
			"    for line in f:\n"
			"        key, value = line.split(':', 1)\n"
			"        meminfo[key] = int(value.strip().split()[0])\n"
			"mem_total = meminfo.get('MemTotal', 0)\n"
			"mem_available = meminfo.get('MemAvailable', 0)\n"
			"memory_percent = round(((mem_total - mem_available) / mem_total) * 100, 2) if mem_total else 0\n"
			"\n"
			"st = os.statvfs('/')\n"
			"disk_total = st.f_blocks * st.f_frsize\n"
			"disk_free = st.f_bavail * st.f_frsize\n"
			"disk_used = disk_total - disk_free\n"
			"disk_percent = round((disk_used / disk_total) * 100, 2) if disk_total else 0\n"
			"\n"
			"cpu_percent = None\n"
			"try:\n"
			"    with open('/proc/stat') as f:\n"
			"        cpu = f.readline().split()[1:]\n"
			"    values = list(map(int, cpu[:8]))\n"
			"    idle = values[3] + values[4]\n"
			"    total = sum(values)\n"
			"    cpu_percent = round((1 - (idle / total)) * 100, 2) if total else 0\n"
			"except Exception:\n"
			"    cpu_percent = 0\n"
			"\n"
			"print(json.dumps({\n"
			"    'cpu_percent': cpu_percent,\n"
			"    'memory_percent': memory_percent,\n"
			"    'disk_percent': disk_percent,\n"
			"    'load_avg': ' '.join(load_avg),\n"
			"}))\n"
			"PY"
		),
	]
	result = subprocess.run(command, capture_output=True, text=True, check=False)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.strip() or "Failed to collect server metrics")
	return json.loads(result.stdout.strip())


def update_server_metrics(server_name: str) -> dict[str, Any]:
	server = frappe.get_doc("Server", server_name)
	metrics = _run_server_metric_command(server.server_ip, server.ssh_user, server.ssh_port)
	server.db_set("cpu_percent", metrics.get("cpu_percent") or 0, update_modified=False)
	server.db_set("memory_percent", metrics.get("memory_percent") or 0, update_modified=False)
	server.db_set("disk_percent", metrics.get("disk_percent") or 0, update_modified=False)
	server.db_set("load_avg", metrics.get("load_avg") or "", update_modified=False)
	server.db_set("last_metrics_at", frappe.utils.now_datetime(), update_modified=False)
	return metrics


def update_all_server_metrics() -> None:
	for server_name in frappe.get_all("Server", pluck="name"):
		try:
			update_server_metrics(server_name)
		except Exception:
			frappe.log_error(
				frappe.get_traceback(),
				title=f"Server metrics update failed for {server_name}",
			)
