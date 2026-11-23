import { useState } from 'react'
import { createRecyclablesRequest } from '../src/services/api.js'
import { ServicePageLayout, FileUpload, ServiceSuccess } from './ServiceShared.jsx'

const makeMaterial = (materialType = 'Plastic') => ({ id: `${Date.now()}-${Math.random()}`, materialType, otherMaterialType: '', volumeLiters: '' })
const EMPTY_FORM = {
  fullName: '', contactNumber: '', materials: [makeMaterial()], photos: [], pickupAddress: '',
  fulfillment: 'Pickup', preferredDate: '',
}
const MATERIAL_TYPES = ['Plastic', 'Paper', 'Cardboard', 'Glass', 'Metal', 'Aluminum', 'Electronic Waste', 'Other']

export default function RecyclablesPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  function updateMaterial(index, field, value) {
    setForm((current) => ({ ...current, materials: current.materials.map((item, i) => i === index ? { ...item, [field]: value } : item) }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setRequest(await createRecyclablesRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Recyclable materials request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, materials: [makeMaterial()] })
    setRequest(null)
    setError('')
  }

  const successDetail = request?.materials?.length
    ? `Your request for ${request.materials.map((item) => `${item.materialType === 'Other' ? item.otherMaterialType : item.materialType} (${item.volumeLiters} L)`).join(', ')} was received.`
    : 'Your recyclable materials request was received.'
  const hasAvailableMaterialType = form.materials.length < MATERIAL_TYPES.length

  return (
    <ServicePageLayout showBack={!request} title="Sell recyclable materials">
      {request ? (
        <ServiceSuccess request={request} title="Recyclables request submitted" detail={successDetail} onReset={resetForm} />
      ) : (
        <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
          <section className="service-form-section" aria-labelledby="recyclables-contact-title">
            <div className="service-section-heading"><span>01</span><div><h3 id="recyclables-contact-title">Your contact details</h3></div></div>
            <div className="service-fields-grid">
              <label className="service-field"><span>Name <small>Optional</small></span><input name="fullName" autoComplete="name" maxLength={60} placeholder="Enter your name (optional)" value={form.fullName} onChange={updateField} /></label>
              <label className="service-field"><span>Contact number <i aria-hidden="true">*</i></span><input name="contactNumber" type="tel" autoComplete="tel" maxLength={20} placeholder="+63 9XX XXX XXXX" value={form.contactNumber} onChange={updateField} required /></label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="recyclables-material-title">
            <div className="service-section-heading"><span>02</span><div><h3 id="recyclables-material-title">Material details</h3></div></div>
            {form.materials.map((material, index) => (
              <div className="service-fields-grid" key={material.id}>
                <label className="service-field"><span>Material type <i aria-hidden="true">*</i></span><select value={material.materialType} onChange={(event) => updateMaterial(index, 'materialType', event.target.value)}>{MATERIAL_TYPES.map((type) => <option key={type} disabled={form.materials.some((item, itemIndex) => itemIndex !== index && item.materialType === type)}>{type}</option>)}</select></label>
                {material.materialType === 'Other' && <label className="service-field"><span>Other material type <i aria-hidden="true">*</i></span><input maxLength={60} placeholder="Describe the material" value={material.otherMaterialType} onChange={(event) => updateMaterial(index, 'otherMaterialType', event.target.value)} required /></label>}
                <div className="material-volume-control">
                  <label className="service-field"><span>Volume (liters) <i aria-hidden="true">*</i></span><input type="number" min="0.1" max="100000" step="0.1" inputMode="decimal" placeholder="e.g. 20" value={material.volumeLiters} onChange={(event) => updateMaterial(index, 'volumeLiters', event.target.value)} required /></label>
                  {form.materials.length > 1 && <button className="material-remove-button" type="button" aria-label={`Delete ${material.materialType === 'Other' && material.otherMaterialType ? material.otherMaterialType : material.materialType} material`} title="Delete material" onClick={() => setForm((current) => current.materials.length <= 1 ? current : { ...current, materials: current.materials.filter((_, i) => i !== index) })}><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></svg></button>}
                </div>
              </div>
            ))}
            <button className="material-add-button" type="button" disabled={!hasAvailableMaterialType} onClick={() => setForm((current) => {
              const nextType = MATERIAL_TYPES.find((type) => !current.materials.some((item) => item.materialType === type))
              return nextType ? { ...current, materials: [...current.materials, makeMaterial(nextType)] } : current
            })}>+ Add another material</button>
          </section>

          <section className="service-form-section" aria-labelledby="recyclables-schedule-title">
            <div className="service-section-heading"><span>03</span><div><h3 id="recyclables-schedule-title">Pickup or drop-off</h3></div></div>
            <div className="service-choice-grid service-choice-grid--two">
              {['Pickup', 'Drop-off'].map((option) => (
                <label className={`service-choice-card${form.fulfillment === option ? ' service-choice-card--selected' : ''}`} key={option}>
                  <input type="radio" name="fulfillment" value={option} checked={form.fulfillment === option} onChange={updateField} />
                  <span><strong>{option}</strong><small>{option === 'Pickup' ? 'Collect from your address' : 'Bring materials to the receiving point'}</small></span>
                </label>
              ))}
            </div>
            {form.fulfillment === 'Pickup' && (
              <div className="service-fields-grid">
                <label className="service-field service-field--full"><span>Pickup address <i aria-hidden="true">*</i></span><textarea name="pickupAddress" autoComplete="street-address" maxLength={160} placeholder="Street, house or building number, and barangay" value={form.pickupAddress} onChange={updateField} required rows={3} /></label>
                <FileUpload id="recyclables-photos" label="Photos of recyclable materials" multiple required value={form.photos} help="Add 1–5 JPG, PNG, or WebP photos (up to 5 MB each)." onChange={(photos) => { setForm((current) => ({ ...current, photos })); setError('') }} />
              </div>
            )}
          </section>
          {error && <p className="service-form-error" role="alert">{error}</p>}
          <div className="service-submit-row"><p>Enter each recyclable material and its estimated volume.</p><button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting request…' : 'Submit recyclable request'}</button></div>
        </form>
      )}
    </ServicePageLayout>
  )
}
