import { useState } from 'react'
import ServicePageLayout, { FileUpload, ServiceSuccess } from '../layouts/ServicePageLayout.jsx'
import { createEnvironmentalReport } from '../services/api.js'

const EMPTY_FORM = {
  anonymous: false,
  fullName: '',
  contactNumber: '',
  email: '',
  type: 'ILLEGAL_DUMPING',
  location: '',
  description: '',
  photo: null,
}

const REPORT_TYPES = [
  ['ILLEGAL_DUMPING', 'Illegal waste dumping'],
  ['MISSED_COLLECTION', 'Missed garbage collection'],
]

export default function EnvironmentalReportsPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.anonymous && !form.contactNumber.trim() && !form.email.trim()) {
      setError('Provide a phone number or email, or choose anonymous submission.')
      return
    }
    if (!form.photo) {
      setError('Add photo evidence before submitting this report.')
      return
    }

    setSubmitting(true)
    try {
      setRequest(await createEnvironmentalReport(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Environmental report could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setForm(EMPTY_FORM)
    setRequest(null)
    setError('')
  }

  return (
    <ServicePageLayout
      module="COMPLAINTS & ENVIRONMENTAL REPORTS"
      title="Report an environmental concern"
      description="Report illegal dumping or a missed garbage collection. Your report receives a reference number for status tracking."
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Environmental report submitted"
          detail="Your report and photo evidence have been saved. An administrator will review and assign an investigator."
          onReset={reset}
        />
      ) : (
        <form className="service-form-card service-form" onSubmit={submit} noValidate>
          <div className="service-form-heading">
            <div><p className="service-overline">COMPLAINTS &amp; ENVIRONMENTAL REPORTS</p><h2>Tell us what happened</h2></div>
            <span className="required-note"><i>*</i> Required fields</span>
          </div>

          <section className="service-form-section" aria-labelledby="environmental-type-title">
            <div className="service-section-heading">
              <span>01</span><div><h3 id="environmental-type-title">Report type and location</h3><p>Choose the concern and provide its exact location.</p></div>
            </div>
            <div className="service-fields-grid">
              <label className="service-field">
                <span>Report type <i>Required</i></span>
                <select name="type" value={form.type} onChange={updateField}>
                  {REPORT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="service-field service-field--full">
                <span>Incident location <i>Required</i></span>
                <textarea name="location" rows={2} maxLength={300} value={form.location} onChange={updateField} required placeholder="Street, landmark, barangay" />
              </label>
              <label className="service-field service-field--full">
                <span>Description <i>Required</i></span>
                <textarea name="description" rows={4} maxLength={1500} value={form.description} onChange={updateField} required placeholder="Describe the dumping or missed collection, including when it occurred." />
              </label>
            </div>
          </section>

          <section className="service-form-section" aria-labelledby="environmental-contact-title">
            <div className="service-section-heading">
              <span>02</span><div><h3 id="environmental-contact-title">Contact information</h3><p>Contact details are optional if you submit anonymously.</p></div>
            </div>
            <label className="service-acknowledgement">
              <input type="checkbox" name="anonymous" checked={form.anonymous} onChange={updateField} />
              <span>Submit anonymously</span>
            </label>
            {!form.anonymous && (
              <div className="service-fields-grid">
                <label className="service-field">
                  <span>Name <small>Optional</small></span>
                  <input name="fullName" autoComplete="name" maxLength={120} value={form.fullName} onChange={updateField} />
                </label>
                <label className="service-field">
                  <span>Contact number <small>Phone or email required</small></span>
                  <input name="contactNumber" type="tel" autoComplete="tel" maxLength={24} value={form.contactNumber} onChange={updateField} />
                </label>
                <label className="service-field">
                  <span>Email <small>Phone or email required</small></span>
                  <input name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={updateField} />
                </label>
              </div>
            )}
          </section>

          <section className="service-form-section" aria-labelledby="environmental-photo-title">
            <div className="service-section-heading">
              <span>03</span><div><h3 id="environmental-photo-title">Photo evidence</h3><p>Attach an image that helps document the concern.</p></div>
            </div>
            <FileUpload
              id="environmental-photo"
              label="Photo evidence"
              required
              value={form.photo}
              help="Add one JPG, PNG, or WebP image (up to 5 MB)."
              onChange={(photo) => {
                setForm((current) => ({ ...current, photo }))
                setError('')
              }}
            />
          </section>

          {error && <p className="service-form-error" role="alert">{error}</p>}
          <div className="service-submit-row">
            <p>A reference number is generated after the report is saved.</p>
            <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting report…' : 'Submit environmental report'}</button>
          </div>
        </form>
      )}
    </ServicePageLayout>
  )
}
