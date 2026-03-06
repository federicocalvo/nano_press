// Copyright (c) 2025, Venkatesh M and contributors
// For license information, please see license.txt

// Metrics history accumulates samples across refreshes for the time-series charts.
let _metrics_history = {
	labels: [],
	cpu: [],
	ram: [],
	io_read: [],
	io_write: [],
};
const MAX_SAMPLES = 10;

frappe.ui.form.on('Server', {
	refresh(frm) {
		// avoid duplicate buttons
		if (frm.clear_custom_buttons) frm.clear_custom_buttons();

		// only add action buttons for saved docs
		if (!frm.is_new()) {
			// Show Prepare Server button with option to include Traefik
			if (
				frm.doc.verify_status === 'Verified' ||
				frm.doc.verify_status === 'Prepared'
			) {
				// Only show Prepare when verified or already prepared
				frm
					.add_custom_button(__('Prepare Server'), () => {
						// Check if server is already prepared
						if (frm.doc.verify_status === 'Prepared') {
							frappe.confirm(
								__(
									'This server is already prepared. Do you want to prepare it again?',
								),
								() => {
									// User confirmed - show options dialog
									show_preparation_dialog(frm);
								},
								() => {
									// User cancelled - do nothing
									frappe.show_alert({
										message: __('Preparation cancelled'),
										indicator: 'orange',
									});
								},
							);
						} else {
							// Server is only verified, not prepared yet - show options directly
							show_preparation_dialog(frm);
						}
					})
					.addClass('btn-primary');
			} else {
				// Not verified yet → show Verify button
				frm
					.add_custom_button(__('Verify Server'), () => {
						frm.set_value('verify_status', 'Verifying');
						frappe.call({
							method: 'nano_press.utils.ansible_runner.ping_server',
							args: { host: frm.doc.server_ip },
							callback: (r) => {
								if (r?.message) {
									if (r.message.status === 'success') {
										frappe.show_alert({
											message: __('Server verified'),
											indicator: 'green',
										});
									} else {
										frm.set_value('verify_status', 'Failed');
										frappe.show_alert({
											message: __('Verification failed'),
											indicator: 'red',
										});
									}
									frm.reload_doc();
								}
							},
						});
					})
					.addClass('btn-primary');
			}
		}

		// Render public key HTML & copy handler
		frappe.call({
			method: 'nano_press.nano_press.doctype.server.server.get_public_key_html',
			callback: (r) => {
				if (r?.message && frm.fields_dict.public_key) {
					frm.fields_dict.public_key.$wrapper.html(r.message);
					const btn = frm.fields_dict.public_key.$wrapper.find(
						'#copy-public-key-btn',
					);
					btn?.on('click', async () => {
						const text = frm.fields_dict.public_key.$wrapper
							.find('#server-public-key')
							.text();
						try {
							await navigator.clipboard.writeText(text);
						} catch (e) {
							const ta = document.createElement('textarea');
							ta.value = text;
							document.body.appendChild(ta);
							ta.select();
							document.execCommand('copy');
							document.body.removeChild(ta);
						}
						frappe.show_alert({
							message: __('Public key copied'),
							indicator: 'green',
						});
					});
				}
			},
		});

		// Load server metrics for the Metrics tab (only for saved docs)
		if (!frm.is_new()) {
			frm.add_custom_button(
				__('Refresh Metrics'),
				() => frm.trigger('load_metrics'),
				__('Actions'),
			);
			frm.trigger('load_metrics');
		}
	},

	load_metrics(frm) {
		if (frm.is_new() || !frm.fields_dict.metrics_html) return;

		const $wrapper = $(frm.fields_dict.metrics_html.wrapper);

		$wrapper.html(`
			<div style="padding:12px">
				<div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
					<div>
						<p class="text-muted text-center" style="margin-bottom:4px">${__('CPU %')}</p>
						<div id="np-chart-cpu"></div>
					</div>
					<div>
						<p class="text-muted text-center" style="margin-bottom:4px">${__('RAM %')}</p>
						<div id="np-chart-ram"></div>
					</div>
					<div>
						<p class="text-muted text-center" style="margin-bottom:4px">${__('Disk Usage')}</p>
						<div id="np-chart-disk"></div>
					</div>
					<div>
						<p class="text-muted text-center" style="margin-bottom:4px">${__('Disk I/O (MB since boot)')}</p>
						<div id="np-chart-io"></div>
					</div>
				</div>
				<p class="text-muted" style="margin-top:8px;font-size:11px;text-align:right">
					${__('Last updated')}: <span id="np-metrics-ts">—</span>
				</p>
			</div>
		`);

		frappe.call({
			method: 'nano_press.nano_press.doctype.server.server.get_server_metrics',
			args: { server_name: frm.doc.name },
			freeze: false,
			callback(r) {
				if (r.exc || !r.message) return;

				const d = r.message;
				const now = frappe.datetime.now_time();

				// Accumulate samples for time-series charts (capped at MAX_SAMPLES)
				_metrics_history.labels.push(now);
				_metrics_history.cpu.push(d.cpu_percent);
				_metrics_history.ram.push(d.ram_percent);
				_metrics_history.io_read.push(d.io_read_mb);
				_metrics_history.io_write.push(d.io_write_mb);

				if (_metrics_history.labels.length > MAX_SAMPLES) {
					Object.keys(_metrics_history).forEach(
						(k) => _metrics_history[k].shift(),
					);
				}

				// CPU — area line chart
				new frappe.Chart('#np-chart-cpu', {
					data: {
						labels: _metrics_history.labels,
						datasets: [
							{ name: __('CPU'), values: _metrics_history.cpu },
						],
					},
					type: 'line',
					height: 160,
					colors: ['#5e64ff'],
					axisOptions: { xIsSeries: true },
					lineOptions: { hideDots: 1, regionFill: 1 },
					tooltipOptions: { formatTooltipY: (v) => v + '%' },
				});

				// RAM — area line chart
				new frappe.Chart('#np-chart-ram', {
					data: {
						labels: _metrics_history.labels,
						datasets: [
							{ name: __('RAM'), values: _metrics_history.ram },
						],
					},
					type: 'line',
					height: 160,
					colors: ['#ff5858'],
					axisOptions: { xIsSeries: true },
					lineOptions: { hideDots: 1, regionFill: 1 },
					tooltipOptions: { formatTooltipY: (v) => v + '%' },
				});

				// Disk — donut chart
				const fmt_gb = (b) =>
					(b / 1024 / 1024 / 1024).toFixed(1) + ' GB';
				new frappe.Chart('#np-chart-disk', {
					data: {
						labels: [__('Used'), __('Free')],
						datasets: [
							{
								values: [
									d.disk_used,
									d.disk_total - d.disk_used,
								],
							},
						],
					},
					type: 'donut',
					height: 160,
					colors: ['#f97316', '#e2e8f0'],
					tooltipOptions: { formatTooltipY: (v) => fmt_gb(v) },
				});

				// I/O — mixed bar chart
				new frappe.Chart('#np-chart-io', {
					data: {
						labels: _metrics_history.labels,
						datasets: [
							{
								name: __('Read MB'),
								values: _metrics_history.io_read,
								chartType: 'bar',
							},
							{
								name: __('Write MB'),
								values: _metrics_history.io_write,
								chartType: 'bar',
							},
						],
					},
					type: 'axis-mixed',
					height: 160,
					colors: ['#22c55e', '#a855f7'],
					axisOptions: { xIsSeries: true },
				});

				$('#np-metrics-ts').text(now);
			},
		});
	},
});

