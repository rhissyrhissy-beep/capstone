function escapeHtml(value) {
  return String(value ?? 'Not provided').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function printableFile(url, label) {
  if (!url) return ''
  const safeUrl = escapeHtml(url)
  const content = url.split('?')[0].toLowerCase().endsWith('.pdf')
    ? `<iframe title="${escapeHtml(label)}" src="${safeUrl}"></iframe>`
    : `<img src="${safeUrl}" alt="${escapeHtml(label)}">`
  return `<section class="document"><h3>${escapeHtml(label)}</h3>${content}</section>`
}

function printablePair(title, documents) {
  const entries = documents.filter(([, url]) => url)
  if (!entries.length) return ''
  const items = entries.map(([label, url]) => {
    const safeUrl = escapeHtml(url)
    const content = url.split('?')[0].toLowerCase().endsWith('.pdf')
      ? `<iframe title="${escapeHtml(label)}" src="${safeUrl}"></iframe>`
      : `<img src="${safeUrl}" alt="${escapeHtml(label)}">`
    return `<figure class="pair-item"><h3>${escapeHtml(label)}</h3>${content}</figure>`
  }).join('')
  return `<section class="document"><h2>${escapeHtml(title)}</h2><div class="pair-grid">${items}</div></section>`
}

function openPrintWindow(title, content, printWindow) {
  printWindow ||= window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) throw new Error('Allow pop-ups for this admin site to print documents.')
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @page { size: 8.5in 13in; margin: 0.38in; }
      * { box-sizing: border-box; }
      body { color: #111; font: 12px Arial, sans-serif; line-height: 1.45; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #888; padding-bottom: 4px; }
      h3 { font-size: 13px; margin: 0 0 8px; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
      th, td { border: 1px solid #aaa; padding: 6px; text-align: left; vertical-align: top; }
      th { width: 30%; background: #f1f1f1; }
      .muted { color: #555; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 54px; }
      .signature { border-top: 1px solid #111; padding-top: 6px; }
      .agreement { font-size: 9pt; line-height: 1.2; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
      .agreement h1 { text-align: center; font-size: 15pt; margin: 0 0 9px; }
      .agreement h2 { text-align: center; font-size: 9pt; margin: 8px 0 5px; }
      .agreement p { margin: 5px 0; }
      .agreement ol { margin: 4px 0 8px; padding-left: 24px; }
      .agreement li { margin: 4px 0; }
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin: 8px 0; }
      .field { border-bottom: 1px solid #222; min-height: 24px; padding: 2px 4px; display: flex; align-items: end; gap: 6px; overflow-wrap: anywhere; }
      .field-label { color: #222; font-size: 8pt; white-space: nowrap; }
      .field-value { flex: 1; min-width: 12px; font-weight: 600; }
      .agreement-subhead { margin: 8px 0 2px; font-size: 8pt; font-weight: 700; }
      .fuel-options { display: flex; justify-content: space-between; margin: 7px 0; }
      .witnesses { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 17px; }
      .agreement-signatures { margin-top: 23px; }
      .document { page-break-before: always; break-before: page; }
      .document img, .document iframe { display: block; width: 100%; height: 245mm; object-fit: contain; border: 0; }
      .pair-grid { display: grid; grid-template-rows: 1fr 1fr; gap: 5mm; height: 255mm; }
      .pair-item { margin: 0; min-height: 0; display: flex; flex-direction: column; }
      .pair-item h3 { font-size: 10px; margin: 0 0 2mm; }
      .pair-item img, .pair-item iframe { width: 100%; height: 117mm; object-fit: contain; border: 0; }
      .inspection { page-break-before: always; break-before: page; }
      @media screen { body { max-width: 800px; margin: 32px auto; padding: 24px; } }
    </style></head><body>${content}
    <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 700));</script>
    </body></html>`)
  printWindow.document.close()
}

export function printCustomerDocuments(customer, documents, printWindow) {
  const entries = [
    ['Proof of address', 'address'], ['Proof of income', 'income'],
  ]
  const ids = printablePair('Customer IDs', [['Primary ID', documents?.primaryId], ['Second ID', documents?.secondId]])
  const extras = printablePair('Additional ID photos', [['Additional photo 1', documents?.extra1], ['Additional photo 2', documents?.extra2]])
  const files = entries.map(([label, key]) => printableFile(documents?.[key], label)).join('')
  const content = `<h1>Customer requirements</h1><p>${escapeHtml(customer.full_name)} · ${escapeHtml(customer.email)}</p>${ids}${files}${extras || (!ids && !files ? '<p>No documents were submitted.</p>' : '')}`
  openPrintWindow(`Requirements - ${customer.full_name}`, content, printWindow)
}

export function printRentalPack(pack, printWindow) {
  const { booking, customer, vehicle } = pack
  const agreementTerms = pack.agreement_terms || {}
  const primaryIsLicense = /driver.?s? license/i.test(customer.id_type || '')
  const secondaryIsLicense = /driver.?s? license/i.test(customer.second_id_type || '')
  const licenseNumber = primaryIsLicense ? customer.id_number : secondaryIsLicense ? customer.second_id_number : ''
  const dateCount = Math.max(1, Math.floor((new Date(`${booking.end_date}T00:00:00`) - new Date(`${booking.start_date}T00:00:00`)) / 86400000) + 1)
  const fuelLevel = (pack.inspections || []).find((inspection) => inspection.type === 'pre_rental')?.fuel_level
  const fuelOptions = [['F', 'Full'], ['3/4', '3/4'], ['1/2', '1/2'], ['1/4', '1/4'], ['E', 'Empty']]
    .map(([label, value]) => `<span>${fuelLevel === value ? '(X)' : '( )'} ${label}</span>`).join('')
  const field = (label, value) => `<div class="field"><span class="field-label">${escapeHtml(label)}:</span><span class="field-value">${escapeHtml(value ?? '')}</span></div>`
  const now = new Date()
  const day = now.getDate()
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th')
  const agreementDate = `${day}${suffix} day of ${now.toLocaleString('en', { month: 'long' })}, ${now.getFullYear()}`
  const agreement = `<article class="agreement">
    <h1>${escapeHtml(agreementTerms.title || 'RENTAL AGREEMENT')}</h1>
    <p><strong>${escapeHtml(agreementTerms.preamble || '')}</strong></p>
    <p>This AGREEMENT is entered into by and between <strong>${escapeHtml(customer.full_name)}</strong>, a resident of <strong>${escapeHtml(customer.address)}</strong> and holder of Driver's license no. <strong>${escapeHtml(licenseNumber || '')}</strong>, hereunder called the RENTER, and PARDZ CAR RENTAL, represented by ______________________________, hereunder called the LESSOR.</p>
    <h2>${escapeHtml(agreementTerms.witnesseth || 'WITNESSETH:')}</h2>
    <p>${escapeHtml(agreementTerms.vehicle_details_intro || '')}</p>
    <div class="form-grid">
      ${field('Make / Model', `${vehicle.year} ${vehicle.make} ${vehicle.model}`)}
      ${field('Plate No.', vehicle.plate_number)}
      ${field('Motor No.', '')}${field('Chassis No.', '')}
      ${field('Rental Rate', `PHP ${Number(vehicle.daily_rate || 0).toLocaleString()} per day`)}
      ${field('Period of lease', `${dateCount} day(s)`)}
      ${field('Date & time release', `${booking.start_date} ${booking.pickup_time || ''}`)}
      ${field('Date & time end', `${booking.end_date} ${booking.return_time || ''}`)}
      ${field('Cell No.', customer.phone)}
      ${field('Signature', '')}
    </div>
    <div class="fuel-options"><strong>FUEL:</strong>${fuelOptions}</div>
    <p class="agreement-subhead">CUSTOMER DETAILS</p>
    <div class="form-grid">
      ${field('Primary ID', `${customer.id_type || ''} ${customer.id_number || ''}`)}
      ${field('Second ID', `${customer.second_id_type || ''} ${customer.second_id_number || ''}`)}
      ${field('Email', customer.email)}
      ${field('Age', customer.age)}
      ${field('Total rental amount', `PHP ${Number(booking.total_amount || 0).toLocaleString()}`)}
      ${field('Pickup / drop-off', booking.pickup_location || 'Self pickup')}
    </div>
    <p><strong>The Renter agrees:</strong></p>
    <ol>${(agreementTerms.renter_terms || []).map((term) => `<li>${escapeHtml(term.replace('{period}', `${booking.start_date} to ${booking.end_date} (${dateCount} day(s))`).replace('{amount}', `PHP ${Number(booking.total_amount || 0).toLocaleString()}`))}</li>`).join('')}</ol>
    <h2>${escapeHtml(agreementTerms.liability_heading || '')}</h2>
    <p>${escapeHtml(agreementTerms.liability_text || '')}</p>
    <p>IN WITNESS WHEREOF, the parties have hereunto set their hands in this Agreement in ${escapeHtml(agreementTerms.signing_location || 'Cagayan de Oro City')}, this ${escapeHtml(agreementDate)}.</p>
    <div class="signatures agreement-signatures">
      <div class="signature"><strong>${escapeHtml(customer.full_name)}</strong><br>(LESSEE / RENTER)<br><br>CTC No.: ____________________<br>Issued on: __________________<br>Issued at: ___________________</div>
      <div class="signature">______________________________<br>(LESSOR / OWNER)<br><br>CTC No.: ____________________<br>Issued on: __________________<br>Issued at: ___________________</div>
    </div>
    <div class="witnesses"><div>1.) ______________________________<br>SIGNED IN THE PRESENCE OF</div><div>2.) ______________________________</div></div>
  </article>`
  const ids = printablePair('Customer IDs', [['Primary ID', pack.documents?.['Primary ID']], ['Second ID', pack.documents?.['Second ID']]])
  const extras = printablePair('Additional ID photos', [['Additional photo 1', pack.documents?.['Additional document 1']], ['Additional photo 2', pack.documents?.['Additional document 2']]])
  const documents = [
    ids,
    printableFile(pack.documents?.['Proof of address'], 'Proof of address'),
    printableFile(pack.documents?.['Proof of income'], 'Proof of income'),
    extras,
  ].join('')
  const inspections = (pack.inspections || []).map((inspection) => {
    const checklist = Object.entries(inspection.checklist || {}).map(([label, checked]) => {
      const status = label.startsWith('Damage:')
        ? (checked ? 'Damage recorded' : 'No damage marked')
        : (checked ? 'Confirmed' : 'Not checked')
      return `<tr><td>${escapeHtml(label)}</td><td>${status}</td></tr>`
    }).join('')
    const photos = (inspection.photos || []).map((url, index) => printableFile(url, `Inspection photo ${index + 1}`)).join('')
    return `<section class="inspection"><h1>${inspection.type === 'pre_rental' ? 'Pre-rental' : 'Post-rental'} inspection checklist</h1>
      <p class="muted">Recorded ${escapeHtml(inspection.created_at)}</p><table>${checklist || '<tr><td>No checklist items recorded</td></tr>'}</table>
      <table><tr><th>Odometer</th><td>${escapeHtml(inspection.odometer_reading)} km</td></tr><tr><th>Fuel</th><td>${escapeHtml(inspection.fuel_level)}</td></tr>
      <tr><th>Damage notes</th><td>${escapeHtml(inspection.damage_notes)}</td></tr><tr><th>Damage fee</th><td>PHP ${Number(inspection.damage_fee || 0).toLocaleString()}</td></tr></table></section>${photos}`
  }).join('')
  openPrintWindow(`Rental pack - ${customer.full_name}`, `${agreement}${documents}${inspections}`, printWindow)
}