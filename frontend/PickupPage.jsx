import { useState } from 'react'
import { createPickupRequest } from '../src/services/api.js'
import { ServicePageLayout, FileUpload, ServiceSuccess } from './ServiceShared.jsx'

const EMPTY_FORM = {
  fullName: '',
  contactNumber: '',
  address: '',
  requestCategory: 'normal',
  specialWasteType: [],
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

  function toggleSpecialWasteType(type) {
    setForm((current) => {
      const selected = current.specialWasteType.includes(type)
        ? current.specialWasteType.filter((item) => item !== type)
        : [...current.specialWasteType, type]
      return { ...current, specialWasteType: selected, otherWaste: selected.includes('Others') ? current.otherWaste : '' }
    })
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
      showBack={!request}
      title="Waste & cooking oil pickup"
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Pickup request submitted"
          detail={`Your request is routed for ${request.truckDispatchGroup}. The demo service received your pickup details and photo proof.`}
          onReset={resetForm}
        />
      ) : (
        <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
          <section className="service-form-section" aria-labelledby="pickup-requester-title">
            <div className="service-section-heading">
              <span>01</span>
              <div><h3 id="pickup-requester-title">Your details</h3></div>
            </div>
            <div className="service-fields-grid">
              <label className="service-field">
                <span>Name <small>Optional</small></span>
                <input name="fullName" autoComplete="name" maxLength={60} placeholder="Enter your name (optional)" value={form.fullName} onChange={updateField} />
              </label>
              <label className="service-field">
                <span>Contact number <i aria-hidden="true">*</i></span>
                <input name="contactNumber" type="tel" autoComplete="tel" maxLength={20} placeholder="+63 9XX XXX XXXX" value={form.contactNumber} onChange={updateField} required />
              </label>
              <label className="service-field service-field--full">
                <span>Exact pickup address, street, and barangay <i aria-hidden="true">*</i></span>
                <textarea name="address" autoComplete="street-address" rows={2} maxLength={160} placeholder="House / unit, street, barangay" value={form.address} onChange={updateField} required />
              </label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="pickup-category-title">
            <div className="service-section-heading">
              <span>02</span>
              <div><h3 id="pickup-category-title">What do you need collected?</h3></div>
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
                <div className="service-field service-field--full special-waste-picker">
                  <span>Special waste types <i aria-hidden="true">*</i> <small>Select all that apply</small></span>
                  <div className="special-waste-options">
                    {SPECIAL_WASTE_TYPES.filter((type) => type !== 'Others').map((type) => (
                      <label className={`special-waste-option${form.specialWasteType.includes(type) ? ' special-waste-option--selected' : ''}`} key={type}>
                        <input
                          type="checkbox"
                          name="specialWasteType"
                          value={type}
                          checked={form.specialWasteType.includes(type)}
                          onChange={() => toggleSpecialWasteType(type)}
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                  <div className="special-waste-others-row">
                    <label className={`special-waste-option${form.specialWasteType.includes('Others') ? ' special-waste-option--selected' : ''}`}>
                      <input
                        type="checkbox"
                        name="specialWasteType"
                        value="Others"
                        checked={form.specialWasteType.includes('Others')}
                        onChange={() => toggleSpecialWasteType('Others')}
                      />
                      <span>Others</span>
                    </label>
                    {form.specialWasteType.includes('Others') && (
                      <label className="service-field special-waste-other-field">
                        <span>Specify the waste <i aria-hidden="true">*</i></span>
                        <input name="otherWaste" maxLength={120} placeholder="Describe the other waste type" value={form.otherWaste} onChange={updateField} required />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {form.requestCategory === 'oil' && (
              <label className="service-field service-field--quantity service-dependent-fields">
                <span>Estimated cooking oil quantity (liters) <i aria-hidden="true">*</i></span>
                <input name="oilQuantityLiters" type="number" min="0.1" max="1000" step="0.1" inputMode="decimal" placeholder="e.g. 2.5" value={form.oilQuantityLiters} onChange={updateField} required />
                <small>Pour used oil into a closed, leak-proof container before collection.</small>
              </label>
            )}
          </section>

          <section className="service-form-section" aria-labelledby="pickup-proof-title">
            <div className="service-section-heading">
              <span>03</span>
              <div><h3 id="pickup-proof-title">Description & photo proof</h3></div>
            </div>
            <label className="service-field service-field--full">
              <span>Additional description or notes <small>Optional</small></span>
              <textarea name="description" rows={3} maxLength={500} placeholder={form.requestCategory === 'oil' ? 'Describe the used oil container or collection access details.' : form.requestCategory === 'special' ? 'Describe the special waste or collection access details.' : 'Describe the household waste or collection access details.'} value={form.description} onChange={updateField} />
            </label>
            <FileUpload
              id="pickup-photo"
              label={form.requestCategory === 'oil' ? 'Photo proof of used cooking oil' : form.requestCategory === 'special' ? 'Photo proof of special waste' : 'Photo proof of household waste'}
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
