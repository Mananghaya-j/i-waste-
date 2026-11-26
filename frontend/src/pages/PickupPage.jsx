import { useState } from 'react'
import { createPickupRequest } from '../services/api.js'
import ServicePageLayout, { FileUpload, ServiceSuccess } from '../layouts/ServicePageLayout.jsx'

const EMPTY_FORM = {
  fullName: '',
  contactNumber: '',
  address: '',
  requestCategory: 'normal',
  specialWasteType: '',
  otherWaste: '',
  oilQuantityLiters: '',
  description: '',
  photo: null,
}

const WASTE_CATEGORIES = [
  { value: 'normal', label: 'Normal Waste', detail: 'Regular household waste' },
  { value: 'special', label: 'Special Waste', detail: 'Bulky or construction items' },
  { value: 'oil', label: 'Cooking Oil', detail: 'Used cooking oil collection' },
]

const SPECIAL_WASTE_TYPES = [
  'Construction debris',
  'Woods',
  'Old furnitures and home fixtures',
  'Old Appliances and home Gadgets',
  'Metal or iron scraps',
  'Glasses',
  'Others',
]

export default function PickupPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

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
      setRequest(await createPickupRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Pickup request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setRequest(null)
    setError('')
  }

  return (
    <ServicePageLayout
      module="MODULE 3"
      title="Waste & cooking oil pickup"
      description="Tell us what needs collecting and where. Choose one request category and include a photo so the right collection team can be assigned."
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Pickup request submitted"
          detail={`Your request is routed for ${request.truckDispatchGroup}. Your pickup details and photo proof have been received.`}
          onReset={resetForm}
        />
      ) : (
        <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
          <div className="service-form-heading">
            <div>
              <p className="service-overline">ONE REQUEST · ONE PAGE</p>
              <h2>Pickup request details</h2>
            </div>
            <span className="required-note"><i>*</i> Required fields</span>
          </div>

          <section className="service-form-section" aria-labelledby="pickup-requester-title">
            <div className="service-section-heading">
              <span>01</span>
              <div><h3 id="pickup-requester-title">Your details</h3><p>Leave your name blank if you prefer; a contact number is required for follow-up.</p></div>
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
              <label className="service-field service-field--full">
                <span>Exact pickup address, street, and barangay <i>Required</i></span>
                <textarea name="address" autoComplete="street-address" rows={2} maxLength={160} placeholder="House / unit, street, barangay" value={form.address} onChange={updateField} required />
              </label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="pickup-category-title">
            <div className="service-section-heading">
              <span>02</span>
              <div><h3 id="pickup-category-title">What do you need collected?</h3><p>Select one request category.</p></div>
            </div>
            <div className="service-choice-grid service-choice-grid--three">
              {WASTE_CATEGORIES.map((category) => (
                <label className={`service-choice-card${form.requestCategory === category.value ? ' service-choice-card--selected' : ''}`} key={category.value}>
                  <input
                    type="radio"
                    name="requestCategory"
                    value={category.value}
                    checked={form.requestCategory === category.value}
                    onChange={updateField}
                  />
                  <span><strong>{category.label}</strong><small>{category.detail}</small></span>
                </label>
              ))}
            </div>

            {form.requestCategory === 'special' && (
              <div className="service-fields-grid service-dependent-fields">
                <label className="service-field">
                  <span>Special waste type <i>Required</i></span>
                  <select name="specialWasteType" value={form.specialWasteType} onChange={updateField} required>
                    <option value="">Choose a type</option>
                    {SPECIAL_WASTE_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                {form.specialWasteType === 'Others' && (
                  <label className="service-field">
                    <span>Specify the waste <i>Required</i></span>
                    <input name="otherWaste" maxLength={120} value={form.otherWaste} onChange={updateField} required />
                  </label>
                )}
              </div>
            )}

            {form.requestCategory === 'oil' && (
              <label className="service-field service-field--quantity service-dependent-fields">
                <span>Estimated cooking oil quantity (liters) <i>optional</i></span>
                <input name="oilQuantityLiters" type="number" min="0.1" max="1000" step="0.1" inputMode="decimal" placeholder="e.g. 2.5" value={form.oilQuantityLiters} onChange={updateField} required />
                <small>Pour used oil into a closed, leak-proof container before collection.</small>
              </label>
            )}
          </section>

          <section className="service-form-section" aria-labelledby="pickup-proof-title">
            <div className="service-section-heading">
              <span>03</span>
              <div><h3 id="pickup-proof-title">Description & photo proof</h3><p>Help the team prepare for your request.</p></div>
            </div>
            <label className="service-field service-field--full">
              <span>Additional description or notes <small>Optional</small></span>
              <textarea name="description" rows={3} maxLength={500} placeholder="Add helpful details about the items or collection access." value={form.description} onChange={updateField} />
            </label>
            <FileUpload
              id="pickup-photo"
              label="Photo proof of waste or cooking oil"
              required
              value={form.photo}
              help="Add one clear JPG, PNG, or WebP image (up to 5 MB)."
              onChange={(photo) => {
                setForm((current) => ({ ...current, photo }))
                setError('')
              }}
            />
          </section>

          {error && <p className="service-form-error" role="alert">{error}</p>}
          <div className="service-submit-row">
            <p>Your reference number and status are shown after submission.</p>
            <button className="service-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Submitting request…' : 'Submit pickup request'}
            </button>
          </div>
        </form>
      )}
    </ServicePageLayout>
  )
}
