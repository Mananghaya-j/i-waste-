const SEARCH_CHARACTERS = /^[\p{L}\p{N}\s,.'-]+$/u
const NAME_CHARACTERS = /^[\p{L}\s.'-]+$/u
const ADDRESS_CHARACTERS = /^[\p{L}\p{N}\s,.'#/-]+$/u
const DESCRIPTION_CHARACTERS = /^[\p{L}\p{N}\s,.'#()/:&!?+-]+$/u
const SQL_KEYWORDS = /\b(select|insert|update|delete|drop|alter|union|truncate|exec|execute)\b/i
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf']
const SPECIAL_WASTE_TYPES = [
  'Construction debris',
  'Woods',
  'Old furnitures and home fixtures',
  'Old Appliances and home Gadgets',
  'Metal or iron scraps',
  'Glasses',
  'Others',
]
const RECYCLABLE_TYPES = ['Plastic', 'Paper', 'Cardboard', 'Glass', 'Metal', 'Aluminum', 'Electronic Waste']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || (code >= 127 && code <= 159)
  })
}

function isSafeText(value, pattern, maxLength) {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    pattern.test(value) &&
    !hasControlCharacters(value) &&
    !/[<>;=\\%]/.test(value) &&
    !SQL_KEYWORDS.test(value)
  )
}

function invalid(field, error) {
  return { valid: false, field, error }
}

function isValidOptionalName(value) {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string' || value.length > 60 || hasControlCharacters(value)) return false
  const name = value.trim()
  return !name || (name.length >= 2 && isSafeText(name, NAME_CHARACTERS, 60))
}

function isValidContactNumber(value) {
  if (typeof value !== 'string' || value.length > 20 || hasControlCharacters(value) ||
    !/^\+?[\d\s().-]+$/.test(value.trim())) return false
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function isValidOptionalText(value, pattern, maxLength) {
  return typeof value === 'string' && value.length <= maxLength && !hasControlCharacters(value) &&
    (!value.trim() || isSafeText(value.trim(), pattern, maxLength))
}

function isValidImage(file) {
  return Boolean(
    file &&
    typeof file.name === 'string' &&
    file.name.length > 0 &&
    file.name.length <= 120 &&
    !hasControlCharacters(file.name) &&
    IMAGE_TYPES.includes(file.type) &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size <= MAX_IMAGE_SIZE
  )
}

function isValidOptionalDocument(file) {
  return !file || Boolean(
    typeof file.name === 'string' &&
    file.name.length > 0 &&
    file.name.length <= 120 &&
    !hasControlCharacters(file.name) &&
    DOCUMENT_TYPES.includes(file.type) &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size <= MAX_DOCUMENT_SIZE
  )
}

function isTodayOrFutureDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exactDate =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10))
  return exactDate && date >= today
}

export function validateSearchQuery(value) {
  if (typeof value !== 'string') return { valid: false, error: 'Enter a text search.' }
  const query = value.trim()
  if (query.length > 64) return { valid: false, error: 'Search must be 64 characters or fewer.' }
  if (query && !isSafeText(query, SEARCH_CHARACTERS, 64)) {
    return { valid: false, error: 'Use letters, numbers, spaces, commas, periods, apostrophes, or hyphens.' }
  }
  return { valid: true, value: query }
}