// Helper function to show preparation options dialog
function show_preparation_dialog(frm) {
	const d = new frappe.ui.Dialog({
		title: __('Prepare Server'),
		fields: [
			{
				label: 'Preparation Options',
				fieldname: 'preparation_info',
				fieldtype: 'HTML',
				options: `
					<div class="alert alert-info">
						<strong>What will be installed:</strong>
						<ul>
							<li>Docker (if not already installed)</li>
							<li>Docker Compose (if not already installed)</li>
							<li>Traefik (optional - only if enabled below)</li>
						</ul>
						<small>The system will check for existing installations and skip them.</small>
					</div>
				`,
			},
			{
				label: 'Include Traefik',
				fieldname: 'include_traefik',
				fieldtype: 'Check',
				description: 'Also deploy Traefik reverse proxy with SSL support',
				default: 0,
				onchange: () => {
					// Show/hide Traefik fields based on checkbox
					const include = d.get_value('include_traefik');
					d.get_field('traefik_section').df.hidden = !include;
					d.refresh();
				},
			},
			{
				fieldname: 'traefik_section',
				fieldtype: 'Section Break',
				label: 'Traefik Configuration',
				hidden: 1,
			},
			{
				label: 'Domain',
				fieldname: 'traefik_domain',
				fieldtype: 'Data',
				reqd: 0,
				default: frm.doc.traefik_domain || '',
				description: 'Domain for Traefik dashboard (e.g., traefik.example.com)',
			},
			{
				label: 'Email',
				fieldname: 'traefik_email',
				fieldtype: 'Data',
				reqd: 0,
				default: frm.doc.traefik_email || '',
				description: "Email for Let's Encrypt SSL certificates",
			},
			{
				fieldname: 'col_break_1',
				fieldtype: 'Column Break',
			},
			{
				label: 'Username',
				fieldname: 'traefik_username',
				fieldtype: 'Data',
				reqd: 0,
				default: frm.doc.traefik_username || 'admin',
				description: 'Username for Traefik dashboard',
			},
			{
				label: 'Password',
				fieldname: 'traefik_password',
				fieldtype: 'Password',
				reqd: 0,
				default: frm.doc.traefik_password || '',
				description: 'Password for Traefik dashboard',
			},
		],
		primary_action_label: 'Prepare Server',
		primary_action(values) {
			// Validate Traefik fields if Traefik is enabled
			if (values.include_traefik) {
				if (
					!values.traefik_domain ||
					!values.traefik_email ||
					!values.traefik_username ||
					!values.traefik_password
				) {
					frappe.msgprint({
						title: __('Missing Information'),
						indicator: 'orange',
						message: __(
							'Please fill in all Traefik fields: Domain, Email, Username, and Password',
						),
					});
					return;
				}

				// Save Traefik fields to the form
				frm.set_value('traefik_domain', values.traefik_domain);
				frm.set_value('traefik_email', values.traefik_email);
				frm.set_value('traefik_username', values.traefik_username);
				frm.set_value('traefik_password', values.traefik_password);
			}

			d.hide();
			frm.set_value('verify_status', 'Preparing');

			// Show progress message
			frappe.show_alert({
				message: values.include_traefik
					? __('Preparing server with Docker and Traefik...')
					: __('Preparing server with Docker...'),
				indicator: 'blue',
			});

			// Call the unified prepare_server API
			frappe.call({
				method: 'nano_press.nano_press.doctype.server.server.prepare_server',
				args: {
					server_name: frm.doc.name,
					include_traefik: values.include_traefik ? 1 : 0,
				},
				freeze: true,
				freeze_message: 'Preparing server, please wait...',
				callback: (r) => {
					console.log(r);
					if (r?.message) {
						if (r.message.status === 200) {
							let message;

							// Show detailed success message
							if (values.include_traefik && r.message.traefik_version) {
								message = `Server prepared successfully!<br>
									Docker: ${r.message.docker_version}<br>
									Compose: ${r.message.compose_version}<br>
									Traefik: ${r.message.traefik_version}<br>
									Domain: ${r.message.traefik_domain}`;
							} else {
								message = `Server prepared successfully!<br>
									Docker: ${r.message.docker_version}<br>
									Compose: ${r.message.compose_version}`;
							}

							frappe.msgprint({
								title: __('Success'),
								indicator: 'green',
								message: __(message),
							});
						} else {
							frappe.msgprint({
								title: __('Failed'),
								indicator: 'red',
								message: __('Server preparation failed'),
							});
						}
						frm.reload_doc();
					}
				},
				error: () => {
					frappe.msgprint({
						title: __('Error'),
						indicator: 'red',
						message: __(
							'Server preparation failed. Check error log for details.',
						),
					});
					frm.reload_doc();
				},
			});
		},
	});

	d.show();
}
