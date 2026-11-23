import { useState } from 'react'
import { createTreeMaintenanceRequest } from '../src/services/api.js'
import { ServicePageLayout, FileUpload, ServiceSuccess } from './ServiceShared.jsx'

const EMPTY_FORM = {
  fullName: '',
  contactNumber: '',
  location: '',
  landClassification: 'private',
  requestType: 'pruning',
  treeType: '',
  hazardDescription: '',
  denrDocument: null,
  denrDocumentReference: '',
  photo: null,
  instructionsAccepted: false,
}

export default function TreePage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setRequest(await createTreeMaintenanceRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Tree maintenance request could not be submitted.')
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
      title="Tree cutting & pruning"
    >
      {request ? (
        <ServiceSuccess
          request={request}
          title="Tree service ticket created"
          detail="Your tree location, request details, and photo evidence have been recorded by the demo service."
          onReset={resetForm}
        />
      ) : (
        <>
          <form className="service-form-card service-form tree-form" onSubmit={handleSubmit} noValidate>

            <section className="service-form-section" aria-labelledby="tree-requester-title">
              <div className="service-section-heading">
                <span>01</span><div><h3 id="tree-requester-title">Your details</h3></div>
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

            <section className="service-form-section" aria-labelledby="tree-location-title">
              <div className="service-section-heading">
                <span>02</span><div><h3 id="tree-location-title">Tree and land details</h3></div>
              </div>
              <div className="service-fields-grid">
                <label className="service-field service-field--full">
                  <span>Exact tree location or address <i aria-hidden="true">*</i></span>
                  <textarea name="location" rows={2} maxLength={160} placeholder="Street, landmark, barangay" value={form.location} onChange={updateField} required />
                </label>
                <div className="service-fields-grid service-fields-grid--three tree-classification-row service-field--full">
                  <label className="service-field">
                    <span>Land classification <i aria-hidden="true">*</i></span>
                    <select name="landClassification" value={form.landClassification} onChange={updateField}>
                      <option value="private">Private / own land</option>
                      <option value="public">Public area</option>
                    </select>
                  </label>
                  <label className="service-field">
                    <span>Request type <i aria-hidden="true">*</i></span>
                    <select name="requestType" value={form.requestType} onChange={updateField}>
                      <option value="pruning">Tree pruning</option>
                      <option value="cutting">Tree cutting / removal</option>
                    </select>
                  </label>
                  <label className="service-field">
                    <span>Tree type <small>If known</small></span>
                    <input name="treeType" maxLength={60} value={form.treeType} onChange={updateField} />
                  </label>
                </div>
                <div className="service-fields-grid tree-document-row service-field--full">
                  <FileUpload
                    id="tree-denr-document"
                    label="DENR approval / Certificate of No Objection"
                    accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                    value={form.denrDocument}
                    help="Attach the approval document (PDF or image, up to 8 MB)."
                    onChange={(denrDocument) => {
                      setForm((current) => ({ ...current, denrDocument }))
                      setError('')
                    }}
                  />
                  <label className="service-field">
                    <span>Approval / certificate reference <small>Optional</small></span>
                    <input name="denrDocumentReference" maxLength={120} placeholder="Reference number, if available" value={form.denrDocumentReference} onChange={updateField} />
                  </label>
                </div>
                <label className="service-field service-field--full">
                  <span>Hazard or pruning details <i aria-hidden="true">*</i></span>
                  <textarea name="hazardDescription" rows={3} maxLength={500} placeholder="For example: overhanging branches, close to power lines, risk of falling, or blocking a road." value={form.hazardDescription} onChange={updateField} required />
                </label>
              </div>
            </section>

            <section className="service-form-section" aria-labelledby="tree-photo-title">
              <div className="service-section-heading">
                <span>03</span><div><h3 id="tree-photo-title">Photo evidence</h3></div>
              </div>
              <FileUpload
                id="tree-photo"
                label="Photo of the tree"
                required
                value={form.photo}
                help="Add one JPG, PNG, or WebP image (up to 5 MB)."
                onChange={(photo) => {
                  setForm((current) => ({ ...current, photo }))
                  setError('')
                }}
              />
            </section>

            <section className="service-guidance-card" aria-labelledby="tree-guidance-title" role="note">
              <span className="guidance-mark" aria-hidden="true">!</span>
              <div>
                <h2 id="tree-guidance-title">Before you submit</h2>
                <p>Cutting a tree on private or your own land may need DENR approval or a Certificate of No Objection. Check the requirements first and attach the document if you have it.</p>
                <label className="service-acknowledgement">
                  <input type="checkbox" name="instructionsAccepted" checked={form.instructionsAccepted} onChange={updateField} required />
                  <span>I have read the tree service instructions and will provide DENR approval or a Certificate of No Objection when required. <i className="service-required-mark" aria-hidden="true">*</i></span>
                </label>
              </div>
            </section>

            {error && <p className="service-form-error" role="alert">{error}</p>}
            <div className="service-submit-row">
              <p>After validation, you'll receive a ticket reference and status.</p>
              <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting ticket…' : 'Submit tree request'}</button>
            </div>
          </form>
        </>
      )}
    </ServicePageLayout>
  )
}
