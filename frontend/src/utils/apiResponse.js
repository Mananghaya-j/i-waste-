export function listData(response, resourceName) {
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.data)) return response.data.data
  throw new Error(`The server returned an invalid ${resourceName} list.`)
}

export function paginatedData(response, resourceName) {
  if (Array.isArray(response?.data)) return response
  if (Array.isArray(response?.data?.data)) {
    return {
      data: response.data.data,
      pagination: response.data.pagination || response.pagination,
    }
  }
  throw new Error(`The server returned an invalid ${resourceName} list.`)
}
