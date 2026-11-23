import { useState } from 'react'
import { createWaterwayCleaningRequest } from '../src/services/api.js'
import { ServicePageLayout, FileUpload, ServiceSuccess } from './ServiceShared.jsx'

const EMPTY_FORM = {
  fullName: '',
  contactNumber: '',
  location: '',
  issueType: [],
  description: '',
  photo: null,
}

const WATERWAY_SERVICES = ['Canal or waterway cleaning', 'Drainage cleaning', 'Water waste or clogging']

export default function WaterwayPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  function toggleIssueType(type) {
    setForm((current) => ({
      ...current,
      issueType: current.issueType.includes(type)
        ? current.issueType.filter((item) => item !== type)
        : [...current.issueType, type],
    }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setRequest(await createWaterwayCleaningRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Waterway request could not be submitted.')
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
      title="Canal & waterway cleaning"
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Waterway cleaning ticket created"
          detail="Your public waterway location, issue details, and photo evidence have been recorded by the demo service."
          onReset={resetForm}
        />
      ) : (
        <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
          <section className="service-form-section" aria-labelledby="waterway-requester-title">
            <div className="service-section-heading">
              <span>01</span><div><h3 id="waterway-requester-title">Your details</h3></div>
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
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="waterway-issue-title">
            <div className="service-section-heading">
              <span>02</span><div><h3 id="waterway-issue-title">Location and issue</h3></div>
            </div>
            <div className="service-fields-grid">
              <div className="service-field service-field--full">
                <span id="waterway-service-label">Waterway services <i aria-hidden="true">*</i> <small>Select all that apply</small></span>
                <div className="service-choice-grid service-choice-grid--three waterway-service-options" role="group" aria-labelledby="waterway-service-label" aria-required="true">
                  {WATERWAY_SERVICES.map((type) => (
                    <label className={`service-choice-card waterway-service-option${form.issueType.includes(type) ? ' service-choice-card--selected' : ''}`} key={type}>
                      <input type="checkbox" name="issueType" value={type} checked={form.issueType.includes(type)} onChange={() => toggleIssueType(type)} />
                      <span><strong>{type}</strong></span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="service-field service-field--full">
                <span>Exact public location <i aria-hidden="true">*</i></span>
                <textarea name="location" rows={2} maxLength={160} placeholder="Canal, drainage, street, landmark, barangay" value={form.location} onChange={updateField} required />
              </label>
              <label className="service-field service-field--full">
                <span>Description of water waste or clogging <i aria-hidden="true">*</i></span>
                <textarea name="description" rows={3} maxLength={500} placeholder="Describe the blockage, buildup, or cleaning concern." value={form.description} onChange={updateField} required />
              </label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="waterway-photo-title">
            <div className="service-section-heading">
              <span>03</span><div><h3 id="waterway-photo-title">Photo evidence</h3></div>
            </div>
            <FileUpload
              id="waterway-photo"
              label="Photo of the canal or waterway"
              required
              value={form.photo}
              help="Add one JPG, PNG, or WebP image (up to 5 MB)."
              onChange={(photo) => {
                setForm((current) => ({ ...current, photo }))
                setError('')
              }}
            />
          </section>

          <p className="service-inline-note">This request is for public canals, drainage, and waterways. For immediate flooding or a safety emergency, contact your barangay directly.</p>

          {error && <p className="service-form-error" role="alert">{error}</p>}
          <div className="service-submit-row">
            <p>A trackable water-cleaning ticket is generated after submission.</p>
            <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting ticket…' : 'Submit waterway request'}</button>
          </div>
        </form>
      )}
    </ServicePageLayout>
  )
}