export function validateModule3PickupRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('form', 'Enter pickup details to continue.')
  }

  const {
    fullName = '',
    contactNumber,
    address,
    requestCategory,
    specialWasteType = '',
    otherWaste = '',
    oilQuantityLiters = '',
    description = '',
    photo,
  } = input
  if (!isValidOptionalName(fullName)) return invalid('fullName', 'Enter a valid name or leave it blank to submit anonymously.')
  if (!isValidContactNumber(contactNumber)) return invalid('contactNumber', 'Enter a valid contact number with 7–15 digits.')
  if (typeof address !== 'string' || hasControlCharacters(address) ||
    address.trim().length < 4 || !isSafeText(address.trim(), ADDRESS_CHARACTERS, 160)) {
    return invalid('address', 'Enter the exact pickup address, street, and barangay (4–160 characters).')
  }
  if (!['normal', 'special', 'oil'].includes(requestCategory)) {
    return invalid('requestCategory', 'Choose Normal Waste, Special Waste, or Cooking Oil Collection.')
  }
  if (requestCategory === 'special' && !SPECIAL_WASTE_TYPES.includes(specialWasteType)) {
    return invalid('specialWasteType', 'Choose a special waste type.')
  }
  if (requestCategory === 'special' && specialWasteType === 'Others' &&
    (typeof otherWaste !== 'string' || hasControlCharacters(otherWaste) || otherWaste.trim().length < 2 ||
      !isSafeText(otherWaste.trim(), DESCRIPTION_CHARACTERS, 120))) {
    return invalid('otherWaste', 'Describe the other waste type (2–120 characters).')
  }
  if (requestCategory === 'oil') {
    if (typeof oilQuantityLiters !== 'string' && typeof oilQuantityLiters !== 'number') {
      return invalid('oilQuantityLiters', 'Enter the estimated cooking oil quantity in liters.')
    }
    const quantity = Number(oilQuantityLiters)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
      return invalid('oilQuantityLiters', 'Enter the estimated cooking oil quantity in liters (greater than 0 and up to 1,000).')
    }
  }
  if (!isValidOptionalText(description, DESCRIPTION_CHARACTERS, 500)) {
    return invalid('description', 'Use up to 500 characters of plain text for your notes.')
  }
  if (!isValidImage(photo)) return invalid('photo', 'Add one JPG, PNG, or WebP photo up to 5 MB.')

  return {
    valid: true,
    value: {
      fullName: typeof fullName === 'string' ? fullName.trim() || null : null,
      contactNumber: contactNumber.trim(),
      address: address.trim(),
      requestCategory,
      specialWasteType: requestCategory === 'special' ? specialWasteType : '',
      otherWaste: requestCategory === 'special' && specialWasteType === 'Others' ? otherWaste.trim() : '',
      oilQuantityLiters: requestCategory === 'oil' ? Number(oilQuantityLiters) : null,
      description: description.trim(),
      photo,
    },
  }
}

export function validateTreeMaintenanceRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('form', 'Enter the tree request details to continue.')
  }
  const {
    fullName = '',
    contactNumber,
    location,
    landClassification,
    requestType,
    treeType = '',
    hazardDescription,
    denrDocument = null,
    denrDocumentReference = '',
    photo,
    instructionsAccepted,
  } = input
  if (!isValidOptionalName(fullName)) return invalid('fullName', 'Enter a valid name or leave it blank to submit anonymously.')
  if (!isValidContactNumber(contactNumber)) return invalid('contactNumber', 'Enter a valid contact number with 7–15 digits.')
  if (typeof location !== 'string' || hasControlCharacters(location) ||
    location.trim().length < 4 || !isSafeText(location.trim(), ADDRESS_CHARACTERS, 160)) {
    return invalid('location', 'Enter the exact tree location or address (4–160 characters).')
  }
  if (!['private', 'public'].includes(landClassification)) return invalid('landClassification', 'Choose the land classification.')
  if (!['cutting', 'pruning'].includes(requestType)) return invalid('requestType', 'Choose cutting or pruning.')
  if (!isValidOptionalText(treeType, DESCRIPTION_CHARACTERS, 60)) return invalid('treeType', 'Use up to 60 characters for the tree type.')
  if (!isValidOptionalText(denrDocumentReference, DESCRIPTION_CHARACTERS, 120)) {
    return invalid('denrDocumentReference', 'Use up to 120 characters for the DENR approval reference.')
  }
  if (typeof hazardDescription !== 'string' || hasControlCharacters(hazardDescription) || hazardDescription.trim().length < 8 ||
    !isSafeText(hazardDescription.trim(), DESCRIPTION_CHARACTERS, 500)) {
    return invalid('hazardDescription', 'Describe the tree hazard (8–500 characters).')
  }
  if (!isValidOptionalDocument(denrDocument)) {
    return invalid('denrDocument', 'Use a PDF, JPG, PNG, or WebP document up to 8 MB.')
  }
  if (!isValidImage(photo)) return invalid('photo', 'Add one JPG, PNG, or WebP tree photo up to 5 MB.')
  if (instructionsAccepted !== true) return invalid('instructionsAccepted', 'Confirm that you have read the tree service instructions.')

  return {
    valid: true,
    value: {
      fullName: typeof fullName === 'string' ? fullName.trim() || null : null,
      contactNumber: contactNumber.trim(),
      location: location.trim(),
      landClassification,
      requestType,
      treeType: treeType.trim(),
      hazardDescription: hazardDescription.trim(),
      denrDocumentReference: denrDocumentReference.trim(),
      denrDocument,
      photo,
      instructionsAccepted,
    },
  }
}

