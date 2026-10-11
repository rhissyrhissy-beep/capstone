import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'

const company = {
  name: 'Pardz Car Rental',
  phone: '0917-7029-367',
  email: 'pardzcarrental@gmail.com',
  address: 'Zone 7, Kauswagan Highway, Cagayan de Oro City',
}

function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function htmlValue(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export default function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [facebookPage, setFacebookPage] = useState(() => localStorage.getItem('pardz-facebook-page') || 'Pardz Car Rental')

  async function load() {
    setLoading(true)
    try {
      setRows(await api.get('/bookings', { status: 'all', start_from: from, start_to: to, sort: 'start_desc' }))
    } catch (error) {
      console.error('Unable to load report:', error.message)
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function exportCsv(branded = false) {
    const header = ['Booking ID', 'Customer', 'Vehicle', 'Plate', 'Start date', 'Pickup time', 'End date', 'Return time', 'Service', 'Status', 'Amount', 'Late return']
    const data = rows.map((row) => [row.id, row.profiles?.full_name, `${row.vehicles?.make} ${row.vehicles?.model}`, row.vehicles?.plate_number, row.start_date, row.pickup_time, row.end_date, row.return_time, row.service_type, row.status, row.total_amount, row.late_return ? 'Yes' : 'No'])
    const reportRange = `${from || 'All dates'} to ${to || 'Present'}`
    const contentRows = branded
      ? [[company.name], [company.phone, company.email, company.address], [`Facebook: ${facebookPage || company.name}`], ['Rental transaction report'], [`Period: ${reportRange}`], [`Generated: ${new Date().toLocaleString()}`], [], header, ...data]
      : [header, ...data]
    const content = contentRows.map((line) => line.map(csvValue).join(',')).join('\n')
    download(content, 'text/csv;charset=utf-8', `pardz-rental-report${branded ? '-branded' : ''}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function openHtmlReport() {
    const reportRange = `${from || 'All dates'} to ${to || 'Present'}`
    const total = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
    const facebook = facebookPage.trim()
    const facebookHref = /^https?:\/\//i.test(facebook)
      ? `<a href="${htmlValue(facebook)}">${htmlValue(facebook)}</a>`
      : htmlValue(facebook || company.name)
    const tableRows = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlValue(row.profiles?.full_name || 'Unknown customer')}</td>
        <td>${htmlValue(`${row.vehicles?.make || ''} ${row.vehicles?.model || ''}`.trim())}<small>${htmlValue(row.vehicles?.plate_number || '')}</small></td>
        <td>${htmlValue(row.start_date)} ${htmlValue(row.pickup_time?.slice(0, 5) || '')}<small>to ${htmlValue(row.end_date)} ${htmlValue(row.return_time?.slice(0, 5) || '')}</small></td>
        <td><span class="status">${htmlValue(row.status)}</span></td>
        <td class="amount">&#8369;${Number(row.total_amount || 0).toLocaleString()}</td>
        <td>${row.late_return ? 'Yes' : 'No'}</td>
      </tr>`).join('')

    const htmlDocument = `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${company.name} | Rental transaction report</title>
          <style>
            @page { size: A4 portrait; margin: 13mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #17243a; font: 12px/1.45 Arial, sans-serif; background: #eef2f7; }
            .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 12px max(calc((100vw - 190mm) / 2), 16px); background: #102f61; }
            .toolbar button { border: 0; border-radius: 5px; padding: 10px 16px; color: white; background: #1765a8; font-weight: 700; cursor: pointer; }
            .sheet { width: 190mm; min-height: 267mm; margin: 22px auto; padding: 14mm; background: white; box-shadow: 0 8px 30px #17243a20; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid #1765a8; padding-bottom: 14px; }
            .brand-name { color: #103766; font-size: 23px; font-weight: 800; letter-spacing: 1.2px; }
            .brand-caption { margin-top: 2px; color: #61748b; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
            .document-label { color: #1765a8; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-align: right; text-transform: uppercase; }
            .contacts { display: flex; flex-wrap: wrap; gap: 4px 18px; padding: 11px 0 14px; color: #46566b; font-size: 10px; }
            .contacts a { color: inherit; text-decoration: none; }
            h1 { margin: 16px 0 4px; color: #152c4a; font-size: 20px; }
            .period { margin: 0; color: #61748b; }
            .summary { display: flex; gap: 28px; margin: 18px 0; padding: 12px 14px; border-left: 3px solid #1765a8; background: #f2f6fa; }
            .summary strong { display: block; margin-top: 2px; color: #142b48; font-size: 15px; }
            .summary span { color: #61748b; font-size: 9px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            thead { display: table-header-group; }
            th { padding: 8px 6px; color: white; background: #103766; text-align: left; }
            td { padding: 8px 6px; border-bottom: 1px solid #dfe6ee; vertical-align: top; }
            tbody tr:nth-child(even) { background: #f7f9fb; }
            td small { display: block; margin-top: 2px; color: #69798c; }
            .status { text-transform: capitalize; }
            .amount { white-space: nowrap; font-weight: 700; }
            .empty { padding: 25px; color: #61748b; text-align: center; }
            footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #dfe6ee; color: #718096; font-size: 9px; }
            @media print { body { background: white; } .toolbar { display: none; } .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } tr { break-inside: avoid; } }
            @media screen and (max-width: 700px) { .sheet { width: calc(100% - 24px); min-height: 0; margin: 12px; padding: 20px; } .summary { gap: 14px; } }
          </style>
        </head>
        <body>
          <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
          <main class="sheet">
            <header class="brand"><div><div class="brand-name">${company.name}</div><div class="brand-caption">You drive, we care</div></div><div class="document-label">Rental records<br>Admin report</div></header>
            <div class="contacts"><span>${company.phone}</span><span>${company.email}</span><span>${company.address}</span><span>Facebook: ${facebookHref}</span></div>
            <h1>Rental Transaction Report</h1>
            <p class="period">Reporting period: ${htmlValue(reportRange)} &nbsp;|&nbsp; Generated ${htmlValue(new Date().toLocaleString())}</p>
            <section class="summary"><div><span>Bookings</span><strong>${rows.length}</strong></div><div><span>Total booking value</span><strong>&#8369;${total.toLocaleString()}</strong></div></section>
            <table><thead><tr><th>#</th><th>Customer</th><th>Vehicle / plate</th><th>Rental dates</th><th>Status</th><th>Amount</th><th>Late</th></tr></thead>
              <tbody>${tableRows || '<tr><td class="empty" colspan="7">No records found for this period.</td></tr>'}</tbody>
            </table>
            <footer>${company.name} &bull; ${company.address}<br>Prepared in WheelSync on ${htmlValue(new Date().toLocaleDateString())}</footer>
          </main>
        </body>
      </html>`
    download(htmlDocument, 'text/html;charset=utf-8', `pardz-rental-report-${new Date().toISOString().slice(0, 10)}.html`)

    const preview = window.open('', '_blank')
    if (!preview) return
    preview.document.write(htmlDocument)
    preview.document.close()
  }

  function exportReport() {
    if (exportFormat === 'html') return openHtmlReport()
    exportCsv(exportFormat === 'branded-csv')
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h1 className="font-display text-2xl font-semibold mb-1">Reports</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Filter and export rental transaction records.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Report export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} className="px-3 py-2 text-sm">
            <option value="csv">CSV · plain</option>
            <option value="branded-csv">CSV · Pardz header</option>
            <option value="html">HTML · A4 print</option>
          </select>
          <button onClick={exportReport} disabled={!rows.length} className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Download size={16} /> {exportFormat === 'html' ? 'Open print preview' : 'Export report'}</button>
        </div>
      </div>
      <div className="card p-4 mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Facebook page details<input value={facebookPage} onChange={(event) => { setFacebookPage(event.target.value); localStorage.setItem('pardz-facebook-page', event.target.value) }} className="px-3 py-2" placeholder="Page name or URL" /></label>
        <button onClick={load} className="btn-primary px-4 py-2 text-sm">Apply filters</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="text-left" style={{ color: 'var(--text-muted)' }}><th className="py-3 px-4">Customer</th><th className="py-3 px-4">Vehicle</th><th className="py-3 px-4">Dates & times</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Amount</th><th className="py-3 px-4">Late</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} style={{ borderTop: '1px solid var(--border-soft)' }}><td className="py-3 px-4">{row.profiles?.full_name}</td><td className="py-3 px-4">{row.vehicles?.make} {row.vehicles?.model} ({row.vehicles?.plate_number})</td><td className="py-3 px-4">{row.start_date} {row.pickup_time?.slice(0, 5) || ''} → {row.end_date} {row.return_time?.slice(0, 5) || ''}</td><td className="py-3 px-4 capitalize">{row.status}</td><td className="py-3 px-4">₱{Number(row.total_amount || 0).toLocaleString()}</td><td className="py-3 px-4">{row.late_return ? 'Yes' : 'No'}</td></tr>)}</tbody>
        </table>
        {!loading && rows.length === 0 && <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No records found.</p>}
        {loading && <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      </div>
    </Layout>
  )
}
