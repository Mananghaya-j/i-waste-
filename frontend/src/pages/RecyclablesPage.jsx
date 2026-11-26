import { useState } from 'react'
import { createRecyclablesRequest, estimateRecyclables } from '../services/api.js'
import ServicePageLayout, { FileUpload, ServiceSuccess } from '../layouts/ServicePageLayout.jsx'

const EMPTY_FORM = {
  fullName: '',
  contactNumber: '',
  materialType: 'Plastic',
  estimatedWeight: '',
  photos: [],
  pickupAddress: '',
  fulfillment: 'Pickup',
  preferredDate: new Date().toLocaleDateString('en-CA'),
}

const MATERIAL_TYPES = ['Plastic', 'Paper', 'Cardboard', 'Glass', 'Metal', 'Aluminum', 'Electronic Waste']

function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function RecyclablesPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)
  const estimate = estimateRecyclables(form)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
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
    setForm(EMPTY_FORM)
    setRequest(null)
    setError('')
  }

  const successDetail = request?.estimate
    ? `Your ${request.materialType.toLowerCase()} request was received. The demo estimate is ${formatPeso(request.estimate.estimatedValue)} for about ${request.estimate.estimatedVolumeLiters} liters.`
    : 'Your recyclable materials request was received. Add an estimated weight next time to see a demo valuation.'

  return (
    <ServicePageLayout
      module="MODULE 5"
      title="Sell recyclable materials"
      description="Tell us what sorted materials you have, add photos, and choose pickup or drop-off. You’ll receive a reference and an indicative estimate."
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Recyclables request submitted"
          detail={successDetail}
          onReset={resetForm}
        />
      ) : (
        <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
          <div className="service-form-heading">
            <div><p className="service-overline">RECYCLABLE MATERIALS</p><h2>Arrange a sale or collection</h2></div>
            <span className="required-note"><i>*</i> Required fields</span>
          </div>

          <section className="service-form-section" aria-labelledby="recyclables-contact-title">
            <div className="service-section-heading">
              <span>01</span><div><h3 id="recyclables-contact-title">Your contact details</h3><p>Leave your name blank if you prefer; a contact number is required for follow-up.</p></div>
            </div>
            <div className="service-fields-grid">
              <label className="service-field">
                <span>Name <small>Optional</small></span>
                <input name="fullName" autoComplete="name" maxLength={60} placeholder="Leave blank if preferred" value={form.fullName} onChange={updateField} />
              </label>
              <label className="service-field">
                <span>Contact number <i>Required</i></span>
                <input name="contactNumber" type="tel" autoComplete="tel" maxLength={20} placeholder="+63 9XX XXX XXXX" value={form.contactNumber} onChange={updateField} required />
              </label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="recyclables-material-title">
            <div className="service-section-heading">
              <span>02</span><div><h3 id="recyclables-material-title">Material details</h3><p>Choose the closest material category and estimate its weight if you can.</p></div>
            </div>
            <div className="service-fields-grid">
              <label className="service-field">
                <span>Material type <i>Required</i></span>
                <select name="materialType" value={form.materialType} onChange={updateField}>
                  {MATERIAL_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="service-field">
                <span>Estimated weight (kg) <small>Optional</small></span>
                <input name="estimatedWeight" type="number" min="0.1" max="10000" step="0.1" inputMode="decimal" placeholder="e.g. 5" value={form.estimatedWeight} onChange={updateField} />
              </label>
              <FileUpload
                id="recyclables-photos"
                label="Photos of recyclable materials"
                multiple
                required
                value={form.photos}
                help="Add 1–5 JPG, PNG, or WebP photos (up to 5 MB each)."
                onChange={(photos) => {
                  setForm((current) => ({ ...current, photos }))
                  setError('')
                }}
              />
            </div>
            <aside className="recyclables-estimate" aria-live="polite">
              <span className="estimate-leaf" aria-hidden="true">♻</span>
              <div>
                <strong>Estimated volume & value</strong>
                {estimate ? (
                  <p>{estimate.estimatedVolumeLiters} L <span>·</span> {formatPeso(estimate.estimatedValue)} <small>demo estimate</small></p>
                ) : (
                  <p>Add an estimated weight to calculate an indicative amount.</p>
                )}
              </div>
              <small>Indicative only; final valuation is confirmed by the receiving junkshop.</small>
            </aside>
          </section>

          <section className="service-form-section" aria-labelledby="recyclables-schedule-title">
            <div className="service-section-heading">
              <span>03</span><div><h3 id="recyclables-schedule-title">Pickup or drop-off</h3><p>Choose how and when you’d like to hand over the materials.</p></div>
            </div>
            <div className="service-choice-grid service-choice-grid--two">
              {['Pickup', 'Drop-off'].map((option) => (
                <label className={`service-choice-card${form.fulfillment === option ? ' service-choice-card--selected' : ''}`} key={option}>
                  <input type="radio" name="fulfillment" value={option} checked={form.fulfillment === option} onChange={updateField} />
                  <span><strong>{option}</strong><small>{option === 'Pickup' ? 'Collect from your address' : 'Bring materials to the receiving point'}</small></span>
                </label>
              ))}
            </div>
            <div className="service-fields-grid">
              <label className="service-field">
                <span>Pickup address <i>Required</i></span>
                <textarea name="pickupAddress" rows={2} maxLength={160} value={form.pickupAddress} onChange={updateField} required placeholder="Street, landmark, barangay" />
              </label>
              <label className="service-field">
                <span>Preferred date <i>Required</i></span>
                <input name="preferredDate" type="date" min={new Date().toLocaleDateString('en-CA')} value={form.preferredDate} onChange={updateField} required />
              </label>
            </div>
          </section>

          {error && <p className="service-form-error" role="alert">{error}</p>}
          <div className="service-submit-row">
            <p>Submitting creates a request reference; the demo estimate is not a guaranteed offer.</p>
            <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting request…' : 'Submit recyclable request'}</button>
          </div>
        </form>
      )}
    </ServicePageLayout>
  )
}