export function validateWaterwayCleaningRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('form', 'Enter the waterway request details to continue.')
  }
  const { fullName = '', contactNumber, location, issueType, description, photo } = input
  if (!isValidOptionalName(fullName)) return invalid('fullName', 'Enter a valid name or leave it blank to submit anonymously.')
  if (!isValidContactNumber(contactNumber)) return invalid('contactNumber', 'Enter a valid contact number with 7–15 digits.')
  if (typeof location !== 'string' || hasControlCharacters(location) ||
    location.trim().length < 4 || !isSafeText(location.trim(), ADDRESS_CHARACTERS, 160)) {
    return invalid('location', 'Enter the exact public canal, drainage, or waterway location.')
  }
  if (!['Canal or waterway cleaning', 'Drainage cleaning', 'Water waste or clogging'].includes(issueType)) {
    return invalid('issueType', 'Choose a waterway service type.')
  }
  if (typeof description !== 'string' || hasControlCharacters(description) || description.trim().length < 8 ||
    !isSafeText(description.trim(), DESCRIPTION_CHARACTERS, 500)) {
    return invalid('description', 'Describe the water waste or clogging issue (8–500 characters).')
  }
  if (!isValidImage(photo)) return invalid('photo', 'Add one JPG, PNG, or WebP waterway photo up to 5 MB.')

  return {
    valid: true,
    value: {
      fullName: typeof fullName === 'string' ? fullName.trim() || null : null,
      contactNumber: contactNumber.trim(),
      location: location.trim(),
      issueType,
      description: description.trim(),
      photo,
    },
  }
}

export function validateRecyclablesRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('form', 'Enter recyclable material details to continue.')
  }
  const {
    fullName = '',
    contactNumber,
    materialType,
    estimatedWeight = '',
    photos,
    pickupAddress,
    fulfillment,
    preferredDate,
  } = input
  if (!isValidOptionalName(fullName)) return invalid('fullName', 'Enter a valid name or leave it blank to submit anonymously.')
  if (!isValidContactNumber(contactNumber)) return invalid('contactNumber', 'Enter a valid contact number with 7–15 digits.')
  if (!RECYCLABLE_TYPES.includes(materialType)) return invalid('materialType', 'Choose one of the listed recyclable materials.')
  let weight = null
  if (estimatedWeight !== '') {
    if (typeof estimatedWeight !== 'string' && typeof estimatedWeight !== 'number') {
      return invalid('estimatedWeight', 'Enter the estimated material weight in kilograms.')
    }
    weight = Number(estimatedWeight)
    if (!Number.isFinite(weight) || weight <= 0 || weight > 10000) {
      return invalid('estimatedWeight', 'Enter a weight greater than 0 and no more than 10,000 kg.')
    }
  }
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 5 || photos.some((photo) => !isValidImage(photo))) {
    return invalid('photos', 'Add 1–5 JPG, PNG, or WebP photos, up to 5 MB each.')
  }
  if (typeof pickupAddress !== 'string' || hasControlCharacters(pickupAddress) || pickupAddress.trim().length < 4 ||
    !isSafeText(pickupAddress.trim(), ADDRESS_CHARACTERS, 160)) {
    return invalid('pickupAddress', 'Enter the pickup address (4–160 characters).')
  }
  if (!['Pickup', 'Drop-off'].includes(fulfillment)) return invalid('fulfillment', 'Choose pickup or drop-off.')
  if (!isTodayOrFutureDate(preferredDate)) return invalid('preferredDate', 'Choose today or a future date.')

  return {
    valid: true,
    value: {
      fullName: typeof fullName === 'string' ? fullName.trim() || null : null,
      contactNumber: contactNumber.trim(),
      materialType,
      estimatedWeight: weight,
      photos,
      pickupAddress: pickupAddress.trim(),
      fulfillment,
      preferredDate,
    },
  }
}
